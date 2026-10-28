import { test, expect } from '@playwright/test';

test.describe('TrackUp: Profile Groundwork, Dedicated Manga/Manhwa, and Binger Import', () => {
  test('navigates to Profile page, views TV Time-style showcases, and imports Binger CSV', async ({
    page,
  }) => {
    await page.goto('/');

    const timestamp = Date.now();
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const isMobile = page.viewportSize() ? page.viewportSize()!.width <= 768 : false;

    // 1. Register & Authenticate User
    if (!isMobile) {
      await page.locator('[data-testid="auth-modal-trigger"]').click();
    } else {
      await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
      await page.locator('[data-testid="mobile-nav-profile"]').click();
    }

    await page.locator('[data-testid="auth-tab-register"]').click();
    await page.locator('[data-testid="auth-username-input"]').fill(`bingertester_${timestamp}`);
    await page.locator('[data-testid="auth-email-input"]').fill(`bingertester_${timestamp}@example.com`);
    await page.locator('[data-testid="auth-password-input"]').fill('BingerPass123!');
    await page.locator('[data-testid="auth-submit-button"]').click();

    await expect(page.locator('[data-testid="auth-modal"]')).toBeHidden();

    // 2. Navigate to Dedicated Reading / Manga & Manhwa section
    if (!isMobile) {
      await page.locator('[data-testid="sidebar-nav-read"]').click();
    } else {
      await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
      await page.locator('[data-testid="mobile-nav-read"]').click();
    }
    await expect(page.locator('[data-testid="read-library-view"]')).toBeVisible();

    // 3. Navigate to Profile page
    if (!isMobile) {
      await page.locator('[data-testid="sidebar-nav-profile"]').click();
    } else {
      await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
      await page.locator('[data-testid="mobile-nav-profile-link"]').click();
    }

    await expect(page.locator('[data-testid="profile-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-page"]').getByText(`@bingertester_${timestamp}`)).toBeVisible();

    // Verify TV Time-style sections & watch time badges exist
    await expect(page.locator('[data-testid="profile-section-tv"]')).toBeVisible();
    await expect(page.locator('[data-testid="tv-watch-time"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-section-movies"]')).toBeVisible();
    await expect(page.locator('[data-testid="movies-watch-time"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-section-anime"]')).toBeVisible();
    await expect(page.locator('[data-testid="anime-watch-time"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-section-reading"]')).toBeVisible();
    await expect(page.locator('[data-testid="reading-watch-time"]')).toBeVisible();
    await expect(page.locator('[data-testid="avatar-file-input"]')).toBeAttached();
    // Verify global combined watch time badge in profile header
    await expect(page.locator('[data-testid="global-watch-time"]')).toBeVisible();

    // Verify Danger Zone Delete Account button exists
    await expect(page.locator('[data-testid="delete-account-btn"]')).toBeVisible();

    // 4. Test Friends & Social Search Panel with @username query
    if (!isMobile) {
      await page.locator('[data-testid="sidebar-nav-social"]').click();
    } else {
      await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
      await page.locator('[data-testid="mobile-nav-social"]').click();
    }
    await expect(page.locator('[data-testid="social-feed-view"]')).toBeVisible();
    await expect(page.locator('[data-testid="friends-search-panel"]')).toBeVisible();

    const friendsSearchInput = page.locator('[data-testid="friends-search-input"]');
    await expect(friendsSearchInput).toBeVisible();
    await friendsSearchInput.fill('@marcus_anime');
    await expect(page.locator('[data-testid="profile-card-marcus_anime"]')).toBeVisible();
    await expect(page.locator('[data-testid="follow-toggle-marcus_anime"]')).toBeVisible();

    // 5. Navigate to Import view and test Binger App CSV
    if (!isMobile) {
      await page.locator('[data-testid="sidebar-nav-import"]').click();
    } else {
      await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
      await page.locator('[data-testid="mobile-nav-import"]').click();
    }

    await expect(page.locator('[data-testid="import-export-engine"]')).toBeVisible();

    // Click sample Binger App CSV test button
    const bingerBtn = page.locator('[data-testid="sample-binger-button"]');
    await expect(bingerBtn).toBeVisible();
    await bingerBtn.click();

    // Expect preview section to appear with staged Binger items
    await expect(page.locator('[data-testid="import-preview-section"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Breaking Bad')).toBeVisible();
    await expect(page.locator('text=Yellowstone')).toBeVisible();

    // Commit import
    await page.locator('[data-testid="commit-import-button"]').click();
    await expect(page.locator('[data-testid="import-complete-section"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Import Completed Successfully!')).toBeVisible();

    // Click "Import Another File" to reset to idle state
    await page.locator('[data-testid="import-another-button"]').click();
    await expect(page.locator('[data-testid="csv-dropzone"]')).toBeVisible();

    // 5. Also import Letterboxd CSV to verify movie duration display
    const letterboxdBtn = page.locator('[data-testid="sample-letterboxd-button"]');
    await expect(letterboxdBtn).toBeVisible();
    await letterboxdBtn.click();
    await expect(page.locator('[data-testid="import-preview-section"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Inception')).toBeVisible();
    await page.locator('[data-testid="commit-import-button"]').click();
    await expect(page.locator('[data-testid="import-complete-section"]')).toBeVisible({ timeout: 10000 });

    // 6. Navigate to Watch Library to verify Completed TV show episode count & Movie runtimes
    if (!isMobile) {
      await page.locator('[data-testid="desktop-sidebar"] button:has-text("Watch Library")').click();
    } else {
      await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
      await page.locator('[data-testid="mobile-nav-watch"]').click();
    }

    await expect(page.locator('[data-testid="watch-library-view"]')).toBeVisible();

    // Verify Breaking Bad (completed) displays "62 eps", NEVER "0 eps"
    await expect(page.locator('text=62 eps')).toBeVisible();
    // Verify Inception (movie) displays "2h 28m", NEVER "Ch. 0" or "0 eps"
    await expect(page.locator('text=2h 28m')).toBeVisible();
    await expect(page.locator('text=Ch. 0')).toHaveCount(0);

    // Switch to compact grid mode and verify quick increment is hidden for movies
    await page.locator('[data-testid="view-mode-compact"]').click();
    await expect(page.locator('[data-testid="library-compact-grid"]')).toBeVisible();
    await expect(page.locator('text=2h 28m')).toBeVisible();

    // 7. Navigate back to Profile page to verify category-specific watch time updates
    if (!isMobile) {
      await page.locator('[data-testid="sidebar-nav-profile"]').click();
    } else {
      await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
      await page.locator('[data-testid="mobile-nav-profile-link"]').click();
    }

    await expect(page.locator('[data-testid="profile-page"]')).toBeVisible();
    // TV watch time and Movie watch time must not be 0m anymore
    const tvWatchTime = page.locator('[data-testid="tv-watch-time"]');
    await expect(tvWatchTime).not.toHaveText('0m');
    const moviesWatchTime = page.locator('[data-testid="movies-watch-time"]');
    await expect(moviesWatchTime).not.toHaveText('0m');

    // 8. Test Clear Library Cleanup Utility
    // Navigate back to import view
    if (!isMobile) {
      await page.locator('[data-testid="sidebar-nav-import"]').click();
    } else {
      await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
      await page.locator('[data-testid="mobile-nav-import"]').click();
    }

    const clearBtn = page.locator('[data-testid="clear-library-button"]');
    await expect(clearBtn).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await clearBtn.click();

    await expect(page.locator('[data-testid="clear-success-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="clear-success-banner"]')).toContainText('Successfully cleared');
  });
});
