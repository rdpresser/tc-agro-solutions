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
});
