import http from "k6/http";
import { check, fail, sleep } from "k6";
import {
  identityBaseUrl,
  sleepSeconds,
  smokeDuration,
  timeoutMs,
} from "../../shared/env.js";

const REGISTER_PATH = "/auth/register";
const LOGIN_PATH = "/auth/login";
const CHECK_EMAIL_PATH = "/auth/check-email";
const USER_LIST_PATH =
  "/api/user?PageNumber=1&PageSize=1&SortBy=id&SortDirection=asc";

const SMOKE_EMAIL = "smoke@tc.agro.com";
const SMOKE_PASSWORD = "Smoke@123";
const SMOKE_USERNAME = "smokeproducer";
const SMOKE_NAME = "Smoke Producer";
const SMOKE_ROLE = "Producer";

export const options = {
  vus: 1,
  duration: smokeDuration(),
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1500"],
  },
};

function parseJsonSafely(response) {
  try {
    return JSON.parse(response.body || "{}");
  } catch (_) {
    return {};
  }
}

function trimSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function resolveApiBase(timeout) {
  const root = trimSlash(identityBaseUrl());
  const candidates = [
    ...new Set([
      root,
      `${root}/api`,
      `${root}/identity`,
      `${root}/identity/api`,
    ]),
  ];

  for (const candidate of candidates) {
    const probe = http.get(
      `${candidate}${CHECK_EMAIL_PATH}/${encodeURIComponent(SMOKE_EMAIL)}`,
      {
        timeout,
        responseCallback: http.expectedStatuses(200, 400, 401, 403, 404),
        tags: { endpoint: "identity-probe-base" },
      },
    );

    if (probe.status !== 404 && probe.status !== 0) {
      return candidate;
    }
  }

  fail(
    `Unable to resolve identity API base path. Tried: ${candidates.join(", ")}. Check service URL/path-base configuration.`,
  );
}

export function setup() {
  const timeout = `${timeoutMs()}ms`;
  const headers = { "Content-Type": "application/json" };
  const base = resolveApiBase(timeout);

  const checkEmailResponse = http.get(
    `${base}${CHECK_EMAIL_PATH}/${encodeURIComponent(SMOKE_EMAIL)}`,
    {
      timeout,
      tags: { endpoint: "identity-check-email" },
    },
  );

  const checkEmailBody = parseJsonSafely(checkEmailResponse);

  check(checkEmailResponse, {
    "check email endpoint reachable": (r) => r.status !== 404,
    "check email success": (r) => r.status === 200,
  });

  if (checkEmailResponse.status !== 200) {
    fail(
      `Check email failed with status ${checkEmailResponse.status}: ${(checkEmailResponse.body || "").substring(0, 300)}`,
    );
  }

  if (checkEmailBody?.isAvailable === true) {
    const createPayload = JSON.stringify({
      name: SMOKE_NAME,
      email: SMOKE_EMAIL,
      username: SMOKE_USERNAME,
      password: SMOKE_PASSWORD,
      role: SMOKE_ROLE,
    });

    const createResponse = http.post(`${base}${REGISTER_PATH}`, createPayload, {
      headers,
      timeout,
      tags: { endpoint: "identity-create-user" },
    });

    check(createResponse, {
      "create user endpoint reachable": (r) => r.status !== 404,
      "create user success": (r) => [201, 400].includes(r.status),
    });

    if (![201, 400].includes(createResponse.status)) {
      fail(
        `Create user failed with status ${createResponse.status}: ${(createResponse.body || "").substring(0, 300)}`,
      );
    }
  }

  const loginPayload = JSON.stringify({
    email: SMOKE_EMAIL,
    password: SMOKE_PASSWORD,
  });

  const loginResponse = http.post(`${base}${LOGIN_PATH}`, loginPayload, {
    headers,
    timeout,
    tags: { endpoint: "identity-login" },
  });

  const loginBody = parseJsonSafely(loginResponse);

  check(loginResponse, {
    "login endpoint reachable": (r) => r.status !== 404,
    "login success": (r) => r.status === 200,
    "login returns jwtToken": () => Boolean(loginBody?.jwtToken),
  });

  if (loginResponse.status !== 200 || !loginBody?.jwtToken) {
    fail(
      `Login failed with status ${loginResponse.status}: ${(loginResponse.body || "").substring(0, 300)}`,
    );
  }

  return {
    base,
    token: loginBody.jwtToken,
  };
}

export default function (data) {
  const base = data.base;
  const timeout = `${timeoutMs()}ms`;
  const headers = { "Content-Type": "application/json" };

  const authHeaders = {
    ...headers,
    Authorization: `Bearer ${data.token}`,
  };

  const checkEmailResponse = http.get(
    `${base}${CHECK_EMAIL_PATH}/${encodeURIComponent(SMOKE_EMAIL)}`,
    {
      timeout,
      tags: { endpoint: "identity-check-email" },
    },
  );

  const checkEmailBody = parseJsonSafely(checkEmailResponse);

  check(checkEmailResponse, {
    "check email endpoint reachable": (r) => r.status !== 404,
    "check email success": (r) => r.status === 200,
    "check email says unavailable for smoke user": () =>
      checkEmailBody?.isAvailable === false,
  });

  if (checkEmailResponse.status !== 200) {
    fail(
      `Check email failed with status ${checkEmailResponse.status}: ${(checkEmailResponse.body || "").substring(0, 300)}`,
    );
  }

  const loginPayload = JSON.stringify({
    email: SMOKE_EMAIL,
    password: SMOKE_PASSWORD,
  });

  const loginResponse = http.post(`${base}${LOGIN_PATH}`, loginPayload, {
    headers,
    timeout,
    tags: { endpoint: "identity-login" },
  });

  const loginBody = parseJsonSafely(loginResponse);

  check(loginResponse, {
    "login endpoint reachable": (r) => r.status !== 404,
    "login success": (r) => r.status === 200,
    "login returns jwtToken": () => Boolean(loginBody?.jwtToken),
  });

  if (loginResponse.status !== 200 || !loginBody?.jwtToken) {
    fail(
      `Login failed with status ${loginResponse.status}: ${(loginResponse.body || "").substring(0, 300)}`,
    );
  }

  const userListResponse = http.get(`${base}${USER_LIST_PATH}`, {
    headers: authHeaders,
    timeout,
    tags: { endpoint: "identity-user-list-auth" },
  });

  check(userListResponse, {
    "producer token accesses user list": (r) => r.status === 200,
  });

  if (userListResponse.status !== 200) {
    fail(
      `Authenticated user list failed with status ${userListResponse.status}: ${(userListResponse.body || "").substring(0, 300)}`,
    );
  }

  sleep(sleepSeconds());
}
