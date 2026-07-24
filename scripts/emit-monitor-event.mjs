#!/usr/bin/env node
/**
 * Emit a Server Monitoring event into the database.
 * Safe to call from deploy scripts and GitHub Actions — it NEVER fails the pipeline
 * (always exits 0) and self-provisions the table if needed.
 *
 * Usage:
 *   node scripts/emit-monitor-event.mjs --type deploy --title "Production deploy" --severity healthy
 *   node scripts/emit-monitor-event.mjs --type build  --title "CI build passed"   --severity healthy --user "CI"
 *
 * Env: DATABASE_URL (required). GITHUB_ACTOR / branch / commit are auto-detected.
 */
import postgres from "postgres";
import { execSync } from "node:child_process";

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function git(cmd, fallback = "") {
  try {
    return execSync(`git ${cmd}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return fallback;
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[emit-monitor-event] DATABASE_URL not set — skipping.");
    return;
  }

  const eventType = arg("type", "deploy");
  const title = arg("title", "Deployment event");
  const severity = arg("severity", "healthy");
  const userName = arg("user", process.env.GITHUB_ACTOR || process.env.USER || process.env.USERNAME || "system");
  const branch = arg("branch", process.env.GITHUB_REF_NAME || git("rev-parse --abbrev-ref HEAD", "unknown"));
  const commitId = arg("commit", (process.env.GITHUB_SHA || git("rev-parse HEAD", "")).slice(0, 7));
  const details = { message: git("log -1 --pretty=%s", ""), actor: userName, at: new Date().toISOString() };

  const sql = postgres(url, { max: 1, idle_timeout: 5, connect_timeout: 15, prepare: false, ssl: "require" });
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS server_monitor_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type text NOT NULL,
        severity text NOT NULL DEFAULT 'info',
        title text NOT NULL,
        details jsonb,
        branch text,
        commit_id text,
        user_id uuid,
        user_name text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
    await sql`
      INSERT INTO server_monitor_events (event_type, severity, title, details, branch, commit_id, user_name)
      VALUES (${eventType}, ${severity}, ${title}, ${JSON.stringify(details)}::jsonb, ${branch}, ${commitId}, ${userName})`;
    console.log(`[emit-monitor-event] logged ${eventType}: ${title} (${branch}@${commitId})`);
  } catch (e) {
    console.warn("[emit-monitor-event] failed (non-fatal):", e?.message || e);
  } finally {
    try {
      await sql.end({ timeout: 5 });
    } catch {
      /* ignore */
    }
  }
}

main()
  .catch((e) => console.warn("[emit-monitor-event] error (non-fatal):", e?.message || e))
  .finally(() => process.exit(0));
