"""
Pydantic models for request/response validation and SQLAlchemy ORM models.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Integer,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PGUUID
from sqlalchemy.orm import declarative_base

Base = declarative_base()


# =============================================================================
# SQLAlchemy ORM Models
# =============================================================================

class Restaurant(Base):
    """Restaurant entity stored in Supabase Postgres."""
    
    __tablename__ = "restaurants"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    google_place_id = Column(Text, nullable=False, unique=True, index=True)
    
    name = Column(Text)
    formatted_address = Column(Text)
    lat = Column(Float)
    lng = Column(Float)
    
    primary_type = Column(Text)
    types = Column(ARRAY(Text))
    
    rating = Column(Float)
    user_rating_count = Column(Integer)
    price_level = Column(SmallInteger)
    
    phone = Column(Text)
    website = Column(Text)
    
    provider_payload = Column(JSONB)
    
    last_fetched_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class NearbyQueryCache(Base):
    """Cache for nearby search queries to reduce Google API costs."""
    
    __tablename__ = "nearby_query_cache"
    
    cache_key = Column(Text, primary_key=True)
    restaurant_place_ids = Column(ARRAY(Text), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# =============================================================================
# Pydantic Request/Response Models
# =============================================================================

class LocationInput(BaseModel):
    """User location input for nearby search."""
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lng: float = Field(..., ge=-180, le=180, description="Longitude")


class NearbySearchRequest(BaseModel):
    """Request body for nearby restaurant search."""
    location: LocationInput
    radius: int = Field(default=1500, ge=100, le=50000, description="Search radius in meters")
    # 10 Google calls max * 20 results per call = 200 (deduped by place ID).
    # 15 Google calls max * 20 results per call = 300 (deduped by place ID).
    max_results: int = Field(default=300, ge=1, le=300, description="Maximum results to return")
    included_types: Optional[list[str]] = Field(
        default=None,
        description="Place types to include (e.g., restaurant, cafe, bar). If None, uses all food types."
    )


class RestaurantResponse(BaseModel):
    """Restaurant data returned to clients."""
    
    id: UUID
    google_place_id: str
    name: Optional[str] = None
    formatted_address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    primary_type: Optional[str] = None
    types: Optional[list[str]] = None
    rating: Optional[float] = None
    user_rating_count: Optional[int] = None
    price_level: Optional[int] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    last_fetched_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class NearbySearchResponse(BaseModel):
    """Response for nearby search endpoint."""
    
    restaurants: list[RestaurantResponse]
    count: int
    cached: bool = False
    cache_key: Optional[str] = None
    # Extra diagnostics for UX + debugging
    requests_made: Optional[int] = None
    max_requests: Optional[int] = None
    raw_places: Optional[int] = None
    unique_places: Optional[int] = None
    truncated: Optional[bool] = None


class HealthResponse(BaseModel):
    """Health check response."""
    
    status: str = "healthy"
    database: str = "connected"
    timestamp: datetime

