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
    await page.goto('alerts.html');

    await expect(page.locator('#alerts-container')).toBeVisible();
    await expect(page.locator('#search-alerts')).toBeVisible();
    await expect(page.locator('#alerts-severity-filter')).toBeVisible();
    await expect(page.locator('#alerts-status-filter')).toBeVisible();
  });

  test('search filter updates request query', async ({ page }) => {
    await applySession(page, buildProducerSession());
    await page.goto('alerts.html');

    const searchInput = page.locator('#search-alerts');
    await expect(searchInput).toBeVisible();

    // Ensure a value transition happens (prevents occasional no-op when already set)
    if ((await searchInput.inputValue()).trim().toLowerCase() === 'north') {
      await searchInput.fill('');
      await page.waitForTimeout(300);
    }

    const requestPromise = page.waitForRequest((request) => {
      const url = decodeURIComponent(request.url()).toLowerCase();
      return url.includes('/api/alerts/pending') && /search=north/i.test(url);
    });

    await searchInput.fill('north');
    await page.waitForTimeout(450);
    await expect
      .poll(() => decodeURIComponent(page.url()).toLowerCase())
      .toContain('search=north');

    await requestPromise;
  });

  test('severity filter updates request query', async ({ page }) => {
    await applySession(page, buildProducerSession());
    await page.goto('alerts.html');

    const severitySelect = page.locator('#alerts-severity-filter');
    await expect(severitySelect).toBeVisible();

    // Ensure a value transition happens (prevents flaky no-op when already set to "critical")
    if ((await severitySelect.inputValue()) === 'critical') {
      await severitySelect.selectOption('');
      await page.waitForTimeout(50);
    }

    const requestPromise = page.waitForRequest((request) => {
      const url = decodeURIComponent(request.url()).toLowerCase();
      return url.includes('/api/alerts/pending') && url.includes('severity=critical');
    });

    await severitySelect.selectOption('critical');
    await requestPromise;
  });

  test('status filter updates request query', async ({ page }) => {
    await applySession(page, buildProducerSession());
    await page.goto('alerts.html');

    const requestPromise = page.waitForRequest((request) => {
      const url = decodeURIComponent(request.url());
      return url.includes('/api/alerts/pending') && /status=(resolved|Resolved)/.test(url);
    });

    await page.locator('#alerts-status-filter').selectOption('resolved');
    await requestPromise;
  });

  test('resolve action triggers update request', async ({ page }) => {
    await applySession(page, buildProducerSession());
    await page.goto('alerts.html');

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
    await page.goto('alerts.html');

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
