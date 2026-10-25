import { test, expect } from '@playwright/test';

test.describe('TrackUp Phase 7: Recommendations Engine & Release Calendar', () => {
  test('explores recommendations, cross-format adaptations, and weekly release calendar across viewports', async ({
    page,
  }) => {
    // 1. Load application
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const isMobile = page.viewportSize() ? page.viewportSize()!.width <= 768 : false;

    // 2. Register user session
    const timestamp = Date.now();
    if (!isMobile) {
      await page.locator('[data-testid="auth-modal-trigger"]').click();
    } else {
      await page.locator('[data-testid="mobile-bottom-nav"] button:has-text("Sign In")').click();
    }

    await page.locator('[data-testid="auth-tab-register"]').click();
    await page.locator('[data-testid="auth-username-input"]').fill(`recs_tester_${timestamp}`);
    await page.locator('[data-testid="auth-email-input"]').fill(`recs_tester_${timestamp}@example.com`);
    await page.locator('[data-testid="auth-password-input"]').fill('SecretPass123!');
    await page.locator('[data-testid="auth-submit-button"]').click();
    await expect(page.locator('[data-testid="auth-modal"]')).toBeHidden();

    // 3. Navigate to Recommendations
    if (!isMobile) {
      await page.locator('[data-testid="sidebar-nav-recommendations"]').click();
    } else {
      await page.locator('[data-testid="mobile-nav-recommendations"]').click();
    }

    await expect(page.locator('[data-testid="recommendations-view"]')).toBeVisible();

    // Verify community favorites shelf is rendered
    await expect(page.locator('[data-testid="recommendations-community-section"]')).toBeVisible();

    // 4. Track Attack on Titan Manga via Omnisearch to trigger cross-format recommendation
    await page.locator('[data-testid="omnisearch-trigger"]').click();
    await expect(page.locator('[data-testid="omnisearch-modal"]')).toBeVisible();
    await page.locator('[data-testid="omnisearch-input"]').fill('Attack on Titan (Manga)');
    const omniManga = page.locator('[data-testid="omnisearch-result-manga_aot_30013"]');
    await expect(omniManga).toBeVisible();
    await omniManga.click();

    await expect(page.locator('[data-testid="title-detail-page"]')).toBeVisible();

    // On detail page, set status to completed
    await page.locator('[data-testid="status-selector"]').selectOption('completed');
    await expect(page.locator('[data-testid="status-selector"]')).toHaveValue('completed');

    // Return to Recommendations
    if (!isMobile) {
      await page.locator('[data-testid="sidebar-nav-recommendations"]').click();
    } else {
      await page.locator('[data-testid="mobile-nav-recommendations"]').click();
    }
    await expect(page.locator('[data-testid="recommendations-view"]')).toBeVisible();

    // Verify Cross-Format Adaptation shelf is triggered for Anime adaptation
    await expect(page.locator('[data-testid="recommendations-adaptations-section"]')).toBeVisible();
    const adaptationCard = page.locator('[data-testid="recommendation-adaptation-card-anime_aot_1429"]');
    await expect(adaptationCard).toBeVisible();
    await expect(adaptationCard).toContainText('Watch the Anime Adaptation');

    // Click on the adaptation card to view detail page
    await adaptationCard.click();
    await expect(page.locator('[data-testid="title-detail-page"]')).toBeVisible();

    // 5. Navigate to Weekly Airing Calendar
    if (!isMobile) {
      await page.locator('[data-testid="sidebar-nav-calendar"]').click();
    } else {
      await page.locator('[data-testid="mobile-nav-calendar"]').click();
    }
    await expect(page.locator('[data-testid="release-calendar-view"]')).toBeVisible();

    // Check day selector buttons
    await expect(page.locator('[data-testid="day-selector-sun"]')).toBeVisible();
    await page.locator('[data-testid="day-selector-sun"]').click();

    // Verify Sunday release (Attack on Titan Episode 89)
    const sundayRelease = page.locator('[data-testid="release-card-rel_aot_ep89"]');
    await expect(sundayRelease).toBeVisible();
    await expect(sundayRelease).toContainText('Episode 89');

    // Click "Filter: My Tracked Only"
    const filterBtn = page.locator('[data-testid="calendar-filter-tracked-button"]');
    await filterBtn.click();
    await expect(filterBtn).toContainText('Showing: Tracked Only');
  });

  test('responsive verification: desktop shows sidebar and hides mobile bottom bar; mobile hides sidebar and shows mobile bottom bar', async ({
    page,
  }) => {
    await page.goto('/');
    const isMobile = page.viewportSize() ? page.viewportSize()!.width <= 768 : false;

    if (!isMobile) {
      await expect(page.locator('[data-testid="desktop-sidebar"]')).toBeVisible();
      await expect(page.locator('[data-testid="mobile-bottom-nav"]')).toBeHidden();
      await expect(page.locator('[data-testid="sidebar-nav-calendar"]')).toBeVisible();
      await expect(page.locator('[data-testid="sidebar-nav-recommendations"]')).toBeVisible();
    } else {
      await expect(page.locator('[data-testid="desktop-sidebar"]')).toBeHidden();
      await expect(page.locator('[data-testid="mobile-bottom-nav"]')).toBeVisible();
      await expect(page.locator('[data-testid="mobile-nav-calendar"]')).toBeVisible();
      await expect(page.locator('[data-testid="mobile-nav-recommendations"]')).toBeVisible();
    }
  });
});
