import http from "k6/http";
import { check, sleep } from "k6";
import {
  sensorIngestServiceBase,
  sleepSeconds,
  smokeDuration,
  timeoutMs,
} from "../../shared/env.js";

export const options = {
  vus: 1,
  duration: smokeDuration(),
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1500"],
  },
};

export default function () {
  const timeout = `${timeoutMs()}ms`;
  const response = http.get(`${sensorIngestServiceBase()}/health`, {
    timeout,
    tags: { endpoint: "sensor-ingest-health" },
  });

  check(response, {
    "sensor-ingest health endpoint reachable": (r) => r.status !== 404,
    "sensor-ingest health success": (r) => r.status === 200,
  });

  sleep(sleepSeconds());
}
