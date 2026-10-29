import { test, expect } from '@playwright/test';

test.describe('TrackUp Phase 3: Watch & Read Libraries, 3 View Modes & Granular Progress', () => {
  test('adds TV show, marks episode watched, adds Manhwa, increments chapter to 12.5, and tests 3 view modes', async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto('/');

    // 1. Authenticate user
    const timestamp = Date.now();
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const isMobile = page.viewportSize() ? page.viewportSize()!.width <= 768 : false;

    if (!isMobile) {
      await page.locator('[data-testid="auth-modal-trigger"]').click();
    } else {
      await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
      await page.locator('[data-testid="mobile-nav-profile"]').click();
    }

    await page.locator('[data-testid="auth-tab-register"]').click();
    await page.locator('[data-testid="auth-username-input"]').fill(`phase3_user_${timestamp}`);
    await page.locator('[data-testid="auth-email-input"]').fill(`phase3_${timestamp}@example.com`);
    await page.locator('[data-testid="auth-password-input"]').fill('SecretPass123!');
    await page.locator('[data-testid="auth-submit-button"]').click();

    await expect(page.locator('[data-testid="auth-modal"]')).toBeHidden();

    // 2. Add TV Show (Breaking Bad) and mark Episode 1 watched
    await page.locator('[data-testid="omnisearch-trigger"]').click();
    await page.locator('[data-testid="omnisearch-input"]').fill('Breaking Bad');
    const tvResult = page.locator('[data-testid="omnisearch-result-tv_breaking_bad_1396"]');
    await expect(tvResult).toBeVisible({ timeout: 15000 });
    await tvResult.click();

    await expect(page.locator('[data-testid="title-detail-page"]')).toBeVisible();

    // Change status to active
    await page.locator('[data-testid="status-selector"]').selectOption('active');

    // Mark Episode 1 watched
    const ep1Row = page.locator('[data-testid="episode-row-1"]');
    await expect(ep1Row).toBeVisible();
    await ep1Row.click();

    // 3. Add Manhwa (Solo Leveling) and set chapter to 12.5
    await page.locator('[data-testid="omnisearch-trigger"]').click();
    await page.locator('[data-testid="search-mode-read"]').click();
    await page.locator('[data-testid="omnisearch-input"]').fill('Solo Leveling');
    const manhwaResult = page.locator('[data-testid="omnisearch-result-manhwa_solo_leveling_105398"]');
    await expect(manhwaResult).toBeVisible({ timeout: 15000 });
    await manhwaResult.click();

    await expect(page.locator('[data-testid="title-detail-page"]')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Solo Leveling');

    // Set status to active
    await page.locator('[data-testid="status-selector"]').selectOption('active');

    // Enter fractional chapter 12.5
    const fractionalInput = page.locator('[data-testid="fractional-chapter-input"]');
    await expect(fractionalInput).toBeVisible();
    await fractionalInput.fill('12.5');
    await page.locator('[data-testid="fractional-chapter-submit"]').click();

    // Verify UI reflects Ch. 12.5
    const readingSection = page.locator('[data-testid="reading-tracking-section"]');
    await expect(readingSection).toContainText('Ch. 12.5');

    // 4. Test Watch Library & 3 View Modes (Grid, Compact, List)
    if (!isMobile) {
      await page.locator('[data-testid="desktop-sidebar"] button:has-text("Watch Library")').click();
    } else {
      await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
      await page.locator('[data-testid="mobile-nav-watch"]').click();
    }

    await expect(page.locator('[data-testid="watch-library-view"]')).toBeVisible();
    await expect(page.locator('text=Breaking Bad')).toBeVisible();

    // Test Local Library Search & Status Dropdown Filter
    const searchInput = page.locator('[data-testid="library-search-input"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Breaking');
    await expect(page.locator('text=Breaking Bad')).toBeVisible();

    // Search for non-matching query
    await searchInput.fill('NonExistentTitle12345');
    await expect(page.locator('[data-testid="no-library-matches"]')).toBeVisible();

    // Clear search using clear button
    await page.locator('[data-testid="library-search-clear-btn"]').click();
    await expect(page.locator('text=Breaking Bad')).toBeVisible();

    // Filter by Status Dropdown
    const statusSelect = page.locator('[data-testid="library-status-select"]');
    await expect(statusSelect).toBeVisible();
    await statusSelect.selectOption('active');
    await expect(page.locator('text=Breaking Bad')).toBeVisible();
    await statusSelect.selectOption('completed');
    await expect(page.locator('[data-testid="no-library-matches"]')).toBeVisible();
    // Reset back to all
    await statusSelect.selectOption('all');
    await expect(page.locator('text=Breaking Bad')).toBeVisible();

    // Default: Poster Grid mode
    await expect(page.locator('[data-testid="library-poster-grid"]')).toBeVisible();

    // Switch to Compact Grid mode
    await page.locator('[data-testid="view-mode-compact"]').click();
    await expect(page.locator('[data-testid="library-compact-grid"]')).toBeVisible();

    // Switch to Detailed List / Table mode
    await page.locator('[data-testid="view-mode-list"]').click();
    await expect(page.locator('[data-testid="library-detailed-list"]')).toBeVisible();

    // In List mode, click +1 quick action button
    const listIncBtn = page.locator('[data-testid^="list-increment-"]').first();
    await expect(listIncBtn).toBeVisible();
    await listIncBtn.click();

    // Verify optimistic progress update
    await expect(page.locator('text=2 / 62 eps')).toBeVisible();

    // 5. Test Reading Library
    if (!isMobile) {
      await page.locator('[data-testid="desktop-sidebar"] [data-testid="sidebar-nav-read"]').click();
    } else {
      await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
      await page.locator('[data-testid="mobile-nav-read"]').click();
    }

    await expect(page.locator('[data-testid="read-library-view"]')).toBeVisible();
    await expect(page.locator('text=Solo Leveling')).toBeVisible();

    // Verify fractional progress 12.5 in reading library table
    await expect(page.locator('text=Ch. 12.5')).toBeVisible();

    // Click fractional increment (+0.5)
    const fracIncBtn = page.locator('[data-testid^="fractional-increment-"]').first();
    await expect(fracIncBtn).toBeVisible();
    await fracIncBtn.click();

    // Optimistic update to Ch. 13
    await expect(page.locator('text=Ch. 13')).toBeVisible();

    // 6. Verify Dashboard "Up Next" section
    if (!isMobile) {
      await page.locator('[data-testid="desktop-sidebar"] button:has-text("Dashboard")').click();
    } else {
      await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
      await page.locator('[data-testid="mobile-nav-dashboard"]').click();
    }

    const upNext = page.locator('[data-testid="dashboard-up-next-section"]');
    await expect(upNext).toBeVisible();
    await expect(upNext).toContainText('Breaking Bad');
    await expect(upNext).toContainText('Solo Leveling');
  });
});
