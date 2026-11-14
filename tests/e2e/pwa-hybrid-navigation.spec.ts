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

  test('verifies mobile renders 5-destination bottom nav bar AND retains top header', async ({ page }) => {
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

    // Verify all 5 exact bottom navigation targets exist
    await expect(page.locator('[data-testid="bottom-nav-home"]')).toBeVisible();
    await expect(page.locator('[data-testid="bottom-nav-discover"]')).toBeVisible();
    await expect(page.locator('[data-testid="bottom-nav-library"]')).toBeVisible();
    await expect(page.locator('[data-testid="bottom-nav-social"]')).toBeVisible();
    await expect(page.locator('[data-testid="bottom-nav-more"]')).toBeVisible();
  });

  test('verifies bottom navigation routes and More bottom sheet on mobile', async ({ page }) => {
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

    // 5. Click Social on bottom nav (AuthGuard fallback when unauthenticated)
    await page.locator('[data-testid="bottom-nav-social"]').click();
    await expect(page.locator('[data-testid="auth-guard-fallback"]')).toBeVisible();

    // 6. Click More on bottom nav to open the smooth More Menu bottom sheet
    await page.locator('[data-testid="bottom-nav-more"]').click();
    await expect(page.locator('[data-testid="mobile-nav-drawer"]')).toBeVisible();

    // Verify secondary routes are present in the More Menu
    await expect(page.locator('[data-testid="mobile-nav-calendar"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-nav-recommendations"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-nav-history"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-nav-import"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-nav-profile-link"]')).toBeVisible();

    // Close More bottom sheet via close button
    await page.locator('[data-testid="mobile-menu-close"]').click();
    await expect(page.locator('[data-testid="mobile-nav-drawer"]')).toBeHidden();

    // 7. Verify top hamburger trigger also opens the More Menu bottom sheet
    await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
    await expect(page.locator('[data-testid="mobile-nav-drawer"]')).toBeVisible();
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
