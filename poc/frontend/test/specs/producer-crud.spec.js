import { expect, test } from '@playwright/test';

import { installApiMocks } from '../fixtures/mock-api.js';
import { applySession, buildProducerSession } from '../fixtures/session.js';

function parsePayload(request) {
  return JSON.parse(request.postData() || '{}');
}

test.describe('Producer CRUD coverage', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page, { pendingAlertsTotal: 2 });
    await applySession(page, buildProducerSession());
  });

  test('properties: read list, create, update, delete behavior', async ({ page }) => {
    await page.goto('/properties.html');
    await expect(page.locator('#properties-tbody tr')).toHaveCount(1);

    await page.goto('/properties-form.html');
    await expect(page.locator('#ownerFieldGroup')).toBeHidden();
    await page.locator('#name').fill('Producer Created Property');
    await page.locator('#address').fill('Road 200');
    await page.locator('#city').fill('Sorocaba');
    await page.locator('#state').fill('SP');
    await page.locator('#country').fill('Brazil');
    await page.locator('#areaHectares').fill('80');

    const createRequestPromise = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().includes('/api/properties')
    );

    await Promise.all([
      page.waitForURL(/properties\.html/),
      page.locator('#propertyForm button[type="submit"]').click()
    ]);

    const createRequest = await createRequestPromise;
    const createPayload = parsePayload(createRequest);
    expect(createPayload.ownerId).toBeUndefined();
    expect(createPayload.name).toBe('Producer Created Property');

    await page.goto('/properties-form.html?id=property-001');
    await expect(page.locator('#ownerFieldGroup')).toBeHidden();
    await page.locator('#name').fill('Producer Updated Property');

    const updateRequestPromise = page.waitForRequest(
      (request) =>
        request.method() === 'PUT' && request.url().includes('/api/properties/property-001')
    );

    await Promise.all([
      page.waitForURL(/properties\.html/),
      page.locator('#propertyForm button[type="submit"]').click()
    ]);

    const updateRequest = await updateRequestPromise;
    const updatePayload = parsePayload(updateRequest);
    expect(updatePayload.ownerId).toBeUndefined();
    expect(updatePayload.name).toBe('Producer Updated Property');

    await page.goto('/properties.html');
    page.once('dialog', (dialog) => dialog.accept());
    const dialogPromise = page.waitForEvent('dialog');
    await page.locator('[data-action="delete"]').first().click();
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toContain('Property deletion will be implemented');
  });

  test('plots: create without owner field and edit read-only', async ({ page }) => {
    await page.goto('/plots-form.html');
    await expect(page.locator('#ownerFieldGroup')).toBeHidden();
    await page.locator('#propertyId').selectOption('property-001');
    await page.locator('#name').fill('Producer Plot');
    await page.locator('#areaHectares').fill('22');
    await page.locator('#cropType').selectOption({ index: 1 });
    await page.locator('#plantingDate').fill('2026-02-02');
    await page.locator('#expectedHarvest').fill('2026-08-02');
    await page.locator('#irrigationType').selectOption({ index: 1 });

    const createRequestPromise = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().includes('/api/plots')
    );

    await Promise.all([
      page.waitForURL(/plots\.html/),
      page.locator('#plotForm button[type="submit"]').click()
    ]);

    const createRequest = await createRequestPromise;
    const createPayload = parsePayload(createRequest);
    expect(createPayload.ownerId).toBeUndefined();

    await page.goto('/plots-form.html?id=plot-001');
    await expect(page.locator('#formErrors')).toContainText('read-only');
    await expect(page.locator('#plotForm button[type="submit"]')).toBeDisabled();
  });

  test('sensors: create without owner field, status update and edit read-only', async ({
    page
  }) => {
    await page.goto('/sensors-form.html');
    await expect(page.locator('#ownerFieldGroup')).toBeHidden();
    await page.locator('#type').selectOption({ index: 1 });
    await page.locator('#plotId').selectOption('plot-001');
    await page.locator('#label').fill('Producer Sensor');

    const createRequestPromise = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().includes('/api/sensors')
    );

    await Promise.all([
      page.waitForURL(/sensors\.html/),
      page.locator('#sensorForm button[type="submit"]').click()
    ]);

    const createRequest = await createRequestPromise;
    const createPayload = parsePayload(createRequest);
    expect(createPayload.ownerId).toBeUndefined();

    await page.goto('/sensors.html');
    await page.locator('.js-change-status').first().click();
    await page.locator('#sensor-new-status').selectOption('Maintenance');

    const statusRequestPromise = page.waitForRequest(
      (request) =>
        request.method() === 'PUT' &&
        request.url().includes('/api/sensors/') &&
        request.url().includes('/status-change')
    );

    await page.locator('#sensor-status-submit').click();
    const statusRequest = await statusRequestPromise;
    const statusPayload = parsePayload(statusRequest);
    expect(statusPayload.newStatus).toBe('Maintenance');

    await page.goto('/sensors-form.html?id=sensor-001');
    await expect(page.locator('#formErrors')).toContainText('read-only');
    await expect(page.locator('#sensorForm button[type="submit"]')).toBeDisabled();
  });

  test('producer cannot access admin-only users pages', async ({ page }) => {
    await page.goto('/users.html');
    await expect(page).toHaveURL(/dashboard\.html/);

    await page.goto('/users-form.html');
    await expect(page).toHaveURL(/dashboard\.html/);
  });
});
