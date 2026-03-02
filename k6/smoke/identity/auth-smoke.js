import http from "k6/http";
import { check, fail, sleep } from "k6";
import { sleepSeconds, smokeDuration, timeoutMs } from "../../shared/env.js";
import {
  ensureSmokeProducerSession,
  SMOKE_EMAIL,
  SMOKE_PASSWORD,
} from "../../shared/auth.js";
import { parseJsonSafely } from "../../shared/json.js";

const LOGIN_PATH = "/auth/login";
const CHECK_EMAIL_PATH = "/auth/check-email";
const USER_LIST_PATH =
  "/user?PageNumber=1&PageSize=1&SortBy=id&SortDirection=asc";

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
  return ensureSmokeProducerSession(timeout);
}

export default function (data) {
  const timeout = `${timeoutMs()}ms`;
  const headers = { "Content-Type": "application/json" };

  const authHeaders = {
    ...headers,
    Authorization: `Bearer ${data.token}`,
  };

  const checkEmailResponse = http.get(
    `${data.authBase}${CHECK_EMAIL_PATH}/${encodeURIComponent(SMOKE_EMAIL)}`,
    {
      timeout,
      tags: { endpoint: "identity-check-email" },
    },
  );

  const checkEmailBody = parseJsonSafely(checkEmailResponse);

  check(checkEmailResponse, {
    "identity check-email reachable": (r) => r.status !== 404,
    "identity check-email success": (r) => r.status === 200,
    "identity check-email unavailable for smoke user": () =>
      checkEmailBody?.isAvailable === false,
  });

  if (checkEmailResponse.status !== 200) {
    fail(
      `Identity check-email failed with status ${checkEmailResponse.status}: ${(checkEmailResponse.body || "").substring(0, 300)}`,
    );
  }

  const loginPayload = JSON.stringify({
    email: SMOKE_EMAIL,
    password: SMOKE_PASSWORD,
  });

  const loginResponse = http.post(
    `${data.authBase}${LOGIN_PATH}`,
    loginPayload,
    {
      headers,
      timeout,
      tags: { endpoint: "identity-login" },
    },
  );

  const loginBody = parseJsonSafely(loginResponse);

  check(loginResponse, {
    "identity login reachable": (r) => r.status !== 404,
    "identity login success": (r) => r.status === 200,
    "identity login returns jwtToken": () => Boolean(loginBody?.jwtToken),
  });

  if (loginResponse.status !== 200 || !loginBody?.jwtToken) {
    fail(
      `Identity login failed with status ${loginResponse.status}: ${(loginResponse.body || "").substring(0, 300)}`,
    );
  }

  const userListResponse = http.get(`${data.apiBase}${USER_LIST_PATH}`, {
    headers: authHeaders,
    timeout,
    tags: { endpoint: "identity-user-list-auth" },
  });

  check(userListResponse, {
    "identity producer token accesses user list": (r) => r.status === 200,
  });

  if (userListResponse.status !== 200) {
    fail(
      `Identity authenticated user list failed with status ${userListResponse.status}: ${(userListResponse.body || "").substring(0, 300)}`,
    );
  }

  sleep(sleepSeconds());
}
