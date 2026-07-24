/* eslint-disable no-console */
// Debug helper: log child_process.spawn calls to pinpoint "spawn EPERM" causes on Windows.
// Usage:
//   node -r ./scripts/log-spawn.cjs node_modules/next/dist/bin/next dev
//
// Keep this file out of production paths; it's only for local debugging.

const childProcess = require("node:child_process");

function safeToString(value) {
  try {
    if (value == null) return "";
    if (Array.isArray(value)) return value.join(" ");
    return String(value);
  } catch {
    return "";
  }
}

const originalSpawn = childProcess.spawn;
childProcess.spawn = function patchedSpawn(command, args, options) {
  console.log("[spawn]", command, safeToString(args));
  return originalSpawn.call(this, command, args, options);
};

const originalSpawnSync = childProcess.spawnSync;
childProcess.spawnSync = function patchedSpawnSync(command, args, options) {
  console.log("[spawnSync]", command, safeToString(args));
  return originalSpawnSync.call(this, command, args, options);
};

const originalExecFile = childProcess.execFile;
childProcess.execFile = function patchedExecFile(file, args, options, callback) {
  console.log("[execFile]", file, safeToString(args));
  return originalExecFile.call(this, file, args, options, callback);
};

const originalExecFileSync = childProcess.execFileSync;
childProcess.execFileSync = function patchedExecFileSync(file, args, options) {
  console.log("[execFileSync]", file, safeToString(args));
  return originalExecFileSync.call(this, file, args, options);
};

const originalFork = childProcess.fork;
childProcess.fork = function patchedFork(modulePath, args, options) {
  console.log("[fork]", modulePath, safeToString(args));
  return originalFork.call(this, modulePath, args, options);
};
