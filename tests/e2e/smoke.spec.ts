import { test, expect } from '@playwright/test';

test.describe('TrackUp Phase 0 Smoke Tests', () => {
  test('renders application shell and brand assets cleanly at /', async ({ page }) => {
    await page.goto('/');

    // Check title
    await expect(page).toHaveTitle(/TrackUp/i);

    // Verify brand heading & tagline
    const heading = page.locator('h1');
    await expect(heading).toContainText('TrackUp');

    const tagline = page.locator('text=Track what you love.');
    await expect(tagline).toBeVisible();

    // Verify logo image is loaded and displayed
    const logo = page.locator('img[alt="TrackUp Logo"]');
    await expect(logo).toBeVisible();

    // Verify status badge
    const badge = page.locator('text=Phase 0 Foundation Ready');
    await expect(badge).toBeVisible();
  });
});
