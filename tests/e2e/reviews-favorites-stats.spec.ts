import { test, expect } from '@playwright/test';

test.describe('TrackUp Phase 4: Ratings, Reviews, Favorites & Dashboard Stats', () => {
  test('rates title with half-stars, publishes spoiler review, toggles favorite, and verifies stats & favorites showcase', async ({
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
    await page.locator('[data-testid="auth-username-input"]').fill(`reviewer_${timestamp}`);
    await page.locator('[data-testid="auth-email-input"]').fill(`reviewer_${timestamp}@example.com`);
    await page.locator('[data-testid="auth-password-input"]').fill('SecretPass123!');
    await page.locator('[data-testid="auth-submit-button"]').click();

    await expect(page.locator('[data-testid="auth-modal"]')).toBeHidden();

    // 2. Open a Movie Title (Inception) via Omnisearch
    await page.locator('[data-testid="omnisearch-trigger"]').click();
    await page.locator('[data-testid="omnisearch-input"]').fill('Inception');
    const movieResult = page.locator('[data-testid="omnisearch-result-movie_inception_27205"]');
    await expect(movieResult).toBeVisible();
    await movieResult.click();

    await expect(page.locator('[data-testid="title-detail-page"]')).toBeVisible();

    // 3. Mark Completed
    await page.locator('[data-testid="status-selector"]').selectOption('completed');

    // 4. Rate with Half-Stars: Click Left half of 5th star (4.5 Stars / 9 pts)
    const star5Half = page.locator('[data-testid="star-5-half"]');
    await expect(star5Half).toBeVisible();
    await star5Half.click();

    // Verify rating indicator displays 4.5 ★
    const scoreText = page.locator('[data-testid="star-rating-score"]').first();
    await expect(scoreText).toContainText('4.5 ★');

    // 5. Toggle Favorite
    const favButton = page.locator('[data-testid="favorite-button"]');
    await expect(favButton).toBeVisible();
    await favButton.click();
    // Verify favorite icon has fill
    await expect(favButton.locator('svg')).toHaveClass(/fill-rose-500/);

    // 6. Write and Publish a Review with Spoilers
    const openReviewBtn = page.locator('[data-testid="open-review-modal-button"]');
    await expect(openReviewBtn).toBeVisible();
    await openReviewBtn.click();

    await expect(page.locator('[data-testid="review-modal"]')).toBeVisible();
    await page
      .locator('[data-testid="review-textarea"]')
      .fill(
        'Dom Cobb reaches the deepest subconscious dream level in a mind-bending climax where the spinning totem leaves the reality ambiguous.'
      );

    // Toggle spoiler protection checkbox
    await page.locator('[data-testid="spoiler-toggle"]').click();

    // Submit review
    await page.locator('[data-testid="submit-review-button"]').click();
    await expect(page.locator('[data-testid="review-modal"]')).toBeHidden({ timeout: 5000 });

    // 7. Verify Spoiler Protection on Detail Page
    const spoilerBanner = page.locator('[data-testid="spoiler-warning-banner"]');
    await expect(spoilerBanner).toBeVisible();
    await expect(spoilerBanner).toContainText(/Warning: This review contains spoilers/i);

    // Click "Reveal Spoiler" button
    const revealBtn = page.locator('[data-testid="reveal-spoiler-button"]');
    await expect(revealBtn).toBeVisible();
    await revealBtn.click();

    // Text is now visible
    const reviewBody = page.locator('[data-testid="review-body-text"]');
    await expect(reviewBody).toBeVisible();
    await expect(reviewBody).toContainText('Dom Cobb reaches the deepest subconscious');

    // 8. Verify Favorites Showcase in Profile Modal
    if (!isMobile) {
      await page.locator('[data-testid="profile-button"]').click();
    } else {
      await page.locator('[data-testid="mobile-nav-profile"]').click();
    }

    await expect(page.locator('[data-testid="profile-modal"]')).toBeVisible();
    await page.locator('[data-testid="profile-tab-favorites"]').click();

    // Verify pinned favorite card
    const favCard = page.locator('[data-testid="favorite-item-movie_inception_27205"]');
    await expect(favCard).toBeVisible();
    await expect(favCard).toContainText('Inception');

    // Close Profile Modal
    await page.locator('[data-testid="profile-close-button"]').click();
    await expect(page.locator('[data-testid="profile-modal"]')).toBeHidden();

    // 9. Navigate to Dashboard and Verify Live Analytics
    if (!isMobile) {
      await page.locator('[data-testid="sidebar-nav-dashboard"]').click();
    } else {
      await page.locator('[data-testid="mobile-nav-dashboard"]').click();
    }

    await expect(page.locator('[data-testid="dashboard-view"]')).toBeVisible();

    // Verify Dashboard Analytics Stats reflect the rated/completed movie
    const statsSection = page.locator('[data-testid="dashboard-stats-section"]');
    await expect(statsSection).toBeVisible();

    const avgRatingStat = page.locator('[data-testid="stat-average-rating"]');
    await expect(avgRatingStat).toContainText('4.5 ★');

    const movieDistChip = page.locator('[data-testid="distribution-chip-movie"]');
    await expect(movieDistChip).toContainText('1');
  });
});
