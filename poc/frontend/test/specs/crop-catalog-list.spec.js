import { expect, test } from '@playwright/test';

import { installApiMocks } from '../fixtures/mock-api.js';
import { applySession, buildProducerSession } from '../fixtures/session.js';

test.describe('Crop catalog listing page', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page, { pendingAlertsTotal: 1 });
    await applySession(page, buildProducerSession());
  });

  test('renders crop table with actions', async ({ page }) => {
    await page.goto('crop-catalog.html');

    const rows = page.locator('#catalogTableBody tr');
    await expect(rows.first()).toBeVisible();
    await expect(page.locator('#catalogTableBody')).toContainText('Sorghum');

    await expect(page.locator('button[data-action="edit"]').first()).toBeVisible();
    await expect(page.locator('button[data-action="deactivate"]').first()).toBeVisible();
  });

  test('add button redirects to dedicated form page', async ({ page }) => {
    await page.goto('crop-catalog.html');

    await page.locator('#addCropTypeBtn').click();

    await expect(page).toHaveURL(/crop-catalog-form\.html$/);
  });

  test('edit action redirects to dedicated form with id', async ({ page }) => {
    await page.goto('crop-catalog.html');

    await page.locator('button[data-action="edit"]').first().click();

    await expect(page).toHaveURL(/crop-catalog-form\.html\?id=/);
  });

  test('defaults to catalog-only view with source toggle unchecked', async ({ page }) => {
    await page.goto('crop-catalog.html');

    // Toggle is unchecked by default
    await expect(page.locator('#includeSuggestionsFilter')).not.toBeChecked();

    // Catalog-source badge present
    await expect(page.locator('[data-source="Catalog"]').first()).toBeVisible();

    // No suggestion-source badge in default view
    await expect(page.locator('[data-source="Suggestion"]')).toHaveCount(0);

    // No promote button in catalog-only view
    await expect(page.locator('button[data-action="promote"]')).toHaveCount(0);
  });

  test('shows source badge per catalog row in default view', async ({ page }) => {
    await page.goto('crop-catalog.html');

    const catalogBadges = page.locator('[data-source="Catalog"]');
    await expect(catalogBadges.first()).toBeVisible();
    await expect(catalogBadges.first()).toContainText('Catalog');
  });

  test('include suggestions toggle shows suggestion rows with source badge and promote button', async ({
    page
  }) => {
    await page.goto('crop-catalog.html');

    // Enable suggestions toggle
    await page.locator('#includeSuggestionsFilter').check();
    await page.locator('#catalogFilterForm').dispatchEvent('submit');

    // Wait for table to refresh
    await expect(page.locator('#catalogTableBody')).toContainText('Wheat');

    // Suggestion-source badge appears
    await expect(page.locator('[data-source="Suggestion"]').first()).toBeVisible();

    // Promote button appears for suggestion rows
    await expect(page.locator('button[data-action="promote"]').first()).toBeVisible();
  });

  test('promote action calls promote endpoint and reloads catalog', async ({ page }) => {
    let promoteCalled = false;

    await page.route('**/api/crop-types/suggestions/*/promote', async (route) => {
      if (route.request().method().toUpperCase() !== 'POST') {
        await route.fallback();
        return;
      }

      promoteCalled = true;

      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cropTypeCatalogId: 'promoted-catalog-wheat-001',
          cropType: 'Wheat',
          promoted: true,
          alreadyExisted: false
        })
      });
    });

    await page.goto('crop-catalog.html');

    // Enable suggestions
    await page.locator('#includeSuggestionsFilter').check();
    await page.locator('#catalogFilterForm').dispatchEvent('submit');

    await expect(page.locator('button[data-action="promote"]').first()).toBeVisible();

    // Accept confirmation dialog
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('button[data-action="promote"]').first().click();

    expect(promoteCalled).toBe(true);
  });
});
