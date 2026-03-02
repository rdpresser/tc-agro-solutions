import http from "k6/http";
import { check, fail, sleep } from "k6";
import { sleepSeconds, smokeDuration, timeoutMs } from "../../shared/env.js";
import { ensureSmokeProducerSession } from "../../shared/auth.js";
import { createFarmFixture } from "../../shared/farm-fixture.js";

export const options = {
  vus: 1,
  duration: smokeDuration(),
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1500"],
  },
};

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

  const propertiesListResponse = http.get(
    `${data.farmBase}/api/properties?PageNumber=1&PageSize=10&SortBy=name&SortDirection=asc`,
    {
      headers,
      timeout,
      tags: { endpoint: "farm-list-properties" },
    },
  );

  check(propertiesListResponse, {
    "farm list properties success": (r) => r.status === 200,
  });

  if (propertiesListResponse.status !== 200) {
    fail(
      `Farm list properties failed with status ${propertiesListResponse.status}: ${(propertiesListResponse.body || "").substring(0, 300)}`,
    );
  }

  const propertyByIdResponse = http.get(
    `${data.farmBase}/api/properties/${data.propertyId}`,
    {
      headers,
      timeout,
      tags: { endpoint: "farm-get-property" },
    },
  );

  check(propertyByIdResponse, {
    "farm get property by id success": (r) => r.status === 200,
  });

  const propertyPlotsResponse = http.get(
    `${data.farmBase}/api/properties/${data.propertyId}/plots`,
    {
      headers,
      timeout,
      tags: { endpoint: "farm-list-property-plots" },
    },
  );

  check(propertyPlotsResponse, {
    "farm list plots from property success": (r) => r.status === 200,
  });

  const plotByIdResponse = http.get(
    `${data.farmBase}/api/plots/${data.plotId}`,
    {
      headers,
      timeout,
      tags: { endpoint: "farm-get-plot" },
    },
  );

  check(plotByIdResponse, {
    "farm get plot by id success": (r) => r.status === 200,
  });

  const plotSensorsResponse = http.get(
    `${data.farmBase}/api/plots/${data.plotId}/sensors`,
    {
      headers,
      timeout,
      tags: { endpoint: "farm-list-plot-sensors" },
    },
  );

  check(plotSensorsResponse, {
    "farm list sensors from plot success": (r) => r.status === 200,
  });

  const sensorByIdResponse = http.get(
    `${data.farmBase}/api/sensors/${data.sensorId}`,
    {
      headers,
      timeout,
      tags: { endpoint: "farm-get-sensor" },
    },
  );

  check(sensorByIdResponse, {
    "farm get sensor by id success": (r) => r.status === 200,
  });

  sleep(sleepSeconds());
}
