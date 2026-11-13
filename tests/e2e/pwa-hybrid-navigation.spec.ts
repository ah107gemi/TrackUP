import { test, expect } from '@playwright/test';

test.describe('PWA & Hybrid Mobile Navigation E2E', () => {
  test('verifies desktop preserves sidebar and hides bottom nav bar', async ({ page }) => {
    const isMobile = (page.viewportSize()?.width || 1200) < 768;
    test.skip(isMobile, 'Desktop-only test');

    await page.goto('/');

    // Desktop sidebar must be visible
    await expect(page.locator('[data-testid="desktop-sidebar"]')).toBeVisible();
    // Bottom nav bar must be hidden
    await expect(page.locator('[data-testid="bottom-navigation-bar"]')).toBeHidden();
    // Mobile hamburger trigger must be hidden
    await expect(page.locator('[data-testid="mobile-hamburger-trigger"]')).toBeHidden();
  });

  test('verifies mobile renders bottom nav bar AND retains top hamburger bar', async ({ page }) => {
    const isMobile = (page.viewportSize()?.width || 1200) < 768;
    test.skip(!isMobile, 'Mobile-only test');

    await page.goto('/');

    // Desktop sidebar must be hidden
    await expect(page.locator('[data-testid="desktop-sidebar"]')).toBeHidden();
    // Bottom navigation bar must be visible
    await expect(page.locator('[data-testid="bottom-navigation-bar"]')).toBeVisible();
    // Streamlined top bar with hamburger and search must be visible
    await expect(page.locator('[data-testid="mobile-hamburger-trigger"]')).toBeVisible();
    await expect(page.locator('[data-testid="omnisearch-trigger"]')).toBeVisible();

    // Verify all 4 primary bottom navigation targets exist
    await expect(page.locator('[data-testid="bottom-nav-home"]')).toBeVisible();
    await expect(page.locator('[data-testid="bottom-nav-discover"]')).toBeVisible();
    await expect(page.locator('[data-testid="bottom-nav-library"]')).toBeVisible();
    await expect(page.locator('[data-testid="bottom-nav-profile"]')).toBeVisible();
  });

  test('verifies bottom navigation routes between views on mobile', async ({ page }) => {
    const isMobile = (page.viewportSize()?.width || 1200) < 768;
    test.skip(!isMobile, 'Mobile-only test');

    await page.goto('/');

    // 1. Initial view is dashboard
    await expect(page.locator('[data-testid="dashboard-view"]')).toBeVisible();

    // 2. Click Discover on bottom nav
    await page.locator('[data-testid="bottom-nav-discover"]').click();
    await expect(page.locator('[data-testid="discover-search-input"]')).toBeVisible();

    // 3. Click Home on bottom nav
    await page.locator('[data-testid="bottom-nav-home"]').click();
    await expect(page.locator('[data-testid="dashboard-view"]')).toBeVisible();

    // 4. Click Library on bottom nav (AuthGuard fallback when unauthenticated)
    await page.locator('[data-testid="bottom-nav-library"]').click();
    await expect(page.locator('[data-testid="auth-guard-fallback"]')).toBeVisible();

    // 5. Open hamburger drawer to verify secondary tabs are accessible
    await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
    await expect(page.locator('[data-testid="mobile-nav-drawer"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-nav-calendar"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-nav-social"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-nav-import"]')).toBeVisible();

    // Click close button to close drawer
    await page.locator('[data-testid="mobile-menu-close"]').click();
    await expect(page.locator('[data-testid="mobile-nav-drawer"]')).toBeHidden();
  });

  test('verifies manifest and theme color tags in head', async ({ page }) => {
    await page.goto('/');
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveCount(1);

    const themeColor = page.locator('meta[name="theme-color"]');
    await expect(themeColor).toHaveAttribute('content', '#FFC400');
  });
});
