import http from "k6/http";
import { check, fail } from "k6";
import { identityBaseUrl } from "./env.js";
import { parseJsonSafely, requireField } from "./json.js";

const REGISTER_PATH = "/auth/register";
const LOGIN_PATH = "/auth/login";
const CHECK_EMAIL_PATH = "/auth/check-email";
const USER_BY_EMAIL_PATH = "/user/by-email";

export const SMOKE_EMAIL = "smoke@tc.agro.com";
export const SMOKE_PASSWORD = "Smoke@123";
const SMOKE_USERNAME = "smokeproducer";
const SMOKE_NAME = "Smoke Producer";
const SMOKE_ROLE = "Producer";

function trimSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function toApiBase(authBase) {
  return authBase.endsWith("/api") ? authBase : `${authBase}/api`;
}

export function resolveIdentityAuthBase(timeout) {
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
    `Unable to resolve identity auth base. Tried: ${candidates.join(", ")}. Check identity URL/path-base configuration.`,
  );
}

export function ensureSmokeProducerSession(timeout) {
  const authBase = resolveIdentityAuthBase(timeout);
  const apiBase = toApiBase(authBase);
  const headers = { "Content-Type": "application/json" };

  const checkEmailResponse = http.get(
    `${authBase}${CHECK_EMAIL_PATH}/${encodeURIComponent(SMOKE_EMAIL)}`,
    {
      timeout,
      tags: { endpoint: "identity-check-email" },
    },
  );

  const checkEmailBody = parseJsonSafely(checkEmailResponse);

  check(checkEmailResponse, {
    "identity check-email reachable": (r) => r.status !== 404,
    "identity check-email success": (r) => r.status === 200,
  });

  if (checkEmailResponse.status !== 200) {
    fail(
      `Identity check-email failed with status ${checkEmailResponse.status}: ${(checkEmailResponse.body || "").substring(0, 300)}`,
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

    const createResponse = http.post(
      `${authBase}${REGISTER_PATH}`,
      createPayload,
      {
        headers,
        timeout,
        tags: { endpoint: "identity-create-user" },
      },
    );

    check(createResponse, {
      "identity create-user reachable": (r) => r.status !== 404,
      "identity create-user success": (r) => [201, 400].includes(r.status),
    });

    if (![201, 400].includes(createResponse.status)) {
      fail(
        `Identity create-user failed with status ${createResponse.status}: ${(createResponse.body || "").substring(0, 300)}`,
      );
    }
  }

  const loginPayload = JSON.stringify({
    email: SMOKE_EMAIL,
    password: SMOKE_PASSWORD,
  });

  const loginResponse = http.post(`${authBase}${LOGIN_PATH}`, loginPayload, {
    headers,
    timeout,
    tags: { endpoint: "identity-login" },
  });

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

  const authHeaders = { Authorization: `Bearer ${loginBody.jwtToken}` };
  let userId = null;

  const userByEmailResponse = http.get(
    `${apiBase}${USER_BY_EMAIL_PATH}/${encodeURIComponent(SMOKE_EMAIL)}`,
    {
      headers: authHeaders,
      timeout,
      responseCallback: http.expectedStatuses(200, 404),
      tags: { endpoint: "identity-user-by-email" },
    },
  );

  if (userByEmailResponse.status === 200) {
    const userByEmailBody = parseJsonSafely(userByEmailResponse);
    try {
      userId = requireField(
        userByEmailBody,
        ["id", "userId"],
        "Identity user-by-email response missing user id.",
      );
    } catch (_) {
      userId = null;
    }
  }

  return {
    authBase,
    apiBase,
    token: loginBody.jwtToken,
    userId,
    email: SMOKE_EMAIL,
    password: SMOKE_PASSWORD,
  };
}
