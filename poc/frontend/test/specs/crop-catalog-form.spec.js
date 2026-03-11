import { expect, test } from '@playwright/test';

import { installApiMocks } from '../fixtures/mock-api.js';
import { applySession, buildProducerSession } from '../fixtures/session.js';

test.describe('Crop catalog form page', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page, { pendingAlertsTotal: 1 });
    await applySession(page, buildProducerSession());
  });

  test('create mode renders catalog-only fields and irrigation options', async ({ page }) => {
    await page.goto('crop-catalog-form.html');

    await expect(page.locator('#formTitle')).toHaveText('Add Crop Type');
    await expect(page.locator('#cropTypeNameField')).toBeEnabled();
    await expect(page.locator('#propertyIdField')).toHaveCount(0);
    await expect(page.locator('#suggestedImageField')).toBeVisible();
    await expect(page.locator('#descriptionField')).toBeVisible();

    const irrigationOptionsText = await page
      .locator('#irrigationTypeField option')
      .allTextContents();

    expect(irrigationOptionsText.join(' | ')).toContain('💧 Drip Irrigation');
    expect(irrigationOptionsText.join(' | ')).toContain('🔄 Center Pivot');
    expect(irrigationOptionsText.join(' | ')).toContain('🌧️ Rainfed (No Irrigation)');
  });

  test('planting window helper composes catalog month range', async ({ page }) => {
    await page.goto('crop-catalog-form.html');

    await page.locator('#plantingStartMonthField').selectOption('September');
    await page.locator('#plantingEndMonthField').selectOption('December');

    await expect(page.locator('#plantingWindowPreview')).toHaveValue('Sep to Dec');
  });

  test('create submit sends payload and redirects to listing', async ({ page }) => {
    let capturedPayload = null;

    await page.route('**/api/crop-types', async (route) => {
      if (route.request().method().toUpperCase() !== 'POST') {
        await route.fallback();
        return;
      }

      capturedPayload = route.request().postDataJSON();

      await route.fulfill({
        status: 201,
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          id: 'crop-catalog-created-001',
          cropTypeCatalogId: 'crop-catalog-created-001'
        })
      });
    });

    await page.goto('crop-catalog-form.html');

    await page.locator('#cropTypeNameField').fill('Teff');
    await page.locator('#suggestedImageField').fill('🌾');
    await page.locator('#descriptionField').fill('Tenant-scoped grain catalog entry');
    await page.locator('#plantingStartMonthField').selectOption('May');
    await page.locator('#plantingEndMonthField').selectOption('July');
    await page.locator('#harvestCycleField').fill('4');
    await page.locator('#irrigationTypeField').selectOption('Sprinkler');
    await page.locator('#minSoilMoistureField').fill('31');
    await page.locator('#maxTemperatureField').fill('34');
    await page.locator('#minHumidityField').fill('45');

    await page.locator('#saveCropTypeBtn').click();

    await expect
      .poll(() => capturedPayload?.cropType || null, {
        timeout: 5000,
        message: 'Expected crop type payload to be captured on create'
      })
      .toBe('Teff');

    expect(capturedPayload.propertyId).toBe('property-001');
    expect(capturedPayload.suggestedIrrigationType).toBe('Sprinkler');
    expect(capturedPayload.plantingWindow).toBe('May to Jul');
    expect(capturedPayload.suggestedImage).toBe('🌾');
    expect(capturedPayload.notes).toBe('Tenant-scoped grain catalog entry');

    await expect(page).toHaveURL(/crop-catalog\.html$/);
  });

  test('edit mode loads entry, keeps immutable fields disabled, and sends update payload', async ({
    page
  }) => {
    let capturedPayload = null;

    await page.route('**/api/crop-types/77777777-7777-4777-8777-777777777777', async (route) => {
      if (route.request().method().toUpperCase() !== 'PUT') {
        await route.fallback();
        return;
      }

      capturedPayload = route.request().postDataJSON();

      await route.fulfill({
        status: 200,
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          id: '77777777-7777-4777-8777-777777777777',
          cropTypeCatalogId: '77777777-7777-4777-8777-777777777777'
        })
      });
    });

    await page.goto('crop-catalog-form.html?id=77777777-7777-4777-8777-777777777777');

    await expect(page.locator('#formTitle')).toHaveText('Edit Crop Type');
    await expect(page.locator('#cropTypeNameField')).toBeDisabled();
    await expect(page.locator('#propertyIdField')).toHaveCount(0);
    await expect(page.locator('#cropTypeNameField')).toHaveValue('Sorghum');
    await expect(page.locator('#suggestedImageField')).toHaveValue('🌾');

    await page.locator('#plantingStartMonthField').selectOption('June');
    await page.locator('#plantingEndMonthField').selectOption('August');
    await page.locator('#harvestCycleField').fill('5');
    await page.locator('#irrigationTypeField').selectOption('Center Pivot');
    await page.locator('#descriptionField').fill('Updated in edit mode');
    await page.locator('#suggestedImageField').fill('🌱');

    await page.locator('#saveCropTypeBtn').click();

    await expect
      .poll(() => capturedPayload?.cropType || null, {
        timeout: 5000,
        message: 'Expected update payload to be captured in edit mode'
      })
      .toBe('Sorghum');

    expect(capturedPayload.plantingWindow).toBe('Jun to Aug');
    expect(capturedPayload.harvestCycleMonths).toBe(5);
    expect(capturedPayload.suggestedIrrigationType).toBe('Center Pivot');
    expect(capturedPayload.notes).toBe('Updated in edit mode');
    expect(capturedPayload.suggestedImage).toBe('🌱');

    await expect(page).toHaveURL(/crop-catalog\.html$/);
  });
});
