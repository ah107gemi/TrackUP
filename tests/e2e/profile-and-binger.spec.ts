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

    // Verify TV Time-style sections exist
    await expect(page.locator('[data-testid="profile-section-tv"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-section-movies"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-section-anime"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-section-reading"]')).toBeVisible();
    await expect(page.locator('[data-testid="avatar-file-input"]')).toBeAttached();

    // 4. Navigate to Import view and test Binger App CSV
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
  });
});
