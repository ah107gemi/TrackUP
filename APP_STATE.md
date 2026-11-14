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
*   **Current Active Task:**
    *   Fixing a cross-season state bug where toggling an episode's watched status (e.g., S3E1) accidentally marks the same episode number across all other seasons (S1E1, S2E1, etc.).
    *   **Goal:** Refactor the UI state update functions (likely in `TitleDetailPage.tsx` or similar) to strictly filter by both `season_number` AND `episode_number`.
    *   **Goal:** Add a new "Unmark Season" button that batch-updates an entire season array to unwatched.

## Instructions for AI (Antigravity)
1.  **Always read this file (`APP_STATE.md`) first** before attempting any modifications to the codebase or generating SQL.
2.  Base all new React components and styling choices on the established "Core Stack" and "Design Language".
3.  When writing SQL or Supabase logic, refer to the "Database Schema" section to ensure columns and relationships are accurate.
4.  After successfully completing a major task or resolving a bug, update this file to reflect the new state.
