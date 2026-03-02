import { localEnv } from "./dotenv.js";

function pick(name) {
  return localEnv[name] || __ENV[name];
}

function normalizePath(path) {
  if (!path) {
    return "";
  }

  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash;
}

export function baseUrl() {
  return pick("BASE_URL") || "http://localhost";
}

export function identityPathBase() {
  return normalizePath(pick("IDENTITY_PATH_BASE"));
}

export function farmPathBase() {
  return normalizePath(pick("FARM_PATH_BASE"));
}

export function sensorIngestPathBase() {
  return normalizePath(pick("SENSOR_INGEST_PATH_BASE"));
}

export function analyticsPathBase() {
  return normalizePath(pick("ANALYTICS_PATH_BASE"));
}

function serviceBaseUrl(servicePrefix, defaultPort) {
  const specific = pick(`${servicePrefix}_BASE_URL`);
  if (specific) {
    return specific;
  }

  const root = baseUrl();
  return root.includes("://") && /:\d+$/.test(root)
    ? root
    : `${root}:${defaultPort}`;
}

export function identityBaseUrl() {
  return serviceBaseUrl("IDENTITY", 5001);
}

export function farmBaseUrl() {
  return serviceBaseUrl("FARM", 5002);
}

export function sensorIngestBaseUrl() {
  return serviceBaseUrl("SENSOR_INGEST", 5003);
}

export function analyticsBaseUrl() {
  return serviceBaseUrl("ANALYTICS", 5004);
}

export function apiPrefix(pathBase = "") {
  return `${pathBase}/api`;
}

export function farmServiceBase() {
  return `${farmBaseUrl()}${farmPathBase()}`;
}

export function sensorIngestServiceBase() {
  return `${sensorIngestBaseUrl()}${sensorIngestPathBase()}`;
}

export function analyticsServiceBase() {
  return `${analyticsBaseUrl()}${analyticsPathBase()}`;
}

export function timeoutMs() {
  const value = pick("TIMEOUT_MS");
  return value ? Number(value) : 5000;
}

export function smokeDuration() {
  return pick("SMOKE_DURATION") || "30s";
}

export function sleepSeconds() {
  const value = pick("SLEEP_SECONDS");
  return value ? Number(value) : 1;
}
