/**
 * Single resolver for database connection strings used by maintenance scripts.
 *
 * SECURITY: connection strings (which embed the DB password) must NEVER be
 * written as string literals in tracked files. They are read from the
 * environment / an untracked .env(.local) only.
 *
 * Usage:
 *   import { resolveDbUrl } from "./lib/prod-db-url.mjs";
 *   const sql = postgres(resolveDbUrl("prod"));   // or "dev" / "local"
 *
 * Env keys (set in .env.local — see .env.example):
 *   PROD_DATABASE_URL   production pooler URL
 *   DEV_DATABASE_URL    dev pooler URL
 *   DATABASE_URL        default (used by db-apply-all-migrations.mjs)
 */
import fs from "node:fs";

function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    env[t.slice(0, i)] = t.slice(i + 1).replace(/^"|"$/g, "");
  }
  return env;
}

function loadEnv() {
  return {
    ...parseEnvFile(".env"),
    ...parseEnvFile(".env.local"),
    ...process.env,
  };
}

/**
 * @param {"prod"|"dev"|"local"} target
 * @returns {string} connection URL
 */
export function resolveDbUrl(target = "local") {
  const env = loadEnv();
  const key =
    target === "prod" ? "PROD_DATABASE_URL" :
    target === "dev" ? "DEV_DATABASE_URL" :
    "DATABASE_URL";
  const url = env[key] || (target === "local" ? env.DATABASE_URL : "");
  if (!url) {
    console.error(
      `[prod-db-url] ${key} is not set. Add it to .env.local (never commit it). ` +
      `See .env.example and docs/security-remediation-db-credentials.md.`
    );
    process.exit(1);
  }
  return url;
}

export default resolveDbUrl;
