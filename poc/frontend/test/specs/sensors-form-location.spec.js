import { expect, test } from '@playwright/test';

import { installApiMocks } from '../fixtures/mock-api.js';
import { applySession, buildProducerSession } from '../fixtures/session.js';

test.describe('Sensors form location with property fallback', () => {
  test.beforeEach(async ({ page }) => {
    const now = new Date().toISOString();

    await installApiMocks(page, {
      pendingAlertsTotal: 2,
      properties: [
        {
          id: 'property-001',
          ownerId: '00000000-0000-0000-0000-000000000001',
          ownerName: 'Alpha Farms',
          name: 'Alpha Main Property',
          address: 'Road 10',
          city: 'Ribeirao Preto',
          state: 'SP',
          country: 'Brazil',
          areaHectares: 100,
          plotCount: 1,
          isActive: true,
          createdAt: now,
          latitude: -22.9035,
          longitude: -43.2096
        }
      ],
      plots: [
        {
          id: 'plot-001',
          ownerId: '00000000-0000-0000-0000-000000000001',
          ownerName: 'Alpha Farms',
          propertyId: 'property-001',
          propertyName: 'Alpha Main Property',
          name: 'North Field',
          areaHectares: 25,
          latitude: null,
          longitude: null,
          boundaryGeoJson: null,
          cropType: 'Soybean',
          plantingDate: now,
          expectedHarvestDate: now,
          irrigationType: 'Drip',
          status: 'healthy',
          sensorsCount: 1,
          additionalNotes: '',
          createdAt: now
        }
      ]
    });

    await applySession(page, buildProducerSession());
  });

  test('fills coordinates from property when plot coordinates are null', async ({ page }) => {
    await page.goto('sensors-form.html');

    await expect(page.locator('#plotLatitude')).toHaveAttribute('readonly', '');
    await expect(page.locator('#plotLongitude')).toHaveAttribute('readonly', '');

    await page.locator('#plotId').selectOption('plot-001');

    await expect(page.locator('#plotLatitude')).toHaveValue('-22.903500');
    await expect(page.locator('#plotLongitude')).toHaveValue('-43.209600');
    await expect(page.locator('#plotLocationMessage')).toContainText(
      'Coordinates source: property'
    );
    await expect(page.locator('#plotLocationMessage')).not.toHaveClass(/text-warning/);
  });

  test('fills coordinates in edit mode by loading plot/property coordinates from plot details', async ({
    page
  }) => {
    await page.goto('sensors-form.html?id=sensor-001');

    await expect(page.locator('#plotLatitude')).toHaveValue('-22.903500');
    await expect(page.locator('#plotLongitude')).toHaveValue('-43.209600');
    await expect(page.locator('#plotLocationMessage')).toContainText(
      'Coordinates source: property'
    );
    await expect(page.locator('#plotLocationMessage')).not.toHaveClass(/text-warning/);
  });
});

test.describe('Sensors form location with missing coordinates', () => {
  test.beforeEach(async ({ page }) => {
    const now = new Date().toISOString();

    await installApiMocks(page, {
      pendingAlertsTotal: 2,
      properties: [
        {
          id: 'property-001',
          ownerId: '00000000-0000-0000-0000-000000000001',
          ownerName: 'Alpha Farms',
          name: 'Alpha Main Property',
          address: 'Road 10',
          city: 'Ribeirao Preto',
          state: 'SP',
          country: 'Brazil',
          areaHectares: 100,
          plotCount: 1,
          isActive: true,
          createdAt: now,
          latitude: null,
          longitude: null
        }
      ],
      plots: [
        {
          id: 'plot-001',
          ownerId: '00000000-0000-0000-0000-000000000001',
          ownerName: 'Alpha Farms',
          propertyId: 'property-001',
          propertyName: 'Alpha Main Property',
          name: 'North Field',
          areaHectares: 25,
          latitude: null,
          longitude: null,
          boundaryGeoJson: null,
          cropType: 'Soybean',
          plantingDate: now,
          expectedHarvestDate: now,
          irrigationType: 'Drip',
          status: 'healthy',
          sensorsCount: 1,
          additionalNotes: '',
          createdAt: now
        }
      ]
    });

    await applySession(page, buildProducerSession());
  });

  test('shows zeros and warning when neither plot nor property has coordinates', async ({
    page
  }) => {
    await page.goto('sensors-form.html');

    await page.locator('#plotId').selectOption('plot-001');

    await expect(page.locator('#plotLatitude')).toHaveValue('0.000000');
    await expect(page.locator('#plotLongitude')).toHaveValue('0.000000');
    await expect(page.locator('#plotLocationMessage')).toContainText(
      'Coordinates source: fallback 0.000000'
    );
    await expect(page.locator('#plotLocationMessage')).toHaveClass(/text-warning/);
  });
});
