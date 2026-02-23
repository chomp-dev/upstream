# MISTAKES.md — Codebase Mistake History

This file is a permanent, append-only log of mistakes made by agents (and humans) working in this repository. Its purpose is to prevent the same errors from happening twice.

## How to read this file

Read it during **Phase 1 (Context Mining)** before starting any task. Scan all entries, then pay close attention to entries tagged with the area of the codebase you are working in. Tags are listed at the bottom of each entry.

## How to add an entry

Add a new entry at the **bottom** of this file during or immediately after **Phase 3 (Action)**, as soon as you discover a mistake was made. Use the template below. Never edit or delete existing entries.

### Entry template

```
## [YYYY-MM-DD] — <Area> — <Short description of the mistake>
**What went wrong**: A precise description of the incorrect assumption or action taken.
**Correct approach**: What should have been done instead, with enough detail to act on.
**Files affected**: List the files that were touched or should have been touched.
**Tags**: #area #pattern-name
```

---

## Entries

---

## [2026-02-22] — Mobile/Auth — Used bare supabase export instead of useAuth().supabase for authenticated queries

**What went wrong**: A component imported `supabase` directly from `apps/mobile/src/lib/supabase.ts` and used it to query a Supabase table protected by Row Level Security. The query returned zero rows (or a permission error) because the bare client has no Auth0 JWT attached, so the RLS policy rejected it.

**Correct approach**: Always get the Supabase client from the `useAuth` hook: `const { supabase } = useAuth()`. This client is created by `createSupabaseClient(idToken)` with the Auth0 ID token injected as a Bearer header, which satisfies the RLS policy. The bare `supabase` export from `supabase.ts` exists only for truly public (unauthenticated) data access. Most tables in this app are RLS-protected.

**Files affected**: `apps/mobile/src/lib/supabase.ts`, `apps/mobile/src/context/auth.tsx`

**Tags**: #mobile #auth #supabase #rls

---

## [2026-02-22] — Mobile/Imports — Used relative paths from screen files instead of TypeScript path aliases

**What went wrong**: A new screen file under `apps/mobile/app/(tabs)/` imported a theme token using a relative path like `../../src/theme/tokens`. This worked at runtime but broke the project's established import convention and is fragile — it breaks if the file is moved.

**Correct approach**: Use the configured TypeScript path aliases defined in `apps/mobile/tsconfig.json`. For theme tokens, use `import { colors } from '@/theme'` or `import { colors, spacing } from '../src/theme'` (from `app/` level). For UI components, use `@/ui/Text`. For lib utilities, use `@/lib/feedStore`. The alias `@/*` maps to `apps/mobile/src/*`. The alias `@/components/*` maps to `apps/mobile/components/*`.

**Files affected**: `apps/mobile/tsconfig.json` (reference), any new screen or component files

**Tags**: #mobile #imports #typescript #path-aliases

---

## [2026-02-22] — Mobile/Feed — Assumed a newly uploaded video would appear in the feed immediately

**What went wrong**: After a successful upload call to `POST /api/upload/video`, the video was expected to appear in the feed. It did not. The video was in the DB with `status = 'pending'` and the feed query filters out all rows where `status != 'error'`... wait — actually the feed filters `WHERE status != 'error'`, so `pending` videos do appear. But the video had no `playback_url` yet, causing the VideoPlayer to render a broken player.

**Correct approach**: The full lifecycle is `pending` → `ready` (via Cloudflare webhook) → appears with a working playback URL. A `pending` video has no `playback_url`. After uploading, poll `GET /api/upload/video/:videoId/status` (client-side: `checkVideoUploadStatus`) or wait for the webhook to fire before redirecting the user to the feed. Do not assume `pending` videos are playable. The webhook endpoint is `POST /api/webhook` in `services/media-api/src/routes/webhook.ts`.

**Files affected**: `services/media-api/src/routes/feed.ts`, `services/media-api/src/routes/webhook.ts`, `apps/mobile/src/lib/api/media.ts`, `apps/mobile/components/VideoPlayer/index.tsx`

**Tags**: #media-api #video-lifecycle #feed #cloudflare

---

## [2026-02-22] — Media API / Search API — Attempted to add a foreign key from videos to the restaurants table across services

**What went wrong**: A migration was written that added a foreign key constraint from `videos.google_place_id` to a `restaurants` table, assuming both tables lived in the same database. They do not. The Media API and Search API use separate PostgreSQL databases. The `restaurants` table is owned by the Search API. The Media API has no access to it.

**Correct approach**: The `google_place_id` column in `videos`, `image_posts`, and `tiktok_embeds` is intentionally a plain `TEXT` column with no foreign key. The loose coupling between services is by design — it allows either service to be deployed or migrated independently. To enrich media records with restaurant names, the mobile app fetches from both APIs separately and joins in memory, or the Media API joins against its own `restaurants` table (which gets populated when the search API upserts restaurant data into a shared DB). Never enforce cross-service referential integrity at the database level.

**Files affected**: `services/media-api/src/routes/feed.ts`, any migration files under `services/media-api/`

**Tags**: #media-api #search-api #architecture #database #google-place-id

---

## [2026-02-22] — Mobile/Theme — Hardcoded color hex values in a new component instead of using design tokens

**What went wrong**: A new component used `backgroundColor: '#eeb57e'` and `color: '#0D0B0A'` directly in a `StyleSheet.create` call. The values happen to be correct (they match `colors.primary` and `colors.text`), but hardcoding them means the component won't update if the design system changes and it makes the intent of the color opaque to future readers.

**Correct approach**: Import from the theme: `import { colors, spacing } from '@/theme'` (or `from '../src/theme'`). Use `colors.primary`, `colors.text`, `colors.bg`, `spacing.md`, etc. All tokens are defined in `apps/mobile/src/theme/tokens.ts`. If a semantic token does not exist for your use case, add it there — do not hardcode values in component files.

**Files affected**: `apps/mobile/src/theme/tokens.ts`, any component under `apps/mobile/components/` or `apps/mobile/src/ui/`

**Tags**: #mobile #theme #design-system #styling

---

## [2026-02-22] — Search API — Called POST /api/v1/nearby and got a 2–4 second response, then added it to a synchronous UI flow

**What went wrong**: The nearby search endpoint calls the Google Places API on a cache miss, which takes 2–4 seconds. An agent wired this call directly into a screen's synchronous render path without loading state, freezing the UI.

**Correct approach**: The Search API's `POST /api/v1/nearby` is intentionally cached in the `nearby_query_cache` PostgreSQL table (keyed by rounded lat/lng + radius, TTL 15 minutes). Cache hits return in 100–300ms. But cache misses are slow. Always show a loading indicator when calling this endpoint. In the mobile app, the `mapStore` provides a 60-minute in-memory + AsyncStorage cache layer on top of this, so most in-app navigations hit the store before ever calling the network. Check `mapStore.getRestaurants()` before issuing a network request.

**Files affected**: `apps/mobile/src/lib/mapStore.ts`, `apps/mobile/src/lib/api/search.ts`, `apps/mobile/app/(tabs)/map.tsx`

**Tags**: #search-api #mobile #performance #caching #google-places

---

## [2026-02-22] — Mobile/Auth — Forgot to handle the login_required error from getCredentials during background token refresh

**What went wrong**: A new background task called `getCredentials()` from the Auth0 SDK without wrapping it in the `login_required` error guard. On cold app start, before the user's session is fully established, Auth0 throws an error with `error: 'login_required'`. This propagated as an unhandled rejection and crashed the background task.

**Correct approach**: Calls to `getCredentials()` must always check for `login_required` and return early gracefully. See the pattern already established in `apps/mobile/src/context/auth.tsx` — both `refreshToken` and `initSession` wrap `getCredentials` with a try/catch that checks `credError?.message?.includes('login_required') || credError?.error === 'login_required'` and returns without throwing. Copy this pattern in any new code that calls `getCredentials`.

**Files affected**: `apps/mobile/src/context/auth.tsx`

**Tags**: #mobile #auth #auth0 #error-handling

---

## [2026-02-22] — Media API — Added a new route without registering it on the Express app in index.ts

**What went wrong**: A new route file was created under `services/media-api/src/routes/` and the handler logic was written correctly, but the router was never imported and mounted in `services/media-api/src/index.ts`. The endpoint returned 404 in every environment.

**Correct approach**: After creating a new route module, open `services/media-api/src/index.ts`, import the new router, and mount it with `app.use('/api/...', newRouter)`. Check the existing mount pattern in that file for the correct base path convention. Then verify with a local `curl` or the dev server before committing.

**Files affected**: `services/media-api/src/index.ts`, `services/media-api/src/routes/` (new route file)

**Tags**: #media-api #express #routing

---

## [2026-02-22] — Mobile/Feed — Mutated feedStore memory cache directly instead of calling setFeed

**What went wrong**: Code that needed to update the feed after a user action (e.g., deleting a post) directly mutated the `memoryCache` variable inside `feedStore` by doing `feedStore.memoryCache.feed = ...`. This is not possible via the exported API (the variable is module-private), but an agent tried to work around it by reassigning properties on the returned object from `getFeed()`. The AsyncStorage-persisted copy was never updated, so the next app restart re-hydrated the old data.

**Correct approach**: Always use `feedStore.setFeed(feed, nearbyPlaceIds, feedMode)` to update the cache. This writes to both the in-memory cache and AsyncStorage atomically. To remove a single item, fetch the current feed, filter it, then call `setFeed` with the filtered result. To force a full refresh, call `feedStore.clear()` so the next `getFeed()` call returns null and triggers a network fetch.

**Files affected**: `apps/mobile/src/lib/feedStore.ts`

**Tags**: #mobile #feed #store #cache

---

## [2026-02-23] — Mobile/Social — Optimistic like UI did not verify mutation success

**What went wrong**: A feed action updated `isLiked` and counts optimistically but did not check Supabase mutation results for `insert/delete` errors. The UI appeared successful, but failed writes meant likes were not persisted and disappeared after restart. The same area also suppressed social-read errors, hiding root causes during debugging.

**Correct approach**: Always inspect `{ error }` from Supabase writes and throw/revert optimistic state when present. Do not silently swallow errors in social bootstrap reads; log them with clear source tags so device logs reveal whether failures are auth, RLS, or connectivity-related.

**Files affected**: `apps/mobile/components/MediaOverlay.tsx`

**Tags**: #mobile #likes #optimistic-ui #supabase #observability

---

## [2026-02-23] — Mobile/Social — Supabase RLS rejects Auth0 JWTs for social writes (likes, saves)

**What went wrong**: `MediaOverlay.tsx` used the Supabase JS client (with Auth0 `idToken` as Bearer header) to insert/delete rows in `video_likes`, `image_post_likes`, and `saves`. Supabase RLS policies use `auth.uid()` / `auth.jwt()` which expect Supabase-native auth claims, not Auth0's `sub` claim format (e.g. `google-oauth2|123...`). Every write was rejected with error `42501: new row violates row-level security policy`. Reads may also have been silently returning empty results. This is the same root cause that previously broke comments (which were already migrated to the Media API).

**Correct approach**: Route all social writes (likes, saves, comments) through the Media API backend, which connects to the same Postgres database via `pg` pool as the `postgres` role and bypasses RLS entirely. The pattern is: mobile calls `POST /api/social/like` or `POST /api/social/save` via `fetch()`, and the backend performs the DB operation. Social reads also go through `GET /api/social/status` for the same reason. Never use the Supabase JS client for write operations on tables with RLS policies that don't recognize Auth0 JWTs.

**Files affected**: `apps/mobile/components/MediaOverlay.tsx`, `services/media-api/src/routes/social.ts` (new), `services/media-api/src/db/index.ts`

**Tags**: #mobile #supabase #rls #auth0 #likes #saves #architecture
