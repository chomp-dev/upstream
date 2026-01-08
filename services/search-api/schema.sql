-- =============================================================================
-- Search MVP - Supabase Database Schema
-- =============================================================================
-- Run this in Supabase SQL Editor to create the required tables
-- Project: searchMVP
-- =============================================================================

-- Enable useful extensions
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- =============================================================================
-- Restaurants Table
-- =============================================================================
-- Canonical restaurant records keyed by Google Place ID.
-- Stores both structured fields and raw provider payload.

create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  google_place_id text not null unique,

  -- Basic info
  name text,
  formatted_address text,
  lat double precision,
  lng double precision,

  -- Classification
  primary_type text,
  types text[],

  -- Ratings & pricing
  rating numeric(3,2),
  user_rating_count int,
  price_level smallint,

  -- Contact
  phone text,
  website text,

  -- Raw provider data (for future field extraction)
  provider_payload jsonb,

  -- Timestamps
  last_fetched_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for common queries
create index if not exists idx_restaurants_google_place_id on restaurants (google_place_id);
create index if not exists idx_restaurants_lat_lng on restaurants (lat, lng);
create index if not exists idx_restaurants_last_fetched on restaurants (last_fetched_at);
create index if not exists idx_restaurants_rating on restaurants (rating desc nulls last);

-- =============================================================================
-- Nearby Query Cache
-- =============================================================================
-- Short-lived cache for nearby search queries.
-- Key includes: rounded lat/lng + radius + types
-- Stores list of place IDs, not full restaurant data (normalized).

create table if not exists nearby_query_cache (
  cache_key text primary key,
  restaurant_place_ids text[] not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Index for cleanup queries
create index if not exists idx_nearby_cache_expires on nearby_query_cache (expires_at);

-- =============================================================================
-- Auto-update Trigger
-- =============================================================================
-- Automatically update updated_at timestamp on row changes

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_restaurants_updated on restaurants;
create trigger trg_restaurants_updated
before update on restaurants
for each row execute function set_updated_at();

-- =============================================================================
-- Cleanup Function (optional - run periodically)
-- =============================================================================
-- Call this to remove expired cache entries
-- You can set up a pg_cron job or call from your backend

create or replace function cleanup_expired_cache()
returns integer as $$
declare
  deleted_count integer;
begin
  delete from nearby_query_cache where expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$ language plpgsql;

-- =============================================================================
-- Row Level Security (RLS) - Enable for production
-- =============================================================================
-- Uncomment and configure these for production use with Supabase Auth

-- alter table restaurants enable row level security;
-- alter table nearby_query_cache enable row level security;

-- Example: Allow authenticated users to read restaurants
-- create policy "Allow authenticated read" on restaurants
--   for select using (auth.role() = 'authenticated');

-- Example: Only allow backend (service role) to write
-- create policy "Service role write" on restaurants
--   for all using (auth.role() = 'service_role');

-- =============================================================================
-- Sample Query: Find restaurants by distance
-- =============================================================================
-- This uses the Haversine formula. For production, consider PostGIS.
-- Usage: SELECT * FROM restaurants_by_distance(40.7128, -74.0060, 2000);

create or replace function restaurants_by_distance(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters integer default 1500
)
returns table (
  id uuid,
  google_place_id text,
  name text,
  formatted_address text,
  lat double precision,
  lng double precision,
  rating numeric,
  distance_meters double precision
) as $$
begin
  return query
  select 
    r.id,
    r.google_place_id,
    r.name,
    r.formatted_address,
    r.lat,
    r.lng,
    r.rating,
    (6371000 * acos(
      cos(radians(p_lat)) * cos(radians(r.lat)) * 
      cos(radians(r.lng) - radians(p_lng)) + 
      sin(radians(p_lat)) * sin(radians(r.lat))
    )) as distance_meters
  from restaurants r
  where r.lat is not null 
    and r.lng is not null
    and (6371000 * acos(
      cos(radians(p_lat)) * cos(radians(r.lat)) * 
      cos(radians(r.lng) - radians(p_lng)) + 
      sin(radians(p_lat)) * sin(radians(r.lat))
    )) <= p_radius_meters
  order by distance_meters;
end;
$$ language plpgsql;

