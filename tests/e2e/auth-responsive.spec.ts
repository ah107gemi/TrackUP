import { test, expect } from '@playwright/test';

test.describe('TrackUp Phase 1: Responsive Layout & App Shell', () => {
  test('verifies responsive navigation visibility based on viewport', async ({ page }) => {
    await page.goto('/');

    const isMobile = page.viewportSize() ? page.viewportSize()!.width <= 768 : false;

    if (isMobile) {
      // Mobile: desktop sidebar is hidden, mobile hamburger trigger is visible
      await expect(page.locator('[data-testid="desktop-sidebar"]')).toBeHidden();
      await expect(page.locator('[data-testid="mobile-hamburger-trigger"]')).toBeVisible();
    } else {
      // Desktop: desktop sidebar is visible, mobile hamburger trigger is hidden
      await expect(page.locator('[data-testid="desktop-sidebar"]')).toBeVisible();
      await expect(page.locator('[data-testid="mobile-hamburger-trigger"]')).toBeHidden();
    }
  });

  test('verifies Omnisearch modal opens via trigger and dismisses via Escape', async ({ page }) => {
    await page.goto('/');

    const trigger = page.locator('[data-testid="omnisearch-trigger"]');
    await expect(trigger).toBeVisible();
    await trigger.click();

    // Verify modal appears
    const modal = page.locator('[data-testid="omnisearch-modal"]');
    await expect(modal).toBeVisible();

    const input = page.locator('[data-testid="omnisearch-input"]');
    await expect(input).toBeVisible();

    // Type query
    await input.fill('Attack on Titan');
    await expect(page.locator('[data-testid^="omnisearch-result-"]').first()).toBeVisible();

    // Press Escape to dismiss
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });

  test('verifies AuthGuard protects library views and prompts login', async ({ page }) => {
    await page.goto('/');

    const isMobile = page.viewportSize() ? page.viewportSize()!.width <= 768 : false;

    if (isMobile) {
      await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
      await page.locator('[data-testid="mobile-nav-watch"]').click();
    } else {
      await page.locator('[data-testid="desktop-sidebar"] button:has-text("Watch Library")').click();
    }

    // Verify AuthGuard fallback
    const fallback = page.locator('[data-testid="auth-guard-fallback"]');
    await expect(fallback).toBeVisible();
    await expect(fallback).toContainText('Sign In to Access Your Watch Library');

    // Click sign in button in fallback
    await page.locator('[data-testid="auth-guard-signin-button"]').click();
    await expect(page.locator('[data-testid="auth-modal"]')).toBeVisible();
  });

  test('verifies full User Registration, Profile Edit, and Sign Out cycle', async ({ page }) => {
    await page.goto('/');

    // Clear any previous mock session
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Open Auth Modal
    const authTrigger = page.locator('[data-testid="auth-modal-trigger"]');
    if (await authTrigger.isVisible()) {
      await authTrigger.click();
    } else {
      await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
      await page.locator('[data-testid="mobile-nav-profile"]').click();
    }

    await expect(page.locator('[data-testid="auth-modal"]')).toBeVisible();

    // Switch to Register tab
    await page.locator('[data-testid="auth-tab-register"]').click();

    // Fill registration form
    const timestamp = Date.now();
    const testUsername = `user_${timestamp}`;
    const testEmail = `user_${timestamp}@example.com`;

    await page.locator('[data-testid="auth-username-input"]').fill(testUsername);
    await page.locator('[data-testid="auth-displayname-input"]').fill('Master Tracker');
    await page.locator('[data-testid="auth-email-input"]').fill(testEmail);
    await page.locator('[data-testid="auth-password-input"]').fill('SecretPassword123!');

    // Submit
    await page.locator('[data-testid="auth-submit-button"]').click();

    // Modal should close upon successful registration
    await expect(page.locator('[data-testid="auth-modal"]')).toBeHidden();

    // Verify user is now authenticated
    const profileBtn = page.locator('[data-testid="profile-button"]');
    const isMobile = page.viewportSize() ? page.viewportSize()!.width <= 768 : false;

    if (!isMobile) {
      await expect(profileBtn).toBeVisible();
      await profileBtn.click();
    } else {
      await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
      await page.locator('[data-testid="mobile-nav-profile"]').click();
    }

    // Profile modal opens
    await expect(page.locator('[data-testid="profile-modal"]')).toBeVisible();

    // Update profile display name & visibility
    await page.locator('[data-testid="profile-displayname-input"]').fill('Master Tracker Prime');
    await page.locator('[data-testid="visibility-option-private"]').click();
    await page.locator('[data-testid="profile-save-button"]').click();

    await expect(page.locator('text=Saved!')).toBeVisible();

    // Close profile modal
    await page.locator('[data-testid="profile-close-button"]').click();
    await expect(page.locator('[data-testid="profile-modal"]')).toBeHidden();

    // Sign out
    if (!isMobile) {
      await page.locator('[data-testid="signout-button"]').click();
      await expect(page.locator('[data-testid="auth-modal-trigger"]')).toBeVisible();
    } else {
      await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
      await page.locator('[data-testid="mobile-drawer-signout"]').click();
      await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
      await expect(page.locator('[data-testid="mobile-nav-profile"]')).toContainText('Sign In');
    }
  });
});
