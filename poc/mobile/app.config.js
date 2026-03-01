const { expo } = require("./app.json");

function normalize(value, fallback) {
  const normalized = String(value || "").trim();
  return normalized.length > 0 ? normalized : fallback;
}

function resolveRuntimeHost(runtime, deviceHost, emulatorHost) {
  if (runtime === "emulator") {
    return normalize(emulatorHost, "10.0.2.2");
  }

  if (runtime === "device") {
    const host = normalize(deviceHost, "");
    if (!host) {
      throw new Error(
        "MOBILE_DEVICE_HOST is required when MOBILE_RUNTIME=device (example: 192.168.0.15)",
      );
    }
    return host;
  }

  return "localhost";
}

function buildK8sUrls(protocol, host) {
  const origin = `${protocol}://${host}`;
  return {
    API_ENV: "k8s",
    IDENTITY_API_BASE_URL: `${origin}/identity`,
    FARM_API_BASE_URL: `${origin}/farm`,
    SENSOR_API_BASE_URL: `${origin}/sensor-ingest`,
    ANALYTICS_API_BASE_URL: `${origin}/analytics-worker`,
  };
}

function buildDockerUrls(protocol, host) {
  const origin = `${protocol}://${host}`;
  return {
    API_ENV: "docker",
    IDENTITY_API_BASE_URL: `${origin}:5001`,
    FARM_API_BASE_URL: `${origin}:5002`,
    SENSOR_API_BASE_URL: `${origin}:5003`,
    ANALYTICS_API_BASE_URL: `${origin}:5004`,
  };
}

module.exports = () => {
  const stack = normalize(process.env.MOBILE_STACK, "k8s").toLowerCase();
  const runtime = normalize(
    process.env.MOBILE_RUNTIME,
    "localhost",
  ).toLowerCase();
  const protocol = normalize(process.env.MOBILE_PROTOCOL, "http").toLowerCase();
  const signalrEnabled = normalize(process.env.MOBILE_SIGNALR_ENABLED, "true");

  const host = resolveRuntimeHost(
    runtime,
    process.env.MOBILE_DEVICE_HOST,
    process.env.MOBILE_EMULATOR_HOST,
  );

  const profileConfig =
    stack === "docker"
      ? buildDockerUrls(protocol, host)
      : buildK8sUrls(protocol, host);

  return {
    expo: {
      ...expo,
      extra: {
        ...expo.extra,
        ...profileConfig,
        SIGNALR_ENABLED: signalrEnabled,
        MOBILE_STACK: stack,
        MOBILE_RUNTIME: runtime,
        MOBILE_HOST: host,
      },
    },
  };
};
