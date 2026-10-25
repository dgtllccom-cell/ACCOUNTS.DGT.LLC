// Shared helpers for the expense-accounting framework tests (DEV only).
import crypto from "node:crypto";

export const BASE = process.env.BASE || "http://localhost:3520";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only: BASE must be a local server");

export async function devSession(role = "super_admin", extra = {}) {
  const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role, ...extra }) });
  if (!r.ok) throw new Error(`dev-session ${role} failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
  const cookie = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session="));
  if (!cookie) throw new Error("no erp_session cookie returned");
  return cookie;
}

export function client(cookie) {
  return async function api(method, path, body, headers = {}) {
    const res = await fetch(BASE + path, {
      method,
      headers: { "content-type": "application/json", cookie, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json = null;
    const text = await res.text();
    try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
    return { status: res.status, json };
  };
}

export const uuid = () => crypto.randomUUID();

const results = [];
export function check(name, ok, detail = "") {
  results.push({ name, ok: !!ok });
  console.log(ok ? "PASS" : "FAIL", name, detail ? "· " + String(detail).slice(0, 400) : "");
}
export function summary(label) {
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n${label}: ${pass}/${results.length} passed${pass === results.length ? "" : "  <-- FAILURES"}`);
  return pass === results.length;
}

/** Runs the same async job `n` times at once; returns the settled results. */
export const race = (n, fn) => Promise.all(Array.from({ length: n }, (_, i) => fn(i).catch((e) => ({ status: 0, json: { error: String(e) } }))));
