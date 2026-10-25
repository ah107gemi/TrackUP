# TrackUp Data Dictionary

## 1. `profiles`
| Column | Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | No | None | Primary key referencing `auth.users(id)` |
| `username` | `TEXT` | No | None | Unique public handle |
| `display_name` | `TEXT` | Yes | None | Full display name |
| `avatar_url` | `TEXT` | Yes | None | Profile avatar image URI |
| `bio` | `TEXT` | Yes | None | User bio / description |
| `library_visibility` | `privacy_level`| No | `'public'` | Privacy of tracked library |
| `activity_visibility`| `privacy_level`| No | `'public'` | Privacy of activity feed |
| `rating_display_preference` | `TEXT` | No | `'stars_5'` | `'stars_5'` (half-stars) or `'points_10'` |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Account creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | Profile last modified timestamp |

---

## 2. `catalog_titles`
| Column | Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | No | `gen_random_uuid()` | Unique title ID |
| `media_type` | `media_type` | No | None | Content category |
| `title` | `TEXT` | No | None | Canonical display title |
| `original_title` | `TEXT` | Yes | None | Native language title |
| `release_year` | `INTEGER` | Yes | None | Release or publication year |
| `synopsis` | `TEXT` | Yes | None | Overview / synopsis |
| `poster_url` | `TEXT` | Yes | None | Poster image URL |
| `backdrop_url` | `TEXT` | Yes | None | Wide backdrop banner URL |
| `genres` | `TEXT[]` | No | `'{}'` | Genre tags |
| `origin_country`| `TEXT` | Yes | None | ISO country code |
| `status` | `TEXT` | Yes | `'released'` | Production status |
| `total_episodes`| `INTEGER` | Yes | None | Total episode count |
| `total_seasons` | `INTEGER` | Yes | None | Total season count |
| `total_chapters`| `NUMERIC` | Yes | None | Total chapter count (supports decimals) |
| `total_volumes` | `INTEGER` | Yes | None | Total volume count |
| `runtime_minutes`| `INTEGER`| Yes | None | Movie runtime |
| `tmdb_id` | `INTEGER` | Yes | None | TMDB identifier |
| `imdb_id` | `TEXT` | Yes | None | IMDb identifier (e.g., `tt1234567`) |
| `anilist_id` | `INTEGER` | Yes | None | AniList identifier |
| `mal_id` | `INTEGER` | Yes | None | MyAnimeList identifier |
| `metadata_synced_at`| `TIMESTAMPTZ`| Yes | None | Last external metadata sync |

---

## 3. `user_libraries`
| Column | Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | No | `gen_random_uuid()` | Library entry ID |
| `user_id` | `UUID` | No | None | Owner referencing `profiles(id)` |
| `title_id` | `UUID` | No | None | Catalog title referencing `catalog_titles(id)` |
| `status` | `tracking_status`| No | `'planned'`| Current user tracking status |
| `rating` | `SMALLINT` | Yes | None | Rating `1`–`10` (`stars * 2`) |
| `is_private` | `BOOLEAN` | No | `false` | Explicit private entry flag |
| `personal_notes` | `TEXT` | Yes | None | Private notes |
| `started_at` | `TIMESTAMPTZ`| Yes | None | Timestamp tracking started |
| `completed_at` | `TIMESTAMPTZ`| Yes | None | Timestamp completed |
| `last_progressed_at`| `TIMESTAMPTZ`| No | `now()` | Timestamp of last progress event |

---

## 4. `user_episode_progress` & `user_reading_progress`
- `user_episode_progress`: Links `(user_id, episode_id)` with `watched BOOLEAN` and timestamp.
- `user_reading_progress`: Links `library_id` with `last_chapter_read NUMERIC` and `last_volume_read INTEGER`.
