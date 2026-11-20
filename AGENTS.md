# TrackUP - Project Memory & Agent Guidelines

## Project Overview
TrackUP is a high-performance personal entertainment tracking and discovery Progressive Web Application (PWA). It provides a unified, cross-media tracking experience across six distinct entertainment domains:
1. **Movies** (Feature films & documentaries)
2. **TV Shows** (Episodic television & serials)
3. **Anime Series** (Episodic animation)
4. **Anime Films** (Theatrical anime features)
5. **Manga** (Japanese comics & serialized chapters)
6. **Manhwa** (Korean digital webtoons & serialized chapters)

The user experience is built on an editorial, dark noir & gold luxury aesthetic with responsive layout patterns tailored for both desktop power users and mobile-first touch navigation.

## Tech Stack
* **Frontend Core:** React 18 (`react`, `react-dom`), TypeScript (`~5.6.3`), Vite 5 (`vite`), Tailwind CSS (`tailwindcss`, `clsx`, `tailwind-merge`).
* **Client State & Data Fetching:** TanStack React Query v5 (`@tanstack/react-query`) for server-state caching, automatic cache invalidation, and optimistic mutations with rollback. Zustand v5 (`zustand`) strictly for ephemeral UI shell state (`src/stores/uiStore.ts`).
* **Database & Auth:** Supabase (PostgreSQL 15), 100% Row Level Security (RLS) enforcement across all public tables, stored procedures (RPCs), and automated database triggers (`on_auth_user_created`).
* **External APIs & Metadata Pipeline:**
  * **TMDB API:** Metadata ingestion for Movies and TV Shows.
  * **AniList GraphQL API:** Metadata ingestion for Anime Series, Anime Films, Manga, and Manhwa.
  * **Jikan v4 REST API:** Resilient fallback and metadata healing via `metadataHealer.ts` (enforces strict 3000ms timeout via `AbortSignal.timeout(3000)`).
  * **Mock Fixtures:** `MOCK_CATALOG_FIXTURES` for zero-network testing and offline development fallback.
* **Hosting & Deployment:** Render (Automated continuous deployments triggered via commits to GitHub `main` branch).
* **PWA & Offline Infrastructure:** `vite-plugin-pwa` with Service Worker Workbox runtime caching.

## Core Architecture & State
1. **Separation of Concerns:**
   * Server state lives strictly in TanStack React Query (`src/hooks/useCatalog.ts`, `src/hooks/useLists.ts`, etc.).
   * Ephemeral UI shell state (active view, modals, quick-action sheets, filter drawers) lives strictly in Zustand (`src/stores/uiStore.ts`).
   * Factual metadata in `catalog_titles` is strictly decoupled from user-specific data in `user_libraries`, `user_favorites`, `custom_lists`, and progress tracking tables.
2. **Database Security & RLS Matrix:**
   * All user tables (`profiles`, `user_libraries`, `user_favorites`, `user_episode_progress`, `user_reading_progress`, `watch_history`, `reading_history`, `reviews`, `custom_lists`, `list_items`) strictly enforce RLS with `auth.uid() = user_id`.
   * Public catalog tables (`catalog_titles`, `catalog_seasons`, `catalog_episodes`, `title_relationships`) allow public read access (`true`) and restrict write/mutation access to administrative service roles.
   * Every Supabase mutation MUST append `.throwOnError()` to prevent silent promise swallows.
   * Every mutating client operation MUST verify an active session via `getAuthenticatedUserId()` before attempting database calls.
3. **Client-Side ID Generation & Canonical Formatting:**
   * All client-generated entities (such as custom lists and list items) MUST generate RFC 4122 UUID v4 values via `generateUUID()`.
   * Temporary string IDs (`list_...`, `item_...`) are strictly prohibited to prevent PostgreSQL `invalid input syntax for type uuid` errors.
   * UUID validation is enforced using canonical 36-character hexadecimal format checking (`isValidUUID()`).
4. **Data Synchronization Contract:**
   * Remote-first persistence: Database mutation must succeed before committing persistent cache updates.
   * If an operation fails remotely, optimistic UI state must be rolled back immediately, and clear error feedback must be presented via toast notifications (`addToast`).
   * Local storage mirrors are updated strictly *after* successful Supabase writes or with defensive versioning/healing to prevent ghost records.

## Strict Design System (Do Not Alter)
* **Theme & Atmosphere:** Dark noir & champagne-gold luxury aesthetic.
* **Color Tokens:**
  * Canvas background: `#101014` (`bg-background`)
  * Surface cards & sidebars: `#16161D` (`bg-surface`)
  * Elevated surfaces & borders: `#1F1F29` (`bg-surface-elevated`, `border-surface-elevated`)
  * Primary accent: Champagne-gold / amber yellow `#FFC400` (`bg-accent`, `text-accent`)
  * Accent hover: `#FFD033` (`bg-accent-hover`, `text-accent-hover`)
  * Primary text: `#F4F4F6` (`text-text-primary`)
  * Secondary text: `#A1A1AA` (`text-text-secondary`)
  * Muted text: `#71717A` (`text-text-muted`)
* **Typography:** Clean sans-serif system stack (`font-sans`), high-contrast hierarchy, uppercase tracking for category badges and section dividers (`tracking-wider`, `text-xs`).
* **Layout & Navigation:**
  * Mobile viewports: Sticky bottom navigation bar (`MobileBottomNav.tsx`) with touch targets of at least `44x44px`.
  * Desktop viewports: Collapsible left sidebar (`Sidebar.tsx`) with persistent route shortcuts.
  * Responsive grids: Media catalog grids strictly use balanced responsive columns (`grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6`).
* **Media Cards & Aspect Ratios:**
  * Poster cards strictly enforce a `2:3` aspect ratio (`aspect-[2/3]`) using `object-cover`.
  * Every image component must provide graceful fallback state (shimmer placeholder or genre-specific icon) for missing poster artwork.

## Agent Operational Directives
1. **Speed & Scope:** Only inspect and edit files explicitly mentioned in the prompt or strictly necessary for the task. Do not scan the entire codebase or modify unrelated modules.
2. **Database Safety:** NEVER drop tables, alter schema, or modify Drizzle/Supabase migrations without explicit permission. All schema modifications must be additive, backward-compatible, and accompanied by corresponding RLS policies.
3. **Supabase Mutation Safety:** Always chain `.throwOnError()` onto Supabase client calls. Never assume an operation succeeded without verifying the error object.
4. **ID & Type Integrity:** Use client-side RFC 4122 UUID v4 generation (`generateUUID()`). Never introduce arbitrary string IDs for database entities. Maintain strict TypeScript types without using `any`.
5. **UI Preservation:** Do not overwrite existing Tailwind layout rules (`flex-col h-full`, `mt-auto`, responsive breakpoints, container paddings) on media cards, list modals, or navigation shells.
6. **Verification Gate:** Always verify code changes with the required quality commands before reporting completion:
   * `npm run typecheck` (`tsc --noEmit`)
   * `npm run test:unit` (`vitest run`)
   * `npm run build` (`tsc && vite build`)
   * `npm run test:e2e` (`playwright test`)

## Persistent Documentation Maintenance Rules
1. **APP_STATE.md:**
   * Treat it as the authoritative single source of truth for the active operational state of TrackUP.
   * Update it whenever significant implementation work changes architecture, features, database schemas, security/RLS policies, API integrations, configuration, or operational behavior.
   * Keep it accurate and remove outdated information instead of accumulating obsolete historical notes.
   * Preserve the `@APP_STATE.md Read this first` directive at the top and the seven-section structure.
2. **docs/ARCHIVE_HISTORY.md:**
   * Treat it as the permanent historical record of completed development phases, legacy architectural shifts, and closed milestones.
   * Append completed milestones to the archive when `APP_STATE.md` section 7 reaches capacity (~8–10 recent milestones).
   * Preserve its existing history. Never rewrite, renumber, or remove previous milestones without explicit authorization.
3. **MASTER_DEVELOPMENT_PLAYBOOK.md:**
   * Update only when a reusable engineering standard, workflow, architectural pattern, or project-wide convention changes.
   * Do not record temporary, task-specific, or transient implementation notes.
4. **Documentation Judgment:**
   * Do not update documentation for trivial UI adjustments, typo corrections, routine small bug fixes, or minor styling tweaks.
   * Documentation updates must reflect verified, tested implementation—never planned, assumed, or unverified work.
   * Never claim that a feature or milestone is complete unless its implementation has been verified by the test suite.
5. **Task Completion Workflow:**
   * After significant implementation work, review all affected documentation files.
   * Update the relevant documentation files before presenting the final completion report.
   * Include a short dedicated section in the final report identifying which documentation files were updated and why (or explicitly confirm that no documentation updates were required).
6. **Git Restrictions:**
   * Documentation updates do NOT authorize Git commits, pushes, merges, or deployments.
   * Always wait for explicit user authorization before performing any Git commit, push, or deployment operation.
