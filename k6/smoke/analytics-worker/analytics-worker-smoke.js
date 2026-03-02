import http from "k6/http";
import { check, sleep } from "k6";
import {
  analyticsServiceBase,
  sleepSeconds,
  smokeDuration,
  timeoutMs,
} from "../../shared/env.js";
import { ensureSmokeProducerSession } from "../../shared/auth.js";
import { parseJsonSafely, pickField } from "../../shared/json.js";

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

  return {
    token: session.token,
  };
}

export default function (data) {
  const base = analyticsServiceBase();
  const timeout = `${timeoutMs()}ms`;
  const authHeaders = {
    Authorization: `Bearer ${data.token}`,
  };

  const healthResponse = http.get(`${base}/health`, {
    timeout,
    tags: { endpoint: "analytics-health" },
  });

  check(healthResponse, {
    "analytics health endpoint reachable": (r) => r.status !== 404,
    "analytics health success": (r) => r.status === 200,
  });

  const pendingAlertsResponse = http.get(
    `${base}/api/alerts/pending?PageNumber=1&PageSize=20`,
    {
      headers: authHeaders,
      timeout,
      tags: { endpoint: "analytics-pending-alerts" },
    },
  );

  check(pendingAlertsResponse, {
    "analytics pending alerts success": (r) => r.status === 200,
  });

  const pendingSummaryResponse = http.get(
    `${base}/api/alerts/pending/summary?WindowHours=24`,
    {
      headers: authHeaders,
      timeout,
      tags: { endpoint: "analytics-pending-summary" },
    },
  );

  check(pendingSummaryResponse, {
    "analytics pending summary success": (r) => r.status === 200,
  });

  const pendingBody = parseJsonSafely(pendingAlertsResponse);
  const rows = Array.isArray(pendingBody?.data)
    ? pendingBody.data
    : Array.isArray(pendingBody?.items)
      ? pendingBody.items
      : [];

  const firstAlert = rows.length > 0 ? rows[0] : null;
  const sensorId = pickField(firstAlert, ["sensorId", "SensorId"]);

  if (sensorId) {
    const historyResponse = http.get(
      `${base}/api/alerts/history/${sensorId}?Days=7&PageNumber=1&PageSize=10`,
      {
        headers: authHeaders,
        timeout,
        responseCallback: http.expectedStatuses(200, 404),
        tags: { endpoint: "analytics-alert-history" },
      },
    );

    check(historyResponse, {
      "analytics alert history reachable": (r) => [200, 404].includes(r.status),
    });

    const sensorStatusResponse = http.get(
      `${base}/api/sensors/${sensorId}/status`,
      {
        headers: authHeaders,
        timeout,
        responseCallback: http.expectedStatuses(200, 404),
        tags: { endpoint: "analytics-sensor-status" },
      },
    );

    check(sensorStatusResponse, {
      "analytics sensor status reachable": (r) => [200, 404].includes(r.status),
    });
  }

  sleep(sleepSeconds());
}
