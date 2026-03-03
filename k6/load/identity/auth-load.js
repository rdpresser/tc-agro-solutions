import http from "k6/http";
import { check, fail, sleep } from "k6";
import { sleepSeconds, timeoutMs } from "../../shared/env.js";
import {
  ensureSmokeProducerSession,
  SMOKE_EMAIL,
  SMOKE_PASSWORD,
} from "../../shared/auth.js";
import { parseJsonSafely } from "../../shared/json.js";
import { dockerLoadOptions } from "../../shared/load-profile.js";

const LOGIN_PATH = "/auth/login";
const CHECK_EMAIL_PATH = "/auth/check-email";
const USER_LIST_PATH =
  "/user?PageNumber=1&PageSize=10&SortBy=id&SortDirection=asc";

export const options = dockerLoadOptions();

const RELOGIN_EVERY = Number(__ENV.RELOGIN_EVERY || 5);
const CHECK_EMAIL_EVERY = Number(__ENV.CHECK_EMAIL_EVERY || 10);

let cachedToken = null;

export function setup() {
  const timeout = `${timeoutMs()}ms`;
  return ensureSmokeProducerSession(timeout);
}

export default function (data) {
  const timeout = `${timeoutMs()}ms`;
  const headers = { "Content-Type": "application/json" };

  if (__ITER % CHECK_EMAIL_EVERY === 0) {
    const checkEmailResponse = http.get(
      `${data.authBase}${CHECK_EMAIL_PATH}/${encodeURIComponent(SMOKE_EMAIL)}`,
      {
        timeout,
        tags: { endpoint: "identity-check-email-load" },
      },
    );

    check(checkEmailResponse, {
      "identity load check-email success": (r) => r.status === 200,
    });

    if (checkEmailResponse.status !== 200) {
      fail(
        `Identity load check-email failed with status ${checkEmailResponse.status}: ${(checkEmailResponse.body || "").substring(0, 200)}`,
      );
    }
  }

  if (!cachedToken) {
    cachedToken = data.token;
  }

  if (__ITER % RELOGIN_EVERY === 0) {
    const loginResponse = http.post(
      `${data.authBase}${LOGIN_PATH}`,
      JSON.stringify({ email: SMOKE_EMAIL, password: SMOKE_PASSWORD }),
      {
        headers,
        timeout,
        tags: { endpoint: "identity-login-load" },
      },
    );

    const loginBody = parseJsonSafely(loginResponse);

    check(loginResponse, {
      "identity load login success": (r) => r.status === 200,
      "identity load login token": () => Boolean(loginBody?.jwtToken),
    });

    if (loginResponse.status !== 200 || !loginBody?.jwtToken) {
      fail(
        `Identity load login failed with status ${loginResponse.status}: ${(loginResponse.body || "").substring(0, 200)}`,
      );
    }

    cachedToken = loginBody.jwtToken;
  }

  const userListResponse = http.get(`${data.apiBase}${USER_LIST_PATH}`, {
    headers: {
      Authorization: `Bearer ${cachedToken}`,
    },
    timeout,
    tags: { endpoint: "identity-user-list-load" },
  });

  check(userListResponse, {
    "identity load user list success": (r) => r.status === 200,
  });

  sleep(sleepSeconds());
}
