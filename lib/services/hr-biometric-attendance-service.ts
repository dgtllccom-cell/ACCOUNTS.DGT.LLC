/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Face-ID / biometric attendance → the EXISTING office_attendance records.
 *
 *   device punch ─► hr_attendance_device_events (raw, idempotent)
 *               ─► one office_attendance row per employee per day (source 'device')
 *   payroll already reads office_attendance (overtime) — no second attendance store.
 *
 * Rules: a manual / HR-corrected attendance row is never overwritten by a device (the punch is
 * kept and marked 'ignored_manual'); an unknown biometric id is kept as 'unmatched' until HR maps
 * it to an employee; every read and write is clamped to the caller's country / branch scope.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg, withReadPg } from "@/lib/db/local-postgres";
import { ApiClientError } from "@/lib/api/response";
import { recordInSessionScope, sessionSqlScope, sqlScopeCondition } from "@/lib/api/scope-middleware";
import { assertEmployeeAccess } from "@/lib/services/hr-api";

export type DevicePunch = { biometricId: string; time: string; direction?: "in" | "out" | "unknown" | null; verifyMode?: string | null; raw?: unknown };
type Device = { id: string; device_code: string; name: string; country_id: string; country_branch_id: string | null; city_branch_id: string | null; timezone: string; is_active: boolean; api_key_hash: string };

const hash = (key: string) => createHash("sha256").update(key).digest("hex");
const newKey = () => `dgtdev_${randomBytes(24).toString("base64url")}`;

/** Local calendar date + HH:MM:SS of an instant in the device's timezone. */
function localParts(iso: string, tz: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new ApiClientError(`Invalid punch time: ${iso}`, { status: 400, code: "BAD_TIME" });
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const hh = p.hour === "24" ? "00" : p.hour;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${hh}:${p.minute}:${p.second}` };
}

// ── Devices ─────────────────────────────────────────────────────────────────

export async function registerDevice(
  session: ErpSession,
  input: { deviceCode: string; name: string; deviceType?: string; serialNo?: string | null; countryId: string; countryBranchId?: string | null; cityBranchId?: string | null; timezone?: string }
) {
  if (!recordInSessionScope(session, { country_id: input.countryId, country_branch_id: input.countryBranchId ?? null, city_branch_id: input.cityBranchId ?? null })) {
    throw new ApiClientError("This branch is outside your authorized scope.", { status: 403, code: "FORBIDDEN" });
  }
  const key = newKey();
  const row = (await withLocalPg((sql) => sql`
    INSERT INTO public.hr_attendance_devices (device_code, name, device_type, serial_no, country_id, country_branch_id, city_branch_id, timezone, api_key_hash, api_key_hint, created_by)
    VALUES (${input.deviceCode.trim()}, ${input.name.trim()}, ${input.deviceType ?? "face"}, ${input.serialNo ?? null}, ${input.countryId}::uuid,
            ${input.countryBranchId ?? null}::uuid, ${input.cityBranchId ?? null}::uuid, ${input.timezone || "Asia/Dubai"}, ${hash(key)}, ${key.slice(-4)}, ${session.userId}::uuid)
    RETURNING id, device_code, name
  `)) as any[] | null;
  // The plain key is returned exactly once; only its hash is stored.
  return { device: row?.[0], apiKey: key };
}

export async function rotateDeviceKey(session: ErpSession, deviceId: string) {
  await loadDeviceInScope(session, deviceId);
  const key = newKey();
  await withLocalPg((sql) => sql`UPDATE public.hr_attendance_devices SET api_key_hash = ${hash(key)}, api_key_hint = ${key.slice(-4)}, updated_at = now() WHERE id = ${deviceId}::uuid`);
  return { apiKey: key };
}

export async function setDeviceActive(session: ErpSession, deviceId: string, active: boolean) {
  await loadDeviceInScope(session, deviceId);
  await withLocalPg((sql) => sql`UPDATE public.hr_attendance_devices SET is_active = ${active}, updated_at = now() WHERE id = ${deviceId}::uuid`);
}

async function loadDeviceInScope(session: ErpSession, deviceId: string): Promise<Device> {
  const d = ((await withReadPg((sql) => sql`SELECT * FROM public.hr_attendance_devices WHERE id = ${deviceId}::uuid AND deleted_at IS NULL`)) as any[] | null)?.[0];
  if (!d || !recordInSessionScope(session, d)) throw new ApiClientError("Device not found.", { status: 404, code: "NOT_FOUND" });
  return d;
}

export async function listDevices(session: ErpSession) {
  const scope = sessionSqlScope(session);
  return ((await withReadPg((sql) => sql`
    SELECT d.id, d.device_code, d.name, d.device_type, d.serial_no, d.country_id, d.city_branch_id, d.timezone, d.api_key_hint, d.is_active, d.last_seen_at, d.created_at,
           c.name AS country_name, cb.name AS city_branch_name,
           (SELECT count(*) FROM public.hr_attendance_device_events e WHERE e.device_id = d.id)::int AS event_count,
           (SELECT count(*) FROM public.hr_attendance_device_events e WHERE e.device_id = d.id AND e.status = 'unmatched')::int AS unmatched_count
    FROM public.hr_attendance_devices d
    LEFT JOIN public.countries c ON c.id = d.country_id
    LEFT JOIN public.city_branches cb ON cb.id = d.city_branch_id
    WHERE d.deleted_at IS NULL AND ${sqlScopeCondition(sql, scope, "d")}
    ORDER BY d.created_at DESC
  `)) ?? []) as any[];
}

/** Device push authentication: device code + key (constant-time hash compare). */
export async function authenticateDevice(deviceCode: string | null, apiKey: string | null): Promise<Device> {
  if (!deviceCode || !apiKey) throw new ApiClientError("Device credentials are required.", { status: 401, code: "DEVICE_AUTH" });
  const d = ((await withReadPg((sql) => sql`SELECT * FROM public.hr_attendance_devices WHERE lower(device_code) = lower(${deviceCode}) AND deleted_at IS NULL LIMIT 1`)) as any[] | null)?.[0] as Device | undefined;
  const a = Buffer.from(hash(apiKey));
  const b = Buffer.from(d?.api_key_hash ?? "0".repeat(64));
  if (!d || a.length !== b.length || !timingSafeEqual(a, b)) throw new ApiClientError("Invalid device credentials.", { status: 401, code: "DEVICE_AUTH" });
  if (!d.is_active) throw new ApiClientError("This device is disabled.", { status: 403, code: "DEVICE_DISABLED" });
  return d;
}

// ── Ingestion ───────────────────────────────────────────────────────────────

export async function ingestPunches(device: Device, punches: DevicePunch[], source: "device" | "import" = "device") {
  if (!punches.length) return { received: 0, stored: 0, duplicates: 0, unmatched: 0, attendanceUpdated: 0 };
  if (punches.length > 5000) throw new ApiClientError("Too many punches in one request (max 5000).", { status: 413, code: "TOO_MANY" });
  const result = await withLocalPg(async (sql) => {
    const ids = [...new Set(punches.map((p) => String(p.biometricId).trim()).filter(Boolean))];
    const emps = (await sql`
      SELECT id, biometric_id FROM public.employees
      WHERE deleted_at IS NULL AND country_id = ${device.country_id}::uuid AND biometric_id = ANY(${ids})
    `) as any[];
    const byBio = new Map(emps.map((e) => [String(e.biometric_id), e.id as string]));
    let stored = 0, unmatched = 0;
    const touched = new Set<string>();
    for (const p of punches) {
      const bio = String(p.biometricId ?? "").trim();
      if (!bio || !p.time) continue;
      const { date } = localParts(p.time, device.timezone);
      const empId = byBio.get(bio) ?? null;
      const dir = p.direction === "in" || p.direction === "out" ? p.direction : "unknown";
      const ins = (await sql`
        INSERT INTO public.hr_attendance_device_events
          (device_id, biometric_id, employee_id, event_time, event_local_date, direction, verify_mode, status, source, raw, country_id, country_branch_id, city_branch_id)
        VALUES (${device.id}::uuid, ${bio}, ${empId}::uuid, ${new Date(p.time).toISOString()}::timestamptz, ${date}::date, ${dir}, ${p.verifyMode ?? null},
                ${empId ? "pending" : "unmatched"}, ${source}, ${p.raw === undefined ? null : sql.json(p.raw as any)},
                ${device.country_id}::uuid, ${device.country_branch_id}::uuid, ${device.city_branch_id}::uuid)
        ON CONFLICT (device_id, biometric_id, event_time) DO NOTHING
        RETURNING id
      `) as any[];
      if (!ins.length) continue;
      stored++;
      if (empId) touched.add(`${empId}|${date}`);
      else unmatched++;
    }
    await sql`UPDATE public.hr_attendance_devices SET last_seen_at = now() WHERE id = ${device.id}::uuid`;
    return { stored, unmatched, touched: [...touched] };
  });
  let attendanceUpdated = 0;
  for (const k of result?.touched ?? []) {
    const [emp, date] = k.split("|");
    if (await rollupDay(emp, date, device.timezone)) attendanceUpdated++;
  }
  return { received: punches.length, stored: result?.stored ?? 0, duplicates: punches.length - (result?.stored ?? 0), unmatched: result?.unmatched ?? 0, attendanceUpdated };
}

/**
 * Roll one employee-day of punches into office_attendance. First 'in' (else earliest) = check-in,
 * last 'out' (else latest, when more than one punch) = check-out. Work hours, late, early-leave and
 * overtime are NOT computed here: the existing hr_calc_attendance trigger derives them from the
 * employee's shift, exactly as for manual rows. Returns true when the attendance row was written.
 */
export async function rollupDay(employeeId: string, date: string, tz: string): Promise<boolean> {
  return !!(await withLocalPg(async (sql) => {
    const ev = (await sql`
      SELECT id, event_time, direction, source FROM public.hr_attendance_device_events
      WHERE employee_id = ${employeeId}::uuid AND event_local_date = ${date}::date AND status IN ('pending', 'applied', 'ignored_manual')
      ORDER BY event_time
    `) as any[];
    if (!ev.length) return false;
    const emp = ((await sql`SELECT country_id, city_branch_id FROM public.employees WHERE id = ${employeeId}::uuid`) as any[])[0];
    const ins = ev.filter((e) => e.direction === "in");
    const outs = ev.filter((e) => e.direction === "out");
    const first = (ins[0] ?? ev[0]).event_time;
    const last = outs.length ? outs[outs.length - 1].event_time : ev.length > 1 ? ev[ev.length - 1].event_time : null;
    const cin = localParts(new Date(first).toISOString(), tz).time;
    const cout = last ? localParts(new Date(last).toISOString(), tz).time : null;
    // 'import' only when every punch of the day came from an uploaded device log.
    const source = ev.every((e) => e.source === "import") ? "import" : "device";

    const existing = ((await sql`
      SELECT id, source FROM public.office_attendance WHERE employee_id = ${employeeId}::uuid AND attendance_date = ${date}::date AND deleted_at IS NULL
      ORDER BY created_at LIMIT 1
    `) as any[])[0];
    const evIds = ev.map((e) => e.id);
    if (existing && existing.source !== "device" && existing.source !== "import") {
      // A manual / corrected row is authoritative — keep it, keep the punches as evidence.
      await sql`UPDATE public.hr_attendance_device_events SET status = 'ignored_manual', attendance_id = ${existing.id}::uuid, processed_at = now() WHERE id = ANY(${evIds}::uuid[])`;
      return false;
    }
    let attId: string;
    if (existing) {
      await sql`UPDATE public.office_attendance SET check_in = ${cin}::time, check_out = ${cout}::time, status = 'Present', source = ${source}, updated_at = now()
                WHERE id = ${existing.id}::uuid`;
      attId = existing.id;
    } else {
      const r = (await sql`
        INSERT INTO public.office_attendance (employee_id, attendance_date, check_in, check_out, status, country_id, city_branch_id, source, notes)
        VALUES (${employeeId}::uuid, ${date}::date, ${cin}::time, ${cout}::time, 'Present',
                ${emp?.country_id ?? null}::uuid, ${emp?.city_branch_id ?? null}::uuid, ${source}, ${"Face-ID / biometric device"})
        RETURNING id
      `) as any[];
      attId = r[0].id;
    }
    await sql`UPDATE public.hr_attendance_device_events SET status = 'applied', attendance_id = ${attId}::uuid, processed_at = now() WHERE id = ANY(${evIds}::uuid[])`;
    return true;
  }));
}

// ── HR actions ──────────────────────────────────────────────────────────────

export async function listDeviceEvents(session: ErpSession, opts: { status?: string | null; limit?: number } = {}) {
  const scope = sessionSqlScope(session);
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 1000);
  return ((await withReadPg((sql) => sql`
    SELECT e.id, e.biometric_id, e.employee_id, e.event_time, e.event_local_date, e.direction, e.verify_mode, e.status, e.source, e.attendance_id,
           d.device_code, d.name AS device_name, emp.employee_code
    FROM public.hr_attendance_device_events e
    JOIN public.hr_attendance_devices d ON d.id = e.device_id
    LEFT JOIN public.employees emp ON emp.id = e.employee_id
    WHERE ${sqlScopeCondition(sql, scope, "e")} AND (${opts.status ?? null}::text IS NULL OR e.status = ${opts.status ?? null})
    ORDER BY e.event_time DESC LIMIT ${limit}
  `)) ?? []) as any[];
}

/** HR assigns a biometric id to an employee; unmatched punches for that id (same country) are applied. */
export async function mapBiometricId(session: ErpSession, employeeId: string, biometricId: string) {
  await assertEmployeeAccess(session, employeeId);
  const bio = biometricId.trim();
  if (!bio) throw new ApiClientError("Biometric id is required.", { status: 400, code: "BAD_REQUEST" });
  const touched = await withLocalPg(async (sql) => {
    const emp = ((await sql`SELECT id, country_id FROM public.employees WHERE id = ${employeeId}::uuid AND deleted_at IS NULL`) as any[])[0];
    const clash = ((await sql`SELECT employee_code FROM public.employees WHERE country_id = ${emp.country_id} AND biometric_id = ${bio} AND id <> ${employeeId}::uuid AND deleted_at IS NULL LIMIT 1`) as any[])[0];
    if (clash) throw new ApiClientError(`Biometric id ${bio} is already assigned to ${clash.employee_code}.`, { status: 409, code: "BIOMETRIC_TAKEN" });
    await sql`UPDATE public.employees SET biometric_id = ${bio}, updated_at = now() WHERE id = ${employeeId}::uuid`;
    const rows = (await sql`
      UPDATE public.hr_attendance_device_events e SET employee_id = ${employeeId}::uuid, status = 'pending'
      FROM public.hr_attendance_devices d
      WHERE d.id = e.device_id AND d.country_id = ${emp.country_id} AND e.biometric_id = ${bio} AND e.status = 'unmatched'
      RETURNING e.event_local_date::text AS date, d.timezone
    `) as any[];
    return rows;
  });
  const days = new Map<string, string>();
  for (const r of touched ?? []) days.set(r.date, r.timezone);
  let updated = 0;
  for (const [date, tz] of days) if (await rollupDay(employeeId, date, tz)) updated++;
  return { employeeId, biometricId: bio, eventsMatched: touched?.length ?? 0, attendanceUpdated: updated };
}

/** HR uploads a device's exported log (CSV: biometric_id,datetime[,direction]) for a device in scope. */
export async function importDeviceLog(session: ErpSession, deviceId: string, csv: string) {
  const device = await loadDeviceInScope(session, deviceId);
  const punches: DevicePunch[] = [];
  for (const line of csv.split(/\r?\n/)) {
    const cells = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cells.length < 2 || !cells[0] || /^(biometric|user|id|emp)/i.test(cells[0])) continue;
    // Times without an offset are device-local and are interpreted in the device's timezone.
    const t = cells[1].includes("T") ? cells[1] : cells[1].replace(" ", "T");
    punches.push({ biometricId: cells[0], time: toInstant(t, device.timezone), direction: (cells[2]?.toLowerCase() as any) || "unknown", raw: { line } });
  }
  return ingestPunches(device, punches, "import");
}

/** A wall-clock "YYYY-MM-DDTHH:MM[:SS]" in `tz` → ISO instant (no offset in the input = device-local). */
export function toInstant(local: string, tz: string): string {
  if (/Z|[+-]\d{2}:?\d{2}$/.test(local)) return new Date(local).toISOString();
  const guess = new Date(local + "Z");
  if (Number.isNaN(guess.getTime())) throw new ApiClientError(`Invalid time in log: ${local}`, { status: 400, code: "BAD_TIME" });
  const p = localParts(guess.toISOString(), tz);
  const shown = new Date(`${p.date}T${p.time}Z`).getTime();
  return new Date(guess.getTime() - (shown - guess.getTime())).toISOString();
}
