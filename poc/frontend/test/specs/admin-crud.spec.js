import { expect, test } from '@playwright/test';

import { installApiMocks, DEFAULT_OWNER_ID_ALPHA } from '../fixtures/mock-api.js';
import { applySession, buildAdminSession } from '../fixtures/session.js';

function parsePayload(request) {
  return JSON.parse(request.postData() || '{}');
}

test.describe('Admin CRUD coverage', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
    await applySession(page, buildAdminSession());
  });

  test('properties: read list, create, update, delete behavior', async ({ page }) => {
    await page.goto('/properties.html');

    await expect(page.locator('#properties-tbody tr')).toHaveCount(1);
    await expect(page.locator('#properties-tbody tr td').first()).toContainText('Alpha Farms');

    await page.goto('/properties-form.html');
    await expect(page.locator('#ownerFieldGroup')).toBeVisible();
    await page.locator('#ownerId').selectOption(DEFAULT_OWNER_ID_ALPHA);
    await page.locator('#name').fill('Admin Created Property');
    await page.locator('#address').fill('Road 100');
    await page.locator('#city').fill('Sao Paulo');
    await page.locator('#state').fill('SP');
    await page.locator('#country').fill('Brazil');
    await page.locator('#areaHectares').fill('150');

    const createRequestPromise = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().includes('/api/properties')
    );

    await Promise.all([
      page.waitForURL(/properties\.html/),
      page.locator('#propertyForm button[type="submit"]').click()
    ]);

    const createRequest = await createRequestPromise;
    const createPayload = parsePayload(createRequest);
    expect(createPayload.ownerId).toBe(DEFAULT_OWNER_ID_ALPHA);
    expect(createPayload.name).toBe('Admin Created Property');

    await page.goto('/properties-form.html?id=property-001');
    await expect(page.locator('#name')).toHaveValue('Alpha Main Property');
    await page.locator('#name').fill('Admin Updated Property');
    await page.locator('#city').fill('Campinas');

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
    expect(updatePayload.name).toBe('Admin Updated Property');
    expect(updatePayload.city).toBe('Campinas');

    await page.goto('/properties.html');
    page.once('dialog', (dialog) => dialog.accept());
    const dialogPromise = page.waitForEvent('dialog');
    await page.locator('[data-action="delete"]').first().click();
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toContain('Property deletion will be implemented');
  });

  test('plots: create and edit read-only constraint', async ({ page }) => {
    await page.goto('/plots.html');
    await expect(page.locator('#plots-tbody tr')).toHaveCount(1);

    await page.goto('/plots-form.html');
    await expect(page.locator('#ownerFieldGroup')).toBeVisible();
    await page.locator('#ownerId').selectOption(DEFAULT_OWNER_ID_ALPHA);
    await page.locator('#propertyId').selectOption('property-001');
    await page.locator('#name').fill('Admin New Plot');
    await page.locator('#areaHectares').fill('40');
    await page.locator('#cropType').selectOption({ index: 1 });
    await page.locator('#plantingDate').fill('2026-02-01');
    await page.locator('#expectedHarvest').fill('2026-07-01');
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
    expect(createPayload.ownerId).toBe(DEFAULT_OWNER_ID_ALPHA);
    expect(createPayload.propertyId).toBe('property-001');

    await page.goto('/plots-form.html?id=plot-001');
    await expect(page.locator('#formErrors')).toContainText('read-only');
    await expect(page.locator('#plotForm button[type="submit"]')).toBeDisabled();
  });

  test('sensors: create, status update and edit read-only constraint', async ({ page }) => {
    await page.goto('/sensors.html');
    await expect(page.locator('#sensors-tbody tr')).toHaveCount(1);

    await page.goto('/sensors-form.html');
    await expect(page.locator('#ownerFieldGroup')).toBeVisible();
    await page.locator('#ownerId').selectOption(DEFAULT_OWNER_ID_ALPHA);
    await page.locator('#type').selectOption({ index: 1 });
    await page.locator('#plotId').selectOption('plot-001');
    await page.locator('#label').fill('Admin Sensor Created');

    const createRequestPromise = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().includes('/api/sensors')
    );

    await Promise.all([
      page.waitForURL(/sensors\.html/),
      page.locator('#sensorForm button[type="submit"]').click()
    ]);

    const createRequest = await createRequestPromise;
    const createPayload = parsePayload(createRequest);
    expect(createPayload.ownerId).toBe(DEFAULT_OWNER_ID_ALPHA);
    expect(createPayload.plotId).toBe('plot-001');

    await page.goto('/sensors.html');
    await page.locator('.js-change-status').first().click();
    await page.locator('#sensor-new-status').selectOption('Inactive');
    await page.locator('#sensor-status-reason').fill('Test status change');

    const statusRequestPromise = page.waitForRequest(
      (request) =>
        request.method() === 'PUT' &&
        request.url().includes('/api/sensors/') &&
        request.url().includes('/status-change')
    );

    await page.locator('#sensor-status-submit').click();
    const statusRequest = await statusRequestPromise;
    const statusPayload = parsePayload(statusRequest);
    expect(statusPayload.newStatus).toBe('Inactive');

    await page.goto('/sensors-form.html?id=sensor-001');
    await expect(page.locator('#formErrors')).toContainText('read-only');
    await expect(page.locator('#sensorForm button[type="submit"]')).toBeDisabled();
  });

  test('users: create, update and delete', async ({ page }) => {
    await page.goto('/users.html');
    await expect(page.locator('#users-tbody tr')).toHaveCount(2);

    await page.goto('/users-form.html');
    await page.locator('#name').fill('Created By Admin');
    await page.locator('#email').fill('created-admin@tcagro.com');
    await page.locator('#username').fill('createdadmin');
    await page.locator('#role').selectOption('Producer');
    await page.locator('#password').fill('Admin@123');

    const createRequestPromise = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().includes('/auth/register')
    );

    await Promise.all([
      page.waitForURL(/users\.html/),
      page.locator('#userForm button[type="submit"]').click()
    ]);

    const createRequest = await createRequestPromise;
    const createPayload = parsePayload(createRequest);
    expect(createPayload.email).toBe('created-admin@tcagro.com');
    expect(createPayload.role).toBe('Producer');

    await page.goto('/users-form.html?id=user-admin-001&email=admin%40tcagro.com');
    await expect(page.locator('#email')).toHaveValue('admin@tcagro.com');
    await page.locator('#name').fill('Admin User Updated');
    await page.locator('#username').fill('adminupdated');

    const updateRequestPromise = page.waitForRequest(
      (request) => request.method() === 'PUT' && request.url().includes('/api/user/user-admin-001')
    );

    await Promise.all([
      page.waitForURL(/users\.html/),
      page.locator('#userForm button[type="submit"]').click()
    ]);

    const updateRequest = await updateRequestPromise;
    const updatePayload = parsePayload(updateRequest);
    expect(updatePayload.name).toBe('Admin User Updated');
    expect(updatePayload.username).toBe('adminupdated');

    await page.goto('/users.html');
    page.on('dialog', (dialog) => dialog.accept());

    const deleteRequestPromise = page.waitForRequest(
      (request) =>
        request.method() === 'DELETE' && request.url().includes('/api/user/user-producer-001')
    );

    await page.locator('[data-action="delete"][data-email="producer@tcagro.com"]').first().click();
    await deleteRequestPromise;
  });
});
