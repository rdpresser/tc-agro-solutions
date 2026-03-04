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

  test('search mode allows selecting crop and pre-fills defaults', async ({ page }) => {
    await page.goto('plots-form.html');

    await page.locator('#openCropPickerBtn').click();
    await expect(page.locator('#cropPickerModal')).toHaveClass(/open/);

    await page.locator('#cropPickerSearch').fill('mango');
    await page.locator('#cropPickerResults [data-crop-type="Mango"]').click();

    await expect(page.locator('#cropPickerModal')).not.toHaveClass(/open/);
    await expect(page.locator('#cropType')).toHaveValue('Mango');
    await expect(page.locator('#irrigationType')).toHaveValue('Drip Irrigation');
    await expect(page.locator('#minSoilMoisture')).toHaveValue('35');
    await expect(page.locator('#maxTemperature')).toHaveValue('36');
    await expect(page.locator('#minHumidity')).toHaveValue('55');
    await expect(page.locator('#plantingDate')).not.toHaveValue('');
    await expect(page.locator('#expectedHarvest')).not.toHaveValue('');
  });

  test('defaults table shows irrigation icon and allows selecting crop type', async ({ page }) => {
    await page.goto('plots-form.html');

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

    await page.locator('#openCropDefaultsTableBtn').click();
    await expect(page.locator('#cropDefaultsTablePanel')).toBeVisible();

    await page.locator('#cropDefaultsFilterInput').fill('rice');
    const riceRow = page.locator('#cropDefaultsTableBody tr[data-crop-type="Rice"]');
    await expect(riceRow).toBeVisible();

    await riceRow.focus();
    await page.keyboard.press('Enter');

    await expect(page.locator('#cropType')).toHaveValue('Rice');
    await expect(page.locator('#irrigationType')).toHaveValue('Flood/Furrow');
    await expect(page.locator('#cropPickerModal')).not.toHaveClass(/open/);
  });
});
