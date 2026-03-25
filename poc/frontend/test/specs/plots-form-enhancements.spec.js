import { expect, test } from '@playwright/test';

import { installApiMocks } from '../fixtures/mock-api.js';
import { applySession, buildProducerSession } from '../fixtures/session.js';

async function installGeocodingMocks(page) {
  await page.route('https://photon.komoot.io/**', async (route) => {
    const requestUrl = new URL(route.request().url());

    if (requestUrl.pathname.includes('/reverse')) {
      const latitude = Number(requestUrl.searchParams.get('lat') || -21.1775);
      const longitude = Number(requestUrl.searchParams.get('lon') || -47.8103);

      await route.fulfill({
        status: 200,
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          features: [
            {
              geometry: {
                coordinates: [longitude, latitude]
              },
              properties: {
                name: 'Mocked Plot Location',
                city: 'Ribeirao Preto',
                state: 'SP',
                country: 'Brazil'
              }
            }
          ]
        })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        features: []
      })
    });
  });

  await page.route('https://geocode.maps.co/**', async (route) => {
    const requestUrl = new URL(route.request().url());

    if (requestUrl.pathname.includes('/reverse')) {
      const latitude = Number(requestUrl.searchParams.get('lat') || -21.1775);
      const longitude = Number(requestUrl.searchParams.get('lon') || -47.8103);

      await route.fulfill({
        status: 200,
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          lat: latitude,
          lon: longitude,
          display_name: 'Mocked Plot Location, Ribeirao Preto, SP, Brazil',
          address: {
            city: 'Ribeirao Preto',
            state: 'SP',
            country: 'Brazil'
          }
        })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify([])
    });
  });
}

test.describe('Plots form enhancements', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page, { pendingAlertsTotal: 2 });
    await installGeocodingMocks(page);
    await applySession(page, buildProducerSession());
  });

  test('map click fills latitude and longitude fields', async ({ page }) => {
    await page.goto('plots-form.html');
    const map = page.locator('#plotBoundaryMap');
    await map.scrollIntoViewIfNeeded();
    await expect(map).toBeVisible();

    await map.click({ position: { x: 220, y: 170 } });

    await expect(page.locator('#latitude')).not.toHaveValue('');
    await expect(page.locator('#longitude')).not.toHaveValue('');

    const latitudeValue = Number(await page.locator('#latitude').inputValue());
    const longitudeValue = Number(await page.locator('#longitude').inputValue());

    expect(Number.isFinite(latitudeValue)).toBeTruthy();
    expect(Number.isFinite(longitudeValue)).toBeTruthy();
  });

  test('existing boundary computes area in hectares and centroid coordinates', async ({ page }) => {
    await page.goto('plots-form.html?id=plot-001');

    await expect(page.locator('#boundaryGeoJson')).not.toHaveValue('');
    await expect(page.locator('#calculatedAreaDisplay')).toHaveValue(/ha$/);
    await expect(page.locator('#latitude')).not.toHaveValue('');
    await expect(page.locator('#longitude')).not.toHaveValue('');
    await expect(page.locator('#useCurrentPointBtn')).toBeDisabled();

    const boundaryGeoJson = await page.locator('#boundaryGeoJson').inputValue();
    expect(boundaryGeoJson).toContain('Polygon');

    const areaValue = Number(await page.locator('#areaHectares').inputValue());
    expect(Number.isFinite(areaValue)).toBeTruthy();
    expect(areaValue).toBeGreaterThan(0);
    expect(areaValue).toBeLessThan(10);
  });

  test('edit mode shows associated sensors list with edit action', async ({ page }) => {
    await page.goto('plots-form.html?id=plot-001');

    await expect(page.locator('#sensorsSection')).toBeVisible();
    await expect(page.locator('#sensorsList')).toContainText('Soil Sensor 001');
    await expect(page.locator('#sensorsList')).toContainText('Edit Sensor');

    const editSensorLink = page.locator('#sensorsList a', { hasText: 'Edit Sensor' }).first();
    await expect(editSensorLink).toBeVisible();
    await expect(editSensorLink).toHaveAttribute('href', /sensors-form\.html\?id=sensor-001/);
  });

  test('search mode uses backend property crops and pre-fills suggestion metadata', async ({
    page
  }) => {
    await page.goto('plots-form.html');

    await page.locator('#propertyId').selectOption('property-001');

    await page.locator('#openCropPickerBtn').click();
    await expect(page.locator('#cropPickerModal')).toHaveClass(/open/);

    await page.locator('#cropPickerSearch').fill('sorghum');
    await expect(page.locator('#cropPickerResults [data-crop-type="Sorghum"]')).toContainText(
      'AI Suggestion'
    );
    await page.locator('#cropPickerResults [data-crop-type="Sorghum"]').click();

    await expect(page.locator('#cropPickerModal')).not.toHaveClass(/open/);
    await expect(page.locator('#cropType')).toHaveValue('Sorghum');
    await expect(page.locator('#irrigationType')).toHaveValue('Sprinkler');
    await expect(page.locator('#minSoilMoisture')).toHaveValue('26');
    await expect(page.locator('#maxTemperature')).toHaveValue('37');
    await expect(page.locator('#minHumidity')).toHaveValue('38');

    await page.locator('#openCropPickerBtn').click();
    await page.locator('#cropPickerSearch').fill('mango');
    await expect(page.locator('#cropPickerResults [data-crop-type="Mango"]')).toHaveCount(0);
  });

  test('property crop suggestions extend picker catalog and apply property defaults', async ({
    page
  }) => {
    await page.goto('plots-form.html');

    await page.locator('#propertyId').selectOption('property-001');

    await page.locator('#openCropPickerBtn').click();
    await expect(page.locator('#cropPickerModal')).toHaveClass(/open/);

    await page.locator('#cropPickerSearch').fill('sorghum');
    await expect(page.locator('#cropPickerResults [data-crop-type="Sorghum"]')).toContainText(
      'AI Suggestion'
    );
    await expect(page.locator('#cropPickerResults [data-crop-type="Sorghum"]')).toBeVisible();
    await page.locator('#cropPickerResults [data-crop-type="Sorghum"]').click();

    await expect(page.locator('#cropType')).toHaveValue('Sorghum');
    await expect(page.locator('#cropTypePlantingHint')).toContainText('AI Suggestion');
    await expect(page.locator('#irrigationType')).toHaveValue('Sprinkler');
    await expect(page.locator('#minSoilMoisture')).toHaveValue('26');
    await expect(page.locator('#maxTemperature')).toHaveValue('37');
    await expect(page.locator('#minHumidity')).toHaveValue('38');
    await expect(page.locator('#expectedHarvest')).not.toHaveValue('');
  });

  test('create payload sends catalog and suggestion ids for property-specific crop', async ({
    page
  }) => {
    let capturedPayload = null;

    await page.route('**/api/plots/submit', async (route) => {
      if (route.request().method().toUpperCase() !== 'POST') {
        await route.fallback();
        return;
      }

      capturedPayload = route.request().postDataJSON();

      await route.fulfill({
        status: 202,
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          id: 'plot-created-001'
        })
      });
    });

    await page.goto('plots-form.html');

    await page.locator('#propertyId').selectOption('property-001');
    await page.locator('#name').fill('South Field');
    await page.locator('#areaHectares').fill('12');

    await page.locator('#openCropPickerBtn').click();
    await page.locator('#cropPickerSearch').fill('sorghum');
    await page.locator('#cropPickerResults [data-crop-type="Sorghum"]').click();

    await page.locator('#plantingDate').fill('2026-03-01');
    await page.locator('#expectedHarvest').fill('2026-07-01');

    await page.locator('#plotForm button[type="submit"]').click();

    await expect
      .poll(() => capturedPayload?.cropType || null, {
        message: 'Expected plot create request payload to be captured'
      })
      .toBe('Sorghum');

    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload.cropType).toBe('Sorghum');
    expect(capturedPayload.cropTypeCatalogId).toBe('77777777-7777-4777-8777-777777777777');
    expect(capturedPayload.selectedCropTypeSuggestionId).toBe('crop-suggestion-001');
  });

  test('shows empty catalog CTA and still allows selecting suggestions from picker', async ({ page }) => {
    await page.route('**/api/crop-types/options**', async (route) => {
      const requestUrl = new URL(route.request().url());
      const includeSuggestionOverlay =
        String(requestUrl.searchParams.get('includeSuggestionOverlay') || 'false').toLowerCase() ===
        'true';

      if (!includeSuggestionOverlay) {
        await route.fulfill({
          status: 200,
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify([])
        });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify([
          {
            catalogId: '77777777-7777-4777-8777-777777777777',
            suggestionId: 'crop-suggestion-001',
            cropType: 'Sorghum',
            source: 'ai',
            plantingWindow: 'Late spring to early summer',
            harvestCycleMonths: 4,
            recommendedIrrigationType: 'Sprinkler',
            minSoilMoisture: 26,
            maxTemperature: 37,
            minHumidity: 38
          }
        ])
      });
    });

    await page.goto('plots-form.html');

    await page.locator('#propertyId').selectOption('property-001');

    await expect(page.locator('#cropTypeEmptyCatalogHint')).toBeVisible();
    await expect(page.locator('#openCropPickerFromEmptyCatalogBtn')).toBeVisible();

    await page.locator('#openCropPickerFromEmptyCatalogBtn').click();
    await expect(page.locator('#cropPickerModal')).toHaveClass(/open/);

    await page.locator('#cropPickerSearch').fill('sorghum');
    await expect(page.locator('#cropPickerResults [data-crop-type="Sorghum"]')).toContainText(
      'AI Suggestion'
    );
    await page.locator('#cropPickerResults [data-crop-type="Sorghum"]').click();

    await expect(page.locator('#cropType')).toHaveValue('Sorghum');
  });

  test('defaults table shows irrigation icon and allows selecting crop type', async ({ page }) => {
    await page.goto('plots-form.html');

    await page.locator('#propertyId').selectOption('property-001');

    await page.locator('#openCropDefaultsTableBtn').click();
    await expect(page.locator('#cropPickerModal')).toHaveClass(/open/);
    await expect(page.locator('#cropDefaultsTablePanel')).toBeVisible();

    await page.locator('#cropDefaultsFilterInput').fill('coffee');

    const coffeeRow = page.locator('#cropDefaultsTableBody tr[data-crop-type="Coffee"]');
    await expect(coffeeRow).toBeVisible();
    await expect(coffeeRow.locator('td').nth(3)).toContainText('💧');
    await expect(coffeeRow.locator('td').nth(3)).toContainText('Drip Irrigation');
    await expect(coffeeRow.locator('td').nth(4)).toContainText('🌱');
    await expect(coffeeRow.locator('td').nth(4)).toContainText('40%');
    await expect(coffeeRow.locator('td').nth(5)).toContainText('🌡️');
    await expect(coffeeRow.locator('td').nth(5)).toContainText('30°C');
    await expect(coffeeRow.locator('td').nth(6)).toContainText('💧');
    await expect(coffeeRow.locator('td').nth(6)).toContainText('60%');

    await coffeeRow.click();

    await expect(page.locator('#cropPickerModal')).not.toHaveClass(/open/);
    await expect(page.locator('#cropType')).toHaveValue('Coffee');
    await expect(page.locator('#irrigationType')).toHaveValue('Drip Irrigation');
    await expect(page.locator('#minSoilMoisture')).toHaveValue('40');
    await expect(page.locator('#maxTemperature')).toHaveValue('30');
    await expect(page.locator('#minHumidity')).toHaveValue('60');
  });

  test('defaults table supports keyboard selection', async ({ page }) => {
    await page.goto('plots-form.html');

    await page.locator('#propertyId').selectOption('property-001');

    await page.locator('#openCropDefaultsTableBtn').click();
    await expect(page.locator('#cropDefaultsTablePanel')).toBeVisible();

    await page.locator('#cropDefaultsFilterInput').fill('sorghum');
    const sorghumRow = page.locator('#cropDefaultsTableBody tr[data-crop-type="Sorghum"]');
    await expect(sorghumRow).toBeVisible();

    await sorghumRow.focus();
    await page.keyboard.press('Enter');

    await expect(page.locator('#cropType')).toHaveValue('Sorghum');
    await expect(page.locator('#irrigationType')).toHaveValue('Sprinkler');
    await expect(page.locator('#cropPickerModal')).not.toHaveClass(/open/);
  });
});
