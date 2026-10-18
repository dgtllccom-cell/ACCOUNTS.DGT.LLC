#!/usr/bin/env node
/**
 * Points git at .githooks/ so the repo's pre-commit i18n guard runs for everyone.
 * Wired to npm `prepare`, so `npm install` sets it up automatically. Safe to re-run.
 * No-ops outside a git work tree (e.g. CI `npm ci` in a shallow checkout is fine).
 *
 * It must NEVER overwrite a protected hooks path. On the live server `core.hooksPath` points at a root-owned directory that holds the
 * "reference-transaction" lock (docs/production-deployment-control.md). This script used to force `.githooks` on every `npm install`
 * (including the one inside a deploy build), which silently removed that lock — the cause of the ungated Production updates of 2026-10-18.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";

try {
  if (!fs.existsSync(".git") && !fs.existsSync(".githooks")) process.exit(0);
  execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
  let current = "";
  try { current = execSync("git config --local --get core.hooksPath", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { /* not set */ }
  if (current && current !== ".githooks") {
    console.log(`git hooks path left as "${current}" (protected — not overwritten)`);
    process.exit(0);
  }
  if (fs.existsSync("/etc/dgt-deploy/env")) {
    console.log("production server: git hooks path is managed by the deploy gate — not changed");
    process.exit(0);
  }
  execSync("git config core.hooksPath .githooks", { stdio: "ignore" });
  try { fs.chmodSync(".githooks/pre-commit", 0o755); } catch { /* windows */ }
  console.log("✓ git hooks path set to .githooks (pre-commit i18n guard active)");
} catch {
  // not a git checkout — nothing to do
}
