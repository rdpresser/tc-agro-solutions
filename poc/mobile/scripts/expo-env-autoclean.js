#!/usr/bin/env node

const path = require("path");
const { spawn, execSync } = require("child_process");

const args = process.argv.slice(2);
const childEnv = { ...process.env };

delete childEnv.MOBILE_DEVICE_HOST;
delete childEnv.mobile_device_host;

function getPidsUsingPort(port) {
  try {
    if (process.platform === "win32") {
      const output = execSync(`netstat -ano -p tcp | findstr :${port}`, {
        stdio: ["ignore", "pipe", "ignore"],
      }).toString();

      const pids = output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.split(/\s+/))
        .filter((parts) => parts.length >= 5)
        .filter((parts) => (parts[1] || "").endsWith(`:${port}`))
        .map((parts) => Number(parts[parts.length - 1]))
        .filter((pid) => Number.isFinite(pid) && pid > 0);

      return Array.from(new Set(pids));
    }

    const output = execSync(`lsof -ti tcp:${port}`, {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();

    const pids = output
      .split(/\r?\n/)
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isFinite(pid) && pid > 0);

    return Array.from(new Set(pids));
  } catch {
    return [];
  }
}

function killPid(pid) {
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      return true;
    }

    process.kill(pid, "SIGKILL");
    return true;
  } catch {
    return false;
  }
}

function freePortIfNeeded(port) {
  const shouldStart = args.includes("start");
  if (!shouldStart) return;

  const pids = getPidsUsingPort(port).filter((pid) => pid !== process.pid);
  if (pids.length === 0) return;

  console.log(
    `[mobile env] Port ${port} is in use by PID(s): ${pids.join(", ")}. Releasing...`,
  );

  const killed = pids.filter((pid) => killPid(pid));

  if (killed.length > 0) {
    console.log(
      `[mobile env] Released port ${port} by terminating PID(s): ${killed.join(", ")}.`,
    );
  } else {
    console.warn(
      `[mobile env] Could not terminate process(es) on port ${port}. Expo may choose another port.`,
    );
  }
}

function freePortsIfNeeded(ports) {
  const uniquePorts = Array.from(new Set(ports)).filter(
    (port) => Number.isFinite(port) && port > 0,
  );

  uniquePorts.forEach((port) => freePortIfNeeded(port));
}

const expoEnvScript = path.join(__dirname, "expo-env.js");

freePortsIfNeeded([8081, 19000, 19001, 19002]);

const child = spawn(process.execPath, [expoEnvScript, ...args], {
  stdio: "inherit",
  env: childEnv,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(
    "[mobile env] Failed to run auto-clean launcher:",
    error.message,
  );
  process.exit(1);
});
