# 3. TRACKUP_DATABASE_PLAN.md

```markdown
# TRACKUP DATABASE ARCHITECTURE & SECURITY PLAN

## 1. Design Philosophy & Beginner Inspectability
The TrackUp PostgreSQL schema is designed so that anyone opening the **Supabase Studio Schema Visualizer** can immediately understand how data flows:
1. **Shared Catalog Entities (`catalog_*`, `title_relationships`):** Store factual metadata about movies, TV shows, anime, manga, and manhwa once. If 500 users track *Attack on Titan*, the title exists **once** in `catalog_titles`.
2. **User Ownership Entities (`profiles`, `user_libraries`, `user_favorites`):** Connect an individual user (`auth.uid()`) to a catalog title with their personal status and rating.
3. **Specialized Progress Entities:** Episodic watching (`user_episode_progress`, `watch_history`) is separated cleanly from chapter/volume reading (`user_reading_progress`, `reading_history`). Movies never pollute episode tables, and manga never pollutes TV season tables.
4. **Migration & Social Entities (`import_*`, `reviews`, `user_follows`, `activity_logs`):** Support staged CSV imports and social sharing with clear foreign keys.

---

## 2. Entity-Relationship Diagram (Mermaid)
*(To be saved and maintained in `docs/DATABASE_SCHEMA_DIAGRAM.md`)*

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