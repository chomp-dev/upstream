"""
Cache module with pluggable backends.

Usage:
    from app.cache import get_cache, generate_cache_key
    
    cache = get_cache()
    key = generate_cache_key(lat, lng, radius, types)
    
    # Get from cache
    result = await cache.get(key)
    
    # Set with TTL
    await cache.set(key, place_ids, ttl_seconds=900)
"""

from typing import Optional

from .base import CacheBackend, generate_cache_key
from .postgres import PostgresCache
from .redis import RedisCache

__all__ = [
    "CacheBackend",
    "PostgresCache", 
    "RedisCache",
    "get_cache",
    "generate_cache_key",
]

# Singleton cache instance
_cache_instance: Optional[CacheBackend] = None


def get_cache() -> CacheBackend:
    """
    Get the configured cache backend.
    Uses CACHE_BACKEND env var: "postgres" (default) or "redis"
    """
    global _cache_instance
    
    if _cache_instance is None:
        from ..settings import get_settings
        settings = get_settings()
        
        if settings.cache_backend == "redis":
            if not settings.redis_url:
                raise ValueError("REDIS_URL required when CACHE_BACKEND=redis")
            _cache_instance = RedisCache(settings.redis_url)
        else:
            # Default to Postgres
            from ..db import async_session_maker
            _cache_instance = PostgresCache(async_session_maker)
    
    return _cache_instance


async def close_cache() -> None:
    """Close cache connections on shutdown."""
    global _cache_instance
    if _cache_instance:
        await _cache_instance.close()
        _cache_instance = None

