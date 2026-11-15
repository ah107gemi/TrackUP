# TrackUP PWA - Master Application State
**Last Updated:** November 15, 2026

## Core Stack & Infrastructure
*   **Frontend:** React (TypeScript), Progressive Web App (PWA) with Service Worker caching.
*   **Database & Auth:** Supabase (PostgreSQL), utilizing Row Level Security (RLS) policies.
*   **Hosting:** Render (Automated deployments via GitHub).
*   **Design Language:** Dark slate aesthetic, champagne-gold accents, white text, clean geometric layouts.

## Database Schema (Crucial Context)
*   **`auth.users`:** Managed exclusively by Supabase Authentication. (Email confirm is currently OFF).
*   **`public.profiles`:** Linked to `auth.users` via a trigger (`on_auth_user_created`). 
    *   **Fields:** `id` (UUID), `email` (TEXT), `username` (TEXT - has a case-insensitive index `idx_profiles_username_lower`), `display_name` (TEXT).
*   **Core Media & Tracking Tables:** `catalog_titles`, `user_libraries`, `user_episode_progress`, `user_reading_progress`, `reviews`, `user_follows`.
    *   *Note: These tables must respect standard UUID foreign key constraints pointing to `profiles.id`.*
    *   *`user_libraries` Schema:* includes `id`, `user_id`, `title_id`, `status` (`'active' | 'completed' | 'planned' | 'paused' | 'dropped'`), `rating`, `is_private`, `personal_notes`, `private_notes` (TEXT, strictly confidential private user notes), timestamps.
*   **`public.custom_lists`:** User-created custom media collections.
    *   **Fields:** `id` (UUID, PK), `user_id` (UUID, FK -> `profiles.id` ON DELETE CASCADE), `list_name` (TEXT), `description` (TEXT), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
    *   **RLS Policies:** SELECT, INSERT, UPDATE, DELETE permitted strictly for the list owner (`auth.uid() = user_id`).
*   **`public.list_items`:** Universal media title mappings for custom lists (supports shows, movies, anime series/films, manga, manhwa).
    *   **Fields:** `id` (UUID, PK), `list_id` (UUID, FK -> `custom_lists.id` ON DELETE CASCADE), `user_id` (UUID, FK -> `profiles.id` ON DELETE CASCADE, default `auth.uid()`), `media_id` / `title_id` (TEXT), `media_type` (TEXT), `notes` (TEXT), `display_order` (INTEGER), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ), UNIQUE(`list_id`, `media_id`).
    *   **RLS Policies:** SELECT, INSERT, UPDATE, DELETE permitted when `auth.uid() = user_id` or parent list owner matches `auth.uid()`.

## Current Development Phase: Mobile & Bug Fixes
*   **Recently Completed (Do not re-implement):**
    *   **Custom Lists UUID Schema & Session RLS Alignment:** Enforced strict RFC 4122 UUID v4 generation (`generateUUID()`, `isValidUUID()`) across client-side list creation and media item associations. Eliminated temporary string IDs (`list_...` and `item_...`) that triggered PostgreSQL `invalid input syntax for type uuid`. Guaranteed `user_id` is strictly retrieved from the active Supabase session (`supabase.auth.getUser()`), perfectly satisfying RLS `WITH CHECK (auth.uid() = user_id)`. Added automatic migration/healing for any legacy IDs stored in localStorage, and ensured parent custom lists are synced to Supabase before inserting into `list_items`.
    *   **Custom Lists Persistence & RLS Resolution:** Fixed Supabase silent rejection on `list_items` insertions by ensuring payloads in `customListsService.ts` include `user_id`, `media_id`, `title_id`, and `media_type`. Updated RLS policies to directly evaluate `auth.uid() = user_id` alongside parent list ownership. Added prominent red error toasts in both `<AddToListModal />` and `<CustomListsSection />` with automatic error messaging rather than silent optimistic reverts.
    *   **Custom Lists UX Optimization (Collapsed Folders & Detail Modal):** In the Profile section (`CustomListsSection.tsx`), media cards are no longer rendered inline under each list. Instead, Custom Lists display as compact, clickable folder summary cards showing list names, descriptions, privacy status, title counts, and mini poster thumbnail stacks. Clicking a folder opens a dedicated list view modal (`custom-list-detail-modal`) with full media cards and management actions.
    *   **"Add to List" Shortcut on Title Detail Page:** In `TitleDetailPage.tsx`, added a dedicated "Add to List" shortcut button positioned exactly between the Synopsis section and the Episodes/Chapters section. Clicking it opens `<AddToListModal />`, allowing users to toggle any title across their custom lists with instant optimistic state updates and on-the-fly list creation.
    *   **Private Notes Section:** Under the Review section on the title detail page (`TitleDetailPage.tsx`), added a dedicated "Private Notes" text area with confidential lock indicators, real-time feedback toast, and auto-sync. Backed by `user_libraries.private_notes` (TEXT) and optimistic local storage caching, strictly accessible only to the authenticated owner.
    *   **"Plan to watch/read" Status UX:** Updated the tracking status UI across the entire application (`TitleDetailPage.tsx`, `LibraryView.tsx`, `RecommendationsView.tsx`, `PublicProfilePage.tsx`). Replaced legacy "Planned" display labels with "Plan to watch/read" while preserving the underlying `'planned'` database enum value to guarantee backwards compatibility.
    *   **Hamburger Menu Completely Removed:** Completely eliminated the hamburger menu trigger button and `<MobileNavDrawer />` dropdown/drawer from the application header and navigation shell. Mobile navigation relies 100% on `<BottomNavBar />` (Home, Discover, Library, Social, Profile) with accessible tap targets and zero horizontal layout overflow, while desktop relies on `DesktopSidebar` and `TopUtilityBar`.
    *   **Custom Lists Feature Implemented:** In the Profile section, completely replaced the legacy "My Library & Watched Titles" showcase with a rich, interactive "Custom Lists" manager (`CustomListsSection.tsx`, `customListsService.ts`). Users can create new lists, edit names/descriptions, delete lists, and curate any media type (shows, movies, anime, manhwa, manga) backed by Supabase tables (`custom_lists`, `list_items`) and optimistic localStorage synchronization.
    *   **Unified Search UX:** Refactored the search bars inside the Library (`LibraryView.tsx`) and Discover (`SearchPage.tsx`) sections. Inline search text inputs were replaced with unified global search triggers that match the exact UI look, styling, and functionality of the Global Search Omnisearch modal (`OmnisearchModal.tsx`) with ⌘K shortcuts.
    *   Mobile bottom navigation bar `<BottomNavBar />` is deployed and live.
    *   Database triggers and policies for username-based login are fully configured.
    *   The missing `email` column in `profiles` was successfully added, and ghost accounts were purged via SQL. Registration is now stable.
    *   Cross-season episode tracking state bug fixed: `toggleEpisodeWatched` and batch episode logging strictly respect both `season_number` and `episode_number`.
    *   "Unmark Season" button implemented and deployed across season headers in `TitleDetailPage.tsx`.
    *   Public Profile Viewing fixed: `ProfilePage` dynamically resolves target user ID from URL parameters (`#/user/:param`, `#/profile/:param`, `?user=:id`, `?userId=:id`), fetching `user_libraries` data via `effectiveUserId` rather than `useAuth().user.id`. Includes full public library showcase with privacy filtering.
    *   More Navigation Panel cleaned: "Tracking History", "For You", and "Release Calendar" links completely removed from `MobileNavDrawer.tsx`.
    *   Dashboard cleanup: Completely removed the "Analytics & Overview" section (`<DashboardStats />`) from the Home/Dashboard view in `AppShell.tsx` and updated e2e test suite assertions accordingly.
*   **Current Active Task:**
    *   Verification, stability monitoring, and test maintenance.

## Instructions for AI (Antigravity)
1.  **Always read this file (`APP_STATE.md`) first** before attempting any modifications to the codebase or generating SQL.
2.  Base all new React components and styling choices on the established "Core Stack" and "Design Language".
3.  When writing SQL or Supabase logic, refer to the "Database Schema" section to ensure columns and relationships are accurate.
4.  After successfully completing a major task or resolving a bug, update this file to reflect the new state.
5. Always commit your changes and run 'git push origin main' to the remote repository when you finish a task, so the user does not have to do it manually.
