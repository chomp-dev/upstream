"""
Database connection and operations layer.
Uses SQLAlchemy async with asyncpg for Supabase Postgres.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from .models import Restaurant
from .settings import get_settings

settings = get_settings()

# Create async engine
# Note: Supabase pooler (PgBouncer) does NOT support prepared statements in transaction/statement mode.
# The safest setup is:
# - Disable asyncpg prepared statement cache
# - Disable SQLAlchemy pooling (let PgBouncer handle pooling)
engine = create_async_engine(
    settings.database_url,
    echo=False,  # Set to True for SQL debugging
    poolclass=NullPool,
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    },
)

# Session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db_session() -> AsyncSession:
    """Dependency for FastAPI to get database session."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# =============================================================================
# Restaurant Operations
# =============================================================================

async def upsert_restaurants(
    session: AsyncSession,
    restaurants_data: list[dict],
) -> list[Restaurant]:
    """
    Upsert restaurants by google_place_id.
    Returns the upserted restaurant records.
    """
    if not restaurants_data:
        return []
    
    # Use PostgreSQL INSERT ... ON CONFLICT for efficient upsert
    stmt = insert(Restaurant).values(restaurants_data)
    
    # On conflict, update all fields except id, google_place_id, created_at
    update_dict = {
        "name": stmt.excluded.name,
        "formatted_address": stmt.excluded.formatted_address,
        "lat": stmt.excluded.lat,
        "lng": stmt.excluded.lng,
        "primary_type": stmt.excluded.primary_type,
        "types": stmt.excluded.types,
        "rating": stmt.excluded.rating,
        "user_rating_count": stmt.excluded.user_rating_count,
        "price_level": stmt.excluded.price_level,
        "phone": stmt.excluded.phone,
        "website": stmt.excluded.website,
        "provider_payload": stmt.excluded.provider_payload,
        "last_fetched_at": stmt.excluded.last_fetched_at,
    }
    
    stmt = stmt.on_conflict_do_update(
        index_elements=["google_place_id"],
        set_=update_dict,
    ).returning(Restaurant)
    
    result = await session.execute(stmt)
    await session.commit()
    
    return list(result.scalars().all())


async def get_restaurants_by_place_ids(
    session: AsyncSession,
    place_ids: list[str],
) -> list[Restaurant]:
    """Fetch restaurants by their Google Place IDs."""
    if not place_ids:
        return []
    
    stmt = select(Restaurant).where(Restaurant.google_place_id.in_(place_ids))
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_stale_restaurants(
    session: AsyncSession,
    place_ids: list[str],
    max_age_days: int,
) -> list[str]:
    """
    Get place IDs that are stale (older than max_age_days) or don't exist.
    These need to be refreshed from Google Places API.
    """
    if not place_ids:
        return []
    
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    
    # Find existing fresh records
    stmt = select(Restaurant.google_place_id).where(
        Restaurant.google_place_id.in_(place_ids),
        Restaurant.last_fetched_at > cutoff,
    )
    result = await session.execute(stmt)
    fresh_ids = set(result.scalars().all())
    
    # Return IDs that aren't fresh
    return [pid for pid in place_ids if pid not in fresh_ids]


# =============================================================================
# Health Check
# =============================================================================

async def check_db_connection(session: AsyncSession) -> bool:
    """Verify database connectivity."""
    try:
        await session.execute(select(1))
        return True
    except Exception:
        return False

