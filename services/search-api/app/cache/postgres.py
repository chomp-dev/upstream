"""
Postgres-backed cache implementation.
Uses the nearby_query_cache table in Supabase.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ..models import NearbyQueryCache
from .base import CacheBackend


class PostgresCache(CacheBackend):
    """
    Cache implementation using Postgres table.
    Good for MVP - no additional infrastructure needed.
    """
    
    def __init__(self, session_maker: async_sessionmaker[AsyncSession]):
        self._session_maker = session_maker
    
    async def get(self, key: str) -> Optional[list[str]]:
        """Get cached place IDs, returns None if miss or expired."""
        async with self._session_maker() as session:
            now = datetime.now(timezone.utc)
            stmt = select(NearbyQueryCache).where(
                NearbyQueryCache.cache_key == key,
                NearbyQueryCache.expires_at > now,
            )
            result = await session.execute(stmt)
            entry = result.scalar_one_or_none()
            
            if entry:
                return entry.restaurant_place_ids
            return None
    
    async def set(self, key: str, place_ids: list[str], ttl_seconds: int) -> None:
        """Store place IDs with expiration."""
        async with self._session_maker() as session:
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
            
            stmt = insert(NearbyQueryCache).values(
                cache_key=key,
                restaurant_place_ids=place_ids,
                expires_at=expires_at,
            ).on_conflict_do_update(
                index_elements=["cache_key"],
                set_={
                    "restaurant_place_ids": place_ids,
                    "expires_at": expires_at,
                },
            )
            
            await session.execute(stmt)
            await session.commit()
    
    async def delete(self, key: str) -> bool:
        """Delete a cache entry."""
        async with self._session_maker() as session:
            stmt = delete(NearbyQueryCache).where(NearbyQueryCache.cache_key == key)
            result = await session.execute(stmt)
            await session.commit()
            return result.rowcount > 0
    
    async def cleanup_expired(self) -> int:
        """Remove all expired cache entries."""
        async with self._session_maker() as session:
            now = datetime.now(timezone.utc)
            stmt = delete(NearbyQueryCache).where(NearbyQueryCache.expires_at <= now)
            result = await session.execute(stmt)
            await session.commit()
            return result.rowcount
    
    async def close(self) -> None:
        """No cleanup needed for Postgres cache."""
        pass

