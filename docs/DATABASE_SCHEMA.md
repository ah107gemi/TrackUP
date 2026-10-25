# TrackUp Database Schema Documentation

## 1. Schema Principles
- **100% RLS Coverage:** Every table in the `public` schema has Row-Level Security enabled.
- **Normalization:** Factual entertainment metadata (posters, episodes, synopses) exists once in `catalog_*` and is never duplicated per-user.
- **Domain Separation:**
  - Episodic watching (`tv`, `anime_series`) tracks `user_episode_progress` and `watch_history`.
  - Chapter reading (`manga`, `manhwa`) tracks `user_reading_progress` and `reading_history`.
  - Single-session watching (`movie`, `anime_film`) updates `user_libraries.status` and logs completion.

---

## 2. Table Summary

| Table Name | Primary Purpose | RLS Access Pattern |
| :--- | :--- | :--- |
| `profiles` | Extended user identity, preferences, and privacy | Public/follower read; owner update |
| `catalog_titles` | Shared normalized metadata for all 6 media types | Public read; service-role write |
| `catalog_seasons` | TV and Anime series season groupings | Public read; service-role write |
| `catalog_episodes` | Granular episode metadata and air dates | Public read; service-role write |
| `title_relationships` | Cross-media connections (e.g. Manga -> Anime) | Public read; service-role write |
| `user_libraries` | User ownership, tracking status, rating, and notes | Owner all; public read if profile/item public |
| `user_episode_progress` | Individual episode watched checkboxes | Strict owner isolation |
| `user_reading_progress` | Current chapter and volume counters | Strict owner isolation |
| `watch_history` | Chronological log of viewed episodes & movies | Strict owner isolation |
| `reading_history` | Chronological log of read chapters & volumes | Strict owner isolation |
| `reviews` | User reviews, ratings, and spoiler protection | Public read per visibility; owner all |
| `user_favorites` | Showcase of pinned favorite titles | Readable if profile visible; owner all |
| `import_batches` | Staged CSV/XML upload batches | Strict owner isolation |
| `import_batch_items` | Individual rows for match resolution | Strict owner isolation |
| `user_follows` | Social graph follower/following relationships | Public read; follower insert/delete |
| `activity_logs` | Audit feed of user tracking activities | Readable per user activity visibility |

---

## 3. Enumerated Types
- `media_type`: `movie`, `tv`, `anime_series`, `anime_film`, `manga`, `manhwa`
- `tracking_status`: `planned`, `active`, `completed`, `paused`, `dropped`, `reconsuming`
- `relationship_type`: `adaptation`, `sequel`, `prequel`, `spin_off`, `side_story`, `parent`, `other`
- `privacy_level`: `private`, `followers_only`, `public`
- `import_batch_status`: `pending`, `processing`, `completed`, `cancelled`, `failed`
- `import_item_status`: `pending`, `exact_match`, `ambiguous_match`, `unmatched`, `invalid`, `committed`
