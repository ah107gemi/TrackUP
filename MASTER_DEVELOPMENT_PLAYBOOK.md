# TrackUP - Master Development Playbook

**Version:** 1.0.0  
**Last Updated:** November 20, 2026  
**Primary References:** [APP_STATE.md](APP_STATE.md) | [AGENTS.md](AGENTS.md) | [ARCHIVE_HISTORY.md](docs/ARCHIVE_HISTORY.md)

---

## 1. Purpose & Documentation Architecture

This playbook defines reusable engineering standards, architectural patterns, database contracts, and verification protocols for the TrackUP Progressive Web Application (PWA).

TrackUP operates on a four-tier documentation architecture:
1. **`AGENTS.md` (Operational Directives):** Root guidelines governing agent behavior, design constraints, database safety, and documentation maintenance workflows.
2. **`APP_STATE.md` (Single Source of Truth):** Active operational state, current schema, environment variables, synchronization contracts, and recent milestones.
3. **`MASTER_DEVELOPMENT_PLAYBOOK.md` (Engineering Standards):** This document. Reusable technical patterns, code standards, external API conventions, testing gates, and verification workflows.
4. **`docs/ARCHIVE_HISTORY.md` (Historical Record):** Permanent chronological archive of completed foundational phases (Phases 1–7) and past milestones.

---

## 2. Core Architecture & Tech Stack

* **Frontend:** React 18, TypeScript (`~5.6.3`), Vite 5, Tailwind CSS (`clsx`, `tailwind-merge`).
* **Server State:** TanStack React Query v5 (`@tanstack/react-query`).
* **Ephemeral UI State:** Zustand v5 (`zustand`).
* **Database & Auth:** Supabase (PostgreSQL 15) with 100% Row Level Security (RLS).
* **PWA & Caching:** `vite-plugin-pwa` with Workbox service worker caching.
* **Hosting:** Render automated continuous deployments triggered from GitHub `main`.

---

## 3. Client State & Store Patterns

### A. Server State with TanStack React Query v5
All asynchronous data fetched from Supabase or external APIs must be managed via TanStack React Query hooks.
* **Query Key Hierarchy:** Query keys must use structured tuples representing resource domain, media type, and identifiers:
  * `['catalog', mediaType, id]`
  * `['custom-lists', userId]`
  * `['list-items', listId]`
  * `['user-library', userId]`
  * `['progress', userId, titleId]`
* **Stale Times & Invalidation:**
  * Catalog metadata (static): `staleTime: 1000 * 60 * 30` (30 minutes).
  * User library and lists (dynamic): `staleTime: 1000 * 60 * 2` (2 minutes).
  * Invalidate queries deterministically upon successful mutations via `queryClient.invalidateQueries({ queryKey: [...] })`.
* **Optimistic Updates & Rollbacks:**
  * When optimistic updates are used, always capture previous state in `onMutate`.
  * Roll back immediately in `onError` using `queryClient.setQueryData(key, context.previous)`.
  * Invalidate queries in `onSettled` to ensure synchronization with the remote database.

### B. Ephemeral UI State with Zustand v5
Zustand is strictly reserved for ephemeral, non-persisted client-side UI shell state:
* **Location:** `src/stores/uiStore.ts`.
* **Scope:**
  * Active modal identifier (`activeModal: 'add-to-list' | 'create-list' | 'share' | null`).
  * Search dialog visibility and current search filter selections.
  * Mobile drawer and bottom sheet open/close state.
  * Selected media entity for quick-action overlays.
* **Prohibition:** Never persist server entities or database records in Zustand. Server records belong exclusively in React Query cache.

---

## 4. Catalog Normalization & External API Resilience

TrackUP tracks six distinct entertainment domains:
1. `movie` — Feature films & cinematic documentaries
2. `tv` — Episodic television series
3. `anime_series` — Japanese episodic animation
4. `anime_film` — Japanese theatrical anime features
5. `manga` — Serialized Japanese comics & graphic novels
6. `manhwa` — Serialized Korean digital webtoons

### External API Integration Pipeline
1. **Primary Ingestion:**
   * Movies & TV: The Movie Database (TMDB) API.
   * Anime & Manga/Manhwa: AniList GraphQL API.
2. **Resilient Metadata Healing:**
   * Handled by `src/features/catalog/metadataHealer.ts`.
   * Secondary fallback for anime and manga: Jikan v4 REST API (MyAnimeList wrapper).
   * **Strict Timeout Rule:** All Jikan requests must enforce a 3000ms timeout using `AbortSignal.timeout(3000)` to prevent blocking rendering during upstream rate limits.
3. **Zero-Network Fixture Fallback:**
   * Curated development fixtures (`MOCK_CATALOG_FIXTURES` in `src/features/catalog/catalogService.ts`) provide offline and test-environment data when external APIs or network connectivity are unavailable.
4. **Canonical Data Normalization:**
   * Metadata must map into a standard `CatalogTitle` interface containing:
     * `id`: Canonical string identifier.
     * `title`: Primary display title.
     * `original_title`: Native language title.
     * `media_type`: One of the six supported media domain strings.
     * `poster_path`: Clean, absolute image URL (or fallback token).
     * `banner_path`: Landscape artwork URL (or fallback token).
     * `release_date`: ISO 8601 date string.
     * `status`: Airing, completed, released, or upcoming.
     * `genres`: String array of normalized genre tags.

---

## 5. Database & Security Contracts (Supabase PostgreSQL 15)

### A. Row Level Security (RLS) Policy Matrix
* **100% RLS Coverage:** Every table created in the `public` schema MUST have RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`).
* **User Tables:**
  * Tables: `profiles`, `user_libraries`, `user_favorites`, `user_episode_progress`, `user_reading_progress`, `watch_history`, `reading_history`, `reviews`, `custom_lists`, `list_items`.
  * Policy Rule: Must strictly enforce `auth.uid() = user_id` for INSERT, UPDATE, and DELETE operations.
  * Public Read Visibility: `custom_lists` allows SELECT for public lists (`is_public = true` OR `auth.uid() = user_id`).
* **Catalog Tables:**
  * Tables: `catalog_titles`, `catalog_seasons`, `catalog_episodes`, `title_relationships`.
  * Policy Rule: SELECT is open to public (`true`), mutations are strictly restricted to admin service roles.

### B. Pre-Flight Session Verification
* Mutating operations must verify an active session before initiating database calls.
* Use `getAuthenticatedUserId()`:
  ```typescript
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    throw new Error('Authentication required');
  }
  ```

### C. Client-Side UUID Generation & Canonical Validation
* **Generation:** Client-created entities (custom lists, list items) MUST generate RFC 4122 UUID v4 identifiers via `generateUUID()`.
* **Prohibition:** Temporary string prefixes (e.g., `list_123`, `item_abc`) are strictly forbidden; PostgreSQL will reject them with `invalid input syntax for type uuid`.
* **Validation:** All UUID inputs must be validated using `isValidUUID()`, enforcing canonical 36-character hexadecimal format:
  ```typescript
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  ```

### D. Supabase Mutation Error Contract
* Every mutating Supabase query MUST chain `.throwOnError()`:
  ```typescript
  const { data, error } = await supabase
    .from('custom_lists')
    .insert(payload)
    .throwOnError();
  ```
* Never swallow promise errors silently. Always catch and surface errors through user-facing toasts (`addToast`).

---

## 6. Data Synchronization & Error Contract

### Remote-First Persistence
1. **Step 1 — Remote Mutation:** Send payload to Supabase with user authentication.
2. **Step 2 — Remote Confirmation:** Wait for successful response from Supabase.
3. **Step 3 — Cache Invalidation / Local Update:** Update TanStack Query cache and synchronize localStorage mirrors.
4. **Step 4 — Error Rollback:** If the remote mutation fails:
   * Revert optimistic UI updates.
   * Do NOT commit ghost records to localStorage.
   * Trigger error toast notification with actionable messaging.

### Duplicate Key Resolution
* Insertion into junction tables (e.g., `list_items`, `user_favorites`) must handle PostgreSQL duplicate key errors (`23505`) gracefully without throwing uncaught exceptions to the UI.

---

## 7. Strict Design System & UI/UX Standards

### Color Tokens
* **Canvas Background:** `#101014` (`bg-background`)
* **Surface Cards & Sidebars:** `#16161D` (`bg-surface`)
* **Elevated Surfaces & Borders:** `#1F1F29` (`bg-surface-elevated`, `border-surface-elevated`)
* **Primary Accent:** Champagne-gold / amber yellow `#FFC400` (`bg-accent`, `text-accent`)
* **Accent Hover:** `#FFD033` (`bg-accent-hover`, `text-accent-hover`)
* **Text Tokens:**
  * Primary Text: `#F4F4F6` (`text-text-primary`)
  * Secondary Text: `#A1A1AA` (`text-text-secondary`)
  * Muted Text: `#71717A` (`text-text-muted`)

### Layout & Navigation Shell
* **Mobile Viewports (< 768px):**
  * Persistent sticky bottom navigation bar (`BottomNavBar.tsx`).
  * Minimum touch target dimensions: `44x44px` for all clickable icons, navigation tabs, and modal triggers.
* **Desktop Viewports (>= 768px):**
  * Collapsible left navigation sidebar (`DesktopSidebar.tsx`).
  * Expanded catalog grids with hover elevation.
* **Catalog Grids:**
  * Responsive columns: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6`.
  * Grid gaps: `gap-3 sm:gap-4 md:gap-6`.
* **Poster Aspect Ratio:**
  * All media poster cards strictly enforce a `2:3` aspect ratio (`aspect-[2/3]`).
  * Images must use `object-cover` with an animated shimmer or genre placeholder during asset loading.

---

## 8. PWA & Service Worker Caching

* Configured via `vite-plugin-pwa` and Workbox.
* **Asset Caching:** Static assets (fonts, icons, CSS, bundled JS) are precached for offline shell access.
* **External Images:** External poster artwork from TMDB and AniList CDNs is cached with a CacheFirst strategy and reasonable maximum entry limits.
* **API Calls:** Supabase queries and GraphQL requests bypass Service Worker caching to guarantee fresh data synchronization.

---

## 9. Verification Gates & Test Commands

Every feature, bug fix, or refactor must pass the following verification gates before completion:

| Gate | Command | Description |
| :--- | :--- | :--- |
| **Type Check** | `npm run typecheck` | Executes `tsc --noEmit` to verify 100% strict TypeScript compliance. |
| **Unit Tests** | `npm run test:unit` | Executes `vitest run` for component, service, and utility unit tests. |
| **Production Build** | `npm run build` | Executes `tsc && vite build` to ensure error-free production bundling. |
| **E2E Tests** | `npm run test:e2e` | Executes `playwright test` for end-to-end integration flows. |
| **Full Verification** | `npm test` | Runs both unit and end-to-end test suites sequentially. |

---

## 10. Development Workflow & Git Protocol

1. **Pre-Implementation:** Always inspect `APP_STATE.md` first. Understand existing architecture, schema constraints, and RLS policies before writing code.
2. **Minimal Changes:** Focus strictly on files relevant to the task. Avoid broad, unsolicited refactoring.
3. **Database Integrity:** NEVER drop tables, alter schema, or remove columns without explicit user instructions.
4. **Documentation Sync:** Update `APP_STATE.md` whenever changes affect architecture, database schemas, security, or core features. Record completed milestones in accordance with `AGENTS.md`.
5. **Git Restrictions:**
   * **NEVER** run `git commit`, `git push`, or deploy without explicit user authorization.
   * Review all diffs with the user and wait for formal approval before making Git changes.
