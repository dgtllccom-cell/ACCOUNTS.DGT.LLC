/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * UAE WPS & SIF — the final stage of the EXISTING payroll run.
 *
 * approved / posted / paid hr_payroll_runs  →  validate (WPS rules)  →  SIF file (EDR + SCR)
 *   →  download  →  employer uploads it to its WPS agent (bank / exchange house) OUTSIDE the ERP
 *   →  submission register: submitted → accepted / rejected / partially paid → paid.
 *
 * Nothing here posts accounting or alters the payroll run. One live SIF per run (DB-enforced);
 * every generation / download / status change is written to hr_wps_sif_events.
 *
 * SIF layout (UAE Central Bank WPS):
 *   EDR,<person id 14>,<agent routing 9>,<IBAN / account>,<pay start YYYY-MM-DD>,<pay end YYYY-MM-DD>,<days>,<fixed>,<variable>,<leave days>
 *   SCR,<establishment id 13>,<employer routing 9>,<file date YYYY-MM-DD>,<file time HHMM>,<salary month MMYYYY>,<EDR count>,<total>,AED,<employer reference>
 *   file name: <establishment id><YYMMDDHHMMSS>.SIF
 */
import { createHash } from "node:crypto";
import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg, withReadPg } from "@/lib/db/local-postgres";
import { ApiClientError } from "@/lib/api/response";
import { recordInSessionScope, sessionSqlScope, sqlScopeCondition } from "@/lib/api/scope-middleware";
import { assertEmployeeAccess } from "@/lib/services/hr-api";
import { companyInSessionScope, loadCompanyScopeRow } from "@/lib/services/company-master-service";

export type WpsIssue = { level: "error" | "warning"; code: string; employeeId?: string; employeeCode?: string; message: string };
export type SifStatus = "generated" | "downloaded" | "submitted" | "accepted" | "rejected" | "partially_paid" | "paid" | "cancelled";
export type SifAction = "submit" | "accept" | "reject" | "partially_paid" | "paid" | "cancel";

const ELIGIBLE_RUN_STATUSES = ["approved", "posted", "paid"];
const TRANSITIONS: Record<SifAction, { from: SifStatus[]; to: SifStatus }> = {
  submit: { from: ["generated", "downloaded"], to: "submitted" },
  accept: { from: ["submitted"], to: "accepted" },
  reject: { from: ["submitted"], to: "rejected" },
  partially_paid: { from: ["submitted", "accepted"], to: "partially_paid" },
  paid: { from: ["accepted", "partially_paid"], to: "paid" },
  cancel: { from: ["generated", "downloaded"], to: "cancelled" },
};

const notFound = (what: string) => new ApiClientError(`${what} not found.`, { status: 404, code: "NOT_FOUND" });
const bad = (message: string, code = "BAD_REQUEST") => new ApiClientError(message, { status: 400, code });

// ── Format rules ────────────────────────────────────────────────────────────

export const isPersonId = (v: unknown) => /^\d{14}$/.test(String(v ?? ""));
export const isRoutingCode = (v: unknown) => /^\d{9}$/.test(String(v ?? ""));
export const isEstablishmentId = (v: unknown) => /^\d{13}$/.test(String(v ?? ""));

/** UAE IBAN: AE + 2 check digits + 19 digits (23 chars), ISO 13616 mod-97 = 1. */
export function isValidUaeIban(v: unknown): boolean {
  const s = String(v ?? "").replace(/\s+/g, "").toUpperCase();
  if (!/^AE\d{21}$/.test(s)) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  const digits = moved.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of digits) rem = (rem * 10 + Number(ch)) % 97;
  return rem === 1;
}
/** WPS accepts an IBAN (bank) or an agent card / account number (exchange house). */
function accountIssue(v: unknown): string | null {
  const s = String(v ?? "").replace(/\s+/g, "").toUpperCase();
  if (!s) return "missing";
  if (s.startsWith("AE")) return isValidUaeIban(s) ? null : "invalid_iban";
  return /^[A-Z0-9]{6,23}$/.test(s) ? null : "invalid_account";
}

const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

function dubaiNow() {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
  const hh = p.hour === "24" ? "00" : p.hour;
  return { date: `${p.year}-${p.month}-${p.day}`, hhmm: `${hh}${p.minute}`, stamp: `${p.year.slice(2)}${p.month}${p.day}${hh}${p.minute}${p.second}` };
}

// ── Establishments ──────────────────────────────────────────────────────────

export async function listEstablishments(session: ErpSession) {
  const scope = sessionSqlScope(session);
  return ((await withReadPg((sql) => sql`
    SELECT w.id, w.company_id, w.establishment_id, w.employer_routing_code, w.agent_name, w.employer_reference, w.is_active,
           w.country_id, w.city_branch_id, c.name AS company_name, c.company_code, cb.name AS city_branch_name,
           (SELECT count(*) FROM public.employees e WHERE e.wps_establishment_id = w.id AND e.deleted_at IS NULL)::int AS employee_count
    FROM public.hr_wps_establishments w
    JOIN public.companies c ON c.id = w.company_id
    LEFT JOIN public.city_branches cb ON cb.id = w.city_branch_id
    WHERE w.deleted_at IS NULL AND ${sqlScopeCondition(sql, scope, "w")}
    ORDER BY c.name
  `)) ?? []) as any[];
}

export async function createEstablishment(
  session: ErpSession,
  input: { companyId: string; establishmentId: string; employerRoutingCode: string; agentName?: string | null; employerReference?: string | null; cityBranchId?: string | null; countryBranchId?: string | null }
) {
  const company = await loadCompanyScopeRow(input.companyId);
  if (!company || !companyInSessionScope(session, company)) throw notFound("Company");
  if (!isEstablishmentId(input.establishmentId)) throw bad("MOHRE establishment ID must be exactly 13 digits.", "WPS_ESTABLISHMENT_ID");
  if (!isRoutingCode(input.employerRoutingCode)) throw bad("Employer agent routing code must be exactly 9 digits.", "WPS_ROUTING_CODE");
  const uae = await isUaeCountry(company.country_id);
  if (!uae) throw bad("WPS applies to UAE companies only.", "WPS_NOT_UAE");
  if (!recordInSessionScope(session, { country_id: company.country_id, country_branch_id: input.countryBranchId ?? null, city_branch_id: input.cityBranchId ?? null })) {
    throw new ApiClientError("This branch is outside your authorized scope.", { status: 403, code: "FORBIDDEN" });
  }
  try {
    const row = ((await withReadPg((sql) => sql`
      INSERT INTO public.hr_wps_establishments (company_id, country_id, country_branch_id, city_branch_id, establishment_id, employer_routing_code, agent_name, employer_reference, created_by)
      VALUES (${input.companyId}::uuid, ${company.country_id}::uuid, ${input.countryBranchId ?? null}::uuid, ${input.cityBranchId ?? null}::uuid,
              ${input.establishmentId}, ${input.employerRoutingCode}, ${input.agentName ?? null}, ${input.employerReference ?? null}, ${session.userId}::uuid)
      RETURNING id
    `)) as any[] | null)?.[0];
    return { id: row?.id as string };
  } catch (e: any) {
    if (String(e?.code) === "23505") throw new ApiClientError("This MOHRE establishment ID is already registered.", { status: 409, code: "WPS_ESTABLISHMENT_EXISTS" });
    throw e;
  }
}

async function isUaeCountry(countryId: string | null | undefined): Promise<boolean> {
  if (!countryId) return false;
  const r = ((await withReadPg((sql) => sql`SELECT iso2 FROM public.countries WHERE id = ${countryId}::uuid`)) as any[] | null)?.[0];
  return String(r?.iso2 ?? "").toUpperCase() === "AE";
}

async function loadEstablishment(session: ErpSession, id: string) {
  const w = ((await withReadPg((sql) => sql`SELECT * FROM public.hr_wps_establishments WHERE id = ${id}::uuid AND deleted_at IS NULL`)) as any[] | null)?.[0];
  if (!w || !recordInSessionScope(session, w)) throw notFound("WPS establishment");
  return w;
}

// ── Employee WPS details ────────────────────────────────────────────────────

export async function listWpsEmployees(session: ErpSession) {
  const scope = sessionSqlScope(session);
  const rows = ((await withReadPg((sql) => sql`
    SELECT e.id, e.employee_code, COALESCE(c.customer_name, c.company_name, e.employee_code) AS name, e.salary_currency,
           e.wps_person_id, e.wps_routing_code, e.wps_iban, e.wps_establishment_id, cb.name AS city_branch_name
    FROM public.employees e
    JOIN public.countries co ON co.id = e.country_id AND upper(co.iso2) = 'AE'
    LEFT JOIN public.customers c ON c.id = e.person_master_id
    LEFT JOIN public.city_branches cb ON cb.id = e.city_branch_id
    WHERE e.deleted_at IS NULL AND ${sqlScopeCondition(sql, scope, "e")}
    ORDER BY e.employee_code
  `)) ?? []) as any[];
  return rows.map((r) => ({
    ...r,
    issues: [
      !isPersonId(r.wps_person_id) && "person_id",
      !isRoutingCode(r.wps_routing_code) && "routing_code",
      accountIssue(r.wps_iban) && "account",
      !r.wps_establishment_id && "establishment",
    ].filter(Boolean),
  }));
}

export async function setEmployeeWps(
  session: ErpSession,
  employeeId: string,
  input: { personId?: string | null; routingCode?: string | null; iban?: string | null; establishmentId?: string | null }
) {
  await assertEmployeeAccess(session, employeeId);
  const personId = input.personId?.trim() || null;
  const routing = input.routingCode?.trim() || null;
  const iban = input.iban?.replace(/\s+/g, "").toUpperCase() || null;
  if (personId && !isPersonId(personId)) throw bad("Employee person ID (labour card) must be exactly 14 digits.", "WPS_PERSON_ID");
  if (routing && !isRoutingCode(routing)) throw bad("Agent routing code must be exactly 9 digits.", "WPS_ROUTING_CODE");
  if (iban && accountIssue(iban)) throw bad(iban.startsWith("AE") ? "IBAN is not a valid UAE IBAN (AE + 21 digits, checksum)." : "Account number must be 6–23 letters / digits.", "WPS_ACCOUNT");
  if (input.establishmentId) {
    const w = await loadEstablishment(session, input.establishmentId);
    const emp = ((await withReadPg((sql) => sql`SELECT country_id FROM public.employees WHERE id = ${employeeId}::uuid`)) as any[] | null)?.[0];
    if (emp?.country_id !== w.country_id) throw bad("Establishment and employee must be in the same country.", "WPS_COUNTRY_MISMATCH");
  }
  await withReadPg((sql) => sql`
    UPDATE public.employees SET wps_person_id = ${personId}, wps_routing_code = ${routing}, wps_iban = ${iban},
           wps_establishment_id = ${input.establishmentId ?? null}::uuid, updated_at = now()
    WHERE id = ${employeeId}::uuid
  `);
  return { employeeId };
}

// ── Runs, validation, generation ────────────────────────────────────────────

export async function listEligibleRuns(session: ErpSession) {
  const scope = sessionSqlScope(session);
  return ((await withReadPg((sql) => sql`
    SELECT r.id, r.run_no, r.period_month, r.status, r.employee_count, r.total_net, r.country_id, r.city_branch_id,
           cb.name AS city_branch_name,
           (SELECT f.status FROM public.hr_wps_sif_files f WHERE f.run_id = r.id AND f.status NOT IN ('cancelled','rejected') LIMIT 1) AS sif_status
    FROM public.hr_payroll_runs r
    JOIN public.countries co ON co.id = r.country_id AND upper(co.iso2) = 'AE'
    LEFT JOIN public.city_branches cb ON cb.id = r.city_branch_id
    WHERE r.deleted_at IS NULL AND r.status = ANY(${ELIGIBLE_RUN_STATUSES}) AND ${sqlScopeCondition(sql, scope, "r")}
    ORDER BY r.period_month DESC, r.created_at DESC
  `)) ?? []) as any[];
}

async function loadRun(session: ErpSession, runId: string) {
  const run = ((await withReadPg((sql) => sql`SELECT * FROM public.hr_payroll_runs WHERE id = ${runId}::uuid AND deleted_at IS NULL`)) as any[] | null)?.[0];
  if (!run || !recordInSessionScope(session, run)) throw notFound("Payroll run");
  return run;
}

type PreparedLine = {
  employeeId: string; employeeCode: string; payrollLineId: string; personId: string; routingCode: string; account: string;
  fixed: number; variable: number; leaveDays: number; net: number;
};

/** Validates a payroll run for WPS. Errors block SIF generation; warnings do not. */
export async function validateRun(session: ErpSession, runId: string, establishmentId: string) {
  const run = await loadRun(session, runId);
  const est = await loadEstablishment(session, establishmentId);
  const issues: WpsIssue[] = [];
  if (!ELIGIBLE_RUN_STATUSES.includes(run.status)) issues.push({ level: "error", code: "run_not_approved", message: `Payroll run ${run.run_no} is '${run.status}'. Only approved, posted or paid runs can go to WPS.` });
  if (!(await isUaeCountry(run.country_id))) issues.push({ level: "error", code: "run_not_uae", message: "WPS applies to UAE payroll runs only." });
  if (!est.is_active) issues.push({ level: "error", code: "establishment_inactive", message: "The selected WPS establishment is inactive." });
  if (est.country_id !== run.country_id) issues.push({ level: "error", code: "establishment_country", message: "Establishment and payroll run are in different countries." });

  const lines = ((await withReadPg((sql) => sql`
    SELECT l.id, l.employee_id, l.net_salary, l.overtime_amount, l.bonus_amount, l.unpaid_leave_days, l.currency, l.status,
           e.employee_code, e.wps_person_id, e.wps_routing_code, e.wps_iban, e.wps_establishment_id
    FROM public.hr_payroll_run_lines l JOIN public.employees e ON e.id = l.employee_id
    WHERE l.run_id = ${runId}::uuid AND l.status <> 'excluded'
    ORDER BY e.employee_code
  `)) ?? []) as any[];
  if (!lines.length) issues.push({ level: "error", code: "no_lines", message: "The payroll run has no employee lines." });

  const prepared: PreparedLine[] = [];
  const seen = new Map<string, string>();
  for (const l of lines) {
    const tag = { employeeId: l.employee_id as string, employeeCode: l.employee_code as string };
    const net = Number(l.net_salary || 0);
    let ok = true;
    const err = (code: string, message: string) => { ok = false; issues.push({ level: "error", code, ...tag, message }); };
    if (String(l.currency || "").toUpperCase() !== "AED") err("currency", `Salary currency is ${l.currency}; WPS pays AED.`);
    if (!(net > 0)) err("net_not_positive", `Net salary ${money(net)} — WPS needs a positive amount (exclude the line if nothing is paid).`);
    if (!isPersonId(l.wps_person_id)) err("person_id", "Employee person ID (labour card, 14 digits) is missing or invalid.");
    if (!isRoutingCode(l.wps_routing_code)) err("routing_code", "Agent routing code (9 digits) is missing or invalid.");
    const acc = accountIssue(l.wps_iban);
    if (acc) err("account", acc === "missing" ? "IBAN / account is missing." : acc === "invalid_iban" ? "IBAN fails the UAE IBAN checksum." : "Account number format is invalid.");
    if (l.wps_establishment_id && l.wps_establishment_id !== establishmentId) err("establishment_mismatch", "Employee is registered under a different WPS establishment.");
    if (!l.wps_establishment_id) issues.push({ level: "warning", code: "establishment_unassigned", ...tag, message: "No establishment on the employee record — included under the selected establishment." });
    if (l.wps_person_id && seen.has(l.wps_person_id)) err("duplicate_person_id", `Person ID also used by ${seen.get(l.wps_person_id)}.`);
    if (l.wps_person_id) seen.set(l.wps_person_id, l.employee_code);
    if (!ok) continue;
    const variable = Math.min(net, Math.max(0, Number(l.overtime_amount || 0) + Number(l.bonus_amount || 0)));
    prepared.push({
      ...tag, payrollLineId: l.id, personId: l.wps_person_id, routingCode: l.wps_routing_code,
      account: String(l.wps_iban).replace(/\s+/g, "").toUpperCase(),
      fixed: Math.round((net - variable) * 100) / 100, variable: Math.round(variable * 100) / 100,
      leaveDays: Math.round(Number(l.unpaid_leave_days || 0)), net,
    });
  }
  const errors = issues.filter((i) => i.level === "error");
  return {
    run: { id: run.id, runNo: run.run_no, periodMonth: run.period_month, status: run.status },
    establishment: { id: est.id, establishmentId: est.establishment_id },
    ok: errors.length === 0,
    issues,
    summary: { lines: lines.length, ready: prepared.length, errors: errors.length, warnings: issues.length - errors.length, total: Math.round(prepared.reduce((a, p) => a + p.net, 0) * 100) / 100 },
    prepared,
    est,
    runRow: run,
  };
}

export function buildSif(args: {
  establishmentId: string; employerRoutingCode: string; employerReference: string | null; periodMonth: string; lines: PreparedLine[];
  now?: { date: string; hhmm: string; stamp: string };
}) {
  const [y, m] = args.periodMonth.split("-").map(Number);
  const start = `${args.periodMonth}-01`;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${args.periodMonth}-${String(days).padStart(2, "0")}`;
  const now = args.now ?? dubaiNow();
  const edr = args.lines.map((l) => ["EDR", l.personId, l.routingCode, l.account, start, end, days, money(l.fixed), money(l.variable), l.leaveDays].join(","));
  const total = args.lines.reduce((a, l) => a + l.fixed + l.variable, 0);
  const salaryMonth = `${String(m).padStart(2, "0")}${y}`;
  const scr = ["SCR", args.establishmentId, args.employerRoutingCode, now.date, now.hhmm, salaryMonth, args.lines.length, money(total), "AED", (args.employerReference ?? "").replace(/[,\r\n]/g, " ").trim()].join(",");
  return {
    fileName: `${args.establishmentId}${now.stamp}.SIF`,
    content: [...edr, scr].join("\r\n") + "\r\n",
    salaryMonth, start, end, days, total: Math.round(total * 100) / 100,
  };
}

export async function generateSif(session: ErpSession, runId: string, establishmentId: string) {
  const v = await validateRun(session, runId, establishmentId);
  if (!v.ok) {
    throw new ApiClientError("The payroll run does not pass WPS validation.", { status: 422, code: "WPS_VALIDATION_FAILED", details: { issues: v.issues, summary: v.summary } });
  }
  const sif = buildSif({
    establishmentId: v.est.establishment_id, employerRoutingCode: v.est.employer_routing_code, employerReference: v.est.employer_reference ?? v.runRow.run_no,
    periodMonth: v.runRow.period_month, lines: v.prepared,
  });
  const sha = createHash("sha256").update(sif.content).digest("hex");
  try {
    return await withLocalPg(async (sql) => sql.begin(async (tx: any) => {
      const n = ((await tx`SELECT count(*)::int AS n FROM public.hr_wps_sif_files`) as any[])[0].n + 1;
      const fileNo = `WPS-${new Date().getFullYear()}-${String(n).padStart(5, "0")}`;
      const f = ((await tx`
        INSERT INTO public.hr_wps_sif_files (file_no, run_id, establishment_id, salary_month, period_start, period_end, file_name, content, content_sha256,
                                             edr_count, total_amount, currency, validation, country_id, country_branch_id, city_branch_id, created_by)
        VALUES (${fileNo}, ${runId}::uuid, ${establishmentId}::uuid, ${sif.salaryMonth}, ${sif.start}::date, ${sif.end}::date, ${sif.fileName}, ${sif.content}, ${sha},
                ${v.prepared.length}, ${sif.total}, 'AED', ${tx.json({ issues: v.issues, summary: v.summary } as any)},
                ${v.runRow.country_id}::uuid, ${v.runRow.country_branch_id ?? null}::uuid, ${v.runRow.city_branch_id ?? null}::uuid, ${session.userId}::uuid)
        RETURNING id, file_no, file_name
      `) as any[])[0];
      let i = 0;
      for (const l of v.prepared) {
        i++;
        await tx`INSERT INTO public.hr_wps_sif_lines (sif_id, employee_id, payroll_line_id, person_id, routing_code, account, days_in_period, fixed_amount, variable_amount, leave_days, line_no)
                 VALUES (${f.id}::uuid, ${l.employeeId}::uuid, ${l.payrollLineId}::uuid, ${l.personId}, ${l.routingCode}, ${l.account}, ${sif.days}, ${l.fixed}, ${l.variable}, ${l.leaveDays}, ${i})`;
      }
      await tx`INSERT INTO public.hr_wps_sif_events (sif_id, action, to_status, detail, actor_id, actor_name)
               VALUES (${f.id}::uuid, 'generated', 'generated', ${tx.json({ edrCount: v.prepared.length, total: sif.total, sha256: sha, warnings: v.summary.warnings } as any)}, ${session.userId}::uuid, ${session.fullName ?? null})`;
      return { id: f.id as string, fileNo: f.file_no as string, fileName: f.file_name as string, edrCount: v.prepared.length, total: sif.total };
    }));
  } catch (e: any) {
    if (String(e?.code) === "23505") throw new ApiClientError("A live SIF already exists for this payroll run. Cancel it (or record the agent's rejection) before generating a new one.", { status: 409, code: "WPS_SIF_EXISTS" });
    throw e;
  }
}

// ── Register ────────────────────────────────────────────────────────────────

export async function listSifFiles(session: ErpSession) {
  const scope = sessionSqlScope(session);
  return ((await withReadPg((sql) => sql`
    SELECT f.id, f.file_no, f.file_name, f.salary_month, f.edr_count, f.total_amount, f.currency, f.status, f.submission_reference, f.submitted_at,
           f.agent_response, f.created_at, f.updated_at, r.run_no, r.period_month, w.establishment_id AS mohre_id, c.name AS company_name
    FROM public.hr_wps_sif_files f
    JOIN public.hr_payroll_runs r ON r.id = f.run_id
    JOIN public.hr_wps_establishments w ON w.id = f.establishment_id
    JOIN public.companies c ON c.id = w.company_id
    WHERE ${sqlScopeCondition(sql, scope, "f")}
    ORDER BY f.created_at DESC LIMIT 500
  `)) ?? []) as any[];
}

async function loadSif(session: ErpSession, id: string) {
  const f = ((await withReadPg((sql) => sql`SELECT * FROM public.hr_wps_sif_files WHERE id = ${id}::uuid`)) as any[] | null)?.[0];
  if (!f || !recordInSessionScope(session, f)) throw notFound("SIF file");
  return f;
}

export async function getSif(session: ErpSession, id: string) {
  const f = await loadSif(session, id);
  const [lines, events] = await Promise.all([
    withReadPg((sql) => sql`
      SELECT l.*, e.employee_code, COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name
      FROM public.hr_wps_sif_lines l JOIN public.employees e ON e.id = l.employee_id LEFT JOIN public.customers c ON c.id = e.person_master_id
      WHERE l.sif_id = ${id}::uuid ORDER BY l.line_no`),
    withReadPg((sql) => sql`SELECT * FROM public.hr_wps_sif_events WHERE sif_id = ${id}::uuid ORDER BY created_at DESC`),
  ]);
  const { content: _content, ...file } = f;
  return { file, lines: lines ?? [], events: events ?? [] };
}

export async function downloadSif(session: ErpSession, id: string) {
  const f = await loadSif(session, id);
  if (createHash("sha256").update(f.content).digest("hex") !== f.content_sha256) {
    throw new ApiClientError("SIF content failed its integrity check.", { status: 409, code: "WPS_SIF_INTEGRITY" });
  }
  await withLocalPg(async (sql) => sql.begin(async (tx: any) => {
    if (f.status === "generated") await tx`UPDATE public.hr_wps_sif_files SET status = 'downloaded', updated_at = now() WHERE id = ${id}::uuid AND status = 'generated'`;
    await tx`INSERT INTO public.hr_wps_sif_events (sif_id, action, from_status, to_status, actor_id, actor_name)
             VALUES (${id}::uuid, 'downloaded', ${f.status}, ${f.status === "generated" ? "downloaded" : f.status}, ${session.userId}::uuid, ${session.fullName ?? null})`;
  }));
  return { fileName: f.file_name as string, content: f.content as string };
}

export async function transitionSif(session: ErpSession, id: string, action: SifAction, input: { reference?: string | null; response?: string | null }) {
  const f = await loadSif(session, id);
  const t = TRANSITIONS[action];
  if (!t.from.includes(f.status)) {
    throw new ApiClientError(`A '${f.status}' SIF cannot be moved to '${t.to}'.`, { status: 409, code: "WPS_BAD_TRANSITION" });
  }
  const reference = input.reference?.trim() || null;
  const response = input.response?.trim() || null;
  if (action === "submit" && !reference) throw bad("Enter the WPS agent's submission reference.", "WPS_REFERENCE_REQUIRED");
  if ((action === "reject" || action === "partially_paid") && !response) throw bad("Record the agent's response.", "WPS_RESPONSE_REQUIRED");
  await withLocalPg(async (sql) => sql.begin(async (tx: any) => {
    const upd = (await tx`
      UPDATE public.hr_wps_sif_files SET status = ${t.to}, updated_at = now(),
        submission_reference = COALESCE(${reference}, submission_reference),
        submitted_at = CASE WHEN ${action} = 'submit' THEN now() ELSE submitted_at END,
        submitted_by = CASE WHEN ${action} = 'submit' THEN ${session.userId}::uuid ELSE submitted_by END,
        agent_response = COALESCE(${response}, agent_response)
      WHERE id = ${id}::uuid AND status = ${f.status}
      RETURNING id
    `) as any[];
    if (!upd.length) throw new ApiClientError("The SIF changed meanwhile — reload and try again.", { status: 409, code: "WPS_CONFLICT" });
    await tx`INSERT INTO public.hr_wps_sif_events (sif_id, action, from_status, to_status, detail, actor_id, actor_name)
             VALUES (${id}::uuid, ${action}, ${f.status}, ${t.to}, ${tx.json({ reference, response } as any)}, ${session.userId}::uuid, ${session.fullName ?? null})`;
  }));
  return { id, status: t.to };
}
