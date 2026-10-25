# TRACKUP PHASED DEVELOPMENT ROADMAP

Every phase is a self-contained, testable milestone. Antigravity must complete one phase, run its automated verification suite, and present the results before advancing to the next phase.

---

## PHASE 0: Environment Audit, Repository Setup & Database Tooling
- **Objectives:** Audit local tooling, initialize Vite + React + TypeScript repository, configure Supabase CLI & MCP server, and establish CI/testing harness.
- **Features:** None (Infrastructure & verification foundation).
- **Database Changes:** Initialize `supabase/config.toml` and verify connection to `trackup-dev` project.
- **Files/Modules Expected:** `TRACKUP_ENVIRONMENT_SETUP.md` verification log, `package.json`, `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`, `.env.example`, `.gitignore`.
- **Dependencies:** Node.js LTS, Git, Supabase account (`trackup-dev` project).
- **Acceptance Criteria:**
  1. All tool versions verified and documented.
  2. Supabase MCP server or Supabase CLI linked strictly to `trackup-dev` (never production).
  3. `npm run build` and `npm run typecheck` succeed cleanly.
- **Automated Tests:** Smoke test in Vitest (`tests/unit/setup.test.ts`) and Playwright (`tests/e2e/smoke.spec.ts`) verifying the app boots at `http://localhost:5173`.
- **Manual Verification Steps:** Developer confirms `.env.local` is ignored by `git status` and inspects the connected Supabase project dashboard.
- **Risks & Unresolved Decisions:** Ensuring MCP has `project_ref` scoping enabled so account-wide commands are disabled.

---

## PHASE 1: Design System, Responsive App Shell, Auth & Initial Schema
- **Objectives:** Apply the complete initial PostgreSQL migration, build the `#101014` / `#FFC400` design system, implement responsive desktop/mobile navigation, and wire Supabase Auth.
- **Features:** User registration, email/password login, Google OAuth (with mobile redirect fallback), password reset, profile settings, desktop collapsible sidebar, and mobile bottom navigation bar with safe-area padding[cite: 2].
- **Database Changes:** Migration `20261025000001_initial_schema.sql` creating all core enums, `profiles` (with `on_auth_user_created` trigger), `catalog_titles`, `catalog_seasons`, `catalog_episodes`, `title_relationships`, `user_libraries`, `user_episode_progress`, `user_reading_progress`, `watch_history`, `reading_history`, `reviews`, `user_favorites`, `import_batches`, `import_batch_items`, `user_follows`, `activity_logs`, indexes, and RLS policies.
- **Files/Modules Expected:** `supabase/migrations/20261025000001_initial_schema.sql`, `docs/DATABASE_SCHEMA.md`, `docs/DATABASE_SCHEMA_DIAGRAM.md`, `docs/DATA_DICTIONARY.md`, `src/components/layout/*`, `src/features/auth/*`.
- **Dependencies:** Phase 0 approval + official TrackUp logo placed in `public/assets/trackup-logo.jpg`[cite: 1].
- **Acceptance Criteria:**
  1. All tables and foreign keys are visible in the Supabase Studio Schema Visualizer.
  2. RLS is active on 100% of tables in the `public` schema.
  3. Users can sign up, log in, log out, and edit their profile.
- **Automated Tests:**
  - *Playwright E2E:* Register/login flow, protected route redirection, and responsive viewport assertions (`1440x900` shows desktop sidebar and hides mobile bar; `390x844` hides desktop sidebar and displays mobile bottom bar)[cite: 2].
  - *Database RLS Isolation Test:* Automated integration test creating User A and User B, verifying User B receives 0 rows when querying User A's private `user_libraries` and fails with permission denied when attempting to `UPDATE` User A's profile.
- **Manual Verification Steps:** Developer inspects the visual schema diagram in Supabase Dashboard and tests login on mobile and desktop viewports.

---

## PHASE 2: Metadata Normalization Layer, Unified Search & Title Detail Pages
- **Objectives:** Build the server-side metadata normalization layer (TMDB + AniList) via Supabase Edge Functions and construct unified search and adaptive Title Detail pages.
- **Features:** Omnisearch (`Cmd+K`), Discover page, Title Detail view with backdrop, poster, synopsis, cast/staff, TMDB attribution footer, and linked adaptations (`title_relationships`).
- **Database Changes:** RPC functions/indexes for full-text search and upsert helpers for `catalog_titles`, `catalog_seasons`, `catalog_episodes`, and `title_relationships`.
- **Files/Modules Expected:** `supabase/functions/catalog-search/index.ts`, `supabase/functions/catalog-detail/index.ts`, `src/features/catalog/*`, `src/lib/validators.ts`.
- **Dependencies:** Phase 1 complete + `TMDB_READ_ACCESS_TOKEN` configured in Supabase Edge Function secrets.
- **Acceptance Criteria:**
  1. Searching returns normalized results across Movies, TV, Anime Series, Anime Films, Manga, and Manhwa.
  2. No secret API keys exist in client-side source or network requests to third-party APIs.
  3. Detail page adapts cleanly to content type (shows seasons/episodes for TV/Anime Series, chapters/volumes for Manga/Manhwa, runtime for Movies/Anime Films).
- **Automated Tests:**
  - *Vitest Unit:* Verify TMDB and AniList payload normalizers (including `countryOfOrigin: 'KR'` mapping to `manhwa` and `'JP'` mapping to `manga`) and `http/https` URL sanitizer rejecting `javascript:` URIs[cite: 2].
  - *Playwright E2E:* Open Omnisearch with `Cmd+K`, search for a movie and a manga, navigate to each Title Detail page, and verify type-specific sections render.
- **Manual Verification Steps:** Inspect browser DevTools Network tab to confirm all metadata calls go through Supabase Edge Functions/database cache.

---

## PHASE 3: Watch & Read Libraries (All 6 Content Types & Granular Progress)
- **Objectives:** Implement personal library management, status switching, optimistic episode tracking (`tv`, `anime_series`), and chapter/volume tracking (`manga`, `manhwa`).
- **Features:** Add/remove library entries, 6 tracking statuses, 3 view modes (`Grid`, `Compact`, `List`), episode checkmarks with season batch toggle, `+1 Episode` / `+1 Chapter` quick actions on Dashboard "Up Next", and volume/chapter progress controls (supporting fractional chapters like `10.5`).
- **Database Changes:** Database trigger or RPC `log_episode_progress` and `log_reading_progress` that atomically update `user_episode_progress` / `user_reading_progress`, update `user_libraries.last_progressed_at`, and append a record to `watch_history` / `reading_history`.
- **Files/Modules Expected:** `src/features/library/*`, `src/features/dashboard/*`.
- **Dependencies:** Phase 2 complete.
- **Acceptance Criteria:**
  1. User can track Movies, TV Shows, Anime Series, Anime Films, Manga, and Manhwa in their respective Watch/Read libraries.
  2. Clicking `+1 Episode` or `+1 Chapter` updates the UI optimistically and persists to PostgreSQL.
  3. Reaching the final episode or chapter prompts or automatically transitions status to `completed`.
- **Automated Tests:**
  - *Playwright E2E:* Add a TV show and mark Episode 1 watched; add a Manhwa and increment chapter to `12.5`; switch library between `Grid`, `Compact`, and `List` views; verify Dashboard "Up Next" reflects exact progress.
  - *RLS Isolation Test:* Verify User A marking Episode 3 watched has zero effect on User B's progress for the same `title_id`.
- **Manual Verification Steps:** Verify optimistic UI responsiveness and inspect rows in `user_libraries`, `user_episode_progress`, and `user_reading_progress` in Supabase Table Editor.

---

## PHASE 4: Ratings, Reviews, Favorites, History & Dashboard Statistics
- **Objectives:** Add rating widgets (`1–10` scale / half-stars), spoiler-aware reviews, favorites showcase, chronological watch/reading history logs, and personal analytics.
- **Features:** Half-star rating selector, review editor with `contains_spoilers` blur toggle and per-review `visibility` (`public`, `followers_only`, `private`), favorite pinning/reordering, history timeline with rewatch/reread support, and Dashboard statistics cards.
- **Database Changes:** PostgreSQL view or RPC `get_user_statistics(user_id)` computing total hours watched, episodes watched, chapters read, and rating distribution on the server.
- **Files/Modules Expected:** `src/features/reviews/*`, `src/features/dashboard/StatsOverview.tsx`.
- **Dependencies:** Phase 3 complete.
- **Acceptance Criteria:**
  1. A user with a `'private'` library can publish a `'public'` review without exposing their private watchlist or personal notes.
  2. Spoiler reviews are blurred by default until the reader clicks *"Reveal Spoiler"*.
- **Automated Tests:**
  - *Playwright E2E:* Rate a title 4.5 stars (`9/10`), write a spoiler-flagged review, verify spoiler blur renders, favorite the title, and check updated counts on Dashboard stats.
  - *Security Test:* Verify a second user can read the public review but cannot read `user_libraries.personal_notes`.
- **Manual Verification Steps:** Test review modal scrolling on mobile viewport with virtual keyboard simulation.

---

## PHASE 5: CSV Import/Export & Library Migration Engine
- **Objectives:** Build the complete staged CSV/XML migration system and full library CSV export.
- **Features:** Drag-and-drop CSV/XML uploader (`PapaParse`), preset detection (Letterboxd, IMDb, Trakt, MAL, Generic), interactive column mapper, batch staging preview, candidate picker for ambiguous matches, duplicate handling rules, safe cancellation, error report CSV download, and 1-click TrackUp CSV export.
- **Database Changes:** RPC `commit_import_batch(p_batch_id UUID, p_duplicate_strategy TEXT)` executing an atomic transaction that upserts resolved items and prevents duplicates.
- **Files/Modules Expected:** `supabase/functions/import-resolver/index.ts`, `src/features/import-export/*`.
- **Dependencies:** Phase 4 complete.
- **Acceptance Criteria:**
  1. Uploading the exact same CSV file twice produces **zero duplicate library entries** (idempotency verified).
  2. Ambiguous matches (e.g., a title that exists as both a Manga and an Anime Series) pause in `awaiting_review` and never silently resolve to the wrong adaptation.
  3. Cancelling a staged batch leaves `user_libraries` completely untouched.
- **Automated Tests:**
  - *Vitest Unit:* Test Letterboxd (`0.5–5.0` star conversion), IMDb (`Const` ID extraction), Trakt, and MAL XML parsers, plus file size/row limit guards.
  - *Playwright E2E:* Upload a fixture CSV containing an exact match, an ambiguous match, a duplicate, and an invalid row; resolve the ambiguous match in the UI, commit the batch, re-upload the same file to verify zero duplication, and export the library to CSV.
- **Manual Verification Steps:** Test importing a real personal Letterboxd or IMDb export file into `trackup-dev`.

---

## PHASE 6: Social Profiles, Following, Shared Reviews & Rating Comparisons
- **Objectives:** Enable friend connections, follower-scoped library sharing, activity feeds, and side-by-side taste/rating comparisons.
- **Features:** Public/followers-only profile pages, Follow/Unfollow actions, Friend Activity Feed, and a "Compare Ratings" view showing shared titles and rating alignment percentage between two friends.
- **Database Changes:** RPC `compare_user_ratings(user_a UUID, user_b UUID)` respecting `library_visibility` and `is_private_entry` rules.
- **Files/Modules Expected:** `src/features/social/*`.
- **Dependencies:** Phase 5 complete.
- **Acceptance Criteria:** Privacy settings (`private`, `followers_only`, `public`) strictly control visibility of libraries and activity logs at the database RLS layer.
- **Automated Tests:** Playwright multi-context E2E test with two logged-in users following each other, comparing ratings, and verifying that toggling a library back to `private` immediately revokes access.
- **Manual Verification Steps:** Verify profile sharing links and rating comparison UI with a friend account.

---

## PHASE 7: Recommendations, Performance Polish, Security Hardening & Production Launch
- **Objectives:** Add personalized recommendations, execute full security and performance audits, and deploy production environment on Vercel + Supabase.
- **Features:** Recommendations tab combining cross-format adaptation suggestions (`"You finished the Manga — Watch the Anime adaptation"`) and genre/rating similarity via TMDB/AniList recommendations endpoints.
- **Database Changes:** Performance index review via Supabase Advisors (`get_advisors`).
- **Files/Modules Expected:** `src/features/catalog/RecommendationsView.tsx`, `.github/workflows/ci.yml`.
- **Dependencies:** Phase 6 complete.
- **Acceptance Criteria:**
  1. Zero high/critical findings in Supabase Security Advisor.
  2. Full Playwright E2E and Vitest suites pass in CI.
  3. Production Vercel URL is live and accessible from desktop and mobile devices with the developer's laptop powered off.
- **Automated Tests:** Full regression run across all E2E and RLS security specs.
- **Manual Verification Steps:** End-to-end production smoke test on an actual smartphone over cellular/Wi-Fi with the development laptop turned off.