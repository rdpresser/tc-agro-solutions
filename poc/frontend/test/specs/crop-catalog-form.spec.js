import { expect, test } from '@playwright/test';

import { installApiMocks } from '../fixtures/mock-api.js';
import { applySession, buildProducerSession } from '../fixtures/session.js';

test.describe('Crop catalog form page', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page, { pendingAlertsTotal: 1 });
    await applySession(page, buildProducerSession());
  });

  test('create mode renders irrigation options from shared list', async ({ page }) => {
    await page.goto('crop-catalog-form.html');

    await expect(page.locator('#formTitle')).toHaveText('Add Crop Type');
    await expect(page.locator('#cropTypeNameField')).toBeEnabled();
    await expect(page.locator('#propertyIdField')).toBeEnabled();

    const irrigationOptionsText = await page
      .locator('#irrigationTypeField option')
      .allTextContents();

    expect(irrigationOptionsText.join(' | ')).toContain('💧 Drip Irrigation');
    expect(irrigationOptionsText.join(' | ')).toContain('🔄 Center Pivot');
    expect(irrigationOptionsText.join(' | ')).toContain('🌧️ Rainfed (No Irrigation)');
  });

  test('planting window helper composes month/week range', async ({ page }) => {
    await page.goto('crop-catalog-form.html');

    await page.locator('#plantingStartMonthField').selectOption('September');
    await page.locator('#plantingStartWeekField').selectOption('2');
    await page.locator('#plantingEndMonthField').selectOption('December');
    await page.locator('#plantingEndWeekField').selectOption('1');

    await expect(page.locator('#plantingWindowPreview')).toHaveValue(
      'September (Week 2) - December (Week 1)'
    );

    await page.locator('#applyPlantingWindowPresetBtn').click();

    await expect(page.locator('#plantingWindowField')).toHaveValue(
      'September (Week 2) - December (Week 1)'
    );
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
    await page.locator('#propertyIdField').selectOption('property-001');
    await page.locator('#plantingWindowField').fill('May - July');
    await page.locator('#harvestCycleField').fill('4');
    await page.locator('#irrigationTypeField').selectOption('Sprinkler');
    await page.locator('#minSoilMoistureField').fill('31');
    await page.locator('#maxTemperatureField').fill('34');
    await page.locator('#minHumidityField').fill('45');
    await page.locator('#notesField').fill('Test create flow');

    await page.locator('#saveCropTypeBtn').click();

    await expect
      .poll(() => capturedPayload?.cropType || null, {
        timeout: 5000,
        message: 'Expected crop type payload to be captured on create'
      })
      .toBe('Teff');

    expect(capturedPayload.propertyId).toBe('property-001');
    expect(capturedPayload.recommendedIrrigationType).toBe('Sprinkler');

    await expect(page).toHaveURL(/crop-catalog\.html$/);
  });

  test('edit mode loads entry, keeps immutable fields disabled, and sends update payload', async ({
    page
  }) => {
    let capturedPayload = null;

    await page.route('**/api/crop-types/crop-suggestion-001', async (route) => {
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
          id: 'crop-suggestion-001',
          cropTypeCatalogId: '77777777-7777-4777-8777-777777777777'
        })
      });
    });

    await page.goto('crop-catalog-form.html?id=crop-suggestion-001');

    await expect(page.locator('#formTitle')).toHaveText('Edit Crop Type');
    await expect(page.locator('#cropTypeNameField')).toBeDisabled();
    await expect(page.locator('#propertyIdField')).toBeDisabled();
    await expect(page.locator('#cropTypeNameField')).toHaveValue('Sorghum');

    await page.locator('#plantingWindowField').fill('June - August');
    await page.locator('#harvestCycleField').fill('5');
    await page.locator('#irrigationTypeField').selectOption('Center Pivot');
    await page.locator('#notesField').fill('Updated in edit mode');

    await page.locator('#saveCropTypeBtn').click();

    await expect
      .poll(() => capturedPayload?.plantingWindow || null, {
        timeout: 5000,
        message: 'Expected update payload to be captured in edit mode'
      })
      .toBe('June - August');

    expect(capturedPayload.harvestCycleMonths).toBe(5);
    expect(capturedPayload.recommendedIrrigationType).toBe('Center Pivot');
    expect(capturedPayload.notes).toBe('Updated in edit mode');

    await expect(page).toHaveURL(/crop-catalog\.html$/);
  });
});
