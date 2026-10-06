/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

const cwd = process.cwd();
const targets = [
  path.join(cwd, ".sdfghj"),
  path.join(cwd, "sdfghj.zip")
];

console.log(`[cleanup] Scanning directory: ${cwd}`);

targets.forEach((target) => {
  if (fs.existsSync(target)) {
    try {
      console.log(`[cleanup] Found target: ${target}`);
      fs.rmSync(target, { recursive: true, force: true });
      console.log(`[cleanup] Successfully removed: ${target}`);
    } catch (err) {
      console.error(`[cleanup] Failed to remove ${target}:`, err.message);
    }
  } else {
    console.log(`[cleanup] Target not found (already deleted): ${target}`);
  }
});

console.log("[cleanup] Completed.");
