import { expect, test } from '@playwright/test';

import { DEFAULT_OWNERS, installApiMocks } from '../fixtures/mock-api.js';
import { applySession, buildAdminSession, TEST_OWNER_IDS } from '../fixtures/session.js';

const sortedOwnerIds = [...DEFAULT_OWNERS]
  .sort((left, right) => left.name.localeCompare(right.name))
  .map((owner) => owner.id);

test.describe('Admin flows', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
    await applySession(page, buildAdminSession());
  });

  test('dashboard displays owner selector for admin', async ({ page }) => {
    await page.goto('/dashboard.html');

    await expect(page.locator('#dashboard-owner-filter')).toBeVisible();
    await expect(page.locator('#dashboard-owner-select')).toBeEnabled();
    await expect(page.locator('#dashboard-owner-select')).toHaveValue(sortedOwnerIds[0]);
  });

  test('alerts owner selector changes request scope', async ({ page }) => {
    await page.goto('/alerts.html');

    const ownerSelect = page.locator('#alerts-owner-select');
    await expect(page.locator('#alerts-owner-filter')).toBeVisible();
    await expect(ownerSelect).toBeEnabled();

    const requestPromise = page.waitForRequest(
      (request) =>
        request.url().includes('/api/alerts/pending') &&
        request.url().includes(`ownerId=${TEST_OWNER_IDS.zulu}`)
    );

    await ownerSelect.selectOption(TEST_OWNER_IDS.zulu);
    await requestPromise;
  });

  test('sensors owner selector changes request scope', async ({ page }) => {
    await page.goto('/sensors-monitoring.html');

    const ownerSelect = page.locator('#sensors-owner-select');
    await expect(page.locator('#sensors-owner-filter')).toBeVisible();
    await expect(ownerSelect).toBeEnabled();

    const requestPromise = page.waitForRequest(
      (request) =>
        request.url().includes('/api/sensors') &&
        request.url().includes(`ownerId=${TEST_OWNER_IDS.zulu}`)
    );

    await ownerSelect.selectOption(TEST_OWNER_IDS.zulu);
    await requestPromise;
  });

  test('admin can access users page', async ({ page }) => {
    await page.goto('/users.html');

    await expect(page).toHaveURL(/users\.html/);
    await expect(page.locator('#users-tbody')).toBeVisible();
  });
});
