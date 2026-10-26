import { test, expect } from '@playwright/test';

test.describe('TrackUp Phase 5: CSV Import & Export Engine', () => {
  test('tests import workflow, stepper transitions, commit, and library CSV export download', async ({
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
      await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
      await page.locator('[data-testid="mobile-nav-profile"]').click();
    }

    await page.locator('[data-testid="auth-tab-register"]').click();
    await page.locator('[data-testid="auth-username-input"]').fill(`migrator_${timestamp}`);
    await page.locator('[data-testid="auth-email-input"]').fill(`migrator_${timestamp}@example.com`);
    await page.locator('[data-testid="auth-password-input"]').fill('SecretPass123!');
    await page.locator('[data-testid="auth-submit-button"]').click();

    await expect(page.locator('[data-testid="auth-modal"]')).toBeHidden();

    // 2. Navigate to Import View
    if (!isMobile) {
      await page.locator('[data-testid="sidebar-nav-import"]').click();
    } else {
      await page.locator('[data-testid="mobile-hamburger-trigger"]').click();
      await page.locator('[data-testid="mobile-nav-import"]').click();
    }

    await expect(page.locator('[data-testid="import-view"]')).toBeVisible();
    await expect(page.locator('[data-testid="import-export-engine"]')).toBeVisible();

    // 3. Verify Dropzone is visible
    const dropzone = page.locator('[data-testid="csv-dropzone"]');
    await expect(dropzone).toBeVisible();

    // 4. Test Sample Letterboxd CSV Parser & Stepper Transitions
    const sampleBtn = page.locator('[data-testid="sample-letterboxd-button"]');
    await expect(sampleBtn).toBeVisible();
    await sampleBtn.click();

    // Stepper transitions to preview
    await expect(page.locator('[data-testid="import-preview-section"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="import-progress-stepper"]')).toBeVisible();

    // Verify summary indicates 2 records analyzed
    await expect(page.locator('text=2 Records Analyzed & Staged')).toBeVisible();

    // 5. Commit Import
    const commitBtn = page.locator('[data-testid="commit-import-button"]');
    await expect(commitBtn).toBeVisible();
    await commitBtn.click();

    // Verify Complete State
    await expect(page.locator('[data-testid="import-complete-section"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Import Completed Successfully!')).toBeVisible();

    // 6. Test Library CSV Export Trigger
    const downloadPromise = page.waitForEvent('download');
    const exportBtn = page.locator('[data-testid="export-library-button"]');
    await expect(exportBtn).toBeVisible();
    await exportBtn.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/trackup_library_export_.*\.csv/);
  });
});
