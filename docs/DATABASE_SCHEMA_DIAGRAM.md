# TrackUp Database Schema & Entity-Relationship Diagram

## 1. Architectural Overview
The TrackUp PostgreSQL schema cleanly decouples shared media catalog metadata from private user libraries and domain-specific tracking mechanics (episodic watch tracking vs chapter reading progress).

```mermaid
erDiagram
    PROFILES ||--o{ USER_LIBRARIES : "owns"
    PROFILES ||--o{ USER_FAVORITES : "marks"
    PROFILES ||--o{ REVIEWS : "authors"
    PROFILES ||--o{ WATCH_HISTORY : "logs"
    PROFILES ||--o{ READING_HISTORY : "logs"
    PROFILES ||--o{ IMPORT_BATCHES : "uploads"
    PROFILES ||--o{ USER_FOLLOWS : "follower / following"
    PROFILES ||--o{ ACTIVITY_LOGS : "generates"

    CATALOG_TITLES ||--o{ CATALOG_SEASONS : "has (tv/anime_series)"
    CATALOG_SEASONS ||--o{ CATALOG_EPISODES : "contains"
    CATALOG_TITLES ||--o{ TITLE_RELATIONSHIPS : "source / target"
    CATALOG_TITLES ||--o{ USER_LIBRARIES : "tracked in"
    CATALOG_TITLES ||--o{ USER_FAVORITES : "favorited in"
    CATALOG_TITLES ||--o{ REVIEWS : "reviewed in"

    USER_LIBRARIES ||--o{ USER_EPISODE_PROGRESS : "tracks episodes"
    USER_LIBRARIES ||--o| USER_READING_PROGRESS : "tracks chapters/volumes"
    USER_LIBRARIES ||--o{ WATCH_HISTORY : "records views"
    USER_LIBRARIES ||--o{ READING_HISTORY : "records reads"

    CATALOG_EPISODES ||--o{ USER_EPISODE_PROGRESS : "watched state"
    IMPORT_BATCHES ||--o{ IMPORT_BATCH_ITEMS : "stages rows"
    CATALOG_TITLES ||--o{ IMPORT_BATCH_ITEMS : "resolved to"
```

## 2. Key Foreign Key Chains
1. **User Identity Chain:** `auth.users` -> `public.profiles` (`id` references `auth.users.id`).
2. **Catalog Hierarchy:** `catalog_titles` -> `catalog_seasons` -> `catalog_episodes`.
3. **Cross-Media Relationships:** `catalog_titles` (source) -> `title_relationships` -> `catalog_titles` (target).
4. **Library & Progress:** `profiles` + `catalog_titles` -> `user_libraries` -> `user_episode_progress` / `user_reading_progress`.
5. **Audit & Activity:** `profiles` -> `watch_history` / `reading_history` / `activity_logs`.
