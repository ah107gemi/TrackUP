# TrackUP PWA - Master Application State
**Last Updated:** November 14, 2026

## Core Stack & Infrastructure
*   **Frontend:** React (TypeScript), Progressive Web App (PWA) with Service Worker caching.
*   **Database & Auth:** Supabase (PostgreSQL), utilizing Row Level Security (RLS) policies.
*   **Hosting:** Render (Automated deployments via GitHub).
*   **Design Language:** Dark slate aesthetic, champagne-gold accents, white text, clean geometric layouts.

## Database Schema (Crucial Context)
*   **`auth.users`:** Managed exclusively by Supabase Authentication. (Email confirm is currently OFF).
*   **`public.profiles`:** Linked to `auth.users` via a trigger (`on_auth_user_created`). 
    *   **Fields:** `id` (UUID), `email` (TEXT), `username` (TEXT - has a case-insensitive index `idx_profiles_username_lower`), `display_name` (TEXT).
*   **Other Core Tables:** `user_libraries`, `user_episode_progress`, `user_reading_progress`.
    *   *Note: These tables must respect standard UUID foreign key constraints pointing to `profiles.id`.*

## Current Development Phase: Mobile & Bug Fixes
*   **Recently Completed (Do not re-implement):**
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
