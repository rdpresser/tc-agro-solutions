import { expect, test } from '@playwright/test';

import { installApiMocks } from '../fixtures/mock-api.js';
import {
  applySession,
  buildAdminSession,
  buildProducerSession,
  TEST_OWNER_IDS
} from '../fixtures/session.js';

test.describe('Alerts management flow', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  test('loads alerts page and list container', async ({ page }) => {
    await applySession(page, buildProducerSession());
    await page.goto('/alerts.html');

    await expect(page.locator('#alerts-container')).toBeVisible();
    await expect(page.locator('#search-alerts')).toBeVisible();
    await expect(page.locator('#alerts-severity-filter')).toBeVisible();
    await expect(page.locator('#alerts-status-filter')).toBeVisible();
  });

  test('search filter updates request query', async ({ page }) => {
    await applySession(page, buildProducerSession());
    await page.goto('/alerts.html');

    const requestPromise = page.waitForRequest((request) => {
      const url = decodeURIComponent(request.url());
      return url.includes('/api/alerts/pending') && /search=north/i.test(url);
    });

    await page.locator('#search-alerts').fill('north');
    await page.waitForTimeout(450);

    await requestPromise;
  });

  test('severity filter updates request query', async ({ page }) => {
    await applySession(page, buildProducerSession());
    await page.goto('/alerts.html');

    const requestPromise = page.waitForRequest(
      (request) =>
        request.url().includes('/api/alerts/pending') && request.url().includes('severity=critical')
    );

    await page.locator('#alerts-severity-filter').selectOption('critical');
    await requestPromise;
  });

  test('status filter updates request query', async ({ page }) => {
    await applySession(page, buildProducerSession());
    await page.goto('/alerts.html');

    const requestPromise = page.waitForRequest((request) => {
      const url = decodeURIComponent(request.url());
      return url.includes('/api/alerts/pending') && /status=(resolved|Resolved)/.test(url);
    });

    await page.locator('#alerts-status-filter').selectOption('resolved');
    await requestPromise;
  });

  test('resolve action triggers update request', async ({ page }) => {
    await applySession(page, buildProducerSession());
    await page.goto('/alerts.html');

    await expect(page.locator('[data-action="resolve"]').first()).toBeVisible();

    const requestPromise = page.waitForRequest(
      (request) => request.method() === 'PUT' && request.url().includes('/api/alerts/')
    );

    await page.locator('[data-action="resolve"]').first().click();
    await expect(page.locator('#resolve-alert-modal')).toHaveClass(/open/);
    await page.locator('#resolve-alert-confirm').click();
    await requestPromise;
  });

  test('admin owner selector is visible and changes scope', async ({ page }) => {
    await applySession(page, buildAdminSession());
    await page.goto('/alerts.html');

    await expect(page.locator('#alerts-owner-filter')).toBeVisible();

    const requestPromise = page.waitForRequest(
      (request) =>
        request.url().includes('/api/alerts/pending') &&
        request.url().includes(`ownerId=${TEST_OWNER_IDS.zulu}`)
    );

    await page.locator('#alerts-owner-select').selectOption(TEST_OWNER_IDS.zulu);
    await requestPromise;
  });
});
