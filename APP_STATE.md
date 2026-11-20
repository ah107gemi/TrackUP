# TrackUP PWA - Master Application State
**Last Updated:** November 19, 2026

> **Operational Directive:** `@APP_STATE.md Read this first` — Antigravity MUST inspect this document before taking any architectural, database, or code actions.

---

## 1. Stack & Environment

*   **Frontend Core:** React 18 (`react`, `react-dom`), TypeScript (`~5.6.3`), Vite 5 (`vite`), Tailwind CSS (`tailwindcss`, `clsx`, `tailwind-merge`).
*   **State & Data Fetching:** TanStack React Query v5 (`@tanstack/react-query`) for server-state caching, optimistic mutations, and cache invalidation; Zustand v5 (`zustand`) for global client-side UI shell state.
*   **Icons & Utilities:** Lucide React (`lucide-react`), Zod (`zod`), PapaParse (`papaparse`), React Easy Crop (`react-easy-crop`).
*   **PWA & Caching:** `vite-plugin-pwa` with Service Worker caching for offline resilience and asset caching.
*   **Backend & Database:** Supabase (PostgreSQL 15), 100% Row Level Security (RLS) policies enabled across all user tables, stored procedures (RPCs), and automated database triggers (`on_auth_user_created`).
*   **Hosting & Deployment:** Render (Automated continuous deployments triggered via commits to GitHub `main` branch).
*   **Design System & Tokens:**
    *   **Dark Slate Aesthetic:** Canvas background `#101014` (`bg-background`), surface cards/sidebars `#16161D` (`bg-surface`), elevated surfaces & borders `#1F1F29` (`bg-surface-elevated`).
    *   **Interactive Accents:** Champagne-gold / amber yellow `#FFC400` primary (`bg-accent`, `text-accent`), `#FFD033` hover (`bg-accent-hover`).
    *   **Typography & Contrast:** White/light text tokens — `#F4F4F6` primary (`text-text-primary`), `#A1A1AA` secondary (`text-text-secondary`), `#71717A` muted (`text-text-muted`).
    *   **Layout Structure:** Mobile-first responsive PWA shell, fixed bottom navigation bar on mobile viewports, desktop collapsible sidebar, zero horizontal overflow.
*   **Environment Configuration (Variable Names Only):**
    *   `VITE_SUPABASE_URL`: Supabase project URL (local or hosted).
    *   `VITE_SUPABASE_ANON_KEY`: Supabase anonymous public client key.
    *   `VITE_APP_NAME`: Application display name (default: "TrackUp").
    *   `VITE_APP_TAGLINE`: Application tagline (default: "Track what you love.").
    *   `VITE_TMDB_API_KEY`: The Movie Database (TMDB) v3 API key for live movie/TV catalog discovery.
    *   `VITE_TMDB_READ_ACCESS_TOKEN`: TMDB v4 Bearer access token.

---

## 2. Architecture & Directory Map

### 2.1 Feature Directory Mapping
The codebase is structured into feature-first modules under `src/features/` and shared layout/components under `src/components/`:

*   [src/features/catalog/](src/features/catalog/): Media catalog discovery, metadata normalization, and external API integrations.
    *   [catalogService.ts](src/features/catalog/catalogService.ts): Central catalog coordinator, fixture resolver, and curated development fixtures (`MOCK_CATALOG_FIXTURES`).
    *   [tmdbClient.ts](src/features/catalog/tmdbClient.ts): TMDB API v3/v4 client for movies and TV shows, with AniList/Jikan cross-referencing.
    *   [anilistClient.ts](src/features/catalog/anilistClient.ts): AniList GraphQL client for Anime series/films, Manga, and Manhwa (`countryOfOrigin: 'KR'`).
    *   [normalizers.ts](src/features/catalog/normalizers.ts): Normalization utilities mapping disparate third-party payloads to `NormalizedCatalogItem`.
    *   [metadataHealer.ts](src/features/catalog/metadataHealer.ts): Active healer for incomplete media metadata and placeholder poster remediation.
    *   [TitleDetailPage.tsx](src/features/catalog/TitleDetailPage.tsx): Media detail view with synopsis, cast, episode/chapter progress steppers, private notes, and custom list shortcuts.
    *   [SearchPage.tsx](src/features/catalog/SearchPage.tsx): Discover view with multi-format tabs and unified global search triggers.
    *   [RecommendationsView.tsx](src/features/catalog/RecommendationsView.tsx): Recommendation engine combining content-based genre filtering with social collaborative signals.
*   [src/features/library/](src/features/library/): Personal library tracking, status filters, and granular progress steppers.
    *   [libraryService.ts](src/features/library/libraryService.ts): Library CRUD, episode/chapter progress logging, `.throwOnError()` persistence, and UUID validation.
    *   [useLibrary.ts](src/features/library/useLibrary.ts): React Query hooks for library queries, status mutations, and optimistic updates.
    *   [LibraryView.tsx](src/features/library/LibraryView.tsx): Library dashboard with watch/reading tabs and unified search triggers.
*   [src/features/custom-lists/](src/features/custom-lists/): User-curated custom collections across all 6 media formats.
    *   [customListsService.ts](src/features/custom-lists/customListsService.ts): Custom lists and list items CRUD, strict UUID v4 enforcement, session verification, and diagnostic error logging.
    *   [CustomListsSection.tsx](src/features/custom-lists/CustomListsSection.tsx): Compact folder summary cards, list detail modal, and list creation/editing dialogs.
    *   [AddToListModal.tsx](src/features/custom-lists/AddToListModal.tsx): Interactive modal to toggle a title across custom lists with red error toasts and optimistic UI.
*   [src/features/auth/](src/features/auth/): Authentication and user identity management.
    *   [AuthContext.tsx](src/features/auth/AuthContext.tsx): Supabase auth state provider, active session resolver, and username-to-email resolver.
    *   [AuthModal.tsx](src/features/auth/AuthModal.tsx): User authentication modal (email/username sign in, sign up, password recovery).
    *   [AuthGuard.tsx](src/features/auth/AuthGuard.tsx): Route and view protection wrapper for authenticated actions.
*   [src/features/profile/](src/features/profile/): User profiles, tracking metrics, and public profile views.
    *   [profileService.ts](src/features/profile/profileService.ts): User profile metadata, avatar/banner uploads, and account deletion RPC.
    *   [ProfilePage.tsx](src/features/profile/ProfilePage.tsx): Compact tracking overview headers, tracking showcase modals, favorite collections, and custom lists.
    *   [PublicProfilePage.tsx](src/features/profile/PublicProfilePage.tsx): Dynamic public profile viewer with privacy-respecting library display.
*   [src/features/social/](src/features/social/): Social graph, following, and friend activity.
    *   [socialService.ts](src/features/social/socialService.ts): Follow/unfollow mutations, social profile search, and activity queries.
    *   [FriendsPage.tsx](src/features/social/FriendsPage.tsx): User search and friend network management.
    *   [ActivityFeed.tsx](src/features/social/ActivityFeed.tsx): Chronological activity stream of friend ratings and completions.
*   [src/features/reviews/](src/features/reviews/): Community reviews and ratings.
    *   [ReviewModal.tsx](src/features/reviews/ReviewModal.tsx): Rating and review composition modal with spoiler toggles.
    *   [ReviewCard.tsx](src/features/reviews/ReviewCard.tsx): Review card component with spoiler obscuration.
*   [src/features/history/](src/features/history/): Chronological activity timeline.
    *   [HistoryTimeline.tsx](src/features/history/HistoryTimeline.tsx): Timestamped timeline of episode, chapter, and status changes.
*   [src/features/import-export/](src/features/import-export/): Multi-platform CSV imports and data backups.
    *   [importService.ts](src/features/import-export/importService.ts): CSV parsing and hydration engine for Binger, MyAnimeList, and Letterboxd.
    *   [BingerImportModal.tsx](src/features/import-export/BingerImportModal.tsx), [ExportModal.tsx](src/features/import-export/ExportModal.tsx): Import/export user interfaces.
*   [src/components/layout/](src/components/layout/): Core shell and navigation containers.
    *   [AppShell.tsx](src/components/layout/AppShell.tsx): Master responsive application shell coordinating desktop sidebar, top utility bar, and mobile bottom bar.
    *   [BottomNavBar.tsx](src/components/layout/BottomNavBar.tsx): Mobile-only bottom navigation bar (Home, Discover, Library, Social, Profile).
    *   [DesktopSidebar.tsx](src/components/layout/DesktopSidebar.tsx): Desktop-only collapsible sidebar navigation.
    *   [TopUtilityBar.tsx](src/components/layout/TopUtilityBar.tsx): Top utility header with search and quick add triggers.
    *   [OmnisearchModal.tsx](src/components/layout/OmnisearchModal.tsx): Global search overlay with keyboard shortcuts (⌘K / Ctrl+K).
    *   [QuickAddModal.tsx](src/components/layout/QuickAddModal.tsx): Dedicated search-and-track modal enabling rapid inline library tracking without visiting detail pages.
*   [src/components/shared/](src/components/shared/): Reusable UI elements.
    *   [MediaPosterCard.tsx](src/components/shared/MediaPosterCard.tsx): Media poster card rendering title, year, format badge, ongoing indicator, and tracking status pill.
    *   [TmdbAttribution.tsx](src/components/shared/TmdbAttribution.tsx): TMDB legal compliance badge.
*   [src/stores/](src/stores/): UI state stores.
    *   [uiStore.ts](src/stores/uiStore.ts): Zustand store managing active tab views, modal triggers, and drawer states.

### 2.2 External Catalog Integration & Metadata Pipeline
TrackUP unifies 6 distinct entertainment formats across third-party APIs and curated fallback fixtures:
1.  **Movies & TV Shows:** Fetched via TMDB API (`tmdbClient.ts`) using `searchTmdb` and `fetchTmdbMediaById`. Image URLs are built with `buildTmdbImageUrl` (`w342`, `w500`, `w1280`).
2.  **Anime Series & Anime Films:** Queried via AniList GraphQL API (`anilistClient.ts`) with format filters (`TV`, `TV_SHORT`, `OVA`, `ONA`, `MOVIE`).
3.  **Manga & Manhwa:** Queried via AniList GraphQL API (`anilistClient.ts`). Manhwa is distinguished by `countryOfOrigin: 'KR'`.
4.  **Metadata Healer & Jikan Fallback:** In `tmdbClient.ts` / `metadataHealer.ts`, when TMDB returns sparse episode counts or missing seasons for anime titles, TrackUP cross-references AniList and falls back to the Jikan v4 REST API (`https://api.jikan.moe/v4/anime`) with an `AbortSignal.timeout(3000)` non-blocking guard.
5.  **Curated Fixtures (`MOCK_CATALOG_FIXTURES`):** Located in `catalogService.ts`, providing offline resilience and deterministic unit testing across all 6 formats.

---

## 3. Database & Security Matrix

### 3.1 Core Database Schemas
All tables reside in PostgreSQL on Supabase under the `public` schema (with `auth.users` managed by Supabase Authentication):

*   **`auth.users`:**
    *   Managed exclusively by Supabase Auth (email confirmation is currently OFF for rapid onboarding).
*   **`public.profiles`:**
    *   Linked to `auth.users.id` via trigger `on_auth_user_created`.
    *   **Fields:** `id` (UUID, PK -> `auth.users.id`), `email` (TEXT), `username` (TEXT, unique case-insensitive index `idx_profiles_username_lower`), `display_name` (TEXT), `avatar_url` (TEXT), `banner_url` (TEXT), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
*   **`public.user_libraries`:**
    *   Primary tracking table linking users to media items across external catalog providers.
    *   **Fields:**
        *   `id` (UUID, PK)
        *   `user_id` (UUID NOT NULL, REFERENCES `public.profiles(id)` ON DELETE CASCADE)
        *   `title_id` (TEXT NOT NULL; foreign key constraint to `catalog_titles.id` dropped in migration `20261116000001` to support external TMDB and AniList string IDs)
        *   `status` (TEXT NOT NULL CHECK (`status IN ('active', 'completed', 'planned', 'paused', 'dropped')`))
        *   `rating` (NUMERIC(3, 1) CHECK (`rating IS NULL OR (rating >= 0 AND rating <= 10)`))
        *   `is_private` (BOOLEAN NOT NULL DEFAULT false)
        *   `personal_notes` (TEXT)
        *   `private_notes` (TEXT; added in migration `20261115000003`, strictly confidential private notes accessible solely to owner)
        *   `started_at` (TIMESTAMPTZ)
        *   `completed_at` (TIMESTAMPTZ)
        *   `last_progressed_at` (TIMESTAMPTZ NOT NULL DEFAULT now())
        *   `created_at` (TIMESTAMPTZ NOT NULL DEFAULT now())
        *   `updated_at` (TIMESTAMPTZ NOT NULL DEFAULT now())
    *   **Constraints:** UNIQUE(`user_id`, `title_id`).
    *   **Indexes:** `idx_user_libraries_user_status` ON `(user_id, status)`, `idx_user_libraries_user_last_prog` ON `(user_id, last_progressed_at DESC NULLS LAST)`.
*   **`public.user_episode_progress`:**
    *   Episodic tracking records for TV shows and Anime series.
    *   **Fields:**
        *   `id` (UUID, PK)
        *   `user_id` (UUID NOT NULL, REFERENCES `public.profiles(id)` ON DELETE CASCADE)
        *   `library_id` (UUID NOT NULL, REFERENCES `public.user_libraries(id)` ON DELETE CASCADE)
        *   `episode_id` (TEXT NOT NULL; foreign key constraint to `catalog_episodes.id` dropped in migration `20261116000001` to support external provider strings)
        *   `watched` (BOOLEAN NOT NULL DEFAULT true)
        *   `watched_at` (TIMESTAMPTZ DEFAULT now())
        *   `created_at` (TIMESTAMPTZ NOT NULL DEFAULT now())
    *   **Constraints:** UNIQUE(`user_id`, `episode_id`).
*   **`public.user_reading_progress`:**
    *   Volume and chapter tracking records for Manga and Manhwa.
    *   **Fields:**
        *   `id` (UUID, PK)
        *   `user_id` (UUID NOT NULL, REFERENCES `public.profiles(id)` ON DELETE CASCADE)
        *   `library_id` (UUID NOT NULL, REFERENCES `public.user_libraries(id)` ON DELETE CASCADE)
        *   `last_chapter_read` (NUMERIC(6, 1) NOT NULL DEFAULT 0)
        *   `last_volume_read` (NUMERIC(4, 0) NOT NULL DEFAULT 0)
        *   `updated_at` (TIMESTAMPTZ NOT NULL DEFAULT now())
        *   `created_at` (TIMESTAMPTZ NOT NULL DEFAULT now())
    *   **Constraints:** UNIQUE(`user_id`, `library_id`).
*   **`public.custom_lists`:**
    *   User-created custom media collections.
    *   **Fields:**
        *   `id` (UUID, PK DEFAULT `gen_random_uuid()`)
        *   `user_id` (UUID NOT NULL, REFERENCES `public.profiles(id)` ON DELETE CASCADE)
        *   `name` (TEXT NOT NULL; primary display name, synchronized with `list_name` via migration `20261115000004_fix_list_items_rls.sql`)
        *   `list_name` (TEXT; legacy schema column synchronized with `name` for backward compatibility)
        *   `description` (TEXT)
        *   `is_private` (BOOLEAN NOT NULL DEFAULT false)
        *   `created_at` (TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()))
        *   `updated_at` (TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()))
    *   **Indexes:** `idx_custom_lists_user_id` ON `(user_id)`, `idx_custom_lists_created_at` ON `(created_at DESC)`.
*   **`public.list_items`:**
    *   Universal media item mappings inside custom collections.
    *   **Fields:**
        *   `id` (UUID, PK DEFAULT `gen_random_uuid()`)
        *   `list_id` (UUID NOT NULL, REFERENCES `public.custom_lists(id)` ON DELETE CASCADE)
        *   `user_id` (UUID, REFERENCES `public.profiles(id)` ON DELETE CASCADE, DEFAULT `auth.uid()`; added in migration `20261115000004` for direct RLS evaluation)
        *   `media_id` (TEXT; external media title ID string, e.g. `movie_inception_27205`, `tmdb_tv_1396`)
        *   `title_id` (TEXT; synchronized with `media_id` via migration `20261115000004`; foreign key to `catalog_titles.id` dropped to support external strings)
        *   `media_type` (TEXT NOT NULL; `'movie'`, `'tv'`, `'anime_series'`, `'anime_movie'`, `'manga'`, `'manhwa'`)
        *   `notes` (TEXT)
        *   `display_order` (INTEGER NOT NULL DEFAULT 0)
        *   `created_at` (TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()))
        *   `updated_at` (TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()))
    *   **Constraints:** `CONSTRAINT list_items_list_media_unique UNIQUE(list_id, media_id)`.
    *   **Indexes:** `idx_list_items_user_id`, `idx_list_items_list_id`, `idx_list_items_media_id`, `idx_list_items_title_id`.
*   **Supporting Tables:**
    *   `public.reviews`: `id` (UUID, PK), `user_id` (UUID, FK -> `profiles.id`), `title_id` (TEXT), `rating` (NUMERIC), `review_text` (TEXT), `is_spoiler` (BOOLEAN), timestamps.
    *   `public.user_follows`: `id` (UUID, PK), `follower_id` (UUID, FK -> `profiles.id`), `following_id` (UUID, FK -> `profiles.id`), timestamps, UNIQUE(`follower_id`, `following_id`).
    *   `public.catalog_release_schedules`: `id` (UUID, PK), `title_id` (UUID, FK -> `catalog_titles.id`), `release_type` (TEXT), `item_number` (NUMERIC), `air_date` (TIMESTAMPTZ), `day_of_week` (SMALLINT), timestamps.

### 3.2 Row Level Security (RLS) Policy Matrix

| Table | Operation | Policy Rule / Predicate | Description |
| :--- | :--- | :--- | :--- |
| `profiles` | SELECT | `true` (`allow_anon_profiles_read`) | Public profiles searchable by all users |
| `profiles` | UPDATE/DELETE | `auth.uid() = id` | Profile owner full control |
| `user_libraries` | ALL (CRUD) | `auth.uid() = user_id` (`user_libraries_owner_all`) | Authenticated owner full control |
| `user_libraries` | SELECT | `is_private = false OR auth.uid() = user_id` | Public items readable by community |
| `user_episode_progress` | ALL (CRUD) | `auth.uid() = user_id` (`user_episode_progress_owner_all`) | Authenticated owner full control |
| `user_reading_progress` | ALL (CRUD) | `auth.uid() = user_id` (`user_reading_progress_owner_all`) | Authenticated owner full control |
| `custom_lists` | SELECT | `auth.uid() = user_id OR is_private = false OR is_private IS NULL` | Owner or public list viewers |
| `custom_lists` | INSERT | `auth.uid() = user_id` | Authenticated list creator |
| `custom_lists` | UPDATE | `auth.uid() = user_id` | Authenticated list owner |
| `custom_lists` | DELETE | `auth.uid() = user_id` | Authenticated list owner |
| `list_items` | SELECT | `auth.uid() = user_id OR EXISTS (SELECT 1 FROM custom_lists WHERE id = list_items.list_id AND (user_id = auth.uid() OR is_private = false OR is_private IS NULL))` | Owner or public list viewers |
| `list_items` | INSERT | `auth.uid() = user_id OR EXISTS (SELECT 1 FROM custom_lists WHERE id = list_items.list_id AND user_id = auth.uid())` | List owner only |
| `list_items` | UPDATE | `auth.uid() = user_id OR EXISTS (SELECT 1 FROM custom_lists WHERE id = list_items.list_id AND user_id = auth.uid())` | List owner only |
| `list_items` | DELETE | `auth.uid() = user_id OR EXISTS (SELECT 1 FROM custom_lists WHERE id = list_items.list_id AND user_id = auth.uid())` | List owner only |

---

## 4. Data Synchronization & Error Contract

To prevent silent database write failures, UI data ghosting, and unhandled RLS violations, TrackUP enforces a strict data synchronization contract across all services and components:

1.  **Strict Error Throwing:**
    *   In `libraryService.ts`, `.throwOnError()` is appended to all Supabase `.insert()`, `.update()`, `.upsert()`, and `.delete()` calls across `user_libraries`, `user_episode_progress`, and `user_reading_progress`.
    *   In `customListsService.ts`, all database responses are inspected (`if (error) throw new Error(...)`). Exceptions are logged with rich diagnostic context (payloads, session user ID, list IDs) and explicitly thrown.
    *   Services must NEVER silently swallow network or RLS errors into successful returns.
2.  **Authentication Session Guard:**
    *   Every database mutation executes `getAuthenticatedUserId()` prior to issuing network requests.
    *   If no active authenticated user session exists, the service aborts immediately and throws `"User session not found. Please log in..."` before contacting Supabase, preventing silent RLS rejections.
3.  **UUID Generation vs. Format Validation:**
    *   **Generation (`generateUUID()`):** Strictly produces RFC 4122 compliant **UUID v4** strings, leveraging native `crypto.randomUUID()` when available with a bitmasked pseudo-random fallback (`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`).
    *   **Format Validation (`isValidUUID()`):** Validates standard 36-character canonical hexadecimal UUID formatting via case-insensitive regex (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`). This ensures broad acceptance of valid UUIDs (versions 1–5) while strictly rejecting malformed strings or legacy prefixed client IDs (`lib_...`, `list_...`, `item_...`).
    *   **Auto-Healing:** Any legacy non-UUID keys discovered in local cache storage are seamlessly transformed into valid UUID v4 records upon loading via `healLegacyLibraryIds` and `getStoredCustomLists`.
4.  **Optimistic UI Updates, Rollback & Cache Invalidation:**
    *   React Query mutations snapshot previous cache data in `onMutate`.
    *   If a database mutation fails, `onError` rolls back UI state to the previous snapshot and surfaces a high-visibility, auto-dismissing red error toast alert (`actionError`, red error toast).
    *   On mutation completion (`onSettled`), queries are invalidated using `queryClient.invalidateQueries(...)` to guarantee synchronization with backend truth.
5.  **LocalStorage Synchronization Order:**
    *   `localStorage` serves as an offline resilience layer.
    *   In custom list mutations, local cache writes execute ONLY after the remote Supabase operation succeeds, preventing ghost records in local storage.

---

## 5. Verification Checklist

Antigravity and developers MUST verify changes using the following working commands. **Never claim a command passed without actually executing it in the terminal.**

| Verification Check | Terminal Command | Working Directory | Purpose |
| :--- | :--- | :--- | :--- |
| **TypeScript Typecheck** | `npm run typecheck` | `TrackUP` | Validates TypeScript compilation (`tsc --noEmit`) without emitting files. |
| **Vitest Unit Tests** | `npm run test:unit` | `TrackUP` | Executes 246 unit tests across 21 test files (`vitest run`). |
| **Production Build** | `npm run build` | `TrackUP` | Executes `tsc && vite build` and generates the production PWA bundle. |
| **Playwright E2E Tests** | `npm run test:e2e` | `TrackUP` | Runs Playwright end-to-end tests across Chromium, Firefox, and WebKit. |
| **Full Test Suite** | `npm run test` | `TrackUP` | Runs unit tests followed by E2E tests (`vitest run && playwright test`). |

*Note on Windows Execution:* When running commands from the root workspace directory, specify `--prefix TrackUP` (e.g. `npm.cmd --prefix TrackUP run typecheck`).

---

## 6. Active Roadmap & Known Issues

### 6.1 Active Development Roadmap
1.  **PWA Service Worker Caching Refinement:** Optimize Workbox caching strategies for external TMDB poster images (`image.tmdb.org`) to improve offline performance while bounding cache storage.
2.  **External API Rate Limit Resilience:** Implement exponential backoff and retry interceptors for AniList GraphQL and Jikan anime fallback requests during peak usage windows.
3.  **Social Activity Feed Pagination:** Implement infinite scroll pagination for `ActivityFeed.tsx` to handle large friend networks smoothly.
4.  **Custom Lists Drag-and-Drop Reordering:** Connect the existing `display_order` column on `list_items` to interactive drag-and-drop reordering in the list detail modal.

### 6.2 Known Issues & Accepted Technical Debt
1.  **Jikan REST API Rate Limits:** The public Jikan API imposes strict rate limits (3 requests/second). In TrackUP, calls to Jikan are strictly non-blocking fallbacks protected by `AbortSignal.timeout(3000)`.
2.  **TMDB API Key Dependency:** Without a configured `VITE_TMDB_API_KEY`, live movie and TV show discovery is limited to curated `MOCK_CATALOG_FIXTURES`. Anime and Manga continue to operate via free public AniList GraphQL.
3.  **External Title ID String Relaxation:** `user_libraries.title_id` and `list_items.media_id` are typed as `TEXT` rather than foreign keys to accommodate disparate external provider ID formats (TMDB numeric vs AniList numeric vs mock prefix strings).

---

## 7. Recent Milestones

*(For completed milestones 10 through 24 and foundational phases 1 through 7, refer to the historical archive: [docs/ARCHIVE_HISTORY.md](docs/ARCHIVE_HISTORY.md).)*

1.  **Surgical UI Display & Progress Cap Removal:**
    *   In `LibraryView.tsx`, `TitleDetailPage.tsx`, and `MediaPosterCard.tsx`, if `total_episodes` or `total_chapters` is `0`, `null`, or `undefined`, the UI strictly renders "Ongoing" instead of omitting the count or showing invalid numbers.
    *   Progress increments for episodes and chapters across `libraryService.ts` and `TitleDetailPage.tsx` have no caps (`Math.min` stripped), allowing numbers to progress as high as desired.
    *   Search queries in fetchers (`tmdbClient.ts`, etc.) are cleanly URL-encoded via `encodeURIComponent`.
2.  **Quick Add Search & Inline Tracking Architecture:**
    *   Designed and implemented dedicated "Quick Add" modal ([QuickAddModal.tsx](src/components/layout/QuickAddModal.tsx)) and global header/sidebar triggers (`data-testid="quick-add-trigger"`, `data-testid="sidebar-quick-add-btn"`).
    *   Users can search the catalog and track media directly without navigating to Title Detail pages.
    *   Compact rows render poster thumbnail, title, release year, media badge, and existing library tracking badge. Includes full mobile bottom-sheet styling and desktop centered dialog.
    *   Inline action menus with type branching: Movies ("Mark Watched", "Currently Watching", "Plan to Watch", "Add to List"); TV Shows & Anime ("Mark Completed" with batch episode logging across all seasons, "Currently Watching", "Plan to Watch", "Add to Custom List").
    *   Powered by strict UUID and error-throwing services with immediate auto-dismissing emerald success toasts (`quick-add-toast`) and error feedback (`quick-add-error-toast`).
3.  **Full Show Tracking & In-Season Catch-Up Prompt:**
    *   Enhanced episodic tracking on the Title Detail view ([TitleDetailPage.tsx](src/features/catalog/TitleDetailPage.tsx)).
    *   "Full Show" Tracking Buttons: Relabeled top-level buttons to "Mark Full Show" (`data-testid="mark-full-show-btn"`) and "Unmark Full Show" (`data-testid="unmark-full-show-btn"`). Updated mutation logic (`handleBatchMarkFullShowWatched`, `handleBatchUnmarkFullShow`) to collect all episodes across *all* seasons of the entire show, batch logging them via `batchEpisodeMutation` and synchronizing library tracking status ('completed' when fully watched, 'planned' when full show is unmarked). Dedicated season headers retain single-season buttons ("Mark Season", "Unmark Season").
    *   "Catch Up" / Mark Previous Episodes Prompt: When a user marks an episode as watched, evaluates if the episode is between episode 2 and the penultimate episode of that season (`episodeNumber >= 2 && episodeNumber < totalEpisodesInSeason`) with unmarked earlier episodes. Intercepts save to display a champagne-accented confirmation modal asking "Would you like to mark all previous episodes in this season as watched?". Confirming marks episodes 1 through the selected episode; declining marks only the single selected episode.
4.  **Profile Page Consolidation & Compact UI Refactor:**
    *   Drastically reduced vertical scrolling across the user Profile ([ProfilePage.tsx](src/features/profile/ProfilePage.tsx), [CustomListsSection.tsx](src/features/custom-lists/CustomListsSection.tsx)).
    *   Tracking Overview & Showcases: Converted large multi-line sections into compact summary headers surfacing only the Category Label and the Watch Time / Total count pill (`data-testid="tv-watch-time"`, `data-testid="movies-watch-time"`, etc.). Clicking any header opens an interactive Tracking Showcase modal (`data-testid="tracking-showcase-modal"`) detailing full watched/watching/completed metrics and a scrollable grid of tracked titles with poster, status, and navigation routing.
    *   Favorite Collections: Condensed category blocks into compact, dense horizontal rows (`data-testid="favorite-category-tv"`, etc.) with minimized padding and typography while strictly maintaining "View Collection" navigation to `CategoryFavoritesView`.
    *   Custom Lists: Simplified list cards in `CustomListsSection.tsx` by removing descriptions and thumbnail previews, displaying strictly the folder icon, List Name, Item Count, Public/Private status badge, and interactive "View >" button.
5.  **Main Library Strict Error Throwing, Auth Enforcement & UUID Compliance:**
    *   Resolved silent database write failures and UI data-ghosting in `libraryService.ts`, `TitleDetailPage.tsx`, and `LibraryView.tsx`.
    *   Appended `.throwOnError()` to all Supabase `.insert()`, `.update()`, `.upsert()`, and `.delete()` calls across `user_libraries`, `user_episode_progress`, and `user_reading_progress`.
    *   Eliminated legacy string IDs (`lib_${Math.random()}`) with RFC 4122 compliant UUID v4 generation (`generateUUID()`, `isValidUUID()`) and automatic legacy ID healing (`healLegacyLibraryIds`).
    *   Enforced strict active session checks (`getAuthenticatedUserId()`) throwing explicit errors (`"User session not found. Please log in..."`) before any database mutations.
    *   Removed silent raw Supabase catch blocks in `TitleDetailPage.tsx`, unifying tracking actions through React Query mutations with 5-second auto-dismiss red error toast alerts (`actionError`).
    *   Added database migration `20261116000001_library_and_progress_strict_rls.sql` relaxing foreign key constraints on external string title/episode IDs and granting authenticated users full CRUD RLS permissions (`auth.uid() = user_id`).
6.  **Custom Lists Strict Error Throwing & Auth Abort Guard:**
    *   Eliminated silent error-swallowing in `customListsService.ts`. Appended explicit `.throwOnError()` and error verification to all Supabase `.insert()`, `.update()`, and `.delete()` calls on `custom_lists` and `list_items`.
    *   Added explicit authentication session guards (`getAuthenticatedUserId()`) across `createCustomList`, `updateCustomList`, `deleteCustomList`, `addTitleToList`, and `removeTitleFromList`, throwing immediate clear exceptions (`"User session not found. Please log in..."`) rather than silently skipping Supabase writes.
    *   Added rich diagnostic `console.error` logs detailing exact payloads, list IDs, title IDs, and Supabase error responses before throwing.
    *   Guaranteed localStorage caching only updates after persistence succeeds, allowing UI components (`<AddToListModal />`, `<CustomListsSection />`) to immediately catch errors and present red error toasts to the user.
7.  **Custom Lists RLS Overhaul & Local Storage De-Ghosting:**
    *   Completely dropped and recreated all RLS policies for `custom_lists` and `list_items` to guarantee authenticated user (`auth.uid() = user_id`) full SELECT, INSERT, UPDATE, and DELETE access while preserving public list visibility.
    *   Audited `customListsService.ts`: upgraded `isValidUUID` to standard 36-char hex UUID format to prevent falsely invalidating Supabase UUIDs, revamped `fetchUserCustomLists` and `addTitleToList` to prioritize Supabase data without aggressively wiping out items with empty arrays, added resilient merging between database state and local cached items, and handled idempotent duplicate key checks gracefully.
8.  **Custom Lists UUID Schema & Session RLS Alignment:**
    *   Enforced strict RFC 4122 UUID v4 generation (`generateUUID()`, `isValidUUID()`) across client-side list creation and media item associations.
    *   Eliminated temporary string IDs (`list_...` and `item_...`) that triggered PostgreSQL `invalid input syntax for type uuid`.
    *   Guaranteed `user_id` is strictly retrieved from the active Supabase session (`supabase.auth.getUser()`), perfectly satisfying RLS `WITH CHECK (auth.uid() = user_id)`.
    *   Added automatic migration/healing for any legacy IDs stored in localStorage, and ensured parent custom lists are synced to Supabase before inserting into `list_items`.
9.  **Custom Lists Persistence & RLS Resolution:**
    *   Fixed Supabase silent rejection on `list_items` insertions by ensuring payloads in `customListsService.ts` include `user_id`, `media_id`, `title_id`, and `media_type`.
    *   Updated RLS policies to directly evaluate `auth.uid() = user_id` alongside parent list ownership.
    *   Added prominent red error toasts in both `<AddToListModal />` and `<CustomListsSection />` with automatic error messaging rather than silent optimistic reverts.

---

## Documentation & Agent Workflow System

TrackUP enforces a four-tier persistent documentation architecture:

*   **Primary Operational State:** This file ([`APP_STATE.md`](APP_STATE.md)) is the single source of truth for current architecture, active schema, synchronization contracts, and recent milestones. Always inspect this document first.
*   **Operational Directives & Agent Rules:** Consult [`AGENTS.md`](AGENTS.md) for agent operational directives, design system constraints, database safety rules, and documentation maintenance workflows.
*   **Engineering Standards & Playbooks:** Consult [`MASTER_DEVELOPMENT_PLAYBOOK.md`](MASTER_DEVELOPMENT_PLAYBOOK.md) for code patterns, React Query conventions, Supabase error handling, testing gates, and verification procedures.
*   **Historical Archive:** Consult [`docs/ARCHIVE_HISTORY.md`](docs/ARCHIVE_HISTORY.md) for past development phases (Phases 1–7) and historical milestones.
