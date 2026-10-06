#!/usr/bin/env node
/**
 * Points git at .githooks/ so the repo's pre-commit i18n guard runs for everyone.
 * Wired to npm `prepare`, so `npm install` sets it up automatically. Safe to re-run.
 * No-ops outside a git work tree (e.g. CI `npm ci` in a shallow checkout is fine).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";

try {
  if (!fs.existsSync(".git") && !fs.existsSync(".githooks")) process.exit(0);
  execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
  execSync("git config core.hooksPath .githooks", { stdio: "ignore" });
  try { fs.chmodSync(".githooks/pre-commit", 0o755); } catch { /* windows */ }
  console.log("✓ git hooks path set to .githooks (pre-commit i18n guard active)");
} catch {
  // not a git checkout — nothing to do
}
