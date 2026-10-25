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

    // Verify TMDB attribution footer
    await expect(page.locator('[data-testid="tmdb-attribution"]')).toBeVisible();
  });

  test('verifies TV Show detail page renders Seasons & Episode Accordions', async ({ page }) => {
    await page.goto('/');

    // Navigate to Discover
    const isMobile = page.viewportSize() ? page.viewportSize()!.width <= 768 : false;
    if (isMobile) {
      await page.locator('[data-testid="mobile-bottom-nav"] button:has-text("Discover")').click();
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
});
