# 2. TRACKUP_MASTER_BLUEPRINT.md

```markdown
# TRACKUP MASTER BLUEPRINT

## 1. Executive Vision & Product Scope
**TrackUp** (*"Track what you love."*) is a hosted, multi-user, responsive entertainment and reading tracker built for movies, television, anime, manga, and manhwa. It operates 24/7 in the cloud so the developer and friends can access it from mobile phones and desktop browsers without keeping a local laptop running.

### 1.1 Supported Content Categories (First-Class Support from Day 1)
TrackUp strictly separates viewing formats from reading formats while storing all titles in a unified catalog:

| Category Enum | Domain Group | Progress Unit | Secondary Unit | Primary Metadata Source |
| :--- | :--- | :--- | :--- | :--- |
| `movie` | **WATCH** | Completion Status + Watch Count | Runtime (minutes) | TMDB (`movie`) |
| `tv` | **WATCH** | Season # + Episode # | Episode Count | TMDB (`tv`) |
| `anime_series` | **WATCH** | Season/Absolute Episode # | Episode Count | TMDB (`tv`) + AniList (`ANIME` / `TV`, `ONA`, `OVA`) |
| `anime_film` | **WATCH** | Completion Status + Watch Count | Runtime (minutes) | TMDB (`movie`) + AniList (`ANIME` / `MOVIE`) |
| `manga` | **READ** | Chapter # | Volume # | AniList (`MANGA`, `countryOfOrigin: JP`) |
| `manhwa` | **READ** | Chapter # | Volume / Season # | AniList (`MANGA`, `countryOfOrigin: KR`) |

*Architectural Rule:* Never treat `anime_film` as reading material or episodic TV, and never force `manga` or `manhwa` into season/episode tables.

---

## 2. Comprehensive Audit Lessons from CourseVault

Every architectural decision in TrackUp is grounded in verified findings from `COURSEVAULT_TECHNICAL_AUDIT_FOR_TRACKUP.md`[cite: 2].

| Audit Area | 1. What CourseVault Currently Does (Verified) | 2. Why Appropriate or Inappropriate for TrackUp | 3. What TrackUp Must Do Instead | 4. Useful Pattern to Preserve | 5. Mandatory Rule for Antigravity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Architecture & Modularity** | Places all logic inside a single 4,436-line `CourseVaultApp` class in `app.js` with zero build tooling[cite: 2]. | **Inappropriate:** TrackUp has 6 content types, nested seasons/chapters, CSV staging, and social profiles. A single file will become unmaintainable[cite: 2]. | Use Vite + React + TypeScript with feature-scoped modules (`features/library`, `features/catalog`, `features/import`)[cite: 2]. | Keep initial bundle startup fast via route-based code splitting. | Never create files exceeding 350 lines; split UI components, hooks, and API services into distinct modules. |
| **2. Frontend Structure** | Uses raw `innerHTML` template strings and re-binds ~60 DOM IDs manually on every render[cite: 2]. | **Inappropriate:** Causes focus loss on inputs, event listener detachment, and XSS vulnerabilities[cite: 2]. | Use declarative React JSX components and Radix UI (`shadcn/ui`) accessible primitives[cite: 2]. | Preserve keyboard-first ergonomics (`Cmd+K` omnisearch, `Escape` modal dismissal)[cite: 2]. | Never use `dangerouslySetInnerHTML` or raw DOM manipulation (`document.getElementById`) in React components. |
| **3. State Management** | Mutates in-memory arrays (`this.courses`) and dumps JSON to `localStorage`[cite: 2]. | **Inappropriate:** Multi-user relational data cannot live entirely in browser memory or `localStorage`[cite: 2]. | Use **TanStack Query** for server-state caching and optimistic mutations, and **Zustand** only for lightweight UI state (sidebar open, active view mode)[cite: 2]. | Preserve **optimistic UI updates** so marking an episode or chapter feels instantaneous[cite: 2]. | Do not duplicate Supabase server records inside Zustand stores; use TanStack Query cache keys as the single source of truth. |
| **4. Database Design** | Serializes a user's entire library into a single Firestore document (`users/{uid}`)[cite: 2]. | **Inappropriate:** Hits Firestore's 1 MB document limit and causes full-document overwrite collisions[cite: 2]. | Use a normalized PostgreSQL schema in Supabase with dedicated tables for catalog, library entries, episode progress, and reading progress[cite: 2]. | Preserve startup schema validation concepts via versioned SQL migrations (`supabase/migrations/`)[cite: 2]. | Never store a user's library or progress history as a monolithic JSONB blob. |
| **5. Authentication** | Uses Google OAuth + a synthetic Username/4-digit PIN mapped to `${user}@coursevault.internal` with static salt `${pin}__vault`[cite: 2]. | **Inappropriate:** Critical security flaw; 4-digit PINs have only 10,000 combinations, lack account recovery, and allow username Squatting/hijacking[cite: 2]. | Use native **Supabase Auth** (Email + Password with strong password policy, Password Reset email flows, and Google OAuth)[cite: 2]. | Preserve automatic fallback from popup to redirect OAuth on mobile browsers[cite: 2]. | Never implement synthetic email/PIN authentication workarounds. |
| **6. Data Privacy & Security** | Relies on client-side checks and `escapeHtml` that fails to strip `javascript:` links[cite: 2]. | **Inappropriate:** Any authenticated user can query the backend API directly if RLS is missing, and malicious links can trigger XSS[cite: 2]. | Enforce PostgreSQL **Row-Level Security (RLS)** on every table and validate all external URLs against `http:`/`https:` protocols[cite: 2]. | None (CourseVault's security model must be replaced)[cite: 2]. | Every database table must have RLS enabled in the same migration that creates it, verified by automated negative tests. |
| **7. API Integration** | Uses client-side regex to parse YouTube video/playlist IDs directly in the browser[cite: 2]. | **Inappropriate:** TrackUp requires secret API tokens (TMDB) and normalized cross-provider metadata (TMDB + AniList)[cite: 2]. | Route external metadata searches and details through **Supabase Edge Functions** that normalize responses and hide secret keys[cite: 2]. | Preserve URL normalization utilities for clean deduplication. | Never embed `TMDB_READ_ACCESS_TOKEN` or `SUPABASE_SERVICE_ROLE_KEY` in client-side `VITE_*` variables. |
| **8. Caching** | Uses a manual Service Worker (`sw.js`) with a hard-coded `CACHE_NAME` string (`coursevault-v2.9.1`)[cite: 2]. | **Inappropriate:** Forgetting to bump the version string caused mobile users to remain stuck on stale JS/CSS builds[cite: 2]. | Use Vite content-hashed asset filenames on Vercel + TanStack Query (`staleTime`) + PostgreSQL `catalog_titles` caching[cite: 2]. | Preserve separation between static app shell caching and external poster image caching[cite: 2]. | Do not write a manual service worker with hard-coded version strings that caches application JS bundles indefinitely. |
| **9. Responsive Design** | Separates desktop sidebar (`270px`) from mobile off-canvas drawer + sticky bottom bar with `env(safe-area-inset-bottom)` and keyboard scroll padding[cite: 2]. | **Highly Appropriate:** Tested and proven ergonomics for both desktop and mobile browsers[cite: 2]. | Translate these exact layout mechanics into Tailwind CSS utilities and responsive `shadcn/ui` Sheet/Drawer primitives[cite: 2]. | Preserve the 3 view modes (`Grid`, `Compact`, `List`), mobile bottom bar safe-areas, and keyboard-aware modal padding[cite: 2]. | Test every screen at both `1440x900` (Desktop) and `390x844` (Mobile) viewports in Playwright before marking a phase complete[cite: 2]. |
| **10. Automated Testing** | Zero committed unit or E2E tests; relied on temporary scratch scripts[cite: 2]. | **Inappropriate:** Led to regressions when modifying shared UI or state logic[cite: 2]. | Build a committed **Playwright** E2E suite and **Vitest** unit test suite running on every phase milestone[cite: 2]. | Preserve the practice of testing mobile viewports in a real headless browser[cite: 2]. | No phase is complete until its Playwright and Vitest test suites pass with zero errors. |
| **11. Deployment** | Pushes raw unbundled files to GitHub Pages on the `main` branch[cite: 2]. | **Inappropriate:** Lacks TypeScript compilation checks, preview environments, and serverless edge functions[cite: 2]. | Deploy frontend to **Vercel** (with PR preview deployments) and backend functions/migrations to **Supabase**[cite: 2]. | Preserve one-command / automated Git push deployment simplicity[cite: 2]. | Configure GitHub Actions / Vercel build checks so broken TypeScript or failing tests block production deployment. |
| **12. Data Migration & Backup** | Exports/imports a single raw JSON dump with basic Merge/Replace modes[cite: 2]. | **Partially Appropriate:** JSON backup is useful, but TrackUp users need structured CSV imports from third-party trackers (Letterboxd, IMDb, Trakt) with title matching. | Build a staged CSV Import/Export pipeline with column mapping, candidate resolution, and idempotent commits. | Preserve the ability for a user to export their entire TrackUp library at any time as a portable file[cite: 2]. | Never auto-commit ambiguous CSV title matches without user confirmation in a staging preview. |

---

## 3. Feature Evaluation & Phasing Strategy
No requirement is dropped. Features are prioritized so the core tracking engine and migration pipeline are rock-solid before social graph features are layered on top:

| Feature | Release Phase | Architectural Justification |
| :--- | :--- | :--- |
| **Auth, Account Recovery & Profile Management** | **Phase 1 (MVP Core)** | Required for multi-user isolation and RLS enforcement from Day 1. |
| **Responsive App Shell (Desktop Sidebar + Mobile Bottom Bar)** | **Phase 1 (MVP Core)** | Prevents costly retrofitting of mobile ergonomics later. |
| **Unified Catalog Search & Discovery (All 6 Content Types)** | **Phase 2 (MVP Core)** | Required before users can add items to their libraries. |
| **Title Detail Pages (Posters, Backdrops, Cast, Related Works)** | **Phase 2 (MVP Core)** | Core inspection experience for both Watch and Read titles. |
| **Personal Libraries, Watchlists & Reading Lists (6 Statuses)** | **Phase 3 (MVP Core)** | Primary value proposition (`planned`, `active`, `completed`, `paused`, `dropped`, `reconsuming`). |
| **Episode Progress (TV/Anime) & Chapter/Volume Progress (Manga/Manhwa)** | **Phase 3 (MVP Core)** | Core tracking functionality across all 6 required media types. |
| **Ratings, Reviews, Favorites, Watch/Reading History & Stats** | **Phase 4 (MVP Core)** | Essential personal tracking depth and dashboard analytics. |
| **CSV Import & Export Migration System** | **Phase 5 (MVP Core)** | Critical onboarding requirement so users don't rebuild libraries by hand. |
| **Following Friends, Shared Reviews & Rating Comparisons** | **Phase 6 (Post-MVP Release)** | Deferred until personal libraries and privacy settings are populated and verified; database tables (`user_follows`, `activity_logs`, privacy flags) are designed now so no destructive migration is needed later. |
| **Personalized Recommendations Engine** | **Phase 7 (Post-MVP Release)** | Deferred until user ratings, favorites, and `title_relationships` data exist to seed meaningful recommendations alongside TMDB/AniList similar-title endpoints. |

---

## 4. CSV Import and Export Architecture

### 4.1 Verified External Tracker Formats
Before designing the parser, official export formats were verified:
1. **Letterboxd:**
   - *Format:* Downloads a `.zip` containing individual CSVs: `watched.csv` (`Date, Name, Year, Letterboxd URI`), `ratings.csv` (`Date, Name, Year, Letterboxd URI, Rating`), `diary.csv` (`Date, Name, Year, Letterboxd URI, Rating, Rewatch, Tags, Watched Date`), `watchlist.csv` (`Date, Name, Year, Letterboxd URI`), and `reviews.csv`.
   - *Nuances:* Ratings are `0.5` to `5.0` stars (must be multiplied by 2 to normalize to TrackUp's integer `1–10` internal scale, displayed as 5 stars with half-stars). Does **not** contain TMDB IDs in the user CSV; requires matching by `Name` + `Year` (`movie` / `anime_film`).
2. **IMDb:**
   - *Format:* CSV files for Watchlist and Ratings (`Const, Your Rating, Date Rated, Title, URL, Title Type, IMDb Rating, Runtime (mins), Year, Genres, Num Votes, Release Date, Directors`).
   - *Nuances:* `Const` is the exact IMDb ID (`tt1234567`), which TMDB's `/find/{external_id}?external_source=imdb_id` endpoint resolves with 100% precision. Ratings are integers `1–10`. Does **not** include episode-level progress for TV shows.
3. **Trakt:**
   - *Format:* Native account data export produces `.json` files, while list exports and third-party tools produce `.csv` containing `trakt_id`, `imdb_id`, `tmdb_id`, `tvdb_id`, `title`, `year`, `type` (`movie`, `show`, `episode`), `watched_at`, and `rating` (`1–10`).
   - *Nuances:* TrackUp will support both standard CSV uploads and Trakt's flat CSV/JSON structure by inspecting external IDs first (`tmdb_id`, `imdb_id`) before falling back to title/year search.
4. **MyAnimeList (MAL) & AniList:**
   - *Format:* Official MAL exports are `.xml.gz` files (`<anime>`, `<manga>`, `<series_title>`, `<my_watched_episodes>`, `<my_read_chapters>`, `<my_read_volumes>`, `<my_score>`, `<my_status>`). Users frequently convert these to CSV or use generic CSV trackers.
   - *Nuances:* TrackUp's importer will use **PapaParse** for all `.csv` files (supporting automatic header detection and manual column mapping for anime/manga/manhwa columns like `Chapters Read`, `Volumes Read`, `Episodes Watched`, `MAL ID`, `AniList ID`) and include a lightweight client-side XML-to-row adapter so native MAL `.xml` exports can enter the exact same staging pipeline.

### 4.2 Staged Import Pipeline (7-Step Resilient Flow)
1. **Upload & Validation:** User uploads a `.csv` (or `.xml` for MAL) up to **5 MB** and **5,000 rows**. Client-side **PapaParse** parses rows in a Web Worker (`worker: true`) to prevent UI freezing.
2. **Format Detection & Column Mapping:** Auto-detects presets (`Letterboxd Diary/Watched/Watchlist`, `IMDb`, `Trakt`, `Generic CSV`) or allows manual mapping to TrackUp fields (`title`, `year`, `media_type`, `external_id`, `status`, `rating`, `episodes_watched`, `chapters_read`, `volumes_read`, `completed_at`, `notes`).
3. **Idempotency & Fingerprint Generation:** Each row generates a deterministic SHA-256 `row_fingerprint` based on `(normalized_title, year, media_type, external_id)`. A staging record is created in `import_batches` and `import_batch_items` with status `pending`.
4. **Throttled Metadata Resolution:** A Supabase Edge Function processes items in chunks, checking:
   - Local `catalog_titles` cache by external ID (`tmdb_id`, `imdb_id`, `anilist_id`, `mal_id`) or exact normalized title + year + type.
   - External APIs (TMDB `/find` or `/search`, AniList GraphQL) respecting rate limits.
   - classifies each row as `exact_match`, `ambiguous_match` (stores top 3 candidates in `candidate_matches` JSONB), `unmatched`, or `invalid`.
5. **Interactive Preview & Manual Resolution:**
   - User reviews a paginated summary: **Matched (Ready)**, **Needs Review (Ambiguous)**, **Already in Library (Duplicate)**, and **Unmatched/Errors**.
   - **Strict Adaptation Rule:** The resolver never auto-matches a `manga` row to an `anime_series` or vice versa. Ambiguous rows require the user to click the correct poster/adaptation or skip the row.
   - For duplicates already in `user_libraries`, user selects a batch policy: **Skip Existing**, **Fill Missing Fields Only** (default), or **Overwrite with Import**.
6. **Safe Cancellation or Atomic Commit:**
   - Clicking **Cancel Import** marks the `import_batches` record `cancelled` and deletes staged items without touching `user_libraries`.
   - Clicking **Commit Import** invokes a PostgreSQL RPC transaction (`commit_import_batch(batch_id)`) that upserts approved rows into `user_libraries`, `user_episode_progress`, `user_reading_progress`, and `watch_history`/`reading_history` atomically.
7. **Error Reporting & Export:**
   - Any skipped or unmatched rows can be downloaded as an `unmatched_rows_report.csv` for inspection.
   - Users can export their full TrackUp library at any time to a clean `trackup_library_export_YYYY-MM-DD.csv` containing all statuses, ratings, episode/chapter counts, external IDs (`tmdb_id`, `anilist_id`, `imdb_id`), and timestamps.

---

## 5. Media Metadata Providers & Normalization Layer

### 5.1 Provider Evaluation & Official Terms Verified

| Provider | Target Content Types | Authentication & Endpoint | Verified Rate Limits | Licensing, Attribution & Caching Rules |
| :--- | :--- | :--- | :--- | :--- |
| **TMDB API (v3/v4)** | `movie`, `tv`, `anime_series` (TV metadata/episodes), `anime_film` | Server-side Bearer Token (`Authorization: Bearer <token>`) to `https://api.themoviedb.org/3` | ~40–50 requests per second per IP address. | **Attribution Mandatory:** Must display the official TMDB logo and the exact notice: *"This product uses the TMDB API but is not endorsed or certified by TMDB."* Cache TTL is capped at a maximum of **6 months**. |
| **AniList GraphQL API v2** | `anime_series`, `anime_film`, `manga` (`countryOfOrigin: JP`), `manhwa` (`countryOfOrigin: KR`) | POST requests to `https://graphql.anilist.co` | **90 requests per minute** per IP (returns `X-RateLimit-Remaining` and `Retry-After` headers). | Free for non-commercial/personal applications; requires respectful caching and backoff on HTTP `429`. Distinguishes Manhwa from Manga natively via `type: MANGA` + `countryOfOrigin: "KR"`. |

*Regional Note (Libya):* Streaming watch-provider availability data (e.g., TMDB JustWatch integration) is frequently incomplete for Libya (`LY`). TrackUp will **not** rely on regional streaming links as a core feature; if displayed in later phases, it will clearly state region fallback or hide empty provider blocks.

### 5.2 Provider-Agnostic Normalization Layer
External API responses never touch React components directly. Supabase Edge Functions (`catalog-search`, `catalog-hydrate`) translate TMDB and AniList payloads into TrackUp's internal `NormalizedCatalogPayload` and upsert them into `catalog_titles`:
- **Provider Isolation:** External IDs are stored explicitly (`tmdb_id`, `imdb_id`, `anilist_id`, `mal_id`). A TMDB ID (`1399`) is never conflated with an AniList ID (`1399`).
- **Stale-While-Revalidate Database Cache:** Once a title is fetched into `catalog_titles`, subsequent user views read directly from Supabase PostgreSQL in `<30ms`. If `metadata_synced_at` is older than 14 days (for ongoing shows/manga) or 90 days (for completed works, well within TMDB's 6-month limit), a background refresh updates the row.

---

## 6. Proposed Technology Stack & Directory Structure

### 6.1 Final Stack Selection & Justification
- **React 18 + TypeScript + Vite:** Fast HMR, strict static typing across database and API payloads, and modular component boundaries[cite: 2].
- **Tailwind CSS + `shadcn/ui` + `lucide-react`:** Scoped styling using TrackUp design tokens (`#101014`, `#FFC400`) and accessible Radix UI primitives (Dialog, Sheet, Command, Tabs, Select)[cite: 2].
- **Supabase (PostgreSQL + Auth + RLS + Edge Functions + Storage):** Provides relational integrity, database-enforced row security, server-side secret protection for TMDB/AniList calls, and optional avatar storage[cite: 2].
- **TanStack Query v5:** Handles server-state caching, pagination, background refetching, and optimistic updates for episode/chapter increments[cite: 2].
- **Zustand:** Kept minimal—used *only* for persistent UI preferences (sidebar collapsed state, active library view mode `grid | compact | list`, and active filter chips)[cite: 2].
- **PapaParse + Zod:** High-performance client-side CSV parsing/serialization (`papaparse`) paired with strict runtime schema validation (`zod`) for forms, URLs, and API payloads.
- **Vitest + Playwright:** Vitest for fast unit testing of normalizers, CSV mappers, and URL validators; Playwright for full E2E browser testing across desktop and mobile viewports[cite: 2].
- **Vercel:** Zero-downtime atomic deployments, automatic HTTPS, and PR preview URLs[cite: 2].

### 6.2 Modular Repository Directory Tree
```text
TrackUp/
├── .github/workflows/
│   └── ci.yml                         # Typecheck, Vitest, and Playwright E2E pipeline
├── docs/
│   ├── DATABASE_SCHEMA.md             # Complete table & RLS documentation
│   ├── DATABASE_SCHEMA_DIAGRAM.md     # Mermaid ER Diagram maintained with migrations
│   └── DATA_DICTIONARY.md             # Column-by-column definitions and types
├── public/
│   └── assets/
│       └── trackup-logo.jpg           # Official supplied TrackUp brand asset
├── supabase/
│   ├── config.toml                    # Supabase CLI configuration
│   ├── functions/
│   │   ├── catalog-search/            # Unified TMDB + AniList search & normalization
│   │   ├── catalog-detail/            # Hydrates seasons, episodes, chapters, relations
│   │   └── import-resolver/           # Batch CSV title matching with rate-limit backoff
│   ├── migrations/
│   │   └── 20261025000001_initial_schema.sql
│   └── seed.sql                       # Safe development fixtures for testing
├── src/
│   ├── components/
│   │   ├── layout/                    # AppShell, DesktopSidebar, MobileBottomNav, Omnisearch
│   │   ├── ui/                        # shadcn/ui primitives (Button, Dialog, Sheet, etc.)
│   │   └── shared/                    # MediaPosterCard, StatusBadge, SafeExternalLink
│   ├── features/
│   │   ├── auth/                      # Login, Register, PasswordReset, AuthGuard
│   │   ├── dashboard/                 # HeroSpotlight, UpNextRow, StatsStrip, RecentRow
│   │   ├── catalog/                   # SearchPage, TitleDetailPage, CastRow, RelatedWorks
│   │   ├── library/                   # Watchlist, ReadingList, EpisodeTracker, ChapterTracker
│   │   ├── reviews/                   # RatingControl, ReviewEditor, HistoryTimeline
│   │   ├── import-export/             # CsvUploader, ColumnMapper, MatchResolutionTable
│   │   └── social/                    # ProfileView, FollowsList, RatingComparison (Phase 6)
│   ├── lib/
│   │   ├── supabase.ts                # Typed Supabase client instance
│   │   ├── queryClient.ts             # TanStack Query configuration
│   │   ├── validators.ts              # Zod schemas & http/https URL sanitizer
│   │   └── utils.ts                   # Classname helpers & date formatters
│   ├── stores/
│   │   └── uiStore.ts                 # Zustand store for sidebar & view-mode preferences
│   ├── types/
│   │   ├── database.types.ts          # Auto-generated Supabase PostgreSQL types
│   │   └── domain.types.ts            # Application-level TypeScript interfaces
│   ├── App.tsx                        # Router & top-level providers
│   └── main.tsx                       # Application entry point
├── tests/
│   ├── unit/                          # Vitest unit suites (CSV parser, URL sanitizer, normalizer)
│   └── e2e/                           # Playwright E2E suites (auth, RLS isolation, tracking, mobile)
├── .env.example                       # Template of required environment variables
├── playwright.config.ts               # Desktop + Mobile viewport test configurations
├── tailwind.config.ts                 # Design tokens (#101014, #FFC400)
├── tsconfig.json
└── package.json