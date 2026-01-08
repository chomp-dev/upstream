# Chomp 🍔

A TikTok-style food discovery app that combines vertical video feed with nearby restaurant search.

## Project Structure

```
chomp/
├── apps/
│   └── mobile/              # Expo Router mobile app (iOS/Android/Web)
├── services/
│   ├── media-api/           # Express/TS backend (video uploads, feed)
│   └── search-api/          # FastAPI backend (restaurant discovery)
├── packages/
│   └── shared/              # Shared TypeScript types
└── README.md
```

## Features

### 📱 Mobile App (Expo Router)
- **Watch (Home)**: TikTok-style vertical swipe feed for videos and image posts
- **Map**: Discover nearby restaurants with Map/List toggle
- **Create (+)**: Upload videos or images, optionally attach a restaurant
- **Explore**: Grid view of all content with search
- **Social**: Profile, friends, and inbox (UI shell)

### 🎬 Media API (Express/TypeScript)
- Video upload via Cloudflare Stream
- Image post storage
- Feed aggregation
- Restaurant ↔ media linking via `google_place_id`
- Media summary endpoint for restaurant post counts

### 🔍 Search API (FastAPI/Python)
- Nearby restaurant search via Google Places API (New)
- Intelligent caching to minimize API costs
- Restaurant details and metadata

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL (or Supabase)
- Cloudflare Stream account
- Google Places API key

### 1. Clone and Install

```bash
git clone <repo-url>
cd chomp

# Install mobile app dependencies
cd apps/mobile
npm install

# Install media-api dependencies
cd ../../services/media-api
npm install

# Install search-api dependencies
cd ../search-api
pip install -r requirements.txt
```

### 2. Configure Environment

**apps/mobile/.env**
```env
EXPO_PUBLIC_MEDIA_API_BASE=http://localhost:3000
EXPO_PUBLIC_SEARCH_API_BASE=http://localhost:8000
```

**services/media-api/.env**
```env
DATABASE_URL=postgresql://user:pass@host:5432/chomp
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
```

**services/search-api/.env**
```env
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/chomp
GOOGLE_PLACES_API_KEY=your_api_key
CACHE_BACKEND=postgres
```

### 3. Run Database Migrations

```bash
# For media-api (creates videos, image_posts tables)
cd services/media-api
npm run dev  # Auto-runs migrations on startup

# For search-api (creates restaurants, cache tables)
cd services/search-api
python -c "from app.db import Base, engine; import asyncio; asyncio.run(Base.metadata.create_all(engine))"
```

### 4. Start Services

```bash
# Terminal 1: Media API
cd services/media-api
npm run dev

# Terminal 2: Search API
cd services/search-api
py -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

# Terminal 3: Mobile App
cd apps/mobile
npx expo start
```

## API Endpoints

### Media API (port 3000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/feed` | Get feed items |
| POST | `/api/upload/video` | Request video upload URL |
| POST | `/api/upload/images` | Upload image post |
| POST | `/api/restaurants/media-summary` | Get post counts per restaurant |
| GET | `/api/restaurants/:place_id/media` | Get all media for a restaurant |

### Search API (port 8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/nearby` | Search nearby restaurants |
| GET | `/api/v1/nearby` | Search nearby (GET convenience) |
| GET | `/api/v1/restaurants/:place_id` | Get restaurant details |
| GET | `/health` | Health check |

## Content Moderation & Deleted Videos

### The Problem
When videos are deleted from Cloudflare Stream (for moderation/content policy), they remain in the PostgreSQL database with `status='ready'`. This causes:
- Broken videos showing in feed/explore
- Playback errors in the mobile app
- Noisy error logs

### Current Solution

**Automatic Detection (Limited):**
- Feed endpoint automatically checks videos that are:
  - NOT `status='ready'`, OR
  - Missing `playback_url`
- Videos with `status='ready'` are assumed valid and NOT re-checked
- **Result:** Deleted videos won't be caught until manually verified

**Manual Cleanup:**
```bash
# Run this to verify ALL videos and mark deleted ones as error
curl -X POST http://localhost:3000/api/feed/admin/verify-all-videos
```

This endpoint:
1. Fetches all videos from database
2. Checks each one against Cloudflare Stream API
3. Marks deleted videos (404 responses) as `status='error'`
4. Returns summary: `{ checked, markedAsError, stillValid }`

**Feed Filtering:**
- Backend: Videos with `status='error'` are excluded from feed query
- Frontend: Additional client-side filtering for safety
- Result: Deleted videos never appear in feed or explore

### Technical Details

**Error Detection Logic:**
```typescript
// services/media-api/src/services/cloudflare.ts
// Properly detects 404s and attaches statusCode to error
if (response.status === 404) {
  const error: any = new Error('Video not found (404)');
  error.statusCode = 404;
  throw error;
}
```

**Feed Query:**
```sql
-- services/media-api/src/routes/feed.ts
SELECT * FROM videos 
WHERE status != 'error'  -- Exclude deleted videos
ORDER BY created_at DESC
```

**Client-Side Safety:**
```typescript
// apps/mobile/app/(tabs)/index.tsx & explore.tsx
const validFeed = feed.filter(item => 
  item.type !== 'video' || (item.status !== 'error' && item.playback_url)
);
```

### Recommended Production Setup

**Option 1: Cron Job (Recommended)**
Set up a scheduled task to run the admin endpoint periodically:

```bash
# Add to crontab (run every hour)
0 * * * * curl -X POST https://your-domain.com/api/feed/admin/verify-all-videos

# Or use GitHub Actions, Vercel Cron, or node-cron
```

**Option 2: Node-cron (In-App)**
```typescript
// services/media-api/src/index.ts
import cron from 'node-cron';

// Run every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('[Cron] Verifying all videos...');
  // Call verify endpoint logic
});
```

**Option 3: Cloudflare Webhooks**
If Cloudflare Stream supports deletion webhooks, implement an endpoint to receive notifications and immediately mark videos as deleted.

### Future Improvements
- [ ] Set up automated cron job for video verification
- [ ] Add `last_verified_at` timestamp to videos table
- [ ] Implement video age-based re-verification (check videos older than 7 days)
- [ ] Add Cloudflare webhook support for real-time deletion detection
- [ ] Create admin dashboard for content moderation

## Database Schema

### Videos Table
```sql
CREATE TABLE videos (
  id SERIAL PRIMARY KEY,
  cloudflare_video_id VARCHAR(255) UNIQUE NOT NULL,
  playback_url TEXT,
  thumbnail_url TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  duration INTEGER,
  google_place_id TEXT,  -- Links to restaurants
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Image Posts Table
```sql
CREATE TABLE image_posts (
  id SERIAL PRIMARY KEY,
  images TEXT[] NOT NULL,
  google_place_id TEXT,  -- Links to restaurants
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Restaurants Table (Search API)
```sql
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_place_id TEXT UNIQUE NOT NULL,
  name TEXT,
  formatted_address TEXT,
  lat FLOAT,
  lng FLOAT,
  primary_type TEXT,
  types TEXT[],
  rating FLOAT,
  user_rating_count INTEGER,
  price_level SMALLINT,
  phone TEXT,
  website TEXT,
  provider_payload JSONB,
  last_fetched_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Theme System

The app uses a consistent dark theme with neon accents:

```typescript
// Core colors
bg: '#07070A'        // Darkest background
surface: '#121218'   // Card backgrounds
card: '#171720'      // Elevated surfaces
text: '#F3F4F6'      // Primary text
muted: '#A1A1AA'     // Secondary text

// Accent colors
lime: '#7CFF6B'      // Success, high ratings
blue: '#5AA7FF'      // Interactive elements
coral: '#FF6B5A'     // Price badges, alerts
purple: '#8B5CFF'    // AI/special features
```

## Architecture Decisions

1. **Two Backends**: Media and Search remain separate services for independent scaling
2. **Loose Coupling**: `google_place_id` links media to restaurants without foreign keys
3. **Expo Router**: File-based routing for the mobile app
4. **Theme Tokens**: Centralized design system for easy re-skinning
5. **Feature Folders**: Each major feature is isolated under `src/features/`

## Future Enhancements

- [ ] Native map integration (react-native-maps)
- [ ] User authentication
- [ ] Comments and likes
- [ ] Restaurant recommendations
- [ ] AI-powered content moderation
- [ ] Push notifications

## License

MIT
