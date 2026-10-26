import { test, expect } from '@playwright/test';

test.describe('TrackUp Phase 2: Unified Search & Adaptive Title Detail Pages', () => {
  test('verifies searching via Omnisearch and navigating to a Movie Detail Page', async ({ page }) => {
    await page.goto('/');

    // Open Omnisearch
    await page.locator('[data-testid="omnisearch-trigger"]').click();
    await expect(page.locator('[data-testid="omnisearch-modal"]')).toBeVisible();

    // Search for Inception
    const searchInput = page.locator('[data-testid="omnisearch-input"]');
    await searchInput.fill('Inception');

    // Click matching result
    const resultItem = page.locator('[data-testid="omnisearch-result-movie_inception_27205"]');
    await expect(resultItem).toBeVisible();
    await resultItem.click();

    // Verify Title Detail Page opens
    await expect(page.locator('[data-testid="title-detail-page"]')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Inception');

    // Verify Movie-specific section renders (runtime & mark watched button)
    const movieSection = page.locator('[data-testid="movie-tracking-section"]');
    await expect(movieSection).toBeVisible();
    await expect(movieSection).toContainText('148 minutes');

    const completeBtn = page.locator('[data-testid="movie-complete-toggle"]');
    await expect(completeBtn).toBeVisible();
    await completeBtn.click();
    await expect(completeBtn).toContainText('Watched ✓');

    // Verify Movie release date displays cleanly
    const releaseBadge = page.locator('[data-testid="detail-release-date"]');
    await expect(releaseBadge).toBeVisible();
    await expect(releaseBadge).toContainText('Jul 16, 2010');

    // Verify TMDB attribution footer
    await expect(page.locator('[data-testid="tmdb-attribution"]')).toBeVisible();
  });

  test('verifies TV Show detail page renders Seasons & Episode Accordions', async ({ page }) => {
    await page.goto('/');

    // Navigate to Discover
    const isMobile = page.viewportSize() ? page.viewportSize()!.width <= 768 : false;
    if (isMobile) {
      await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
      await page.locator('[data-testid="mobile-nav-discover"]').click();
    } else {
      await page.locator('[data-testid="desktop-sidebar"] button:has-text("Discover")').click();
    }

    await expect(page.locator('[data-testid="discover-page"]')).toBeVisible();

    // Click Breaking Bad poster card
    const card = page.locator('[data-testid="poster-card-tv_breaking_bad_1396"]');
    await expect(card).toBeVisible();
    await card.click();

    // Verify Detail Page
    await expect(page.locator('[data-testid="title-detail-page"]')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Breaking Bad');

    // Verify Episodic tracking section renders
    const episodicSection = page.locator('[data-testid="episodic-tracking-section"]');
    await expect(episodicSection).toBeVisible();
    await expect(episodicSection).toContainText('Episodes & Season Tracker');

    // Verify episode checkmark toggle
    const episodeRow = page.locator('[data-testid="episode-row-1"]');
    await expect(episodeRow).toBeVisible();

    // Verify episode air date is displayed
    const episodeAirDate = page.locator('[data-testid="episode-air-date-1"]');
    await expect(episodeAirDate).toBeVisible();
    await expect(episodeAirDate).toContainText('Jan 20, 2008');

    await episodeRow.click();
  });

  test('verifies Manga detail page renders Chapter/Volume Steppers & Linked Adaptations', async ({ page }) => {
    await page.goto('/');

    // Open Omnisearch and search for Manga
    await page.locator('[data-testid="omnisearch-trigger"]').click();
    const searchInput = page.locator('[data-testid="omnisearch-input"]');
    await searchInput.fill('Titan');

    // Select Manga result
    const mangaResult = page.locator('[data-testid="omnisearch-result-manga_aot_30013"]');
    await expect(mangaResult).toBeVisible();
    await mangaResult.click();

    // Verify Detail Page
    await expect(page.locator('[data-testid="title-detail-page"]')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Attack on Titan (Manga)');

    // Verify Reading section (Chapter & Volume progress)
    const readingSection = page.locator('[data-testid="reading-tracking-section"]');
    await expect(readingSection).toBeVisible();
    await expect(readingSection).toContainText('Reading Progress (Chapters & Volumes)');
    await expect(readingSection).toContainText('Ch. 0 / 139');

    // Increment chapter
    const incBtn = page.locator('[data-testid="chapter-increment"]');
    await expect(incBtn).toBeVisible();
    await incBtn.click();
    await expect(readingSection).toContainText('Ch. 1 / 139');

    // Verify Linked Adaptations (links to Anime series)
    const adaptationsSection = page.locator('[data-testid="related-adaptations-section"]');
    await expect(adaptationsSection).toBeVisible();
    await expect(adaptationsSection).toContainText('Linked Adaptations & Related Works');
    await expect(adaptationsSection).toContainText(/adaptation/i);
  });

  test('verifies future episode countdowns and dynamic top bar header scroll title swap', async ({ page }) => {
    await page.goto('/');

    const isMobile = page.viewportSize() ? page.viewportSize()!.width <= 768 : false;

    // Check initial header greeting
    if (!isMobile) {
      const greeting = page.locator('[data-testid="header-greeting"]');
      await expect(greeting).toBeVisible();
      await expect(greeting).toContainText(/Hello/i);
    }

    // Open Omnisearch and search for Attack on Titan anime
    await page.locator('[data-testid="omnisearch-trigger"]').click();
    const searchInput = page.locator('[data-testid="omnisearch-input"]');
    await searchInput.fill('Titan');

    // Click Attack on Titan anime result
    const aotResult = page.locator('[data-testid="omnisearch-result-anime_aot_1429"]');
    await expect(aotResult).toBeVisible();
    await aotResult.click();

    // Verify Title Detail Page
    await expect(page.locator('[data-testid="title-detail-page"]')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Attack on Titan');

    // Select Season 4 tab
    const season4Tab = page.locator('[data-testid="season-tab-4"]');
    await expect(season4Tab).toBeVisible();
    await season4Tab.click();

    // Verify unaired future episode 27 has formatted air date and countdown badge
    const episodeAirDate27 = page.locator('[data-testid="episode-air-date-27"]');
    await expect(episodeAirDate27).toBeVisible();
    await expect(episodeAirDate27).toContainText('Oct 31, 2026');

    const countdownPill27 = page.locator('[data-testid="episode-countdown-27"]');
    await expect(countdownPill27).toBeVisible();
    await expect(countdownPill27).toContainText('5 days');

    // Verify unaired future episode 30 has countdown badge
    const countdownPill = page.locator('[data-testid="episode-countdown-30"]');
    await expect(countdownPill).toBeVisible();
    await expect(countdownPill).toContainText(/days|hours|today/i);

    // Test dynamic header swap on scroll
    await page.locator('main').evaluate((el) => {
      el.scrollTop = 500;
      el.dispatchEvent(new Event('scroll'));
    });

    if (isMobile) {
      await expect(page.locator('[data-testid="mobile-scrolled-header-title"]')).toContainText('Attack on Titan');
    } else {
      await expect(page.locator('[data-testid="header-scrolled-title"]')).toContainText('Attack on Titan');
    }

    // Scroll back to top and verify greeting reverts
    await page.locator('main').evaluate((el) => {
      el.scrollTop = 0;
      el.dispatchEvent(new Event('scroll'));
    });

    if (!isMobile) {
      await expect(page.locator('[data-testid="header-greeting"]')).toBeVisible();
    }
  });
});
