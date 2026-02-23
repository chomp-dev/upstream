# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent Workflow

All agents working in this codebase must follow the three-phase protocol defined in `AGENTS.md` before writing any code:

1. **Context Mining** — Read `CLAUDE.md` and `MISTAKES.md` fully. Locate and read the files the task actually touches. Understand existing patterns before introducing new ones.
2. **Planning** — Write out what files will change, what the approach is, what risks exist, and whether a utility already exists for the problem.
3. **Action** — Make minimal, focused changes. Stay consistent with surrounding patterns. Log any new mistakes to `MISTAKES.md` immediately upon discovery.

**Before starting any task:**
- Read `AGENTS.md` for the full protocol and a quick-reference table of where things live in the monorepo.
- Read `MISTAKES.md` for known pitfalls specific to this codebase — including Auth0/Supabase token coupling, video lifecycle assumptions, TypeScript path alias usage, loose coupling between services, and more.

## Project Overview

**Chomp** is a TikTok-style food discovery app. It is a monorepo with three main parts:
- `apps/mobile/` — Expo Router (React Native) mobile app
- `services/media-api/` — Express/TypeScript backend for video/image management via Cloudflare Stream
- `services/search-api/` — FastAPI/Python backend for restaurant discovery via Google Places API

## Commands

### Root (monorepo)
```bash
npm run install:all       # Install all dependencies across the monorepo
npm run mobile            # Start Expo dev server
npm run mobile:ios        # Run on iOS simulator
npm run mobile:android    # Run on Android emulator
npm run media-api         # Start Media API in dev mode
npm run search-api        # Start Search API
```

### Media API (`services/media-api/`)
```bash
npm run dev               # Start with tsx watch (hot reload)
npm run build             # Compile TypeScript to dist/
npm run type-check        # Type-check without emit
npm run migrate           # Run database migrations
```

### Search API (`services/search-api/`)
```bash
uvicorn app.main:app --reload --port 8000   # Development
pip install -r requirements.txt             # Install dependencies
```

### Mobile App (`apps/mobile/`)
```bash
npx expo start            # Start dev server
npx expo run:ios          # Build and run on iOS
npx expo run:android      # Build and run on Android
```

## Architecture

### Mobile App — `apps/mobile/`

File-based routing via Expo Router. The main tabs live in `app/(tabs)/`:
- **Watch** (`index.tsx`) — TikTok-style vertical swipe video/image feed
- **Create** (`create.tsx`) — Upload videos or images, optionally tagged to a restaurant
- **Map** (`map.tsx`) — Google Maps + list toggle for nearby restaurants
- **Explore** (`explore.tsx`) — Grid content browser with search
- **Social** (`social.tsx`) — Profile/friends UI (shell)

Key directories:
- `src/context/` — React Contexts (Auth, CommentSheet)
- `src/hooks/` — Custom hooks
- `src/lib/` — API clients, Zustand stores, utilities
- `src/theme/` — Design tokens (colors, spacing, typography)
- `src/ui/` — Shared UI component library
- `components/` — Feature-level components (Map, VideoPlayer, etc.)

TypeScript path aliases: `@/*` maps to project root, `@/components/*`, etc. (see `tsconfig.json`).

### Media API — `services/media-api/`

Express app (`src/index.ts`) with route modules in `src/routes/`. Key routes:
- `POST /api/upload/video` — Request Cloudflare Stream upload URL
- `POST /api/upload/images` — Upload image post
- `GET /api/feed` — Paginated feed (filters `status='error'` videos)
- `GET /api/restaurants/:place_id/media` — All media for a restaurant
- `POST /api/webhook` — Cloudflare Stream webhook (updates video status to `ready`/`error`)

Database: PostgreSQL with three content tables — `videos`, `image_posts`, `tiktok_embeds`. All link to restaurants via `google_place_id` (no foreign key — loose coupling by design).

### Search API — `services/search-api/`

FastAPI app (`app/main.py`). Key routes:
- `POST /api/v1/nearby` — Nearby restaurant search with 15-minute PostgreSQL cache
- `POST /api/v1/search` — Text-based restaurant search
- `GET /api/v1/restaurants/{place_id}` — Restaurant details

Caching: `nearby_query_cache` table stores serialized place_id arrays keyed by rounded lat/lng + radius. Cache misses call Google Places API (2–4s); hits return in ~100–300ms. Coordinate rounding increases cache hit rate.

### Data Flow

Mobile → Media API for content (feed, uploads, comments) and → Search API for restaurant discovery. The two backends are independent; `google_place_id` is the shared key linking media to restaurant data with no cross-database foreign keys.

## Design System

Defined in `apps/mobile/src/theme/`:
- **Background**: `#f7f6f1` (warm cream), **Surface**: `#FFFFFF`, **Text**: `#0D0B0A`
- **Primary accent**: `#eeb57e` (warm coral)
- Spacing scale: `xxs=2, xs=4, sm=8, md=12, lg=16, xl=20, xxl=24, xxxl=32, huge=48`
- Typography sizes from `xs=10` to `display=48`

## Environment Variables

**Media API** requires: `DATABASE_URL`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `FRONTEND_URL`, `PORT` (default 3000).

**Search API** requires: `DATABASE_URL` (async PostgreSQL), `GOOGLE_PLACES_API_KEY`, `CACHE_BACKEND` (`postgres` or `redis`).

**Mobile** uses Auth0 (configured in `app.json`) and Supabase (configured in `src/lib/`).

## Key Patterns

- **Video status lifecycle**: `pending` → `ready` (via Cloudflare webhook) or `error`. Only `ready` videos appear in the feed.
- **Content deletion**: When Cloudflare deletes a video, call `POST /api/feed/admin/verify-all-videos` to sync — marks missing videos as `error`.
- **No test suite** is currently configured in any package.
