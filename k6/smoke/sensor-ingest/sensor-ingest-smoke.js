import http from "k6/http";
import { check, fail, sleep } from "k6";
import {
  sensorIngestServiceBase,
  sleepSeconds,
  smokeDuration,
  timeoutMs,
} from "../../shared/env.js";
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
    sensorId: fixture.sensorId,
  };
}

export default function (data) {
  const base = sensorIngestServiceBase();
  const timeout = `${timeoutMs()}ms`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.token}`,
  };

  const createReadingPayload = JSON.stringify({
    sensorId: data.sensorId,
    timestamp: new Date().toISOString(),
    temperature: 27.3,
    humidity: 61.1,
    soilMoisture: 45.2,
    rainfall: 0,
    batteryLevel: 88.0,
  });

  const createReadingResponse = http.post(
    `${base}/api/readings`,
    createReadingPayload,
    {
      headers,
      timeout,
      tags: { endpoint: "sensor-ingest-create-reading" },
    },
  );

  check(createReadingResponse, {
    "sensor-ingest create reading success": (r) =>
      [200, 202].includes(r.status),
  });

  if (![200, 202].includes(createReadingResponse.status)) {
    fail(
      `Sensor-ingest create reading failed with status ${createReadingResponse.status}: ${(createReadingResponse.body || "").substring(0, 300)}`,
    );
  }

  const latestReadingsResponse = http.get(
    `${base}/api/readings/latest?SensorId=${data.sensorId}&PageNumber=1&PageSize=10`,
    {
      headers: { Authorization: `Bearer ${data.token}` },
      timeout,
      tags: { endpoint: "sensor-ingest-latest-readings" },
    },
  );

  check(latestReadingsResponse, {
    "sensor-ingest latest readings success": (r) => r.status === 200,
  });

  const dashboardLatestResponse = http.get(
    `${base}/api/dashboard/latest?SensorId=${data.sensorId}&PageNumber=1&PageSize=10`,
    {
      headers: { Authorization: `Bearer ${data.token}` },
      timeout,
      tags: { endpoint: "sensor-ingest-dashboard-latest" },
    },
  );

  check(dashboardLatestResponse, {
    "sensor-ingest dashboard latest success": (r) => r.status === 200,
  });

  const readingsHistoryResponse = http.get(
    `${base}/api/sensors/${data.sensorId}/readings?Days=7&PageNumber=1&PageSize=10`,
    {
      headers: { Authorization: `Bearer ${data.token}` },
      timeout,
      tags: { endpoint: "sensor-ingest-readings-history" },
    },
  );

  check(readingsHistoryResponse, {
    "sensor-ingest readings history success": (r) => r.status === 200,
  });

  const response = http.get(`${base}/health`, {
    timeout,
    tags: { endpoint: "sensor-ingest-health" },
  });

  check(response, {
    "sensor-ingest health endpoint reachable": (r) => r.status !== 404,
    "sensor-ingest health success": (r) => r.status === 200,
  });

  sleep(sleepSeconds());
}
