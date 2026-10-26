import { test, expect } from '@playwright/test';

test.describe('TrackUp Smoke & Brand Tests', () => {
  test('renders application shell and brand assets cleanly at /', async ({ page }) => {
    await page.goto('/');

    // Check document title
    await expect(page).toHaveTitle(/TrackUp/i);

    // Verify visible brand wordmark
    await expect(page.locator('text=TrackUp').filter({ visible: true }).first()).toBeVisible();

    // Verify brand tagline on desktop viewports
    const isMobile = page.viewportSize() ? page.viewportSize()!.width <= 768 : false;
    if (!isMobile) {
      const tagline = page.locator('text=Track what you love.').filter({ visible: true }).first();
      await expect(tagline).toBeVisible();
    }

    // Verify logo image is loaded and displayed
    const logo = page.locator('img[alt="TrackUp Logo"]').filter({ visible: true }).first();
    await expect(logo).toBeVisible();

    // Verify Continue Watching section header
    const continueSection = page.locator('text=Continue Watching / Currently Reading').first();
    await expect(continueSection).toBeVisible();
  });
});
