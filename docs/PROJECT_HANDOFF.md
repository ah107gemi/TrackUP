# TRACKUP: TECHNICAL ARCHITECTURE & DEPLOYMENT HANDOFF
**Project Name:** TrackUp ("Track what you love.")  
**Version:** 1.0.0-Production-Ready  
**Date:** 2026-10-25  
**Repository Path:** `D:\Antigravity.google\TrackUP`  
**Git Branch:** `main`  
**License:** Private / Proprietary  

---

## 1. Executive Summary & Product Architecture

TrackUp is a high-performance, responsive entertainment and reading tracker tailored for 6 distinct content formats:
1. **Movies** (Feature films, documentaries, stand-up specials)
2. **TV Shows** (Multi-season television programs with episodic tracking)
3. **Anime Series** (Broadcast Japanese animation with seasonal and absolute episode tracking)
4. **Anime Films** (Theatrical and feature-length anime movies)
5. **Manga** (Japanese serialized graphic novels with volume and fractional chapter steppers)
6. **Manhwa** (South Korean serialized webtoons classified via AniList origin country `KR`)

The system eliminates tracking fragmentation by providing a unified catalog, granular optimistic progress tracking, spoiler-safe reviews, social graph rating comparisons, staged multi-platform CSV imports, a smart recommendation engine, and a weekly release radar calendar.

```
                      +---------------------------------------+
                      |          TrackUp Frontend             |
                      |   Vite + React 18 + TS + Tailwind     |
                      |  (#101014 / #16161D / #FFC400 Theme)  |
                      +-------------------+-------------------+
                                          |
        +---------------------------------+---------------------------------+
        |                                 |                                 |
+-------v-------+                 +-------v-------+                 +-------v-------+
|  Zustand UI   |                 | TanStack Query|                 | Normalization |
|  State Store  |                 | Optimistic UI |                 |  Layer (Mock  |
|  (Nav, Tabs,  |                 | (Granular +1  |                 |  + TMDB/AL    |
|   View Modes) |                 |  Eps & Chaps) |                 |   Adapters)   |
+---------------+                 +-------+-------+                 +---------------+
                                          |
                      +-------------------v-------------------+
                      |      Supabase Client (PostgreSQL)     |
                      |     Row Level Security (100% RLS)     |
                      |   Stored Procedures (RPCs) & Triggers |
                      +-------------------+-------------------+
                                          |
                 +------------------------+------------------------+
                 |                        |                        |
         +-------v-------+        +-------v-------+        +-------v-------+
         | User Libraries|        | Reviews/Social|        | Release Radar |
         | & Granular    |        | & Follow Feed |        | & Smart Recs  |
         | Tracking Logs |        | (Delta Scores)|        | (Cross-Format)|
         +---------------+        +---------------+        +---------------+
```

---

## 2. Frontend Architecture & Design System

### 2.1 Design Tokens
The visual identity follows an editorial dark aesthetic with high-contrast golden-yellow interactive accents:
- **Background Canvas (`bg-background`):** `#101014`
- **Surface Cards & Sidebars (`bg-surface`):** `#16161D`
- **Elevated Surfaces & Borders (`bg-surface-elevated`):** `#1F1F29`
- **Primary Accent (`bg-accent` / `text-accent`):** `#FFC400` (Amber Yellow)
- **Accent Hover (`bg-accent-hover`):** `#FFD033`
- **Text Primary (`text-text-primary`):** `#F4F4F6`
- **Text Secondary (`text-text-secondary`):** `#A1A1AA`
- **Text Muted (`text-text-muted`):** `#71717A`

### 2.2 Key Navigation & Layout Components
- [`DesktopSidebar.tsx`](file:///D:/Antigravity.google/TrackUP/src/components/layout/DesktopSidebar.tsx): Collapsible sidebar (`260px` expanded, `72px` collapsed) with brand wordmark and quick links: Dashboard, Discover, Watch Library, Reading Library, Airing Calendar, Recommended, History & Stats, Import/Export, and Community Feed.
- [`TopUtilityBar.tsx`](file:///D:/Antigravity.google/TrackUP/src/components/layout/TopUtilityBar.tsx): Sticky glassmorphic header displaying personalized greetings, keyboard-shortcut Omnisearch trigger (`Cmd+K` / `Ctrl+K`), and user authentication modal pills.
- [`MobileBottomNav.tsx`](file:///D:/Antigravity.google/TrackUP/src/components/layout/MobileBottomNav.tsx): Fixed bottom navigation bar with iOS/Android safe-area inset padding (`pb-[env(safe-area-inset-bottom)]`) featuring Home, Discover, Watch, Read, Calendar, For You, Import, and Profile.
- [`OmnisearchModal.tsx`](file:///D:/Antigravity.google/TrackUP/src/components/layout/OmnisearchModal.tsx): Live multi-category modal search across all 6 formats with instant keyboard focus, escape dismissal, and direct navigation to title details.

### 2.3 Feature Modules
- **Library Tracking ([`LibraryView.tsx`](file:///D:/Antigravity.google/TrackUP/src/features/library/LibraryView.tsx)):** Supports 6 statuses (`planned`, `active`, `completed`, `paused`, `dropped`, `reconsuming`) and 3 view modes (`grid`, `compact`, `list`) persisted via Zustand.
- **Granular Progress Engine ([`useLibrary.ts`](file:///D:/Antigravity.google/TrackUP/src/features/library/useLibrary.ts)):** Optimistic UI updates with TanStack Query. Instant `+1 Episode` checkmarks, season batch completions, and fractional chapter increments (`12.5`).
- **Ratings & Reviews ([`StarRating.tsx`](file:///D:/Antigravity.google/TrackUP/src/components/ui/StarRating.tsx) & [`ReviewModal.tsx`](file:///D:/Antigravity.google/TrackUP/src/features/reviews/ReviewModal.tsx)):** 5-star rating selector with 0.5-star split touch targets (stored losslessly as 1–10 `SMALLINT`). Spoiler protection banner with interactive reveal toggle.
- **CSV Import & Export Engine ([`ImportExportView.tsx`](file:///D:/Antigravity.google/TrackUP/src/features/import-export/ImportExportView.tsx)):** Idempotent 7-step pipeline supporting Letterboxd, IMDb, Trakt, and MyAnimeList (MAL) CSV formats with duplicate handling policies (`skip`, `fill`, `overwrite`) and 1-click normalized CSV backup export.
- **Social Graph & Rating Comparison ([`SocialFeedView.tsx`](file:///D:/Antigravity.google/TrackUP/src/features/social/SocialFeedView.tsx) & [`RatingComparisonWidget.tsx`](file:///D:/Antigravity.google/TrackUP/src/features/social/RatingComparisonWidget.tsx)):** Follow/unfollow members, community activity feed, and side-by-side rating comparisons showing delta alignment (e.g., `+1.0 ★ higher`).
- **Smart Recommendations ([`RecommendationsView.tsx`](file:///D:/Antigravity.google/TrackUP/src/features/catalog/RecommendationsView.tsx)):** Cross-format adaptation shelf (*"Finished the Manga? Watch the Anime"*), genre affinity scoring based on user tracking history, and community top picks.
- **Weekly Release Calendar ([`ReleaseCalendarView.tsx`](file:///D:/Antigravity.google/TrackUP/src/features/calendar/ReleaseCalendarView.tsx)):** Day-by-day (Sun–Sat) schedule tracking upcoming broadcast episodes and chapter drops with a "My Tracked Only" filter toggle.

---

## 3. Database Architecture & PostgreSQL Schema

The backend is built on Supabase (PostgreSQL 15+) across 5 ordered migrations located in `supabase/migrations/`:

```
supabase/migrations/
├── 20261025000001_initial_schema.sql                  # Core enums, catalog, library, logs, RLS
├── 20261025000002_progress_rpc.sql                    # Atomic episode/reading progress RPCs
├── 20261025000003_reviews_and_stats.sql               # Review visibility & analytics stats RPC
├── 20261025000004_social_graph.sql                    # Social follows & rating comparison RPCs
└── 20261025000005_phase7_recommendations_and_releases.sql # Airing schedules, recs & indexes
```

### 3.1 Tables Overview
| Table Name | Description | Key Constraints & RLS |
| :--- | :--- | :--- |
| `public.profiles` | User profiles, avatars, bios, and visibility settings | 1-to-1 with `auth.users(id)`. RLS: Owner updates; public/follower views. |
| `public.catalog_titles` | Global normalized media titles across all 6 formats | Unique ID. RLS: Public read-only; admin upserts. |
| `public.catalog_seasons` | Television and anime series season metadata | Foreign key to `catalog_titles(id)`. RLS: Public read-only. |
| `public.catalog_episodes` | Individual episodes with runtime and air dates | Foreign key to `catalog_seasons(id)`. RLS: Public read-only. |
| `public.title_relationships`| Cross-format bridges (adaptations, prequels, sequels) | Links `source_title_id` and `target_title_id`. RLS: Public read-only. |
| `public.user_libraries` | User tracking status, star rating, private notes | Composite unique `(user_id, title_id)`. RLS: Owner writes; visibility-aware reads. |
| `public.user_episode_progress` | Individual episode watch timestamps | Composite unique `(user_id, episode_id)`. RLS: Owner access only. |
| `public.user_reading_progress` | Granular reading progress (chapter & volume) | Foreign key to `user_libraries(id)`. RLS: Owner access only. |
| `public.watch_history` | Append-only historical log of episode watch events | Append-only log. RLS: Owner access only. |
| `public.reading_history` | Append-only historical log of chapter read events | Append-only log. RLS: Owner access only. |
| `public.reviews` | User reviews, 1-10 ratings, spoiler flags | Unique `(user_id, title_id)`. RLS: Respects review visibility. |
| `public.user_favorites` | Showcase of user's pinned titles on profile | Unique `(user_id, title_id)`. RLS: Respects profile privacy. |
| `public.import_batches` | Staged CSV import jobs and progress tracking | RLS: Owner access only. |
| `public.import_batch_items` | Individual rows parsed from external platform exports | Foreign key to `import_batches(id)`. RLS: Owner access only. |
| `public.user_follows` | Social graph follow/unfollow relationships | Check `follower_id <> following_id`. RLS: Follower creates/deletes. |
| `public.catalog_release_schedules` | Airing calendar broadcasts and chapter drops | Day-of-week index (0-6). RLS: Public read-only. |

### 3.2 Database RPCs (Stored Procedures)
- `log_episode_progress(p_user_id, p_episode_id, p_watched)`: Atomically logs episode progress, touches `user_libraries.last_progressed_at`, and logs to `watch_history`.
- `log_reading_progress(p_user_id, p_library_id, p_chapter, p_volume)`: Atomically updates reading milestones, sets `last_progressed_at`, and appends to `reading_history`.
- `get_user_statistics(p_user_id)`: Server-side aggregation calculating total episodes watched, chapters read, watch time (days/hours), and distribution percentages across all 6 formats.
- `get_following_activity_feed(p_user_id, p_limit)`: Aggregates recent progress and reviews from followed users respecting target user privacy settings.
- `get_rating_comparison(p_current_user_id, p_target_user_id)`: Generates side-by-side score breakdown and calculates delta alignment between friends.
- `get_user_recommendations(p_user_id, p_limit)`: Queries cross-format adaptations from `title_relationships` and scores candidates using genre frequency unnesting.
- `get_upcoming_releases(p_user_id, p_day_of_week)`: Returns scheduled broadcasts and chapter releases for any day with a boolean flag indicating if the title is in the user's library.
- `commit_import_batch(p_batch_id, p_duplicate_strategy)`: Idempotently upserts resolved staged items into `user_libraries`.

---

## 4. Environment Variables Configuration

Create a local `.env.local` file in `TrackUP/` (already configured in `.gitignore`):

```bash
# ==============================================================================
# TrackUp Environment Variables
# ==============================================================================

# 1. Supabase Client Connection (Required for Local Dev & Production)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 2. TMDB Metadata API (Required for Supabase Edge Functions & Remote Metadata)
TMDB_READ_ACCESS_TOKEN=eyJhbGciOiJIUzI1NiJ9...

# 3. Supabase Service Role Secret (CI/CD, Migrations & Automated Keepalive)
# NEVER commit or expose to client bundles!
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 5. Render Production Hosting Guide (Frontend Static Site)

Render provides high-performance zero-downtime hosting for Vite React applications with automatic Brotli compression, free SSL, and global CDN distribution.

### Step 1: Create a New Static Site on Render
1. Log in to the [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** in the top navigation bar and select **Static Site**.
3. Connect your GitHub repository (`TrackUp`).

### Step 2: Configure Build & Runtime Settings
In the Static Site configuration form, specify:
- **Name:** `trackup` (or your preferred site name)
- **Branch:** `main`
- **Root Directory:** *(Leave blank if repo root is the app root, or specify `TrackUP` if nested)*
- **Build Command:**
  ```bash
  npm install && npm run build
  ```
- **Publish Directory:**
  ```bash
  dist
  ```

### Step 3: Configure Environment Variables on Render
Under the **Environment Variables** tab for your Render Static Site, add:
- `VITE_SUPABASE_URL`: Your production Supabase project URL (`https://<project-ref>.supabase.co`).
- `VITE_SUPABASE_ANON_KEY`: Your production Supabase public anonymous key.

### Step 4: Configure Single Page Application (SPA) Rewrite Rule
Because TrackUp is a client-side Single Page Application (React Router / Zustand navigation), all subroutes must resolve to `index.html`:
1. In your Render Static Site settings, navigate to the **Redirects / Rewrites** tab.
2. Click **Add Rule** and enter:
   - **Type:** `Rewrite`
   - **Source:** `/*`
   - **Destination:** `/index.html`
3. Click **Save Changes**.

### Step 5: Trigger Initial Deployment
Click **Manual Deploy** -> **Deploy latest commit**. Render will run `npm install`, compile TypeScript via `tsc`, run Vite bundling, and deploy your site to `https://trackup.onrender.com`.

---

## 6. Supabase Cloud Linking & Migration Guide

When you are ready to link the repository to a remote Supabase Cloud project:

### Step 1: Log in via Supabase CLI
```powershell
npx.cmd supabase login
```
This opens a browser authentication window to authenticate your CLI session with your Supabase account.

### Step 2: Link Local Repository to Remote Project
Locate your remote project reference ID from your Supabase Dashboard (`https://supabase.com/dashboard/project/<PROJECT_REF>`):
```powershell
cd D:\Antigravity.google\TrackUP
npx.cmd supabase link --project-ref <PROJECT_REF>
```
When prompted for your database password, enter the PostgreSQL password set during project creation.

### Step 3: Push Database Migrations
Deploy all 5 version-controlled schema migrations to your remote Supabase PostgreSQL database:
```powershell
npx.cmd supabase db push
```
This executes:
- `20261025000001_initial_schema.sql`
- `20261025000002_progress_rpc.sql`
- `20261025000003_reviews_and_stats.sql`
- `20261025000004_social_graph.sql`
- `20261025000005_phase7_recommendations_and_releases.sql`

### Step 4: Configure Authentication in Supabase Cloud Dashboard
1. Go to **Authentication** -> **Providers** in the Supabase Dashboard.
2. Ensure **Email / Password** provider is enabled.
3. If enabling **Google OAuth**, input your Google Client ID & Secret and set the redirect URL to:
   `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
4. In **Authentication** -> **URL Configuration**, set:
   - **Site URL:** Your production Render URL (`https://trackup.onrender.com`)
   - **Redirect URLs:** `http://localhost:5173/**`, `https://trackup.onrender.com/**`

### Step 5: (Optional) Deploy Supabase Edge Functions
If third-party API proxying is desired for live TMDB/AniList sync:
```powershell
npx.cmd supabase secrets set TMDB_READ_ACCESS_TOKEN="<YOUR_TMDB_TOKEN>"
npx.cmd supabase functions deploy catalog-search
npx.cmd supabase functions deploy catalog-detail
```

---

## 7. One-Click GitHub Sync & Deployment Script

To make syncing and pushing to GitHub seamless from Windows, two automation scripts are included in the repository root:
1. [`deploy-github.ps1`](file:///D:/Antigravity.google/TrackUP/deploy-github.ps1) (PowerShell automation script)
2. [`deploy-github.bat`](file:///D:/Antigravity.google/TrackUP/deploy-github.bat) (Double-clickable Windows batch wrapper)

### Usage Instructions
Simply double-click `deploy-github.bat` or run in PowerShell:
```powershell
cd D:\Antigravity.google\TrackUP
.\deploy-github.ps1
```

The script will:
1. Verify Git is installed and initialized.
2. Check if a remote `origin` exists (if not, it prompts you to paste your GitHub repo URL, e.g., `https://github.com/your-username/trackup.git`).
3. Check for unstaged changes and prompt for a commit message (or default to a clean timestamped commit).
4. Pull remote changes with rebase safety (`git pull --rebase origin main`).
5. Push the active `main` branch to GitHub (`git push -u origin main`).
6. Report sync status.

---

## 8. Verification & Test Suite Summary

Every phase was verified using rigorous automated test suites:
- **Unit & RLS Isolation Tests (Vitest):** `tests/unit/*.test.ts`
  - 45 tests covering TMDB/AniList normalization, URL sanitization, RLS isolation policies, spoiler visibility guards, CSV format parsers, cross-format recommendation heuristics, and release calendar filters.
- **End-to-End Multi-Viewport Tests (Playwright):** `tests/e2e/*.spec.ts`
  - 28 tests running simultaneously across Desktop (`1440x900`) and Mobile Viewport (`390x844`) covering auth flows, Omnisearch, adaptive detail layouts, granular +1 increments, star ratings, CSV staging, social follows, rating comparisons, and weekly calendar navigation.
- **Total Automated Tests:** **73 / 73 passed (100% pass rate)**.
- **Type Checking:** Clean pass (`tsc --noEmit`).
- **Production Build:** Clean pass (`npm run build`).

---

## 9. Modular File Map & Quick Reference

```
TrackUP/
├── .github/
│   └── workflows/
│       ├── ci.yml                             # Automated GitHub Actions CI pipeline
│       └── supabase-keepalive.yml             # 5-day scheduled ping for free-tier Supabase
├── docs/
│   ├── PROJECT_HANDOFF.md                     # This comprehensive technical handoff document
│   ├── PROJECT_HANDOFF.docx                   # Word document export for non-technical stakeholders
│   ├── DATABASE_SCHEMA.md                     # Markdown database schema documentation
│   ├── DATABASE_SCHEMA_DIAGRAM.md             # Mermaid ERD visual architecture diagram
│   └── DATA_DICTIONARY.md                     # PostgreSQL data dictionary
├── public/
│   ├── assets/
│   │   └── trackup-logo.jpg                   # Official TrackUp golden-yellow brand logo
│   └── manifest.json                          # PWA Web App Manifest
├── src/
│   ├── components/
│   │   ├── layout/                            # DesktopSidebar, MobileBottomNav, TopUtilityBar, Omnisearch
│   │   ├── shared/                            # MediaPosterCard, TmdbAttribution
│   │   └── ui/                                # StarRating
│   ├── features/
│   │   ├── auth/                              # Supabase AuthContext, AuthModal, ProfileModal
│   │   ├── calendar/                          # Weekly Airing Radar & ReleaseCalendarView
│   │   ├── catalog/                           # Normalizers, SearchPage, TitleDetailPage, RecommendationsView
│   │   ├── dashboard/                         # DashboardStats, UpNext cards
│   │   ├── favorites/                         # FavoritesShowcase
│   │   ├── history/                           # HistoryTimeline
│   │   ├── import-export/                     # CSV Import pipeline, Parsers, ImportExportView
│   │   ├── library/                           # LibraryView, useLibrary, granular progress mutations
│   │   ├── recommendations/                   # Heuristic recommendation engine & types
│   │   ├── reviews/                           # ReviewCard, ReviewModal, spoiler reveal logic
│   │   └── social/                            # SocialFeedView, RatingComparisonWidget, socialService
│   ├── lib/                                   # queryClient, supabase client, validators
│   ├── stores/                                # uiStore (Zustand)
│   └── types/                                 # database.types.ts
├── supabase/
│   ├── migrations/                            # 5 version-controlled schema migrations
│   └── config.toml                            # Local Supabase CLI configuration
├── tests/
│   ├── e2e/                                   # 8 Playwright test specs (28 tests across viewports)
│   └── unit/                                  # 7 Vitest test specs (45 unit/RLS tests)
├── deploy-github.bat                          # One-click Windows batch sync & push script
├── deploy-github.ps1                          # PowerShell automated deployment script
└── package.json                               # Dependencies & scripts
```
