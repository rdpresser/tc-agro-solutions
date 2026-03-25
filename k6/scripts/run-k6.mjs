import { spawnSync } from "node:child_process";

const [, , testType, service, mode = "docker", ...extraArgs] = process.argv;

const scriptMap = {
  smoke: {
    identity: "smoke/identity/auth-smoke.js",
    farm: "smoke/farm/farm-smoke.js",
    "sensor-ingest": "smoke/sensor-ingest/sensor-ingest-smoke.js",
    "analytics-worker": "smoke/analytics-worker/analytics-worker-smoke.js",
  },
  load: {
    identity: "load/identity/auth-load.js",
    farm: "load/farm/farm-load.js",
    "sensor-ingest": "load/sensor-ingest/sensor-ingest-load.js",
    "analytics-worker": "load/analytics-worker/analytics-worker-load.js",
  },
};

const dockerConfig = {
  identity: {
    baseUrlKey: "IDENTITY_BASE_URL",
    baseUrl: "http://localhost:5001",
    pathKey: "IDENTITY_PATH_BASE",
    pathValue: "",
  },
  farm: {
    baseUrlKey: "FARM_BASE_URL",
    baseUrl: "http://localhost:5002",
    pathKey: "FARM_PATH_BASE",
    pathValue: "",
  },
  "sensor-ingest": {
    baseUrlKey: "SENSOR_INGEST_BASE_URL",
    baseUrl: "http://localhost:5003",
    pathKey: "SENSOR_INGEST_PATH_BASE",
    pathValue: "",
  },
  "analytics-worker": {
    baseUrlKey: "ANALYTICS_BASE_URL",
    baseUrl: "http://localhost:5004",
    pathKey: "ANALYTICS_PATH_BASE",
    pathValue: "",
  },
};

const k8sConfig = {
  identity: {
    baseUrlKey: "IDENTITY_BASE_URL",
    pathKey: "IDENTITY_PATH_BASE",
    pathValue: "/identity",
  },
  farm: {
    baseUrlKey: "FARM_BASE_URL",
    pathKey: "FARM_PATH_BASE",
    pathValue: "/farm",
  },
  "sensor-ingest": {
    baseUrlKey: "SENSOR_INGEST_BASE_URL",
    pathKey: "SENSOR_INGEST_PATH_BASE",
    pathValue: "/sensor-ingest",
  },
  "analytics-worker": {
    baseUrlKey: "ANALYTICS_BASE_URL",
    pathKey: "ANALYTICS_PATH_BASE",
    pathValue: "/analytics-worker",
  },
};

if (!testType || !service) {
  console.error(
    "Usage: npm run <smoke|load> -- <identity|farm|sensor-ingest|analytics-worker> [docker|k8s]",
  );
  process.exit(1);
}

const scriptPath = scriptMap[testType]?.[service];

if (!scriptPath) {
  console.error(`Unknown target: ${testType}/${service}`);
  console.error(
    `Available targets: ${Object.entries(scriptMap)
      .flatMap(([type, services]) =>
        Object.keys(services).map((name) => `${type}/${name}`),
      )
      .join(", ")}`,
  );
  process.exit(1);
}

if (!["docker", "k8s"].includes(mode)) {
  console.error(`Invalid mode: ${mode}. Use docker or k8s.`);
  process.exit(1);
}

const perModeConfig =
  mode === "docker" ? dockerConfig[service] : k8sConfig[service];

if (!perModeConfig) {
  console.error(`No mode configuration found for service: ${service}`);
  process.exit(1);
}

const commandArgs = ["run", scriptPath, ...extraArgs];

const env = { ...process.env };

if (mode === "docker") {
  env[perModeConfig.baseUrlKey] = perModeConfig.baseUrl;
  env[perModeConfig.pathKey] = perModeConfig.pathValue;
} else {
  const ingressBase = process.env.BASE_URL || "http://localhost";
  env[perModeConfig.baseUrlKey] = ingressBase;
  env[perModeConfig.pathKey] = perModeConfig.pathValue;
}

const result = spawnSync("k6", commandArgs, {
  stdio: "inherit",
  shell: process.platform === "win32",
  env,
});

if (result.error) {
  if (result.error.code === "ENOENT") {
    console.error(
      "k6 CLI was not found in PATH. Install k6 and ensure the `k6` command is available before running smoke/load scripts.",
    );
  } else if (result.error.code === "EACCES") {
    console.error(
      "k6 CLI was found but is not executable (permission denied). Fix execute permissions or reinstall k6.",
    );
  } else {
    console.error(`Failed to start k6: ${result.error.message}`);
  }

  process.exit(1);
}

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(1);
