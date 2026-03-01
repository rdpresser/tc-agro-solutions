import { createFakeJwt } from './session.js';

const DEFAULT_OWNER_ID_ALPHA = '00000000-0000-0000-0000-000000000001';
const DEFAULT_OWNER_ID_ZULU = '00000000-0000-0000-0000-000000000002';

const DEFAULT_OWNERS = [
  {
    id: DEFAULT_OWNER_ID_ZULU,
    name: 'Zulu Farms',
    email: 'zulu-owner@tcagro.com'
  },
  {
    id: DEFAULT_OWNER_ID_ALPHA,
    name: 'Alpha Farms',
    email: 'alpha-owner@tcagro.com'
  }
];

function nowIso() {
  return new Date().toISOString();
}

function buildPaginated(items, pageNumber = 1, pageSize = 10) {
  const normalizedPageNumber = Number(pageNumber) > 0 ? Number(pageNumber) : 1;
  const normalizedPageSize = Number(pageSize) > 0 ? Number(pageSize) : 10;
  const totalCount = Array.isArray(items) ? items.length : 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / normalizedPageSize));
  const safePage = Math.min(Math.max(1, normalizedPageNumber), pageCount);
  const start = (safePage - 1) * normalizedPageSize;
  const pagedItems = items.slice(start, start + normalizedPageSize);

  return {
    data: pagedItems,
    items: pagedItems,
    totalCount,
    pageNumber: safePage,
    pageSize: normalizedPageSize,
    hasNextPage: safePage < pageCount,
    hasPreviousPage: safePage > 1,
    pageCount
  };
}

function createId(prefix = 'id') {
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${stamp}-${random}`;
}

async function fulfillJson(route, body, status = 200) {
  await route.fulfill({
    status,
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

function normalizeRoleByEmail(email) {
  if (
    String(email || '')
      .toLowerCase()
      .includes('producer')
  ) {
    return 'Producer';
  }

  return 'Admin';
}

function findOwner(owners, ownerId) {
  return owners.find((owner) => owner.id === ownerId) || owners[0] || null;
}

function createInitialState({ owners, users, properties, plots, sensors } = {}) {
  const ownersState = owners || [...DEFAULT_OWNERS];

  const usersState = users || [
    {
      id: 'user-admin-001',
      name: 'Admin User',
      firstName: 'Admin',
      lastName: 'User',
      username: 'admin',
      email: 'admin@tcagro.com',
      role: 'Admin',
      status: 'Active',
      createdAt: nowIso()
    },
    {
      id: 'user-producer-001',
      name: 'Producer User',
      firstName: 'Producer',
      lastName: 'User',
      username: 'producer',
      email: 'producer@tcagro.com',
      role: 'Producer',
      status: 'Active',
      createdAt: nowIso()
    }
  ];

  const propertiesState = properties || [
    {
      id: 'property-001',
      ownerId: DEFAULT_OWNER_ID_ALPHA,
      ownerName: 'Alpha Farms',
      name: 'Alpha Main Property',
      address: 'Road 10',
      city: 'Ribeirao Preto',
      state: 'SP',
      country: 'Brazil',
      areaHectares: 100,
      plotCount: 1,
      isActive: true,
      createdAt: nowIso(),
      latitude: -21.1775,
      longitude: -47.8103
    }
  ];

  const plotsState = plots || [
    {
      id: 'plot-001',
      ownerId: DEFAULT_OWNER_ID_ALPHA,
      ownerName: 'Alpha Farms',
      propertyId: 'property-001',
      propertyName: 'Alpha Main Property',
      name: 'North Field',
      areaHectares: 25,
      cropType: 'Soybean',
      plantingDate: nowIso(),
      expectedHarvestDate: nowIso(),
      irrigationType: 'Drip',
      status: 'healthy',
      sensorsCount: 1,
      additionalNotes: '',
      createdAt: nowIso()
    }
  ];

  const sensorsState = sensors || [
    {
      id: 'sensor-001',
      ownerId: DEFAULT_OWNER_ID_ALPHA,
      ownerName: 'Alpha Farms',
      plotId: 'plot-001',
      plotName: 'North Field',
      propertyId: 'property-001',
      propertyName: 'Alpha Main Property',
      type: 'SoilMoisture',
      label: 'Soil Sensor 001',
      status: 'Active',
      installedAt: nowIso(),
      createdAt: nowIso()
    }
  ];

  return {
    owners: ownersState,
    users: usersState,
    properties: propertiesState,
    plots: plotsState,
    sensors: sensorsState
  };
}

function parseRequestBody(request) {
  try {
    return JSON.parse(request.postData() || '{}');
  } catch {
    return {};
  }
}

function normalizeOwnerFilter(items, ownerId) {
  if (!ownerId) {
    return items;
  }

  return items.filter((item) => String(item.ownerId || '') === String(ownerId));
}

function applyTextFilter(items, term, fields) {
  const normalizedTerm = String(term || '')
    .trim()
    .toLowerCase();
  if (!normalizedTerm) {
    return items;
  }

  return items.filter((item) =>
    fields.some((field) =>
      String(item[field] || '')
        .toLowerCase()
        .includes(normalizedTerm)
    )
  );
}

function toPageParams(searchParams, defaults = {}) {
  return {
    pageNumber: Number(searchParams.get('pageNumber') || defaults.pageNumber || 1),
    pageSize: Number(searchParams.get('pageSize') || defaults.pageSize || 10)
  };
}

export async function installApiMocks(
  page,
  { owners = DEFAULT_OWNERS, pendingAlertsTotal = 3, users, properties, plots, sensors } = {}
) {
  const state = createInitialState({ owners, users, properties, plots, sensors });

  await page.route('**/*', async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());

    const isBackendHost =
      (requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1') &&
      ['5001', '5002', '5003', '5004'].includes(requestUrl.port);

    if (!isBackendHost) {
      await route.continue();
      return;
    }

    const method = request.method().toUpperCase();
    const { pathname, searchParams, port } = requestUrl;

    if (port === '5001') {
      if (pathname === '/auth/login' && method === 'POST') {
        const body = parseRequestBody(request);
        const role = normalizeRoleByEmail(body.email);
        const ownerId = '11111111-1111-1111-1111-111111111111';
        const token = createFakeJwt({
          sub: ownerId,
          email: body.email || 'admin@tcagro.com',
          name: role === 'Producer' ? 'Producer User' : 'Admin User',
          role: [role],
          exp: Math.floor(Date.now() / 1000) + 3600
        });

        await fulfillJson(route, {
          jwtToken: token,
          email: body.email || 'admin@tcagro.com'
        });
        return;
      }

      if (pathname === '/auth/register' && method === 'POST') {
        const body = parseRequestBody(request);
        const newUser = {
          id: createId('user'),
          name: body.name,
          firstName: String(body.name || '').split(' ')[0] || 'User',
          lastName:
            String(body.name || '')
              .split(' ')
              .slice(1)
              .join(' ') || 'Created',
          username: body.username,
          email: body.email,
          role: body.role || 'User',
          status: 'Active',
          createdAt: nowIso()
        };

        state.users.push(newUser);
        await fulfillJson(route, newUser, 201);
        return;
      }

      if (pathname === '/swagger/v1/swagger.json' && method === 'GET') {
        await fulfillJson(route, {
          openapi: '3.0.1',
          paths: {
            '/api/user': { get: {} },
            '/api/user/by-email/{email}': { get: {} }
          }
        });
        return;
      }

      if (pathname === '/api/user' && method === 'GET') {
        const { pageNumber, pageSize } = toPageParams(searchParams, { pageSize: 10 });
        const filter = searchParams.get('filter') || '';
        const filtered = applyTextFilter(state.users, filter, [
          'name',
          'email',
          'username',
          'role'
        ]);
        await fulfillJson(route, buildPaginated(filtered, pageNumber, pageSize));
        return;
      }

      if (pathname.startsWith('/api/user/by-email/') && method === 'GET') {
        const email = decodeURIComponent(
          pathname.split('/api/user/by-email/')[1] || ''
        ).toLowerCase();
        const user = state.users.find((item) => String(item.email || '').toLowerCase() === email);

        if (!user) {
          await fulfillJson(route, { message: 'User not found' }, 404);
          return;
        }

        await fulfillJson(route, user);
        return;
      }

      if (pathname.startsWith('/api/user/') && method === 'PUT') {
        const userId = decodeURIComponent(pathname.split('/api/user/')[1] || '');
        const body = parseRequestBody(request);
        const index = state.users.findIndex((user) => user.id === userId);

        if (index === -1) {
          await fulfillJson(route, { message: 'User not found' }, 404);
          return;
        }

        state.users[index] = {
          ...state.users[index],
          ...body,
          role: state.users[index].role,
          email: body.email || state.users[index].email,
          username: body.username || state.users[index].username,
          name: body.name || state.users[index].name
        };

        await fulfillJson(route, state.users[index]);
        return;
      }

      if (pathname.startsWith('/api/user/') && method === 'DELETE') {
        const userId = decodeURIComponent(pathname.split('/api/user/')[1] || '');
        state.users = state.users.filter((user) => user.id !== userId);
        await fulfillJson(route, { success: true });
        return;
      }
    }

    if (port === '5002') {
      if (pathname === '/swagger/v1/swagger.json' && method === 'GET') {
        await fulfillJson(route, {
          openapi: '3.0.1',
          paths: {
            '/api/owners': {
              get: {
                parameters: [
                  { name: 'pageNumber', in: 'query' },
                  { name: 'pageSize', in: 'query' },
                  { name: 'sortBy', in: 'query' },
                  { name: 'sortDirection', in: 'query' },
                  { name: 'filter', in: 'query' }
                ]
              }
            }
          }
        });
        return;
      }

      if (pathname === '/api/owners' && method === 'GET') {
        const { pageNumber, pageSize } = toPageParams(searchParams, { pageSize: 1000 });
        await fulfillJson(route, buildPaginated(state.owners, pageNumber, pageSize));
        return;
      }

      if (pathname === '/api/properties' && method === 'GET') {
        const { pageNumber, pageSize } = toPageParams(searchParams, { pageSize: 10 });
        const ownerId = searchParams.get('ownerId') || '';
        const filter = searchParams.get('filter') || '';

        let items = normalizeOwnerFilter(state.properties, ownerId);
        items = applyTextFilter(items, filter, ['ownerName', 'name', 'city', 'state', 'country']);

        await fulfillJson(route, buildPaginated(items, pageNumber, pageSize));
        return;
      }

      if (pathname === '/api/properties' && method === 'POST') {
        const body = parseRequestBody(request);
        const owner = findOwner(state.owners, body.ownerId || DEFAULT_OWNER_ID_ALPHA);
        const newProperty = {
          id: createId('property'),
          ownerId: body.ownerId || owner?.id || DEFAULT_OWNER_ID_ALPHA,
          ownerName: owner?.name || 'Unknown Owner',
          name: body.name || 'New Property',
          address: body.address || '',
          city: body.city || '',
          state: body.state || '',
          country: body.country || '',
          areaHectares: Number(body.areaHectares || 0),
          latitude: body.latitude ?? null,
          longitude: body.longitude ?? null,
          plotCount: 0,
          isActive: true,
          createdAt: nowIso()
        };

        state.properties.push(newProperty);
        await fulfillJson(route, newProperty, 201);
        return;
      }

      if (pathname.startsWith('/api/properties/') && method === 'GET') {
        const propertyId = decodeURIComponent(pathname.split('/api/properties/')[1] || '');
        const property = state.properties.find((item) => item.id === propertyId);

        if (!property) {
          await fulfillJson(route, { message: 'Property not found' }, 404);
          return;
        }

        await fulfillJson(route, property);
        return;
      }

      if (pathname.startsWith('/api/properties/') && method === 'PUT') {
        const propertyId = decodeURIComponent(pathname.split('/api/properties/')[1] || '');
        const body = parseRequestBody(request);
        const index = state.properties.findIndex((item) => item.id === propertyId);

        if (index === -1) {
          await fulfillJson(route, { message: 'Property not found' }, 404);
          return;
        }

        state.properties[index] = {
          ...state.properties[index],
          ...body,
          id: propertyId,
          ownerId: state.properties[index].ownerId,
          ownerName: state.properties[index].ownerName
        };

        await fulfillJson(route, state.properties[index]);
        return;
      }

      if (pathname === '/api/plots' && method === 'GET') {
        const { pageNumber, pageSize } = toPageParams(searchParams, { pageSize: 10 });
        const ownerId = searchParams.get('ownerId') || '';
        const propertyId = searchParams.get('propertyId') || '';
        const filter = searchParams.get('filter') || '';

        let items = normalizeOwnerFilter(state.plots, ownerId);
        if (propertyId) {
          items = items.filter((plot) => plot.propertyId === propertyId);
        }
        items = applyTextFilter(items, filter, ['name', 'propertyName', 'ownerName']);

        await fulfillJson(route, buildPaginated(items, pageNumber, pageSize));
        return;
      }

      if (pathname === '/api/plots' && method === 'POST') {
        const body = parseRequestBody(request);
        const owner = findOwner(state.owners, body.ownerId || DEFAULT_OWNER_ID_ALPHA);
        const property = state.properties.find((item) => item.id === body.propertyId) || null;

        const newPlot = {
          id: createId('plot'),
          ownerId: body.ownerId || owner?.id || DEFAULT_OWNER_ID_ALPHA,
          ownerName: owner?.name || 'Unknown Owner',
          propertyId: body.propertyId,
          propertyName: property?.name || 'Unknown Property',
          name: body.name || 'New Plot',
          areaHectares: Number(body.areaHectares || 0),
          cropType: body.cropType || 'Soybean',
          plantingDate: body.plantingDate || nowIso(),
          expectedHarvestDate: body.expectedHarvestDate || nowIso(),
          irrigationType: body.irrigationType || 'Drip',
          status: 'healthy',
          sensorsCount: 0,
          additionalNotes: body.additionalNotes || '',
          createdAt: nowIso()
        };

        state.plots.push(newPlot);

        const propertyIndex = state.properties.findIndex((item) => item.id === body.propertyId);
        if (propertyIndex >= 0) {
          state.properties[propertyIndex].plotCount =
            Number(state.properties[propertyIndex].plotCount || 0) + 1;
        }

        await fulfillJson(route, newPlot, 201);
        return;
      }

      if (pathname.startsWith('/api/plots/') && pathname.endsWith('/sensors') && method === 'GET') {
        const plotId = decodeURIComponent(
          pathname.split('/api/plots/')[1].split('/sensors')[0] || ''
        );
        const sensorsForPlot = state.sensors.filter((sensor) => sensor.plotId === plotId);
        const { pageNumber, pageSize } = toPageParams(searchParams, { pageSize: 10 });
        await fulfillJson(route, buildPaginated(sensorsForPlot, pageNumber, pageSize));
        return;
      }

      if (pathname.startsWith('/api/plots/') && method === 'GET') {
        const plotId = decodeURIComponent(pathname.split('/api/plots/')[1] || '');
        const plot = state.plots.find((item) => item.id === plotId);

        if (!plot) {
          await fulfillJson(route, { message: 'Plot not found' }, 404);
          return;
        }

        await fulfillJson(route, plot);
        return;
      }

      if (pathname === '/api/sensors' && method === 'GET') {
        const { pageNumber, pageSize } = toPageParams(searchParams, { pageSize: 10 });
        const ownerId = searchParams.get('ownerId') || '';
        const propertyId = searchParams.get('propertyId') || '';
        const plotId = searchParams.get('plotId') || '';
        const status = searchParams.get('status') || '';
        const type = searchParams.get('type') || '';
        const filter = searchParams.get('filter') || '';

        let items = normalizeOwnerFilter(state.sensors, ownerId);

        if (propertyId) {
          items = items.filter((sensor) => sensor.propertyId === propertyId);
        }

        if (plotId) {
          items = items.filter((sensor) => sensor.plotId === plotId);
        }

        if (status) {
          items = items.filter((sensor) => String(sensor.status || '') === String(status));
        }

        if (type) {
          items = items.filter((sensor) => String(sensor.type || '') === String(type));
        }

        items = applyTextFilter(items, filter, ['label', 'plotName', 'propertyName']);

        await fulfillJson(route, buildPaginated(items, pageNumber, pageSize));
        return;
      }

      if (pathname === '/api/sensors' && method === 'POST') {
        const body = parseRequestBody(request);
        const owner = findOwner(state.owners, body.ownerId || DEFAULT_OWNER_ID_ALPHA);
        const plot = state.plots.find((item) => item.id === body.plotId) || null;
        const property = plot
          ? state.properties.find((item) => item.id === plot.propertyId) || null
          : null;

        const newSensor = {
          id: createId('sensor'),
          ownerId: body.ownerId || owner?.id || DEFAULT_OWNER_ID_ALPHA,
          ownerName: owner?.name || 'Unknown Owner',
          plotId: body.plotId,
          plotName: plot?.name || 'Unknown Plot',
          propertyId: property?.id || '',
          propertyName: property?.name || 'Unknown Property',
          type: body.type || 'SoilMoisture',
          label: body.label || 'New Sensor',
          status: 'Active',
          installedAt: nowIso(),
          createdAt: nowIso()
        };

        state.sensors.push(newSensor);
        await fulfillJson(route, newSensor, 201);
        return;
      }

      if (
        pathname.startsWith('/api/sensors/') &&
        pathname.endsWith('/status-change') &&
        method === 'PUT'
      ) {
        const sensorId = decodeURIComponent(
          pathname.split('/api/sensors/')[1].split('/status-change')[0] || ''
        );
        const body = parseRequestBody(request);
        const sensorIndex = state.sensors.findIndex((sensor) => sensor.id === sensorId);

        if (sensorIndex === -1) {
          await fulfillJson(route, { message: 'Sensor not found' }, 404);
          return;
        }

        state.sensors[sensorIndex].status = body.newStatus || state.sensors[sensorIndex].status;
        await fulfillJson(route, state.sensors[sensorIndex]);
        return;
      }

      if (pathname.startsWith('/api/sensors/') && method === 'GET') {
        const sensorId = decodeURIComponent(pathname.split('/api/sensors/')[1] || '');
        const sensor = state.sensors.find((item) => item.id === sensorId);

        if (!sensor) {
          await fulfillJson(route, { message: 'Sensor not found' }, 404);
          return;
        }

        await fulfillJson(route, sensor);
        return;
      }
    }

    if (port === '5003') {
      if (
        (pathname === '/api/dashboard/latest' || pathname === '/api/readings/latest') &&
        method === 'GET'
      ) {
        const ownerId = searchParams.get('ownerId') || '';
        const pageSize = Number(searchParams.get('pageSize') || 10);

        const readings = normalizeOwnerFilter(state.sensors, ownerId)
          .slice(0, pageSize)
          .map((sensor) => ({
            id: createId('reading'),
            sensorId: sensor.id,
            plotId: sensor.plotId,
            plotName: sensor.plotName,
            propertyName: sensor.propertyName,
            time: nowIso(),
            temperature: 25.5,
            humidity: 60,
            soilMoisture: 45,
            rainfall: 0,
            batteryLevel: 80
          }));

        await fulfillJson(route, {
          items: readings,
          totalCount: readings.length,
          pageNumber: 1,
          pageSize
        });
        return;
      }

      if (pathname.endsWith('/dashboard/sensorshub/negotiate') && method === 'POST') {
        await fulfillJson(route, {
          connectionId: 'mock-sensor-connection',
          availableTransports: []
        });
        return;
      }
    }

    if (port === '5004') {
      if (pathname === '/api/alerts/pending/summary' && method === 'GET') {
        await fulfillJson(route, {
          pendingAlertsTotal,
          affectedPlotsCount: 1,
          affectedSensorsCount: 1,
          criticalPendingCount: pendingAlertsTotal,
          highPendingCount: 0,
          mediumPendingCount: 0,
          lowPendingCount: 0,
          newPendingInWindowCount: pendingAlertsTotal,
          windowHours: Number(searchParams.get('windowHours') || 24)
        });
        return;
      }

      if (pathname === '/api/alerts/pending' && method === 'GET') {
        await fulfillJson(route, {
          items: [
            {
              id: 'alert-001',
              sensorId: 'sensor-001',
              sensorName: 'Sensor 001',
              plotId: 'plot-001',
              plotName: 'North Field',
              propertyName: 'Alpha Main Property',
              severity: 'Critical',
              status: 'Pending',
              createdAt: nowIso(),
              message: 'Soil moisture below threshold'
            }
          ],
          totalCount: 1,
          pageNumber: Number(searchParams.get('pageNumber') || 1),
          pageSize: Number(searchParams.get('pageSize') || 10),
          hasNextPage: false,
          hasPreviousPage: false,
          pageCount: 1
        });
        return;
      }

      if (pathname.startsWith('/api/alerts/') && method === 'PUT') {
        await fulfillJson(route, { success: true });
        return;
      }

      if (pathname.endsWith('/dashboard/alertshub/negotiate') && method === 'POST') {
        await fulfillJson(route, {
          connectionId: 'mock-alert-connection',
          availableTransports: []
        });
        return;
      }
    }

    await fulfillJson(route, {}, 200);
  });
}

export { DEFAULT_OWNERS, DEFAULT_OWNER_ID_ALPHA, DEFAULT_OWNER_ID_ZULU };
