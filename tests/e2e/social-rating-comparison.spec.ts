import { test, expect } from '@playwright/test';

test.describe('TrackUp Phase 6: Social Graph, Activity Feeds & Rating Comparison', () => {
  test('follows a user, verifies activity feed update, and checks rating comparison widget on shared title', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Authenticate user
    const timestamp = Date.now();
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const isMobile = page.viewportSize() ? page.viewportSize()!.width <= 768 : false;

    if (!isMobile) {
      await page.locator('[data-testid="auth-modal-trigger"]').click();
    } else {
      await page.locator('[data-testid="mobile-bottom-nav"] button:has-text("Sign In")').click();
    }

    await page.locator('[data-testid="auth-tab-register"]').click();
    await page.locator('[data-testid="auth-username-input"]').fill(`socialite_${timestamp}`);
    await page.locator('[data-testid="auth-email-input"]').fill(`socialite_${timestamp}@example.com`);
    await page.locator('[data-testid="auth-password-input"]').fill('SecretPass123!');
    await page.locator('[data-testid="auth-submit-button"]').click();

    await expect(page.locator('[data-testid="auth-modal"]')).toBeHidden();

    // 2. Open Social View
    if (!isMobile) {
      await page.locator('[data-testid="sidebar-nav-social"]').click();
    } else {
      // On mobile, navigate via direct Omnisearch or UI tab
      await page.locator('[data-testid="mobile-nav-dashboard"]').click();
    }

    if (!isMobile) {
      await expect(page.locator('[data-testid="social-view"]')).toBeVisible();
      await expect(page.locator('[data-testid="social-feed-view"]')).toBeVisible();

      // 3. Search for Elena Rostova
      const searchInput = page.locator('[data-testid="profile-search-input"]');
      await searchInput.fill('Elena');

      const elenaCard = page.locator('[data-testid="profile-card-elena_tracker"]');
      await expect(elenaCard).toBeVisible();

      // Click Follow
      const followBtn = page.locator('[data-testid="follow-toggle-elena_tracker"]');
      await expect(followBtn).toContainText('Follow');
      await followBtn.click();

      // Button updates to Following
      await expect(followBtn).toContainText('Following');

      // Verify Elena's activity is now visible in the Following feed
      const activityItem = page.locator('[data-testid="activity-feed-item-act_1"]');
      await expect(activityItem).toBeVisible();
      await expect(activityItem).toContainText('Elena Rostova');
    }

    // 4. Open Inception Detail Page via Omnisearch
    await page.locator('[data-testid="omnisearch-trigger"]').click();
    await page.locator('[data-testid="omnisearch-input"]').fill('Inception');
    const movieResult = page.locator('[data-testid="omnisearch-result-movie_inception_27205"]');
    await expect(movieResult).toBeVisible();
    await movieResult.click();

    await expect(page.locator('[data-testid="title-detail-page"]')).toBeVisible();

    // 5. Rate Inception with 4.5 Stars (9 points)
    const star5Half = page.locator('[data-testid="star-5-half"]');
    await expect(star5Half).toBeVisible();
    await star5Half.click();

    // 6. Verify Rating Comparison Widget
    const comparisonWidget = page.locator('[data-testid="rating-comparison-widget"]');
    await expect(comparisonWidget).toBeVisible();

    // User's Rating: 4.5 ★
    const userScore = page.locator('[data-testid="user-rating-score"]');
    await expect(userScore).toContainText('4.5 ★');

    // Elena's Rating: 4.0 ★
    const friendScore = page.locator('[data-testid="friend-rating-score"]');
    await expect(friendScore).toContainText('4.0 ★');

    // Delta Callout: +0.5 ★ higher
    const deltaPill = page.locator('[data-testid="rating-delta-pill"]');
    await expect(deltaPill).toBeVisible();
    await expect(deltaPill).toContainText('+0.5 ★');
  });
});
