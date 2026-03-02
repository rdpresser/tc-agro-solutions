import http from "k6/http";
import { check, sleep } from "k6";
import {
  analyticsServiceBase,
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
  const base = analyticsServiceBase();
  const timeout = `${timeoutMs()}ms`;
  const okOrNotFound = http.expectedStatuses(200, 404);
  const authHeader = {
    Authorization: `Bearer ${data.token}`,
  };

  const pendingAlertsResponse = http.get(
    `${base}/api/alerts/pending?PageNumber=1&PageSize=10`,
    {
      headers: authHeader,
      timeout,
      tags: { endpoint: "analytics-pending-alerts-load" },
    },
  );

  check(pendingAlertsResponse, {
    "analytics load pending alerts success": (r) => r.status === 200,
  });

  const summaryResponse = http.get(
    `${base}/api/alerts/pending/summary?WindowHours=24`,
    {
      headers: authHeader,
      timeout,
      tags: { endpoint: "analytics-summary-load" },
    },
  );

  check(summaryResponse, {
    "analytics load summary success": (r) => r.status === 200,
  });

  const sensorAlertsResponse = http.get(
    `${base}/api/alerts/history/${data.sensorId}?Days=7&PageNumber=1&PageSize=10`,
    {
      headers: authHeader,
      timeout,
      tags: { endpoint: "analytics-sensor-alerts-load" },
      responseCallback: okOrNotFound,
    },
  );

  check(sensorAlertsResponse, {
    "analytics load sensor alerts acceptable": (r) =>
      [200, 404].includes(r.status),
  });

  const sensorTimelineResponse = http.get(
    `${base}/api/sensors/${data.sensorId}/status`,
    {
      headers: authHeader,
      timeout,
      tags: { endpoint: "analytics-sensor-timeline-load" },
      responseCallback: okOrNotFound,
    },
  );

  check(sensorTimelineResponse, {
    "analytics load sensor timeline acceptable": (r) =>
      [200, 404].includes(r.status),
  });

  sleep(sleepSeconds());
}
