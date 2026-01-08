"""
Abstract cache interface.
Implementations can use Postgres, Redis, or any other backend.
"""

from abc import ABC, abstractmethod
from typing import Optional


class CacheBackend(ABC):
    """Abstract base class for cache implementations."""
    
    @abstractmethod
    async def get(self, key: str) -> Optional[list[str]]:
        """
        Get cached place IDs by key.
        Returns None if cache miss or expired.
        """
        pass
    
    @abstractmethod
    async def set(self, key: str, place_ids: list[str], ttl_seconds: int) -> None:
        """Store place IDs with expiration."""
        pass
    
    @abstractmethod
    async def delete(self, key: str) -> bool:
        """Delete a cache entry. Returns True if deleted."""
        pass
    
    @abstractmethod
    async def cleanup_expired(self) -> int:
        """Remove expired entries. Returns count deleted."""
        pass
    
    @abstractmethod
    async def close(self) -> None:
        """Cleanup resources on shutdown."""
        pass


def generate_cache_key(lat: float, lng: float, radius: int, types: list[str]) -> str:
    """
    Generate cache key for nearby query.
    Rounds coordinates to ~100m precision to increase cache hits.
    """
    lat_rounded = round(lat, 3)
    lng_rounded = round(lng, 3)
    types_sorted = ",".join(sorted(types))
    return f"nearby:{lat_rounded}:{lng_rounded}:{radius}:{types_sorted}"

