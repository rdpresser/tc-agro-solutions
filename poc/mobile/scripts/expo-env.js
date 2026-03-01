#!/usr/bin/env node

const os = require("os");
const { spawn } = require("child_process");

const [stackArg, runtimeArg, ...rest] = process.argv.slice(2);

const stack = (stackArg || "k8s").toLowerCase();
const runtime = (runtimeArg || "localhost").toLowerCase();
const expoArgs = rest.length > 0 ? rest : ["start"];
const printOnly = expoArgs.includes("--print-config");

function normalize(value) {
  return String(value || "").trim();
}

function isPrivateIpv4(address) {
  if (address.startsWith("10.")) {
    return true;
  }

  if (address.startsWith("192.168.")) {
    return true;
  }

  if (address.startsWith("172.")) {
    const second = Number(address.split(".")[1]);
    return second >= 16 && second <= 31;
  }

  return false;
}

function isVirtualInterfaceName(name) {
  const normalized = normalize(name).toLowerCase();
  return /vethernet|hyper-v|wsl|docker|virtualbox|vmware|vethernet|loopback|tailscale|zerotier|hamachi|bridge/i.test(
    normalized,
  );
}

function getInterfacePriority(name) {
  const normalized = normalize(name).toLowerCase();

  if (/wi-?fi|wlan|wireless/i.test(normalized)) {
    return 1;
  }

  if (/ethernet|^en\d|^eth\d/i.test(normalized)) {
    return 2;
  }

  return 3;
}

function detectLocalIpv4Host() {
  const interfaces = os.networkInterfaces();
  const privateCandidates = [];
  const fallbackCandidates = [];

  for (const [name, infos] of Object.entries(interfaces)) {
    if (isVirtualInterfaceName(name)) {
      continue;
    }

    for (const info of infos || []) {
      const isIpv4 = info.family === "IPv4" || info.family === 4;
      if (!isIpv4 || info.internal) {
        continue;
      }

      const address = normalize(info.address);
      if (!address) {
        continue;
      }

      const candidate = {
        address,
        priority: getInterfacePriority(name),
      };

      if (isPrivateIpv4(address)) {
        privateCandidates.push(candidate);
      } else {
        fallbackCandidates.push(candidate);
      }
    }
  }

  privateCandidates.sort((a, b) => a.priority - b.priority);
  fallbackCandidates.sort((a, b) => a.priority - b.priority);

  return privateCandidates[0]?.address || fallbackCandidates[0]?.address || "";
}

function resolveRuntimeHost(
  runtimeValue,
  explicitDeviceHost,
  explicitEmulatorHost,
) {
  if (runtimeValue === "emulator") {
    const host = normalize(explicitEmulatorHost);
    return host || "10.0.2.2";
  }

  if (runtimeValue === "device") {
    const host = normalize(explicitDeviceHost);
    if (host) {
      return host;
    }

    return detectLocalIpv4Host();
  }

  return "localhost";
}

const resolvedRuntimeHost = resolveRuntimeHost(
  runtime,
  process.env.MOBILE_DEVICE_HOST,
  process.env.MOBILE_EMULATOR_HOST,
);

function buildChildEnv(baseEnv, overrides) {
  const merged = {
    ...baseEnv,
    ...overrides,
  };

  if (process.platform !== "win32") {
    return merged;
  }

  const sanitized = {};
  const seen = new Map();

  for (const [key, value] of Object.entries(merged)) {
    if (!key || key.includes("=") || key.includes("\0")) {
      continue;
    }

    if (value == null) {
      continue;
    }

    const normalizedKey = key.toUpperCase();
    seen.set(normalizedKey, [key, String(value)]);
  }

  for (const [, [key, value]] of seen.entries()) {
    sanitized[key] = value;
  }

  return sanitized;
}

const env = buildChildEnv(process.env, {
  MOBILE_STACK: stack,
  MOBILE_RUNTIME: runtime,
  ...(runtime === "device" && resolvedRuntimeHost
    ? { MOBILE_DEVICE_HOST: resolvedRuntimeHost }
    : {}),
});

if (runtime === "device" && !normalize(process.env.MOBILE_DEVICE_HOST)) {
  if (!resolvedRuntimeHost) {
    console.error(
      "[mobile env] MOBILE_DEVICE_HOST is required for runtime=device and no local IPv4 was detected.",
    );
    console.error(
      '[mobile env] Set it manually, e.g.: $env:MOBILE_DEVICE_HOST="192.168.0.15"',
    );
    process.exit(1);
  }

  console.log(
    `[mobile env] Auto-detected MOBILE_DEVICE_HOST=${resolvedRuntimeHost}`,
  );
}

function runExpo(useShellFallback = false) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const args = ["expo", ...expoArgs];

  if (useShellFallback && process.platform === "win32") {
    const escapedArgs = args
      .map((arg) =>
        String(arg).includes(" ")
          ? `"${String(arg).replace(/\"/g, '\\"')}"`
          : String(arg),
      )
      .join(" ");

    return spawn(`npx ${escapedArgs}`, {
      stdio: "inherit",
      env,
      shell: true,
    });
  }

  return spawn(command, args, {
    stdio: "inherit",
    env,
  });
}

if (printOnly) {
  const protocol = String(env.MOBILE_PROTOCOL || "http");
  const resolvedHost = resolvedRuntimeHost;

  const isDocker = stack === "docker";
  const identity = isDocker
    ? `${protocol}://${resolvedHost}:5001`
    : `${protocol}://${resolvedHost}/identity`;
  const farm = isDocker
    ? `${protocol}://${resolvedHost}:5002`
    : `${protocol}://${resolvedHost}/farm`;
  const sensor = isDocker
    ? `${protocol}://${resolvedHost}:5003`
    : `${protocol}://${resolvedHost}/sensor-ingest`;
  const analytics = isDocker
    ? `${protocol}://${resolvedHost}:5004`
    : `${protocol}://${resolvedHost}/analytics-worker`;

  console.log("[mobile env]");
  console.log(`stack=${stack}`);
  console.log(`runtime=${runtime}`);
  console.log(`host=${resolvedHost || "(missing)"}`);
  console.log(`IDENTITY_API_BASE_URL=${identity}`);
  console.log(`FARM_API_BASE_URL=${farm}`);
  console.log(`SENSOR_API_BASE_URL=${sensor}`);
  console.log(`ANALYTICS_API_BASE_URL=${analytics}`);
  process.exit(0);
}

let fallbackUsed = false;
let child;

try {
  child = runExpo(false);
} catch (error) {
  if (process.platform === "win32" && error?.code === "EINVAL") {
    fallbackUsed = true;
    try {
      child = runExpo(true);
    } catch (fallbackError) {
      console.error("[mobile env] Failed to run Expo:", fallbackError.message);
      process.exit(1);
    }
  } else {
    console.error("[mobile env] Failed to run Expo:", error.message);
    process.exit(1);
  }
}

child.on("error", (error) => {
  if (
    !fallbackUsed &&
    process.platform === "win32" &&
    error?.code === "EINVAL"
  ) {
    fallbackUsed = true;
    child = runExpo(true);
    child.on("exit", (code) => {
      process.exit(code ?? 0);
    });
    child.on("error", (fallbackError) => {
      console.error("[mobile env] Failed to run Expo:", fallbackError.message);
      process.exit(1);
    });
    return;
  }

  console.error("[mobile env] Failed to run Expo:", error.message);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
