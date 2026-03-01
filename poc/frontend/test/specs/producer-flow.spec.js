import { expect, test } from '@playwright/test';

import { installApiMocks } from '../fixtures/mock-api.js';
import { applySession, buildProducerSession } from '../fixtures/session.js';

test.describe('Producer flows', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page, { pendingAlertsTotal: 2 });
    await applySession(page, buildProducerSession());
  });

  test('dashboard hides owner selector and shows producer alert bell', async ({ page }) => {
    await page.goto('/dashboard.html');

    await expect(page.locator('#dashboard-owner-filter')).toBeHidden();
    await expect(page.locator('[data-role="topbar-alert-bell"]')).toBeVisible();
  });

  test('alerts page hides owner selector for producer', async ({ page }) => {
    await page.goto('/alerts.html');

    await expect(page.locator('#alerts-owner-filter')).toBeHidden();
  });

  test('sensors page hides owner selector for producer', async ({ page }) => {
    await page.goto('/sensors-monitoring.html');

    await expect(page.locator('#sensors-owner-filter')).toBeHidden();
  });

  test('producer is redirected from users page to dashboard', async ({ page }) => {
    await page.goto('/users.html');

    await expect(page).toHaveURL(/dashboard\.html/);
  });
});
