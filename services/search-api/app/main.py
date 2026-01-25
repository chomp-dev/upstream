"""
FastAPI application for Search MVP.
Provides endpoints for nearby restaurant search with caching.
"""

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from .cache import close_cache, generate_cache_key, get_cache
from .db import (
    check_db_connection,
    get_db_session,
    get_restaurants_by_place_ids,
    upsert_restaurants,
)
from .google_places import get_places_client, parse_google_place
from .models import (
    HealthResponse,
    NearbySearchRequest,
    NearbySearchResponse,
    RestaurantResponse,
)
from .settings import get_settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()

APP_VERSION = "chomp-search-api-dev-2026-01-08"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    logger.info("Starting Search MVP API...")
    
    # Startup: cleanup expired cache
    cache = get_cache()
    deleted = await cache.cleanup_expired()
    if deleted:
        logger.info(f"Cleaned up {deleted} expired cache entries")
    
    logger.info(f"Cache backend: {settings.cache_backend}")
    
    yield
    
    # Shutdown: close connections
    await close_cache()
    client = get_places_client()
    await client.close()
    logger.info("Search MVP API shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Search MVP API",
    description="Restaurant discovery API powered by Google Places",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for mobile/web clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    Ensure we always log unhandled exceptions and return JSON instead of a plain-text 500.
    (This makes debugging mobile errors dramatically faster.)
    """
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "error_type": type(exc).__name__,
        },
    )


@app.get("/__debug/version", tags=["Debug"])
async def debug_version():
    # Surface runtime schema info so we can confirm we're running the latest code.
    field = NearbySearchRequest.model_fields.get("max_results")
    le = None
    ge = None
    default = None
    if field is not None:
        default = field.default
        for m in getattr(field, "metadata", []) or []:
            if hasattr(m, "le"):
                le = m.le
            if hasattr(m, "ge"):
                ge = m.ge
    return {"version": APP_VERSION, "max_results": {"default": default, "ge": ge, "le": le}}


# =============================================================================
# Health Check
# =============================================================================

@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check(session: AsyncSession = Depends(get_db_session)):
    """Health check endpoint for monitoring."""
    db_ok = await check_db_connection(session)
    
    return HealthResponse(
        status="healthy" if db_ok else "degraded",
        database="connected" if db_ok else "disconnected",
        timestamp=datetime.now(timezone.utc),
    )


# =============================================================================
# Nearby Search Endpoints
# =============================================================================

from fastapi import Header

@app.post("/api/v1/nearby", response_model=NearbySearchResponse, tags=["Search"])
async def search_nearby_restaurants(
    request: NearbySearchRequest,
    session: AsyncSession = Depends(get_db_session),
    x_skip_cache: str | None = Header(default=None, alias="X-Skip-Cache"),
):
    """
    Search for nearby restaurants.
    
    This endpoint:
    1. Checks cache for recent identical queries
    2. If cache miss, calls Google Places API
    3. Upserts results to database (canonical storage)
    4. Caches the query for future requests
    5. Returns restaurants from database
    
    Cost optimization:
    - Cache TTL prevents duplicate API calls within 15 minutes
    - Coordinate rounding increases cache hit rate
    - Field masking minimizes Google Places billing
    """
    cache = get_cache()
    skip_cache = x_skip_cache == "true"
    
    # Generate cache key
    cache_key = generate_cache_key(
        request.location.lat,
        request.location.lng,
        request.radius,
        request.included_types or [],
    )
    
    # Check cache first (unless skip_cache is requested)
    if not skip_cache:
        cached_place_ids = await cache.get(cache_key)
        
        if cached_place_ids is not None:
            logger.info(f"Cache hit for {cache_key}")
            restaurants = await get_restaurants_by_place_ids(session, cached_place_ids)
            
            return NearbySearchResponse(
                restaurants=[RestaurantResponse.model_validate(r) for r in restaurants],
                count=len(restaurants),
                cached=True,
                cache_key=cache_key,
            )
    
    # Cache miss or skip_cache - call Google Places API
    logger.info(f"{'Skipping cache' if skip_cache else 'Cache miss'} for {cache_key}, calling Google Places API")
    
    try:
        places_client = get_places_client()
        places, places_meta = await places_client.search_nearby(
            lat=request.location.lat,
            lng=request.location.lng,
            radius=request.radius,
            included_types=request.included_types,
            max_results=request.max_results,
        )
    except Exception as e:
        logger.error(f"Google Places API error: {e}")
        raise HTTPException(
            status_code=503,
            detail="Restaurant search temporarily unavailable",
        )
    
    if not places:
        return NearbySearchResponse(
            restaurants=[],
            count=0,
            cached=False,
            cache_key=cache_key,
            requests_made=places_meta.get("requests_made") if "places_meta" in locals() else None,
            max_requests=places_meta.get("max_requests") if "places_meta" in locals() else None,
            raw_places=places_meta.get("raw_places") if "places_meta" in locals() else None,
            unique_places=places_meta.get("unique_places") if "places_meta" in locals() else None,
            truncated=places_meta.get("truncated") if "places_meta" in locals() else None,
        )
    
    # Parse and upsert restaurants
    try:
        restaurants_data = [parse_google_place(p) for p in places]
        logger.info(f"Parsed {len(restaurants_data)} restaurants from Google Places")
        
        restaurants = await upsert_restaurants(session, restaurants_data)
        logger.info(f"Upserted {len(restaurants)} restaurants to database")
        
        # Cache the place IDs
        place_ids = [r.google_place_id for r in restaurants]
        await cache.set(cache_key, place_ids, settings.nearby_cache_ttl_seconds)
        
        return NearbySearchResponse(
            restaurants=[RestaurantResponse.model_validate(r) for r in restaurants],
            count=len(restaurants),
            cached=False,
            cache_key=cache_key,
            requests_made=places_meta.get("requests_made"),
            max_requests=places_meta.get("max_requests"),
            raw_places=places_meta.get("raw_places"),
            unique_places=places_meta.get("unique_places"),
            truncated=places_meta.get("truncated"),
        )
    except Exception as e:
        logger.error(f"Database/upsert error: {type(e).__name__}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process search results: {type(e).__name__}",
        )


@app.get("/api/v1/nearby", response_model=NearbySearchResponse, tags=["Search"])
async def search_nearby_get(
    lat: float = Query(..., ge=-90, le=90, description="Latitude"),
    lng: float = Query(..., ge=-180, le=180, description="Longitude"),
    radius: int = Query(default=1500, ge=100, le=50000, description="Radius in meters"),
    max_results: int = Query(default=300, ge=1, le=300, description="Max results"),
    session: AsyncSession = Depends(get_db_session),
):
    """
    GET endpoint for nearby search (convenience for testing).
    Uses default restaurant type filter.
    """
    request = NearbySearchRequest(
        location={"lat": lat, "lng": lng},
        radius=radius,
        max_results=max_results,
    )
    return await search_nearby_restaurants(request, session)


# =============================================================================
# Restaurant Details
# =============================================================================

@app.get("/api/v1/restaurants/{place_id}", response_model=RestaurantResponse, tags=["Restaurants"])
async def get_restaurant_by_place_id(
    place_id: str,
    session: AsyncSession = Depends(get_db_session),
):
    """
    Get a single restaurant by Google Place ID.
    Returns cached data from database.
    """
    restaurants = await get_restaurants_by_place_ids(session, [place_id])
    
    if not restaurants:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    return RestaurantResponse.model_validate(restaurants[0])


# =============================================================================
# Admin / Maintenance
# =============================================================================

@app.post("/api/v1/admin/cleanup-cache", tags=["Admin"])
async def admin_cleanup_cache():
    """
    Manually trigger cache cleanup.
    Removes expired cache entries.
    """
    cache = get_cache()
    deleted = await cache.cleanup_expired()
    return {"deleted_entries": deleted}


@app.post("/api/v1/admin/clear-all-cache", tags=["Admin"])
async def admin_clear_all_cache(session: AsyncSession = Depends(get_db_session)):
    """
    Clear ALL cache entries.
    Use when search parameters/types have changed.
    """
    from sqlalchemy import text
    
    try:
        result = await session.execute(text("DELETE FROM nearby_query_cache"))
        await session.commit()
        deleted = result.rowcount
        logger.info(f"Cleared all {deleted} cache entries")
        return {"deleted_entries": deleted, "message": "All cache cleared"}
    except Exception as e:
        logger.error(f"Failed to clear cache: {e}")
        return {"deleted_entries": 0, "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
