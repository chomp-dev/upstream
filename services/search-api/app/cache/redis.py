"""
Redis-backed cache implementation.
Use this for higher scale deployments.

Requires: pip install redis
"""

import json
import logging
from typing import Optional

from .base import CacheBackend

logger = logging.getLogger(__name__)


class RedisCache(CacheBackend):
    """
    Cache implementation using Redis.
    Better performance and native TTL support.
    
    Recommended Redis providers:
    - Upstash (serverless, free tier available)
    - Redis Cloud
    - AWS ElastiCache
    """
    
    def __init__(self, redis_url: str):
        self._redis_url = redis_url
        self._client = None
    
    async def _get_client(self):
        """Lazy initialize Redis client."""
        if self._client is None:
            try:
                import redis.asyncio as redis
            except ImportError:
                raise ImportError(
                    "Redis package not installed. Run: pip install redis"
                )
            
            self._client = redis.from_url(
                self._redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
        return self._client
    
    async def get(self, key: str) -> Optional[list[str]]:
        """Get cached place IDs, returns None if miss."""
        try:
            client = await self._get_client()
            data = await client.get(key)
            
            if data:
                return json.loads(data)
            return None
            
        except Exception as e:
            logger.warning(f"Redis GET error: {e}")
            return None
    
    async def set(self, key: str, place_ids: list[str], ttl_seconds: int) -> None:
        """Store place IDs with automatic expiration."""
        try:
            client = await self._get_client()
            await client.setex(
                key,
                ttl_seconds,
                json.dumps(place_ids),
            )
        except Exception as e:
            logger.warning(f"Redis SET error: {e}")
    
    async def delete(self, key: str) -> bool:
        """Delete a cache entry."""
        try:
            client = await self._get_client()
            result = await client.delete(key)
            return result > 0
        except Exception as e:
            logger.warning(f"Redis DELETE error: {e}")
            return False
    
    async def cleanup_expired(self) -> int:
        """
        Redis handles TTL automatically, no cleanup needed.
        Returns 0 for compatibility.
        """
        return 0
    
    async def close(self) -> None:
        """Close Redis connection."""
        if self._client:
            await self._client.close()
            self._client = None

