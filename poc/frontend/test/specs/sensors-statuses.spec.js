import { expect, test } from '@playwright/test';

import {
  DEFAULT_OWNER_ID_ALPHA,
  DEFAULT_OWNER_ID_ZULU,
  installApiMocks
} from '../fixtures/mock-api.js';
import { applySession, buildAdminSession, buildProducerSession } from '../fixtures/session.js';

function buildSensorFixture(status, suffix, type = 'SoilMoisture') {
  const index = Number(suffix) || 1;

  return {
    id: `sensor-${suffix}`,
    ownerId: DEFAULT_OWNER_ID_ALPHA,
    ownerName: 'Alpha Farms',
    plotId: 'plot-001',
    plotName: 'North Field',
    propertyId: 'property-001',
    propertyName: 'Alpha Main Property',
    type,
    label: `Sensor ${suffix}`,
    status,
    installedAt: new Date(Date.now() - index * 60_000).toISOString(),
    createdAt: new Date(Date.now() - index * 60_000).toISOString()
  };
}

const SENSOR_STATUSES_FIXTURE = [
  buildSensorFixture('Active', '001', 'SoilMoisture'),
  buildSensorFixture('Inactive', '002', 'Temperature'),
  buildSensorFixture('Maintenance', '003', 'Humidity'),
  buildSensorFixture('Faulty', '004', 'RainGauge')
];

const MIXED_OWNER_SENSORS_FIXTURE = [
  buildSensorFixture('Active', '101', 'SoilMoisture'),
  buildSensorFixture('Inactive', '102', 'Temperature'),
  {
    ...buildSensorFixture('Maintenance', '201', 'Humidity'),
    ownerId: DEFAULT_OWNER_ID_ZULU,
    ownerName: 'Zulu Farms',
    plotId: 'plot-201',
    plotName: 'Zulu Field',
    propertyId: 'property-201',
    propertyName: 'Zulu Main Property'
  },
  {
    ...buildSensorFixture('Faulty', '202', 'RainGauge'),
    ownerId: DEFAULT_OWNER_ID_ZULU,
    ownerName: 'Zulu Farms',
    plotId: 'plot-202',
    plotName: 'Zulu Field',
    propertyId: 'property-202',
    propertyName: 'Zulu Main Property'
  },
  {
    ...buildSensorFixture('Faulty', '203', 'RainGauge'),
    ownerId: DEFAULT_OWNER_ID_ZULU,
    ownerName: 'Zulu Farms',
    plotId: 'plot-203',
    plotName: 'Zulu Field',
    propertyId: 'property-203',
    propertyName: 'Zulu Main Property'
  }
];

test.describe('Sensors status colors and counters', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page, {
      sensors: SENSOR_STATUSES_FIXTURE
    });

    await applySession(page, buildProducerSession(DEFAULT_OWNER_ID_ALPHA));
  });

  test('sensors list summary shows all four status counters', async ({ page }) => {
    await page.goto('sensors.html');

    await expect(page.locator('#sensors-tbody tr')).toHaveCount(4);

    await expect(page.locator('#sensors-summary-active')).toContainText('1');
    await expect(page.locator('#sensors-summary-active')).toContainText('Active');
    await expect(page.locator('#sensors-summary-active')).toHaveClass(/badge-status-active/);

    await expect(page.locator('#sensors-summary-inactive')).toContainText('1');
    await expect(page.locator('#sensors-summary-inactive')).toContainText('Inactive');
    await expect(page.locator('#sensors-summary-inactive')).toHaveClass(/badge-status-inactive/);

    await expect(page.locator('#sensors-summary-maintenance')).toContainText('1');
    await expect(page.locator('#sensors-summary-maintenance')).toContainText('Maintenance');
    await expect(page.locator('#sensors-summary-maintenance')).toHaveClass(
      /badge-status-maintenance/
    );

    await expect(page.locator('#sensors-summary-faulty')).toContainText('1');
    await expect(page.locator('#sensors-summary-faulty')).toContainText('Faulty');
    await expect(page.locator('#sensors-summary-faulty')).toHaveClass(/badge-status-faulty/);
  });

  test('monitoring cards and stats use centralized status classes', async ({ page }) => {
    await page.goto('sensors-monitoring.html');

    await expect(page.locator('#sensors-grid .sensor-card')).toHaveCount(4);

    await expect(page.locator('#stat-active-sensors')).toHaveText('1');
    await expect(page.locator('#stat-inactive-sensors')).toHaveText('1');
    await expect(page.locator('#stat-maintenance-sensors')).toHaveText('1');
    await expect(page.locator('#stat-faulty-sensors')).toHaveText('1');

    await expect(page.locator('#stat-icon-active')).toHaveClass(/sensor-status-stat-icon-active/);
    await expect(page.locator('#stat-icon-inactive')).toHaveClass(
      /sensor-status-stat-icon-inactive/
    );
    await expect(page.locator('#stat-icon-maintenance')).toHaveClass(
      /sensor-status-stat-icon-maintenance/
    );
    await expect(page.locator('#stat-icon-faulty')).toHaveClass(/sensor-status-stat-icon-faulty/);

    const inactiveCard = page.locator('#sensors-grid .sensor-card[data-status="Inactive"]').first();
    await expect(inactiveCard).toHaveClass(/sensor-card-status-inactive/);
    await expect(inactiveCard.locator('.badge').first()).toHaveClass(/badge-status-inactive/);

    const faultyCard = page.locator('#sensors-grid .sensor-card[data-status="Faulty"]').first();
    await expect(faultyCard).toHaveClass(/sensor-card-status-faulty/);
    await expect(faultyCard.locator('.badge').first()).toHaveClass(/badge-status-faulty/);
  });
});

test.describe('Sensors global status counters by role', () => {
  test('producer uses owner-scoped global counters', async ({ page }) => {
    await installApiMocks(page, { sensors: MIXED_OWNER_SENSORS_FIXTURE });
    await applySession(page, buildProducerSession(DEFAULT_OWNER_ID_ALPHA));

    await page.goto('sensors.html');

    await expect(page.locator('#sensors-tbody tr')).toHaveCount(2);
    await expect(page.locator('#sensors-summary-text')).toContainText('of 2');

    await expect(page.locator('#sensors-summary-active')).toContainText('1');
    await expect(page.locator('#sensors-summary-inactive')).toContainText('1');
    await expect(page.locator('#sensors-summary-maintenance')).toContainText('0');
    await expect(page.locator('#sensors-summary-faulty')).toContainText('0');
  });

  test('admin uses global counters without owner filter', async ({ page }) => {
    await installApiMocks(page, { sensors: MIXED_OWNER_SENSORS_FIXTURE });
    await applySession(page, buildAdminSession());

    await page.goto('sensors.html');

    await expect(page.locator('#sensors-tbody tr')).toHaveCount(5);
    await expect(page.locator('#sensors-summary-text')).toContainText('of 5');

    await expect(page.locator('#sensors-summary-active')).toContainText('1');
    await expect(page.locator('#sensors-summary-inactive')).toContainText('1');
    await expect(page.locator('#sensors-summary-maintenance')).toContainText('1');
    await expect(page.locator('#sensors-summary-faulty')).toContainText('2');
  });
});
