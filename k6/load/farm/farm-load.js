import http from "k6/http";
import { check, sleep } from "k6";
import { sleepSeconds, timeoutMs } from "../../shared/env.js";
import { ensureSmokeProducerSession } from "../../shared/auth.js";
import { createFarmFixture } from "../../shared/farm-fixture.js";
import { dockerLoadOptions } from "../../shared/load-profile.js";

export const options = dockerLoadOptions();

const FARM_LIST_PROPERTIES_EVERY = Number(
  __ENV.FARM_LIST_PROPERTIES_EVERY || 1,
);
const FARM_GET_PROPERTY_EVERY = Number(__ENV.FARM_GET_PROPERTY_EVERY || 1);
const FARM_LIST_PLOTS_EVERY = Number(__ENV.FARM_LIST_PLOTS_EVERY || 1);
const FARM_LIST_SENSORS_EVERY = Number(__ENV.FARM_LIST_SENSORS_EVERY || 1);
const FARM_GET_SENSOR_EVERY = Number(__ENV.FARM_GET_SENSOR_EVERY || 1);

export function setup() {
  const timeout = `${timeoutMs()}ms`;
  const session = ensureSmokeProducerSession(timeout);
  const fixture = createFarmFixture(session, timeout);

  return {
    token: session.token,
    ...fixture,
  };
}

export default function (data) {
  const timeout = `${timeoutMs()}ms`;
  const headers = {
    Authorization: `Bearer ${data.token}`,
  };

  if (__ITER % FARM_LIST_PROPERTIES_EVERY === 0) {
    const propertiesResponse = http.get(
      `${data.farmBase}/api/properties?PageNumber=1&PageSize=20&SortBy=name&SortDirection=asc`,
      {
        headers,
        timeout,
        tags: { endpoint: "farm-list-properties-load" },
      },
    );

    check(propertiesResponse, {
      "farm load list properties success": (r) => r.status === 200,
    });
  }

  if (__ITER % FARM_GET_PROPERTY_EVERY === 0) {
    const propertyResponse = http.get(
      `${data.farmBase}/api/properties/${data.propertyId}`,
      {
        headers,
        timeout,
        tags: { endpoint: "farm-get-property-load" },
      },
    );

    check(propertyResponse, {
      "farm load get property success": (r) => r.status === 200,
    });
  }

  if (__ITER % FARM_LIST_PLOTS_EVERY === 0) {
    const plotsResponse = http.get(
      `${data.farmBase}/api/properties/${data.propertyId}/plots?PageNumber=1&PageSize=20`,
      {
        headers,
        timeout,
        tags: { endpoint: "farm-list-plots-load" },
      },
    );

    check(plotsResponse, {
      "farm load list plots success": (r) => r.status === 200,
    });
  }

  if (__ITER % FARM_LIST_SENSORS_EVERY === 0) {
    const sensorsResponse = http.get(
      `${data.farmBase}/api/plots/${data.plotId}/sensors?PageNumber=1&PageSize=20`,
      {
        headers,
        timeout,
        tags: { endpoint: "farm-list-sensors-load" },
      },
    );

    check(sensorsResponse, {
      "farm load list sensors success": (r) => r.status === 200,
    });
  }

  if (__ITER % FARM_GET_SENSOR_EVERY === 0) {
    const sensorResponse = http.get(
      `${data.farmBase}/api/sensors/${data.sensorId}`,
      {
        headers,
        timeout,
        tags: { endpoint: "farm-get-sensor-load" },
      },
    );

    check(sensorResponse, {
      "farm load get sensor success": (r) => r.status === 200,
    });
  }

  sleep(sleepSeconds());
}
