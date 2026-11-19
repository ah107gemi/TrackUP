# TrackUP - Historical Milestones & Architecture Archive
**Created:** November 19, 2026  
**Primary Reference:** [APP_STATE.md](../APP_STATE.md)  
**Project:** TrackUp ("Track what you love.")

---

## 1. Overview & Purpose

This archive serves as the permanent historical record of completed architectural phases, feature implementations, database migrations, and resolved bugs for the TrackUP application. 

Active operational rules, current database schemas, recent milestones, and ongoing development roadmaps are maintained in the primary single source of truth: [APP_STATE.md](../APP_STATE.md).

---

## 2. Completed Milestones (Late October – Mid-November 2026)

> **Note on Ordering & Identifiers:** Milestones in this archive retain their canonical reference identifiers (Milestones 10–24) inherited from the original reverse-chronological development log in `APP_STATE.md` (where recent work was recorded top-to-bottom from newest to oldest). These numbers serve as stable identifiers rather than strict chronological progression (for example, the initial Custom Lists implementation in Milestone 15 preceded the collapsed folder UX optimization in Milestone 10; navigation link pruning in Milestone 23 occurred when the mobile drawer was active, prior to the drawer's complete removal in Milestone 14).

### Milestone 10: Custom Lists UX Optimization (Collapsed Folders & Detail Modal)
*   **Target Components:** [CustomListsSection.tsx](../src/features/custom-lists/CustomListsSection.tsx), [customListsService.ts](../src/features/custom-lists/customListsService.ts)
*   **Context:** Progressive enhancement building upon the initial Custom Lists implementation (Milestone 15).
*   **Description:** In the Profile section, media cards were removed from inline rendering beneath each custom list. Custom Lists now render as compact, clickable folder summary cards detailing list names, descriptions, privacy status badges, title counts, and mini poster thumbnail stacks.
*   **Interaction:** Clicking any folder card triggers a dedicated modal (`custom-list-detail-modal`) presenting full media poster cards, metadata, and management actions (edit list details, remove items, toggle privacy).

### Milestone 11: "Add to List" Shortcut on Title Detail Page
*   **Target Components:** [TitleDetailPage.tsx](../src/features/catalog/TitleDetailPage.tsx), [AddToListModal.tsx](../src/features/custom-lists/AddToListModal.tsx)
*   **Description:** Integrated a dedicated "Add to List" shortcut button positioned directly between the Synopsis section and the Episodes/Chapters section on the Title Detail view.
*   **Functionality:** Clicking the button launches `<AddToListModal />`, allowing users to quickly toggle the current media title across any of their custom collections with instant optimistic state updates and on-the-fly list creation.

### Milestone 12: Private Notes Section in Title Detail
*   **Target Components:** [TitleDetailPage.tsx](../src/features/catalog/TitleDetailPage.tsx), [libraryService.ts](../src/features/library/libraryService.ts)
*   **Database Migration:** Added `private_notes` (TEXT) column to `public.user_libraries` (`20261115000003_add_private_notes.sql`).
*   **Description:** Under the public Review section on the title detail page, added a dedicated "Private Notes" text area with confidential lock indicators, real-time feedback toasts, and automatic synchronization.
*   **Security:** Strictly private and accessible only to the authenticated owner (`auth.uid() = user_id`). Stored in `user_libraries.private_notes` with optimistic local storage fallback.

### Milestone 13: "Plan to watch/read" Tracking Status UX Label
*   **Target Components:** [TitleDetailPage.tsx](../src/features/catalog/TitleDetailPage.tsx), [LibraryView.tsx](../src/features/library/LibraryView.tsx), [RecommendationsView.tsx](../src/features/catalog/RecommendationsView.tsx), [PublicProfilePage.tsx](../src/features/profile/PublicProfilePage.tsx)
*   **Description:** Refactored tracking status labels throughout all dropdowns and UI badges across the app.
*   **Compatibility:** Replaced the legacy label "Planned" with "Plan to watch/read" while preserving the underlying database enum value `'planned'` to prevent schema breaking changes.

### Milestone 14: Hamburger Menu Completely Removed
*   **Target Components:** Header navigation, [AppShell.tsx](../src/components/layout/AppShell.tsx), [BottomNavBar.tsx](../src/components/layout/BottomNavBar.tsx), [DesktopSidebar.tsx](../src/components/layout/DesktopSidebar.tsx)
*   **Context:** Succeeded earlier drawer cleanup (Milestone 23), completely superseding and eliminating `<MobileNavDrawer />` from the application.
*   **Description:** Eliminated the hamburger menu toggle button and `<MobileNavDrawer />` dropdown/drawer from the application shell entirely.
*   **Responsive Strategy:** Mobile navigation relies 100% on the mobile `<BottomNavBar />` (Home, Discover, Library, Social, Profile) with accessible tap targets and zero horizontal layout overflow. Desktop navigation relies on `DesktopSidebar` and `TopUtilityBar`.

### Milestone 15: Custom Lists Feature Initial Implementation
*   **Target Components:** [CustomListsSection.tsx](../src/features/custom-lists/CustomListsSection.tsx), [customListsService.ts](../src/features/custom-lists/customListsService.ts)
*   **Database Schema:** Created tables `public.custom_lists` and `public.list_items` with Row Level Security (RLS) policies (`20261115000001_custom_lists.sql`).
*   **Description:** In the Profile section, completely replaced the legacy "My Library & Watched Titles" showcase with a comprehensive "Custom Lists" manager. Users can create, rename, edit descriptions, delete lists, and curate any media format (shows, movies, anime series/films, manga, manhwa) with Supabase persistence and localStorage synchronization.
*   **Subsequent Refinement:** Originally rendered list items inline; subsequent UX optimization in Milestone 10 introduced compact folder summary cards and dedicated detail modals.

### Milestone 16: Unified Search UX Across Library & Discover
*   **Target Components:** [LibraryView.tsx](../src/features/library/LibraryView.tsx), [SearchPage.tsx](../src/features/catalog/SearchPage.tsx), [OmnisearchModal.tsx](../src/components/layout/OmnisearchModal.tsx)
*   **Description:** Refactored the search bars inside the Library and Discover sections. Replaced inline text input fields with unified global search triggers that match the exact visual styling, keyboard shortcut indicators (⌘K / Ctrl+K), and functionality of the Global Search Omnisearch modal.

### Milestone 17: Mobile Bottom Navigation Bar Deployment
*   **Target Components:** [BottomNavBar.tsx](../src/components/layout/BottomNavBar.tsx), [AppShell.tsx](../src/components/layout/AppShell.tsx)
*   **Description:** Live deployment of `<BottomNavBar />` pinned to the bottom of the viewport on mobile devices. Features high-contrast active icons, touch-friendly tap targets, and clean tab switching between Home, Discover, Library, Social, and Profile.

### Milestone 18: Database Triggers and Policies for Username-Based Login
*   **Target Components:** Authentication migrations, [AuthContext.tsx](../src/features/auth/AuthContext.tsx), [AuthModal.tsx](../src/features/auth/AuthModal.tsx)
*   **Database Migration:** Created `on_auth_user_created` trigger on `auth.users` to automatically populate `public.profiles`. Added case-insensitive functional index `idx_profiles_username_lower` on `LOWER(username)`.
*   **Description:** Enabled seamless login using either an email address or a unique username.

### Milestone 19: Profiles Email Column and Account Stabilization
*   **Target Components:** `supabase/migrations/20261031000001_add_email_to_profiles.sql`
*   **Description:** Added missing `email` column to `public.profiles` and resolved ghost account anomalies where orphaned `auth.users` records lacked corresponding `profiles` rows. Purged orphaned test accounts via SQL scripts and stabilized user registration.

### Milestone 20: Cross-Season Episode Tracking State Bug Resolution
*   **Target Components:** [libraryService.ts](../src/features/library/libraryService.ts), [TitleDetailPage.tsx](../src/features/catalog/TitleDetailPage.tsx)
*   **Description:** Resolved an issue where episode tracking state collided across multiple seasons for shows with identical episode numbers in different seasons.
*   **Fix:** `toggleEpisodeWatched` and batch episode logging logic were updated to strictly index and match both `season_number` and `episode_number` alongside `episode_id`.

### Milestone 21: "Unmark Season" Button Implementation
*   **Target Components:** [TitleDetailPage.tsx](../src/features/catalog/TitleDetailPage.tsx), [libraryService.ts](../src/features/library/libraryService.ts)
*   **Description:** Implemented an "Unmark Season" button alongside the "Mark Season" action in season headers on Title Detail pages. Users can revert all episodes within a specific season to uncompleted with a single action.

### Milestone 22: Public Profile Viewing Resolution
*   **Target Components:** [ProfilePage.tsx](../src/features/profile/ProfilePage.tsx), [PublicProfilePage.tsx](../src/features/profile/PublicProfilePage.tsx)
*   **Description:** Fixed public profile loading by dynamically parsing target user identifiers from URL parameters (`#/user/:param`, `#/profile/:param`, `?user=:id`, `?userId=:id`).
*   **Implementation:** Queries `user_libraries` using `effectiveUserId` rather than forcing `useAuth().user.id`. Features full public library showcases with privacy filtering respecting `is_private = false`.

### Milestone 23: Navigation Panel Cleanup (Prior to Hamburger Drawer Removal)
*   **Target Components:** `src/components/layout/MobileNavDrawer.tsx`
*   **Context:** Performed in earlier iterations (commit `f7ebde1`) while the mobile navigation drawer was still active, prior to the drawer's complete removal in Milestone 14 (commit `33b52d2`).
*   **Description:** Removed legacy "Tracking History", "For You", and "Release Calendar" links from mobile navigation drawers prior to full drawer removal, streamlining navigation routes.

### Milestone 24: Dashboard Cleanup (Removal of Analytics Overview)
*   **Target Components:** [AppShell.tsx](../src/components/layout/AppShell.tsx), E2E test suite
*   **Description:** Completely removed the "Analytics & Overview" section (`<DashboardStats />`) from the Home/Dashboard view to present a cleaner, content-focused feed. Updated Playwright E2E assertions to match the updated UI layout.

---

## 3. Foundational Development Milestones (October 2026 Launch)

### Phase 1: Database Foundation & RLS Setup (2026-10-25)
*   Created PostgreSQL tables in Supabase: `profiles`, `catalog_titles`, `catalog_seasons`, `catalog_episodes`, `catalog_relations`, `user_libraries`, `user_episode_progress`, `user_reading_progress`.
*   Configured Row Level Security (RLS) across all user tables guaranteeing isolation by `auth.uid() = user_id`.

### Phase 2: Progress Tracking RPCs & Granular Steppers (2026-10-25)
*   Implemented PostgreSQL stored procedure `log_reading_progress_v1` for atomic chapter and volume updates.
*   Built episodic toggle logic and granular progress steppers for Anime, TV, Manga, and Manhwa.

### Phase 3: Reviews, Spoilers & Rating Engine (2026-10-25)
*   Created `reviews` table supporting 10-point ratings, spoiler flags (`is_spoiler: boolean`), and community review feeds.
*   Implemented review statistics and distribution summaries.

### Phase 4: Social Graph & Friends Feed (2026-10-25)
*   Created `user_follows` table and social graph queries.
*   Built friends activity feed ([ActivityFeed.tsx](../src/features/social/ActivityFeed.tsx)) showing live updates of friend ratings, completions, and progress.

### Phase 5: Smart Recommendations & Release Radar (2026-10-25)
*   Engineered hybrid recommendation engine combining content genre filtering and social collaborative signals.
*   Built weekly release radar tracking upcoming episodes and publication dates.

### Phase 6: Profile Customization & Media Assets (2026-10-30)
*   Added Supabase storage bucket `profile-assets` for custom user avatars and profile header banners.
*   Added support for animated video banners (`.mp4`, `.webm`) and dynamic profile customization.

### Phase 7: Recommendations, Airing Calendar & Performance Hardening (2026-10-25)
*   **Database Migration:** Added table `public.catalog_release_schedules` with RLS (`20261025000005_phase7_recommendations_and_releases.sql`) supporting release schedules for TV, Anime, Manga, and Manhwa.
*   **Performance Hardening:** Deployed performance indexes aligned with Supabase Advisors: `idx_release_schedules_day_air`, `idx_release_schedules_title_id`, `idx_user_libraries_user_status`, `idx_user_libraries_user_last_prog`, `idx_reviews_user_rating`, and `idx_user_follows_follower_following`.
*   **Recommendation Engine:** Built hybrid recommendation engine in [RecommendationsView.tsx](../src/features/catalog/RecommendationsView.tsx) pairing content genre similarity with cross-format adaptation prompts ("You finished the Manga — Watch the Anime adaptation").
*   **Airing Calendar:** Deployed weekly release radar tracking upcoming episodes and publication dates by day of the week.
