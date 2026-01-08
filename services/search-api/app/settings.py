"""
Application settings and configuration.
Uses pydantic-settings for environment variable management.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )
    
    # Database
    database_url: str
    
    # Google Places API
    google_places_api_key: str
    google_places_base_url: str = "https://places.googleapis.com/v1"
    
    # Cache settings (cost optimization)
    cache_backend: str = "postgres"  # "postgres" or "redis"
    redis_url: str | None = None  # Required if cache_backend="redis"
    nearby_cache_ttl_seconds: int = 900  # 15 minutes
    details_refresh_days: int = 7  # Refresh restaurant details after 7 days
    
    # Search defaults
    default_search_radius: int = 1500  # meters
    max_search_radius: int = 50000  # 50km max
    default_max_results: int = 20
    
    @property
    def sync_database_url(self) -> str:
        """Return synchronous database URL (for migrations, etc.)."""
        return self.database_url.replace("postgresql+asyncpg://", "postgresql://")


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()

