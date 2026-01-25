"""
Google Places API (New) client.
Handles Nearby Search with field masking for cost optimization.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from .settings import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

# =============================================================================
# Field Masks for Cost Optimization
# =============================================================================
# Google Places (New) charges per field category requested.
# We request only the fields we actually need to minimize costs.
# See: https://developers.google.com/maps/documentation/places/web-service/usage-and-billing

# Basic fields (lower cost tier)
BASIC_FIELDS = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.types",
    "places.primaryType",
]

# Contact fields (medium cost tier)
CONTACT_FIELDS = [
    "places.nationalPhoneNumber",
    "places.websiteUri",
]

# Atmosphere fields (higher cost tier)
ATMOSPHERE_FIELDS = [
    "places.rating",
    "places.userRatingCount",
    "places.priceLevel",
]

# Combined field mask for nearby search
# Adjust based on your needs vs. cost tolerance
NEARBY_FIELD_MASK = ",".join(BASIC_FIELDS + CONTACT_FIELDS + ATMOSPHERE_FIELDS)


# =============================================================================
# Google Places Client
# =============================================================================

class GooglePlacesClient:
    """
    Async client for Google Places API (New).
    Uses the searchNearby endpoint for discovery.
    """
    
    def __init__(self):
        self.base_url = settings.google_places_base_url
        self.api_key = settings.google_places_api_key
        self._client: Optional[httpx.AsyncClient] = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=30.0,
                headers={
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": self.api_key,
                },
            )
        return self._client
    
    async def close(self):
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
    
    async def search_nearby(
        self,
        lat: float,
        lng: float,
        radius: int = 1500,
        included_types: list[str] | None = None,
        max_results: int = 300,
        field_mask: str = NEARBY_FIELD_MASK,
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        """
        Search for nearby places using Google Places Nearby Search (New).
        Makes multiple requests with different type groups to get comprehensive results.
        
        Args:
            lat: Latitude of search center
            lng: Longitude of search center
            radius: Search radius in meters (max 50000)
            included_types: Place types to include. If None, uses default food types.
            max_results: Maximum number of results (will make multiple requests if needed)
            field_mask: Fields to return (affects pricing)
        
        Returns:
            List of place dictionaries from Google Places API
            Metadata dict
        """
        import asyncio

        # Default food-related types grouped for multiple requests
        # Each group targets different cuisine/establishment types
        DEFAULT_TYPE_GROUPS = [
            ["restaurant"],
            ["american_restaurant", "hamburger_restaurant", "steak_house"],
            ["italian_restaurant", "pizza_restaurant"],
            ["mexican_restaurant", "spanish_restaurant"],
            ["chinese_restaurant", "japanese_restaurant", "sushi_restaurant"],
            ["korean_restaurant", "thai_restaurant", "vietnamese_restaurant"],
            ["indian_restaurant", "mediterranean_restaurant", "greek_restaurant"],
            ["fast_food_restaurant", "sandwich_shop", "meal_takeaway"],
            ["cafe", "coffee_shop", "bakery"],
            ["ice_cream_shop", "bar", "juice_shop"],
            # Added for better coverage (up to 300 results)
            ["vegan_restaurant", "vegetarian_restaurant"],
            ["middle_eastern_restaurant", "french_restaurant"],
            ["seafood_restaurant"],
            ["barbecue_restaurant", "ramen_restaurant"],
            ["breakfast_restaurant", "brunch_restaurant"],
        ]
        
        client = await self._get_client()
        all_places: dict[str, dict] = {}  # Dedupe by place ID
        raw_places_count = 0
        
        # If specific types provided, use them in one request
        if included_types and len(included_types) > 0:
            type_groups = [included_types[:10]]  # Limit types per request
        else:
            type_groups = DEFAULT_TYPE_GROUPS[:15]  # Limit to 15 requests max
        
        logger.info(f"Starting {len(type_groups)} parallel Google Places requests for ({lat}, {lng})")
        
        async def fetch_group(types: list[str]) -> list[dict]:
            request_body = {
                "locationRestriction": {
                    "circle": {
                        "center": {
                            "latitude": lat,
                            "longitude": lng,
                        },
                        "radius": float(radius),
                    }
                },
                "includedTypes": types,
                "maxResultCount": 20,  # API max per request
                "rankPreference": "DISTANCE",
            }
            
            try:
                response = await client.post(
                    f"{self.base_url}/places:searchNearby",
                    json=request_body,
                    headers={"X-Goog-FieldMask": field_mask},
                )
                response.raise_for_status()
                data = response.json()
                return data.get("places", [])
            except Exception as e:
                logger.error(f"Google Places request failed for types {types[:3]}: {e}")
                return []

        # Execute all requests in parallel
        results = await asyncio.gather(*[fetch_group(g) for g in type_groups])
        
        # Process results
        for places in results:
            raw_places_count += len(places)
            for place in places:
                place_id = place.get("id")
                if place_id and place_id not in all_places:
                    all_places[place_id] = place
        
        result_list = list(all_places.values())
        truncated = len(result_list) > max_results
        final_result = result_list[:max_results]
        
        logger.info(f"Google Places finished: {len(final_result)} unique results from {raw_places_count} raw items")
        
        return final_result, {
            "requests_made": len(type_groups),
            "max_requests": len(type_groups),
            "raw_places": raw_places_count,
            "unique_places": len(all_places),
            "truncated": truncated,
        }


def parse_google_place(place: dict[str, Any]) -> dict[str, Any]:
    """
    Parse Google Places API response into our restaurant schema.
    Handles the new Google Places API response format.
    """
    # Extract location
    location = place.get("location", {})
    lat = location.get("latitude")
    lng = location.get("longitude")
    
    # Extract display name (localized)
    display_name = place.get("displayName", {})
    name = display_name.get("text") if isinstance(display_name, dict) else None
    
    # Map price level enum to integer
    price_level_map = {
        "PRICE_LEVEL_FREE": 0,
        "PRICE_LEVEL_INEXPENSIVE": 1,
        "PRICE_LEVEL_MODERATE": 2,
        "PRICE_LEVEL_EXPENSIVE": 3,
        "PRICE_LEVEL_VERY_EXPENSIVE": 4,
    }
    price_level_str = place.get("priceLevel")
    price_level = price_level_map.get(price_level_str) if price_level_str else None
    
    # Build restaurant dict matching our schema
    return {
        "google_place_id": place.get("id"),
        "name": name,
        "formatted_address": place.get("formattedAddress"),
        "lat": lat,
        "lng": lng,
        "primary_type": place.get("primaryType"),
        "types": place.get("types", []),
        "rating": place.get("rating"),
        "user_rating_count": place.get("userRatingCount"),
        "price_level": price_level,
        "phone": place.get("nationalPhoneNumber"),
        "website": place.get("websiteUri"),
        "provider_payload": place,  # Store raw response for future use
        "last_fetched_at": datetime.now(timezone.utc),
    }


# Singleton client instance
_places_client: Optional[GooglePlacesClient] = None


def get_places_client() -> GooglePlacesClient:
    """Get singleton Google Places client."""
    global _places_client
    if _places_client is None:
        _places_client = GooglePlacesClient()
    return _places_client

