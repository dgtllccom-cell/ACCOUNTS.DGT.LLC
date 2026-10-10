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

export async function createDeviceRequest(
  input: { app: AppChannel; name: string; phone?: string; identifier: string; note?: string; platform?: string; model?: string; osVersion?: string; appVersion?: string },
  ip: string | null
): Promise<{ device: DeviceRow; token: string }> {
  const name = String(input.name ?? "").trim();
  const identifier = normalizeIdentifier(input.identifier);
  if (name.length < 2 || name.length > 120) throw new ApiClientError("Enter your full name.", { status: 422, code: "VALIDATION" });
  if (identifier.length < 3 || identifier.length > 160) throw new ApiClientError("Enter your ERP e-mail or user code.", { status: 422, code: "VALIDATION" });
  if (input.app !== "b" && input.app !== "bs") throw new ApiClientError("Unknown app.", { status: 422, code: "VALIDATION" });
  throttle(`req:${ip ?? "?"}`, 10, 60 * 60 * 1000);
  const rows = await withLocalPg(async (sql: any) => {
    const open = (await sql`SELECT count(*)::int AS n FROM public.mobile_devices WHERE requested_identifier = ${identifier} AND status IN ('pending','approved')`)[0].n;
    if (open >= MAX_OPEN_PER_IDENTIFIER) throw new ApiClientError("There are already pending requests for this account. Ask the administrator.", { status: 429, code: "TOO_MANY_OPEN" });
    const ins = (await sql`
      INSERT INTO public.mobile_devices (app, platform, device_model, os_version, app_version, requested_name, requested_phone, requested_identifier, request_note, last_ip)
      VALUES (${input.app}, ${(input.platform ?? "").slice(0, 20) || null}, ${(input.model ?? "").slice(0, 80) || null}, ${(input.osVersion ?? "").slice(0, 40) || null},
              ${(input.appVersion ?? "").slice(0, 20) || null}, ${name}, ${(input.phone ?? "").trim().slice(0, 40) || null}, ${identifier}, ${(input.note ?? "").trim().slice(0, 300) || null}, ${ip})
      RETURNING *`) as DeviceRow[];
    await log(sql, ins[0].id, "requested", null, `${input.app} ${input.platform ?? ""} ${input.model ?? ""}`.trim(), ip);
    return ins;
  });
  const device = (rows as DeviceRow[])[0];
  return { device, token: signDeviceToken(device.id) };
}

export async function getDevice(deviceId: string): Promise<DeviceRow | null> {
  const r = (await withLocalPg((sql: any) => sql`SELECT * FROM public.mobile_devices WHERE id = ${deviceId}::uuid`)) as DeviceRow[] | null;
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
  if (!d || d.status !== "active") return { ok: false, reason: "not_active" };
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
