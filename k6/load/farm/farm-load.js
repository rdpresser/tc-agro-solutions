import http from "k6/http";
import { check, sleep } from "k6";
import { sleepSeconds, timeoutMs } from "../../shared/env.js";
import { ensureSmokeProducerSession } from "../../shared/auth.js";
import { createFarmFixture } from "../../shared/farm-fixture.js";
import { dockerLoadOptions } from "../../shared/load-profile.js";

export const options = dockerLoadOptions();

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

  sleep(sleepSeconds());
}
