import http from "k6/http";
import { check, sleep } from "k6";
import {
  sensorIngestServiceBase,
  sleepSeconds,
  timeoutMs,
} from "../../shared/env.js";
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
    sensorId: fixture.sensorId,
  };
}

export default function (data) {
  const base = sensorIngestServiceBase();
  const timeout = `${timeoutMs()}ms`;
  const readingTimestamp = new Date(
    Date.now() - 3 * 60 * 60 * 1000,
  ).toISOString();
  const authHeader = {
    Authorization: `Bearer ${data.token}`,
  };

  const createReadingResponse = http.post(
    `${base}/api/readings`,
    JSON.stringify({
      sensorId: data.sensorId,
      timestamp: readingTimestamp,
      temperature: 26.8,
      humidity: 58.7,
      soilMoisture: 44.3,
      rainfall: 0,
      batteryLevel: 86.2,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
      timeout,
      tags: { endpoint: "sensor-ingest-create-reading-load" },
    },
  );

  check(createReadingResponse, {
    "sensor-ingest load create reading success": (r) =>
      [200, 202].includes(r.status),
  });

  const latestReadingsResponse = http.get(
    `${base}/api/readings/latest?SensorId=${data.sensorId}&PageNumber=1&PageSize=10`,
    {
      headers: authHeader,
      timeout,
      tags: { endpoint: "sensor-ingest-latest-readings-load" },
    },
  );

  check(latestReadingsResponse, {
    "sensor-ingest load latest readings success": (r) => r.status === 200,
  });

  const dashboardLatestResponse = http.get(
    `${base}/api/dashboard/latest?SensorId=${data.sensorId}&PageNumber=1&PageSize=10`,
    {
      headers: authHeader,
      timeout,
      tags: { endpoint: "sensor-ingest-dashboard-latest-load" },
    },
  );

  check(dashboardLatestResponse, {
    "sensor-ingest load dashboard latest success": (r) => r.status === 200,
  });

  const historyResponse = http.get(
    `${base}/api/sensors/${data.sensorId}/readings?Days=7&PageNumber=1&PageSize=10`,
    {
      headers: authHeader,
      timeout,
      tags: { endpoint: "sensor-ingest-history-load" },
    },
  );

  check(historyResponse, {
    "sensor-ingest load history success": (r) => r.status === 200,
  });

  sleep(sleepSeconds());
}
