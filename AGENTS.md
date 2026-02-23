# AGENTS.md — Agent Operating Protocol for Chomp

This document defines the mandatory workflow for all AI agents working in this repository. Every agent must follow the three-phase protocol below before writing any code. Skipping phases leads to mistakes that compound over time — see `MISTAKES.md` for a running record of what has gone wrong and why.

---

## Phase 1 — Context Mining

Before touching a single file, build a complete picture of the area you are working in.

### 1.1 Read the foundational docs first

- Read `CLAUDE.md` in full. It describes the monorepo layout, the three services, the data flow, the design system, and key architectural decisions. Do not assume you know these things — read them every time.
- Read `MISTAKES.md` in full. Filter for entries tagged with the area you are about to work in. A mistake already recorded there is a mistake you must not repeat.

### 1.2 Locate relevant files — do not assume paths

The monorepo has three distinct packages with their own directory conventions:

- **Mobile app** lives under `apps/mobile/`. Source files are in `apps/mobile/src/`. Routed screens live in `apps/mobile/app/`. Feature components live in `apps/mobile/components/`. UI primitives live in `apps/mobile/src/ui/`. Shared state (stores) and API clients live in `apps/mobile/src/lib/`.
- **Media API** lives under `services/media-api/src/`. Route handlers are in `services/media-api/src/routes/`.
- **Search API** lives under `services/search-api/app/`.

Use Glob to find files by pattern and Grep to search for function names, component names, or type definitions before deciding where something lives. Do not guess at paths.

### 1.3 Read the files the task actually touches

Read the full content of every file you intend to modify. Also read the files that import from those files, and the files those files import from. One level of adjacency is usually sufficient to understand the call chain and avoid breaking something upstream or downstream.

### 1.4 Understand existing patterns before introducing new ones

Key patterns you must understand before coding in this repo:

**Auth pattern**
Auth0 issues tokens. The `useAuth` hook (from `apps/mobile/src/context/auth.tsx`) exposes `accessToken` and `supabase` — a Supabase client pre-injected with the Auth0 ID token as a Bearer header. RLS on Supabase tables is enforced via JWT claims from Auth0. Never use the bare `supabase` export from `apps/mobile/src/lib/supabase.ts` for operations that require the authenticated user's identity — always get the client from `useAuth().supabase`.

**API split**
The mobile app calls two independent backends. `MEDIA_API_BASE` (Media API, Express/TypeScript) handles feed, uploads, comments, and user profiles. The Search API (FastAPI/Python) handles restaurant discovery. Both base URLs are configured as `EXPO_PUBLIC_*` environment variables and loaded via `apps/mobile/src/lib/env.ts`. Do not call Search API routes from `media.ts` or vice versa.

**TypeScript path aliases**
The mobile app's `tsconfig.json` defines:
- `@/*` → `src/*`
- `@/components/*` → `components/*`
- `@/theme/*` → `src/theme/*`
- `@/ui/*` → `src/ui/*`
- `@/lib/*` → `src/lib/*`

Use these aliases in all new mobile code. Never use relative `../../` paths to reach `src/` from inside screen files under `app/`.

**Design tokens**
All colors, spacing, radius, and typography values come from `apps/mobile/src/theme/tokens.ts`, exported via `apps/mobile/src/theme/index.ts`. Import from `@/theme` or `../src/theme` depending on context. Never hardcode hex color values or magic pixel numbers in component styles.

**Shared UI vs feature components**
Generic, reusable primitives (Text, Card, Badge, Pill, Screen, Segmented, IconButton) live in `src/ui/`. Feature-specific components tied to a domain (VideoPlayer, CommentSection, Map/MapImpl, MediaOverlay, LikeButton, SaveButton) live in `components/`. When adding something new, decide which category it belongs to before creating the file.

**Store pattern**
In-memory caches backed by `AsyncStorage` are implemented as plain objects with typed async methods — see `feedStore` (`apps/mobile/src/lib/feedStore.ts`) and `mapStore` (`apps/mobile/src/lib/mapStore.ts`). These are not Zustand stores. Both stores hydrate from disk on first access. Do not introduce a new state management library without understanding what the existing stores already provide.

**`google_place_id` is the join key**
Restaurants are identified solely by `google_place_id` across all three services. The media API's PostgreSQL tables (`videos`, `image_posts`, `tiktok_embeds`) each carry a `google_place_id` column but there are no foreign key constraints linking them to any restaurant table. This loose coupling is intentional and by design. Never add cross-database foreign keys or try to enforce referential integrity across the two services.

**Video lifecycle**
A video enters the `videos` table with `status = 'pending'` at upload time. Cloudflare Stream fires a webhook to `POST /api/webhook` which transitions it to `ready` or `error`. Only `status != 'error'` videos appear in feed queries. A video deleted directly from the Cloudflare dashboard will remain in the DB as stale until `POST /api/feed/admin/verify-all-videos` is called. Background validation on feed requests also catches this asynchronously — but the first response may still include the stale row.

---

## Phase 2 — Planning

Write out a plan before writing code. It does not need to be long — three to six bullet points is enough. The plan must answer:

1. **What files will change?** List them by path.
2. **What is the approach?** Describe the logic, not the syntax.
3. **What are the risks?** Consider: cross-service impact (mobile + API), video lifecycle side effects, cache invalidation (feedStore, mapStore, or the search API's `nearby_query_cache`), Auth0/Supabase token usage, RLS policy impact, platform differences (iOS vs Android vs web).
4. **Does a utility already exist for this?** Check `src/hooks/`, `src/lib/`, `src/ui/`, and `src/context/` before building something new.
5. **Will this change break the API contract between mobile and a backend?** If you change a field name, add a required field, or remove a field from a route response, both the backend route handler and the mobile API client types (`apps/mobile/src/lib/api/types.ts`) must be updated together in the same change.

If you are uncertain about the correct approach after mining context, stop and ask. Do not guess and fix later.

---

## Phase 3 — Action

### 3.1 Make minimal, focused changes

Change only the files the task requires. Do not refactor adjacent code that is not broken. Do not reformat files you are not editing. Do not rename identifiers that work correctly.

### 3.2 Stay consistent with surrounding patterns

After writing code, re-read the file you just modified and compare your additions to the existing code around them. Ask: does the new code look like the old code? Does it use the same import style, error handling approach, logging prefix format, and TypeScript patterns? Revise until it does.

### 3.3 Verify cross-service consistency

- If you changed a backend route's response shape, verify the corresponding TypeScript interface in `apps/mobile/src/lib/api/types.ts`.
- If you changed a mobile API call, verify the backend route still matches what the client expects.
- If you changed database schema, verify a migration file exists and run `npm run migrate` from `services/media-api/`.
- If you added a new `EXPO_PUBLIC_*` env variable, document it in `CLAUDE.md` under Environment Variables.

### 3.4 Log mistakes immediately

If at any point during action you discover that your Phase 1 or Phase 2 understanding was wrong — you misread a type, assumed a file path that does not exist, broke something you did not anticipate, or used a pattern inconsistent with the codebase — stop and log the mistake to `MISTAKES.md` before continuing. Use the entry template defined in that file. This step is not optional.

---

## Mistake Tracking Summary

- Mistakes are logged in `MISTAKES.md` at the repository root.
- Every agent reads `MISTAKES.md` during Context Mining (Phase 1).
- Every agent logs new mistakes to `MISTAKES.md` during or after Action (Phase 3).
- Entries are never deleted. They form a permanent learning history for all future agents.

---

## Quick Reference: Where Things Live

| What you need | Where to find it |
|---|---|
| Tab screens | `apps/mobile/app/(tabs)/` |
| Non-tab screens | `apps/mobile/app/` (profile, restaurant, conversation, edit_profile, followers) |
| Root layout + providers | `apps/mobile/app/_layout.tsx` |
| Feature components | `apps/mobile/components/` |
| Reusable UI primitives | `apps/mobile/src/ui/` |
| Design tokens (colors, spacing, etc.) | `apps/mobile/src/theme/tokens.ts` |
| Auth context and `useAuth` hook | `apps/mobile/src/context/auth.tsx` |
| Comment sheet context | `apps/mobile/src/context/commentSheet.tsx` |
| Feed cache store | `apps/mobile/src/lib/feedStore.ts` |
| Map/restaurant cache store | `apps/mobile/src/lib/mapStore.ts` |
| App preload logic | `apps/mobile/src/lib/preloadService.ts` |
| Media API client functions | `apps/mobile/src/lib/api/media.ts` |
| Search API client functions | `apps/mobile/src/lib/api/search.ts` |
| Shared API TypeScript types | `apps/mobile/src/lib/api/types.ts` |
| Supabase client factory | `apps/mobile/src/lib/supabase.ts` |
| Env config (API base URLs) | `apps/mobile/src/lib/env.ts` |
| Media API Express app entry | `services/media-api/src/index.ts` |
| Media API route handlers | `services/media-api/src/routes/` |
| Search API FastAPI app | `services/search-api/app/main.py` |
| Known mistakes and pitfalls | `MISTAKES.md` |
