# 4. TRACKUP_UI_UX_SPECIFICATION.md

```markdown
# TRACKUP DESIGN SYSTEM & UI/UX SPECIFICATION

## 1. Brand Identity & Asset Handling
- **Tagline:** *"Track what you love."*
- **Logo Asset Rule:** Use the supplied TrackUp logo (`image_08641b.jpg` featuring the bold golden-yellow `"T"` with the circular cutout dot and crisp white `"rack"` + golden-yellow `"Up"` wordmark on near-black)[cite: 1].
- **Strict Asset Instruction for Antigravity:** If the logo image file is not yet present in `public/assets/` when initializing the repository, Antigravity must **prompt the developer to drop the image file into `public/assets/trackup-logo.jpg`** (or create an exact high-precision SVG match only if explicitly approved, never a generic placeholder icon).

---

## 2. Design Tokens (Tailwind CSS Configuration)
TrackUp uses a **Cinematic Noir & Golden-Yellow** aesthetic—distinct from Netflix's red/black palette:

| Token Name | Hex / Value | Usage |
| :--- | :--- | :--- |
| `bg-background` | `#101014` | Primary application viewport canvas |
| `bg-surface` | `#16161D` | Desktop sidebar, cards, and elevated panels |
| `bg-surface-elevated` | `#1F1F29` | Hover states, dropdown menus, modal surfaces |
| `bg-glass` | `rgba(16, 16, 20, 0.82)` | Sticky headers and mobile bottom navigation with `backdrop-blur-md` |
| `text-primary` | `#F8FAFC` | Primary headings, titles, and active navigation labels |
| `text-secondary` | `#94A3B8` | Metadata (release year, runtime, genres, chapter labels) |
| `text-muted` | `#64748B` | Disabled states, secondary timestamps |
| `accent-primary` | `#FFC400` | Primary CTA buttons, active progress bars, star ratings, active tab indicators |
| `accent-hover` | `#FFD033` | Hover state for primary golden-yellow buttons (with `#101014` dark bold text for WCAG AAA contrast) |
| `status-watching` | `#FFC400` | Currently Watching / Currently Reading |
| `status-completed` | `#10B981` | Completed badge and progress bar |
| `status-planned` | `#38BDF8` | Watchlist / Reading List (Planned) |
| `status-paused` | `#F59E0B` | On Hold / Paused |
| `status-dropped` | `#EF4444` | Dropped |

### Typography
- **Headings & Display:** `Plus Jakarta Sans` or `Inter` (`font-bold`, tight tracking `-0.02em`).
- **Body & UI Controls:** `Inter` (`font-normal`, `font-medium`).
- **Numeric Badges & Progress Counters (`S02E05`, `Ch. 142`):** `JetBrains Mono` (`tabular-nums`) so incrementing episode/chapter numbers never causes layout jitter[cite: 2].

---

## 3. Core Screen Specifications

### 3.1 Dashboard Layout
1. **Desktop Left Sidebar (`260px` fixed, collapsible to `72px` icon rail):**
   - Brand header with TrackUp logo[cite: 1].
   - Primary Navigation: **Dashboard**, **Discover**, **Watch Library** (*Movies, TV, Anime*), **Reading Library** (*Manga, Manhwa*), **History & Stats**, **Import / Export**, and **Friends** (Phase 6).
   - User profile footer with quick theme/privacy indicator.
2. **Top Utility Bar:**
   - Personalized greeting (*"Good evening, [Name] — Ready to track what you love?"*).
   - Global Omnisearch trigger (`Cmd+K` / `/`) opening an instant modal search across all 6 content types[cite: 2].
3. **Hero Spotlight & Stats Strip:**
   - 4 compact metric cards: *Hours Watched*, *Episodes Logged*, *Chapters Read*, *Active Streak / Completed Titles*.
   - Featured Hero Banner showcasing the user's primary active title (or top trending title for new users) with high-res backdrop, gradient vignette into `#101014`, current progress badge (`Season 2 • Episode 8` or `Volume 4 • Chapter 42`), and a one-click **`+1 Episode` / `+1 Chapter`** golden-yellow action button.
4. **Up Next & Recently Progressed Rows:**
   - **Continue Watching & Reading ("Up Next"):** Horizontal cards with an inline progress bar and a quick `+1` increment button that triggers an optimistic TanStack Query mutation.
   - **Recently Added / Updated Poster Rows:** Segmented by *Watch* and *Read*.

### 3.2 Title Detail Page (Adaptive to Content Type)
- **Cinematic Backdrop Header:** Full-width backdrop image (`aspect-[21/9]` on desktop, `aspect-[16/10]` on mobile) with a multi-stop vertical gradient (`from-transparent via-[#101014]/80 to-[#101014]`).
- **Left Column:** High-resolution poster (`aspect-[2/3]`), Favorite heart toggle, and current User Rating widget (5-star interactive selector supporting half-stars, stored as `1–10`).
- **Right Main Content:**
  - Content category pill (`MOVIE`, `TV SERIES`, `ANIME SERIES`, `ANIME FILM`, `MANGA`, `MANHWA`), release year, origin country, runtime or total chapters/episodes, and genre chips.
  - Primary Action Bar: Status selector dropdown (`Planned`, `Watching/Reading`, `Completed`, `Paused`, `Dropped`), Quick Progress action, and `Write Review` button.
  - Synopsis with spoiler-safe truncation.
  - **Conditional Progress Module:**
    - *For `movie` & `anime_film`:* Mark Watched toggle, Watch Date picker, and Rewatch counter.
    - *For `tv` & `anime_series`:* Interactive Season selector tabs + Episode list with individual watched checkboxes, air dates, and a *"Mark Season Watched"* batch action.
    - *For `manga` & `manhwa`:* Dedicated Chapter & Volume stepper controls (`-1`, `+1`, or direct numeric input for Chapter and Volume), progress percentage bar against `total_chapters`, and Reading History log.
  - **Adaptations & Related Works Section:** Displays linked cards from `title_relationships` (e.g., on the *Jujutsu Kaisen* Manga page, prominently links to the *Jujutsu Kaisen* Anime Series and *Jujutsu Kaisen 0* Anime Film).
  - **Cast / Creators & Community Reviews:** Horizontal cast/staff scroller and spoiler-protected user reviews.

### 3.3 Personal Library View (Watch & Read)
- **Filter & View Bar:**
  - Media Type pills (`All`, `Movies`, `TV`, `Anime Series`, `Anime Films`, `Manga`, `Manhwa`).
  - Status Segment Controller (`All`, `Active`, `Planned`, `Completed`, `Paused`, `Dropped`)[cite: 2].
  - **3 View Modes (Preserved from CourseVault):** `Poster Grid`, `Compact Grid`, and `Detailed List/Table` (with inline episode/chapter increment buttons)[cite: 2].

---

## 4. Responsive Mobile Ergonomics & Interactive States
1. **Mobile Navigation (`<= 768px`):**
   - Desktop sidebar hides; replaced by a fixed bottom navigation bar (`height: 64px`) with `padding-bottom: env(safe-area-inset-bottom)` for iOS/Android home indicators[cite: 2].
   - Bottom Bar destinations: **Home**, **Discover**, **Watch**, **Read**, **More/Drawer**.
2. **Touch & Virtual Keyboard Handling:**
   - All interactive tap targets (especially `+1 Episode/Chapter` buttons and star ratings) enforce a minimum hit area of `44x44px`.
   - Dialogs and bottom sheets use `max-h-[90dvh]` with scrollable internal bodies so mobile software keyboards never obscure text inputs or review editors[cite: 2].
3. **Mandatory UI States:**
   - **Loading:** Shimmering dark-mode skeleton cards matching exact poster/row dimensions (`bg-[#1F1F29] animate-pulse`).
   - **Empty States:** Custom illustrated callouts with direct action buttons (e.g., *"Your Reading List is empty — Search Manga & Manhwa or Import a CSV"*).
   - **Error & Offline States:** Non-destructive toast notifications + an offline connection indicator badge in the header when `navigator.onLine` is false[cite: 2].