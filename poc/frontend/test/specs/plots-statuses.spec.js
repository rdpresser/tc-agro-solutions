import { expect, test } from '@playwright/test';

import {
  DEFAULT_OWNER_ID_ALPHA,
  DEFAULT_OWNER_ID_ZULU,
  installApiMocks
} from '../fixtures/mock-api.js';
import { applySession, buildAdminSession, buildProducerSession } from '../fixtures/session.js';

function buildPlotFixture({
  id,
  ownerId,
  ownerName,
  propertyId,
  propertyName,
  name,
  status,
  areaHectares,
  sensorsCount = 1
}) {
  return {
    id,
    ownerId,
    ownerName,
    propertyId,
    propertyName,
    name,
    areaHectares,
    cropType: 'Soybean',
    plantingDate: '2026-01-01T00:00:00Z',
    expectedHarvestDate: '2026-07-01T00:00:00Z',
    irrigationType: 'Drip',
    status,
    sensorsCount,
    createdAt: '2026-01-01T00:00:00Z'
  };
}

const MIXED_OWNER_PLOTS_FIXTURE = [
  buildPlotFixture({
    id: 'plot-alpha-healthy',
    ownerId: DEFAULT_OWNER_ID_ALPHA,
    ownerName: 'Alpha Farms',
    propertyId: 'property-alpha-001',
    propertyName: 'Alpha Main Property',
    name: 'Alpha Healthy',
    status: 'healthy',
    areaHectares: 25
  }),
  buildPlotFixture({
    id: 'plot-alpha-warning',
    ownerId: DEFAULT_OWNER_ID_ALPHA,
    ownerName: 'Alpha Farms',
    propertyId: 'property-alpha-001',
    propertyName: 'Alpha Main Property',
    name: 'Alpha Warning',
    status: 'warning',
    areaHectares: 30
  }),
  buildPlotFixture({
    id: 'plot-zulu-alert',
    ownerId: DEFAULT_OWNER_ID_ZULU,
    ownerName: 'Zulu Farms',
    propertyId: 'property-zulu-001',
    propertyName: 'Zulu Main Property',
    name: 'Zulu Alert',
    status: 'alert',
    areaHectares: 18
  }),
  buildPlotFixture({
    id: 'plot-zulu-critical-1',
    ownerId: DEFAULT_OWNER_ID_ZULU,
    ownerName: 'Zulu Farms',
    propertyId: 'property-zulu-001',
    propertyName: 'Zulu Main Property',
    name: 'Zulu Critical 1',
    status: 'critical',
    areaHectares: 21
  }),
  buildPlotFixture({
    id: 'plot-zulu-critical-2',
    ownerId: DEFAULT_OWNER_ID_ZULU,
    ownerName: 'Zulu Farms',
    propertyId: 'property-zulu-002',
    propertyName: 'Zulu Secondary Property',
    name: 'Zulu Critical 2',
    status: 'critical',
    areaHectares: 13
  })
];

test.describe('Plots global status counters by role', () => {
  test('producer uses owner-scoped global summary counters', async ({ page }) => {
    await installApiMocks(page, { plots: MIXED_OWNER_PLOTS_FIXTURE });
    await applySession(page, buildProducerSession(DEFAULT_OWNER_ID_ALPHA));

    await page.goto('plots.html');

    await expect(page.locator('#plots-tbody tr')).toHaveCount(2);
    await expect(page.locator('#plots-summary-text')).toContainText('of 2');

    await expect(page.locator('#plots-summary-healthy')).toContainText('1');
    await expect(page.locator('#plots-summary-warning')).toContainText('1');
    await expect(page.locator('#plots-summary-alert')).toContainText('0');

    await expect(page.locator('#plots-summary-healthy')).toHaveClass(/plot-status-summary-badge/);
    await expect(page.locator('#plots-summary-warning')).toHaveClass(/plot-status-summary-badge/);
    await expect(page.locator('#plots-summary-alert')).toHaveClass(/plot-status-summary-badge/);
  });

  test('admin uses global summary counters without owner filter', async ({ page }) => {
    await installApiMocks(page, { plots: MIXED_OWNER_PLOTS_FIXTURE });
    await applySession(page, buildAdminSession());

    await page.goto('plots.html');

    await expect(page.locator('#plots-tbody tr')).toHaveCount(5);
    await expect(page.locator('#plots-summary-text')).toContainText('of 5');

    await expect(page.locator('#plots-summary-healthy')).toContainText('1');
    await expect(page.locator('#plots-summary-warning')).toContainText('1');
    await expect(page.locator('#plots-summary-alert')).toContainText('3');
  });
});
