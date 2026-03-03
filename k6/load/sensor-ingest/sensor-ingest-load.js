import http from "k6/http";
import { check, fail, sleep } from "k6";
import {
  sensorIngestServiceBase,
  sleepSeconds,
  timeoutMs,
} from "../../shared/env.js";
import { ensureSmokeProducerSession } from "../../shared/auth.js";
import { createFarmFixture } from "../../shared/farm-fixture.js";
import { dockerLoadOptions } from "../../shared/load-profile.js";
import { parseJsonSafely } from "../../shared/json.js";

export const options = dockerLoadOptions();

const SENSOR_CREATE_READING_EVERY = Number(
  __ENV.SENSOR_CREATE_READING_EVERY || 1,
);
const SENSOR_LATEST_READINGS_EVERY = Number(
  __ENV.SENSOR_LATEST_READINGS_EVERY || 1,
);
const SENSOR_DASHBOARD_LATEST_EVERY = Number(
  __ENV.SENSOR_DASHBOARD_LATEST_EVERY || 1,
);
const SENSOR_HISTORY_EVERY = Number(__ENV.SENSOR_HISTORY_EVERY || 1);

function waitForSensorRegistration(base, token, sensorId, timeout) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const maxAttempts = 20;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = http.post(
      `${base}/api/readings`,
      JSON.stringify({
        sensorId,
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        temperature: 25.0,
        humidity: 50.0,
        soilMoisture: 40.0,
        rainfall: 0,
        batteryLevel: 90.0,
      }),
      {
        headers,
        timeout,
        tags: { endpoint: "sensor-ingest-registration-probe" },
      },
    );

    if ([200, 202].includes(response.status)) {
      return;
    }

    if (response.status !== 404) {
      fail(
        `Sensor registration probe failed with status ${response.status}: ${(response.body || "").substring(0, 300)}`,
      );
    }

    sleep(1);
  }

  fail(
    `Sensor ${sensorId} was not registered in sensor-ingest after waiting for propagation.`,
  );
}

function tryResolveExistingSensorId(base, token, timeout) {
  const response = http.get(
    `${base}/api/dashboard/latest?PageNumber=1&PageSize=1`,
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout,
      tags: { endpoint: "sensor-ingest-resolve-sensor-setup" },
    },
  );

  if (response.status !== 200) {
    return null;
  }

  const body = parseJsonSafely(response);
  const candidates = [
    body?.items,
    body?.readings,
    body?.data,
    body?.data?.items,
    body?.data?.readings,
  ];

  for (const list of candidates) {
    if (Array.isArray(list) && list.length > 0 && list[0]?.sensorId) {
      return list[0].sensorId;
    }
  }

  return null;
}

export function setup() {
  const timeout = `${timeoutMs()}ms`;
  const session = ensureSmokeProducerSession(timeout);
  const fixture = createFarmFixture(session, timeout);
  const sensorBase = sensorIngestServiceBase();

  const existingSensorId = tryResolveExistingSensorId(
    sensorBase,
    session.token,
    timeout,
  );

  if (!existingSensorId) {
    waitForSensorRegistration(
      sensorBase,
      session.token,
      fixture.sensorId,
      timeout,
    );
  }

  return {
    token: session.token,
    sensorId: existingSensorId || fixture.sensorId,
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

  if (__ITER % SENSOR_CREATE_READING_EVERY === 0) {
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
  }

  if (__ITER % SENSOR_LATEST_READINGS_EVERY === 0) {
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
  }

  if (__ITER % SENSOR_DASHBOARD_LATEST_EVERY === 0) {
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
  }

  if (__ITER % SENSOR_HISTORY_EVERY === 0) {
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
  }

  sleep(sleepSeconds());
}
