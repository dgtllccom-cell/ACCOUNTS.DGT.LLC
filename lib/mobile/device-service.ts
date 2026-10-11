import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { withLocalPg } from "@/lib/db/local-postgres";
import { ApiClientError } from "@/lib/api/response";
import type { AppChannel } from "@/lib/mobile/app-channel";

/**
 * Mobile device approval & activation for the DGT.llc B / BS store apps.
 *
 *   install (public) → request activation (name, phone, ERP login) → Super Admin approves → one-time code → user enters code →
 *   device ACTIVE → user signs in with their ERP account (must be the account the device was approved for).
 *
 * The device is identified by a signed, httpOnly cookie issued when the request is made. Nothing here widens ERP access: an active
 * device still needs a valid ERP login, and what that login may see is decided by the existing role / scope rules.
 */
export const DEVICE_COOKIE = "dgt_device";
export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;
const CODE_TTL_HOURS = 48;
const MAX_CODE_ATTEMPTS = 5;
const MAX_OPEN_PER_IDENTIFIER = 5;

export type DeviceStatus = "pending" | "approved" | "active" | "rejected" | "revoked";
export type DeviceRow = {
  id: string; app: AppChannel; platform: string | null; device_model: string | null; os_version: string | null; app_version: string | null;
  requested_name: string; requested_phone: string | null; requested_identifier: string; request_note: string | null;
  status: DeviceStatus; code_expires_at: string | null; code_attempts: number; approved_by: string | null; approved_at: string | null;
  activated_at: string | null; bound_user_id: string | null; last_seen_at: string | null; decision_note: string | null; requested_at: string;
  /** set when the device was activated with a store-review pass; `review_ok` is false once that pass expired or was revoked */
  review_pass_id?: string | null; review_ok?: boolean | null;
};

let warned = false;
let processSecret: string | null = null;
function secret(): string {
  const s = process.env.ERP_SESSION_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (s) return s;
  if (!warned) { warned = true; console.warn("[security] ERP_SESSION_SECRET is not set: device tokens use a process-local secret."); }
  return (processSecret ??= createHmac("sha256", String(Math.random()) + Date.now()).update("dgt-device").digest("hex"));
}
const mac = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");
const safeEq = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

export function signDeviceToken(deviceId: string): string { return `${deviceId}.${mac("device:" + deviceId)}`; }
export function verifyDeviceToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const i = token.indexOf(".");
  if (i < 30) return null;
  const id = token.slice(0, i);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return safeEq(token.slice(i + 1), mac("device:" + id)) ? id : null;
}
const hashCode = (deviceId: string, code: string) => mac(`code:${deviceId}:${code}`);
export const normalizeIdentifier = (v: string) => String(v ?? "").trim().toLowerCase();

// best-effort request throttle (per process); the DB caps open requests per identifier as the durable limit
const hits = new Map<string, number[]>();
function throttle(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) throw new ApiClientError("Too many requests. Please try again later.", { status: 429, code: "RATE_LIMITED" });
  arr.push(now); hits.set(key, arr);
}

async function log(sql: any, deviceId: string, event: string, actorId: string | null, detail: string | null, ip: string | null) {
  await sql`INSERT INTO public.mobile_device_events (device_id, event, actor_id, detail, ip) VALUES (${deviceId}::uuid, ${event}, ${actorId}, ${detail}, ${ip})`;
}

// ── store-review passes ──────────────────────────────────────────────────────────────────────────────────────────
// A reviewer from Apple / Google / Samsung cannot wait for a Super Admin to approve their phone. The Super Admin issues a pass that is
// valid for ONE limited reviewer login, for a limited time and number of devices. It only replaces the "approve this phone" step: the
// reviewer must still sign in with that login, and that login's own (read-only, empty-scope) permissions decide what is visible.
const PASS_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
const PASS_LEN = 12;
const MAX_PASS_FAILURES = 10;
const hashPass = (passId: string, code: string) => mac(`pass:${passId}:${code}`);
const cleanPassCode = (v: unknown) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const formatPassCode = (c: string) => c.match(/.{1,4}/g)!.join("-");
const INVALID_PASS = () => new ApiClientError("This review code is not valid or has expired.", { status: 401, code: "REVIEW_CODE_INVALID" });

export type ReviewPassRow = {
  id: string; app: AppChannel; label: string; identifier: string; max_devices: number; used_devices: number; failed_attempts: number;
  expires_at: string; revoked_at: string | null; created_at: string;
};

export async function createReviewPass(
  input: { app: AppChannel; label: string; identifier: string; days?: number; maxDevices?: number },
  actorId: string
): Promise<{ id: string; code: string; expiresAt: string }> {
  const label = String(input.label ?? "").trim().slice(0, 80);
  const identifier = normalizeIdentifier(input.identifier);
  if (input.app !== "b" && input.app !== "bs") throw new ApiClientError("Unknown app.", { status: 422, code: "VALIDATION" });
  if (label.length < 2) throw new ApiClientError("Give the pass a name, for example “Apple App Review”.", { status: 422, code: "VALIDATION" });
  if (identifier.length < 3 || identifier.length > 160) throw new ApiClientError("Enter the reviewer’s ERP login.", { status: 422, code: "VALIDATION" });
  const days = Math.min(90, Math.max(1, Math.round(Number(input.days ?? 30)) || 30));
  const maxDevices = Math.min(20, Math.max(1, Math.round(Number(input.maxDevices ?? 6)) || 6));
  const code = Array.from({ length: PASS_LEN }, () => PASS_ALPHABET[randomInt(0, PASS_ALPHABET.length)]).join("");
  const id = (await import("node:crypto")).randomUUID();
  const rows = (await withLocalPg(
    (sql: any) => sql`
      INSERT INTO public.mobile_review_passes (id, app, label, identifier, code_hash, max_devices, expires_at, created_by)
      VALUES (${id}::uuid, ${input.app}, ${label}, ${identifier}, ${hashPass(id, code)}, ${maxDevices}, now() + (${days} || ' days')::interval, ${actorId}::uuid)
      RETURNING expires_at`
  )) as { expires_at: string }[] | null;
  if (!rows?.length) throw new ApiClientError("Could not create the review pass.", { status: 500, code: "DB" });
  return { id, code: formatPassCode(code), expiresAt: String(rows[0].expires_at) };
}

export async function listReviewPasses(): Promise<ReviewPassRow[]> {
  return ((await withLocalPg((sql: any) => sql`
    SELECT id, app, label, identifier, max_devices, used_devices, failed_attempts, expires_at, revoked_at, created_at
    FROM public.mobile_review_passes ORDER BY created_at DESC LIMIT 100`)) ?? []) as ReviewPassRow[];
}

/** Revoking a pass also blocks every device that was activated with it. */
export async function revokeReviewPass(passId: string, actorId: string): Promise<number> {
  const blocked = await withLocalPg(async (sql: any) => {
    const n = (await sql`UPDATE public.mobile_review_passes SET revoked_at = now() WHERE id = ${passId}::uuid AND revoked_at IS NULL RETURNING id`) as any[];
    if (!n.length) throw new ApiClientError("Review pass not found or already revoked.", { status: 409, code: "BAD_STATE" });
    const devs = (await sql`UPDATE public.mobile_devices SET status = 'revoked', decision_note = 'review pass revoked', updated_at = now()
                            WHERE review_pass_id = ${passId}::uuid AND status <> 'revoked' RETURNING id`) as { id: string }[];
    for (const d of devs) { await log(sql, d.id, "revoked", actorId, "review pass revoked", null); statusCache.delete(d.id); }
    return devs.length;
  });
  return blocked ?? 0;
}

/** Consumes one device slot of a valid pass for (app, identifier) and returns the pass, or throws one generic error for every failure. */
async function redeemReviewPass(app: AppChannel, identifier: string, rawCode: unknown, ip: string | null): Promise<{ id: string; label: string; created_by: string | null }> {
  throttle(`rp:${ip ?? "?"}`, 8, 60 * 60 * 1000);
  const code = cleanPassCode(rawCode);
  if (code.length !== PASS_LEN) throw INVALID_PASS();
  const passes = ((await withLocalPg((sql: any) => sql`
    SELECT * FROM public.mobile_review_passes WHERE app = ${app} AND identifier = ${identifier} AND revoked_at IS NULL AND expires_at > now()`)) ?? []) as (ReviewPassRow & { code_hash: string; created_by: string | null })[];
  const match = passes.find((p) => p.failed_attempts < MAX_PASS_FAILURES && safeEq(p.code_hash, hashPass(p.id, code)));
  if (!match) {
    if (passes.length) await withLocalPg((sql: any) => sql`UPDATE public.mobile_review_passes SET failed_attempts = failed_attempts + 1 WHERE app = ${app} AND identifier = ${identifier} AND revoked_at IS NULL`);
    throw INVALID_PASS();
  }
  const used = (await withLocalPg((sql: any) => sql`
    UPDATE public.mobile_review_passes SET used_devices = used_devices + 1
    WHERE id = ${match.id}::uuid AND used_devices < max_devices AND failed_attempts < ${MAX_PASS_FAILURES} AND revoked_at IS NULL AND expires_at > now()
    RETURNING id`)) as any[] | null;
  if (!used?.length) throw new ApiClientError("This review code has no devices left. Ask the administrator for a new one.", { status: 409, code: "REVIEW_CODE_FULL" });
  return { id: match.id, label: match.label, created_by: match.created_by };
}

export async function createDeviceRequest(
  input: { app: AppChannel; name: string; phone?: string; identifier: string; note?: string; platform?: string; model?: string; osVersion?: string; appVersion?: string; reviewCode?: string },
  ip: string | null
): Promise<{ device: DeviceRow; token: string }> {
  const name = String(input.name ?? "").trim();
  const identifier = normalizeIdentifier(input.identifier);
  if (name.length < 2 || name.length > 120) throw new ApiClientError("Enter your full name.", { status: 422, code: "VALIDATION" });
  if (identifier.length < 3 || identifier.length > 160) throw new ApiClientError("Enter your ERP e-mail or user code.", { status: 422, code: "VALIDATION" });
  if (input.app !== "b" && input.app !== "bs") throw new ApiClientError("Unknown app.", { status: 422, code: "VALIDATION" });
  throttle(`req:${ip ?? "?"}`, 10, 60 * 60 * 1000);
  // A valid store-review pass activates the device immediately (still limited to the reviewer login + the pass's device/time limits).
  const pass = String(input.reviewCode ?? "").trim() ? await redeemReviewPass(input.app, identifier, input.reviewCode, ip) : null;
  let rows: DeviceRow[] | null;
  try {
    rows = (await withLocalPg(async (sql: any) => {
      if (!pass) {
        const open = (await sql`SELECT count(*)::int AS n FROM public.mobile_devices WHERE requested_identifier = ${identifier} AND status IN ('pending','approved')`)[0].n;
        if (open >= MAX_OPEN_PER_IDENTIFIER) throw new ApiClientError("There are already pending requests for this account. Ask the administrator.", { status: 429, code: "TOO_MANY_OPEN" });
      }
      const ins = (await sql`
        INSERT INTO public.mobile_devices (app, platform, device_model, os_version, app_version, requested_name, requested_phone, requested_identifier, request_note, last_ip,
                                           status, approved_by, approved_at, activated_at, review_pass_id, decision_note)
        VALUES (${input.app}, ${(input.platform ?? "").slice(0, 20) || null}, ${(input.model ?? "").slice(0, 80) || null}, ${(input.osVersion ?? "").slice(0, 40) || null},
                ${(input.appVersion ?? "").slice(0, 20) || null}, ${name}, ${(input.phone ?? "").trim().slice(0, 40) || null}, ${identifier}, ${(input.note ?? "").trim().slice(0, 300) || null}, ${ip},
                ${pass ? "active" : "pending"}, ${pass?.created_by ?? null}, ${pass ? sql`now()` : null}, ${pass ? sql`now()` : null}, ${pass?.id ?? null}, ${pass ? "review pass: " + pass.label : null})
        RETURNING *`) as DeviceRow[];
      await log(sql, ins[0].id, "requested", null, `${input.app} ${input.platform ?? ""} ${input.model ?? ""}`.trim(), ip);
      if (pass) await log(sql, ins[0].id, "review_pass_activated", pass.created_by, pass.label, ip);
      return ins;
    })) as DeviceRow[] | null;
  } catch (e) {
    if (pass) await withLocalPg((sql: any) => sql`UPDATE public.mobile_review_passes SET used_devices = GREATEST(0, used_devices - 1) WHERE id = ${pass.id}::uuid`).catch(() => {});
    throw e;
  }
  const device = (rows as DeviceRow[])[0];
  return { device, token: signDeviceToken(device.id) };
}

export async function getDevice(deviceId: string): Promise<DeviceRow | null> {
  const r = (await withLocalPg((sql: any) => sql`
    SELECT d.*, (d.review_pass_id IS NULL OR (p.revoked_at IS NULL AND p.expires_at > now())) AS review_ok
    FROM public.mobile_devices d LEFT JOIN public.mobile_review_passes p ON p.id = d.review_pass_id
    WHERE d.id = ${deviceId}::uuid`)) as DeviceRow[] | null;
  return r?.[0] ?? null;
}

export type DeviceSummary = { status: DeviceStatus; app: AppChannel; name: string; codeExpiresAt: string | null; attemptsLeft: number };
export const summarize = (d: DeviceRow): DeviceSummary => ({ status: d.status, app: d.app, name: d.requested_name, codeExpiresAt: d.code_expires_at, attemptsLeft: Math.max(0, MAX_CODE_ATTEMPTS - d.code_attempts) });

export async function approveDevice(deviceId: string, actorId: string, note?: string): Promise<{ code: string; expiresAt: string }> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const res = await withLocalPg(async (sql: any) => {
    const cur = (await sql`SELECT status FROM public.mobile_devices WHERE id = ${deviceId}::uuid FOR UPDATE`)[0];
    if (!cur) throw new ApiClientError("Device not found.", { status: 404, code: "NOT_FOUND" });
    if (cur.status === "revoked") throw new ApiClientError("A revoked device cannot be approved again. The user must install and request again.", { status: 409, code: "REVOKED" });
    const upd = (await sql`
      UPDATE public.mobile_devices SET status = CASE WHEN status = 'active' THEN 'active' ELSE 'approved' END,
        code_hash = ${hashCode(deviceId, code)}, code_expires_at = now() + (${CODE_TTL_HOURS} || ' hours')::interval, code_attempts = 0,
        approved_by = ${actorId}::uuid, approved_at = now(), decision_note = ${note ?? null}, updated_at = now()
      WHERE id = ${deviceId}::uuid RETURNING code_expires_at`)[0];
    await log(sql, deviceId, "approved", actorId, note ?? null, null);
    return upd.code_expires_at as string;
  });
  return { code, expiresAt: String(res) };
}

export async function rejectDevice(deviceId: string, actorId: string, note?: string) {
  await withLocalPg(async (sql: any) => {
    const n = (await sql`UPDATE public.mobile_devices SET status = 'rejected', code_hash = NULL, code_expires_at = NULL, decision_note = ${note ?? null}, approved_by = ${actorId}::uuid, updated_at = now() WHERE id = ${deviceId}::uuid AND status IN ('pending','approved') RETURNING id`);
    if (!n.length) throw new ApiClientError("Only a pending or approved request can be rejected.", { status: 409, code: "BAD_STATE" });
    await log(sql, deviceId, "rejected", actorId, note ?? null, null);
  });
  statusCache.delete(deviceId);
}

export async function revokeDevice(deviceId: string, actorId: string, note?: string) {
  await withLocalPg(async (sql: any) => {
    const n = (await sql`UPDATE public.mobile_devices SET status = 'revoked', code_hash = NULL, code_expires_at = NULL, decision_note = ${note ?? null}, updated_at = now() WHERE id = ${deviceId}::uuid AND status IN ('approved','active','pending') RETURNING id`);
    if (!n.length) throw new ApiClientError("Device not found or already blocked.", { status: 409, code: "BAD_STATE" });
    await log(sql, deviceId, "revoked", actorId, note ?? null, null);
  });
  statusCache.delete(deviceId);
}

export async function verifyActivationCode(deviceId: string, code: string, ip: string | null): Promise<DeviceSummary> {
  const clean = String(code ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) throw new ApiClientError("Enter the 6-digit activation code.", { status: 422, code: "VALIDATION" });
  throttle(`code:${deviceId}`, 20, 60 * 60 * 1000);
  const out = await withLocalPg(async (sql: any) => {
    const d = (await sql`SELECT * FROM public.mobile_devices WHERE id = ${deviceId}::uuid FOR UPDATE`)[0] as (DeviceRow & { code_hash: string | null }) | undefined;
    if (!d) throw new ApiClientError("Device not found.", { status: 404, code: "NOT_FOUND" });
    if (d.status === "active") return d;
    if (d.status !== "approved" || !d.code_hash) throw new ApiClientError("This device has no active activation code. Ask the administrator.", { status: 409, code: "NO_CODE" });
    if (d.code_expires_at && new Date(d.code_expires_at).getTime() < Date.now()) throw new ApiClientError("The activation code has expired. Ask the administrator for a new one.", { status: 410, code: "CODE_EXPIRED" });
    if (d.code_attempts >= MAX_CODE_ATTEMPTS) throw new ApiClientError("Too many wrong codes. Ask the administrator for a new code.", { status: 423, code: "CODE_LOCKED" });
    if (!safeEq(d.code_hash, hashCode(deviceId, clean))) {
      const attempts = d.code_attempts + 1;
      await sql`UPDATE public.mobile_devices SET code_attempts = ${attempts}, ${attempts >= MAX_CODE_ATTEMPTS ? sql`code_hash = NULL,` : sql``} updated_at = now() WHERE id = ${deviceId}::uuid`;
      await log(sql, deviceId, attempts >= MAX_CODE_ATTEMPTS ? "code_locked" : "code_failed", null, `attempt ${attempts}`, ip);
      throw new ApiClientError(attempts >= MAX_CODE_ATTEMPTS ? "Too many wrong codes. Ask the administrator for a new code." : "That code is not correct.", { status: attempts >= MAX_CODE_ATTEMPTS ? 423 : 401, code: attempts >= MAX_CODE_ATTEMPTS ? "CODE_LOCKED" : "CODE_WRONG" });
    }
    const upd = (await sql`UPDATE public.mobile_devices SET status = 'active', activated_at = now(), code_hash = NULL, code_expires_at = NULL, code_attempts = 0, updated_at = now() WHERE id = ${deviceId}::uuid RETURNING *`)[0];
    await log(sql, deviceId, "activated", null, null, ip);
    return upd;
  });
  statusCache.delete(deviceId);
  return summarize(out as DeviceRow);
}

// ── per-request check used by getCurrentErpSession / the login route ────────────────────────────────────────────────────────────
const statusCache = new Map<string, { at: number; row: DeviceRow | null }>();
export async function getDeviceCached(deviceId: string): Promise<DeviceRow | null> {
  const hit = statusCache.get(deviceId);
  if (hit && Date.now() - hit.at < 8000) return hit.row;
  const row = await getDevice(deviceId);
  statusCache.set(deviceId, { at: Date.now(), row });
  return row;
}

export type DeviceCheck = { ok: true; deviceId: string } | { ok: false; reason: "no_device" | "not_active" | "wrong_user" | "wrong_app" };

/** Is this (app, cookie, signed-in user) an approved combination? Binds the device to the first user that signs in on it. */
export async function checkDeviceForUser(opts: { app: AppChannel; token: string | null | undefined; userId: string | null; identifier?: string | null }): Promise<DeviceCheck> {
  const deviceId = verifyDeviceToken(opts.token);
  if (!deviceId) return { ok: false, reason: "no_device" };
  const d = await getDeviceCached(deviceId);
  if (!d || d.status !== "active" || d.review_ok === false) return { ok: false, reason: "not_active" };
  if (d.app !== opts.app) return { ok: false, reason: "wrong_app" };
  if (opts.identifier && normalizeIdentifier(opts.identifier) !== d.requested_identifier) return { ok: false, reason: "wrong_user" };
  if (opts.userId) {
    if (d.bound_user_id && d.bound_user_id !== opts.userId) return { ok: false, reason: "wrong_user" };
    if (!d.bound_user_id) {
      const bound = (await withLocalPg((sql: any) => sql`UPDATE public.mobile_devices SET bound_user_id = ${opts.userId}::uuid, updated_at = now() WHERE id = ${deviceId}::uuid AND bound_user_id IS NULL RETURNING id`)) as unknown[] | null;
      if (bound?.length) await withLocalPg((sql: any) => log(sql, deviceId, "login_ok", opts.userId, "bound to first user", null));
      statusCache.delete(deviceId);
    }
    if (!d.last_seen_at || Date.now() - new Date(d.last_seen_at).getTime() > 5 * 60 * 1000) {
      void withLocalPg((sql: any) => sql`UPDATE public.mobile_devices SET last_seen_at = now() WHERE id = ${deviceId}::uuid`).catch(() => {});
    }
  }
  return { ok: true, deviceId };
}

export async function listDevices(status?: string) {
  const rows = await withLocalPg((sql: any) => status && status !== "all"
    ? sql`SELECT * FROM public.mobile_devices WHERE status = ${status} ORDER BY requested_at DESC LIMIT 300`
    : sql`SELECT * FROM public.mobile_devices ORDER BY requested_at DESC LIMIT 300`);
  return (rows ?? []) as DeviceRow[];
}

export async function deviceEvents(deviceId: string) {
  return ((await withLocalPg((sql: any) => sql`SELECT event, actor_id, detail, created_at FROM public.mobile_device_events WHERE device_id = ${deviceId}::uuid ORDER BY created_at DESC LIMIT 50`)) ?? []) as { event: string; actor_id: string | null; detail: string | null; created_at: string }[];
}

export async function recordLoginBlocked(deviceId: string | null, detail: string, ip: string | null) {
  if (!deviceId) return;
  await withLocalPg((sql: any) => log(sql, deviceId, "login_blocked", null, detail, ip)).catch(() => {});
}
