#!/usr/bin/env node

const path = require("path");
const { spawn } = require("child_process");

const args = process.argv.slice(2);
const childEnv = { ...process.env };

delete childEnv.MOBILE_DEVICE_HOST;
delete childEnv.mobile_device_host;

const expoEnvScript = path.join(__dirname, "expo-env.js");

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
