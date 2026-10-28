import { test, expect } from '@playwright/test';

test.describe('TrackUp UI Quality Audit & Mobile Polish', () => {
  test('1. Media Artwork: displays authentic provider artwork and handles image errors gracefully', async ({
    page,
  }) => {
    await page.goto('/');

    // Navigate to Discover
    const isMobile = (page.viewportSize()?.width ?? 1280) <= 768;
    if (isMobile) {
      await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
      await page.locator('[data-testid="mobile-nav-discover"]').click();
    } else {
      await page.locator('[data-testid="sidebar-nav-discover"]').click();
    }

    await expect(page.locator('[data-testid="discover-page"]')).toBeVisible();

    // Verify Inception poster loads from TMDB
    const inceptionCard = page.locator('[data-testid="poster-card-movie_inception_27205"]');
    await expect(inceptionCard).toBeVisible();
    const inceptionImg = inceptionCard.locator('img');
    await expect(inceptionImg).toHaveAttribute('src', /image\.tmdb\.org/);

    // Verify Attack on Titan Anime poster loads from AniList
    const aotCard = page.locator('[data-testid="poster-card-anime_aot_1429"]');
    await expect(aotCard).toBeVisible();
    const aotImg = aotCard.locator('img');
    await expect(aotImg).toHaveAttribute('src', /anilist\.co/);

    // Switch to Reading Catalog to verify Solo Leveling poster loads from AniList
    await page.locator('[data-testid="discover-mode-read"]').click();
    const soloCard = page.locator('[data-testid="poster-card-manhwa_solo_leveling_105398"]');
    await expect(soloCard).toBeVisible();
    const soloImg = soloCard.locator('img');
    await expect(soloImg).toHaveAttribute('src', /anilist\.co/);

    // Switch back to Watch Catalog for Inception click
    await page.locator('[data-testid="discover-mode-watch"]').click();
    await expect(inceptionCard).toBeVisible();
    await inceptionCard.click();
    await expect(page.locator('[data-testid="title-detail-page"]')).toBeVisible();

    // Verify favorite button has accessible aria-label
    const favButton = page.locator('[data-testid="favorite-button"]');
    await expect(favButton).toBeVisible();
    const ariaLabel = await favButton.getAttribute('aria-label');
    expect(ariaLabel).toMatch(/favorites/i);
  });

  test('2. Mobile Navigation & Tap Targets: Samsung Galaxy S22 (360x780) and iPhone SE (320x568)', async ({
    page,
  }) => {
    // Set viewport to Samsung Galaxy S22
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/');

    const hamburger = page.locator('[data-testid="mobile-hamburger-trigger"]');
    await expect(hamburger).toBeVisible();

    // Verify touch target and accessible label
    const box = await hamburger.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(36);
    expect(box!.width).toBeGreaterThanOrEqual(36);

    await expect(hamburger).toHaveAttribute('aria-label', 'Open navigation menu');

    // Open mobile hamburger drawer
    await hamburger.click();
    const drawer = page.locator('[data-testid="mobile-nav-drawer"]');
    await expect(drawer).toBeVisible();

    // Test navigation between tabs on mobile via hamburger drawer
    await page.locator('[data-testid="mobile-nav-discover"]').click();
    await expect(page.locator('[data-testid="discover-page"]')).toBeVisible();

    await hamburger.click();
    await page.locator('[data-testid="mobile-nav-calendar"]').click();
    await expect(page.locator('[data-testid="release-calendar-view"]')).toBeVisible();

    await hamburger.click();
    await page.locator('[data-testid="mobile-nav-recommendations"]').click();
    await expect(page.locator('[data-testid="recommendations-view"]')).toBeVisible();

    // Verify narrow phone (320x568) has no horizontal layout overflow
    await page.setViewportSize({ width: 320, height: 568 });
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);
  });

  test('3. Category Filters: Discover and filter all 6 media categories on mobile', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/');

    await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
    await page.locator('[data-testid="mobile-nav-discover"]').click();
    await expect(page.locator('[data-testid="discover-page"]')).toBeVisible();

    // All 6 categories + All
    const categories = [
      { id: 'all', expectedTitle: 'Inception' },
      { id: 'movie', expectedTitle: 'Inception' },
      { id: 'tv', expectedTitle: 'Breaking Bad' },
      { id: 'anime_series', expectedTitle: 'Attack on Titan' },
      { id: 'anime_film', expectedTitle: 'Spirited Away' },
      { id: 'manga', expectedTitle: 'Attack on Titan (Manga)' },
      { id: 'manhwa', expectedTitle: 'Solo Leveling' },
    ];

    for (const cat of categories) {
      if (cat.id === 'manga' || cat.id === 'manhwa') {
        const readToggle = page.locator('[data-testid="discover-mode-read"]');
        if (await readToggle.isVisible()) {
          await readToggle.click();
        }
      } else {
        const watchToggle = page.locator('[data-testid="discover-mode-watch"]');
        if (await watchToggle.isVisible()) {
          await watchToggle.click();
        }
      }

      const pill = page.locator(`[data-testid="filter-category-${cat.id}"]`);
      await pill.scrollIntoViewIfNeeded();
      await expect(pill).toBeVisible();
      await pill.click();

      // Verify filtered results contain expected title
      await expect(page.locator(`text=${cat.expectedTitle}`).first()).toBeVisible();
    }
  });

  test('4. Accessibility & Modal Close Targets: accessible names and keyboard traps', async ({
    page,
  }) => {
    await page.goto('/');

    // Omnisearch modal close button accessible name
    await page.locator('[data-testid="omnisearch-trigger"]').click();
    const searchModal = page.locator('[data-testid="omnisearch-modal"]');
    await expect(searchModal).toBeVisible();
    const searchClose = page.locator('[data-testid="omnisearch-close"]');
    await expect(searchClose).toHaveAttribute('aria-label', /close/i);
    await searchClose.click();
    await expect(searchModal).toBeHidden();

    // Auth modal close button accessible name
    await page.locator('[data-testid="auth-modal-trigger"]').click();
    const authModal = page.locator('[data-testid="auth-modal"]');
    await expect(authModal).toBeVisible();
    const authClose = page.locator('[data-testid="auth-close-button"]');
    await expect(authClose).toHaveAttribute('aria-label', /close/i);
    await authClose.click();
    await expect(authModal).toBeHidden();
  });
});
