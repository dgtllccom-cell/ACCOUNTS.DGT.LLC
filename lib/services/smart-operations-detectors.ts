/**
 * Smart Operations — Control Checks (READ-ONLY detectors).
 *
 * Each detector scans an authoritative table for one kind of problem and returns findings that
 * deep-link to the source screen. Detectors never edit, post, reverse or delete anything; any
 * correction goes through the owning module and its existing approval / permission workflow.
 * Every query is clamped to the caller's country / branch scope with the ONE scope rule.
 *
 * Severity: critical · needs_review · reminder.  A detector with zero findings reports "resolved".
 */
import type { ErpSession } from "@/lib/auth/session";
import { withReadPg } from "@/lib/db/local-postgres";
import { sessionSqlScope, sqlScopeCondition, type SqlScope } from "@/lib/api/scope-middleware";

export type Severity = "critical" | "needs_review" | "reminder";
export type Finding = {
  detector: string;
  severity: Severity;
  reference: string;
  detail: string | null;
  date: string | null;
  href: string;
  country: string | null;
};
export type DetectorResult = { detector: string; group: string; severity: Severity; count: number; findings: Finding[] };

const LIMIT = 25;
const iso = (v: unknown) => (v ? (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10)) : null);

type Def = { detector: string; group: string; severity: Severity; run: (sql: any, scope: SqlScope, session: ErpSession) => Promise<any[]>; map: (r: any) => Omit<Finding, "detector" | "severity"> };

/** Country-level master data (companies): global sees all, everyone else their countries. */
function countryOnly(sql: any, session: ErpSession, col: string) {
  if (session.isSuperAdmin || session.roles?.includes("super_admin_reports")) return sql`TRUE`;
  return sql`${sql.unsafe(col)} = ANY(${session.countryIds ?? []}::uuid[])`;
}

const DETECTORS: Def[] = [
  // ── Accounting integrity ──────────────────────────────────────────────
  {
    detector: "unbalanced_entry", group: "accounting", severity: "critical",
    run: (sql, scope) => sql`
      SELECT e.id, coalesce(e.voucher_no, e.journal_no, e.entry_serial) AS ref, e.entry_date, c.name AS country,
             sum(coalesce(l.debit,0)) AS dr, sum(coalesce(l.credit,0)) AS cr
      FROM public.roznamcha_entries e JOIN public.roznamcha_lines l ON l.roznamcha_entry_id = e.id
      LEFT JOIN public.countries c ON c.id = e.country_id
      WHERE e.deleted_at IS NULL AND ${sqlScopeCondition(sql, scope, "e")}
      GROUP BY e.id, c.name
      HAVING abs(sum(coalesce(l.debit,0)) - sum(coalesce(l.credit,0))) > 0.01
         -- Cash-book (Roznamcha) cash payment / receipt lines carry an implicit cash side by design;
         -- only journal-style entries must balance on their own lines.
         AND NOT bool_and(coalesce(l.payment_entry_type::text,'') IN ('cash_payment','cash_receipt'))
      ORDER BY e.entry_date DESC LIMIT ${LIMIT}`,
    map: (r) => ({ reference: r.ref ?? r.id, detail: `DR ${Number(r.dr).toFixed(2)} ≠ CR ${Number(r.cr).toFixed(2)}`, date: iso(r.entry_date), href: `/dashboard/roznamcha/reports/all?q=${encodeURIComponent(r.ref ?? "")}`, country: r.country }),
  },
  {
    detector: "missing_fx_rate", group: "accounting", severity: "critical",
    run: (sql, scope) => sql`
      SELECT e.id, coalesce(e.voucher_no, e.entry_serial) AS ref, e.entry_date, e.original_currency_code AS cur, c.name AS country
      FROM public.roznamcha_entries e LEFT JOIN public.countries c ON c.id = e.country_id
      WHERE e.deleted_at IS NULL AND e.original_currency_code IS NOT NULL AND e.original_currency_code <> coalesce(c.currency_code, e.original_currency_code)
        AND EXISTS (SELECT 1 FROM public.roznamcha_lines l WHERE l.roznamcha_entry_id = e.id AND coalesce(l.usd_rate,0) <= 0)
        AND ${sqlScopeCondition(sql, scope, "e")}
      ORDER BY e.entry_date DESC LIMIT ${LIMIT}`,
    map: (r) => ({ reference: r.ref ?? r.id, detail: r.cur, date: iso(r.entry_date), href: `/dashboard/roznamcha/reports/all?q=${encodeURIComponent(r.ref ?? "")}`, country: r.country }),
  },
  {
    detector: "duplicate_invoice", group: "accounting", severity: "critical",
    run: (sql, scope) => sql`
      SELECT lower(form_data->'form'->>'billNo') AS bill, string_agg(purchase_order_no, ', ' ORDER BY created_at) AS refs, count(*) AS n, max(created_at) AS last_at,
             (array_agg(country_id))[1] AS country_id
      FROM public.purchase_orders po
      WHERE po.deleted_at IS NULL AND coalesce(form_data->'form'->>'billNo','') <> '' AND ${sqlScopeCondition(sql, scope, "po")}
      GROUP BY lower(form_data->'form'->>'billNo'), coalesce(supplier_company_id::text, form_data->'form'->>'supplierName')
      HAVING count(*) > 1 ORDER BY max(created_at) DESC LIMIT ${LIMIT}`,
    map: (r) => ({ reference: r.bill, detail: r.refs, date: iso(r.last_at), href: `/dashboard/purchase/purchase-booking-journal-report?q=${encodeURIComponent(r.bill ?? "")}`, country: null }),
  },
  {
    detector: "missing_posting", group: "accounting", severity: "needs_review",
    run: (sql, scope) => sql`
      SELECT po.purchase_order_no AS ref, po.created_at, c.name AS country, 'purchase' AS kind
      FROM public.purchase_orders po LEFT JOIN public.countries c ON c.id = po.country_id
      WHERE po.deleted_at IS NULL AND coalesce(po.ledger_posting_status,'unposted') <> 'posted'
        AND coalesce(po.status,'') NOT IN ('draft','cancelled') AND po.created_at < now() - interval '3 days'
        AND ${sqlScopeCondition(sql, scope, "po")}
      UNION ALL
      SELECT so.sales_order_no, so.created_at, c.name, 'sales'
      FROM public.sales_orders so LEFT JOIN public.countries c ON c.id = so.country_id
      WHERE so.deleted_at IS NULL AND coalesce(so.ledger_posting_status,'unposted') <> 'posted'
        AND coalesce(so.sales_status,'') NOT IN ('draft','cancelled') AND so.created_at < now() - interval '3 days'
        AND ${sqlScopeCondition(sql, scope, "so")}
      ORDER BY 2 DESC LIMIT ${LIMIT}`,
    map: (r) => ({ reference: r.ref, detail: r.kind, date: iso(r.created_at), href: r.kind === "sales" ? `/dashboard/sales/sales-booking-journal-report?q=${encodeURIComponent(r.ref ?? "")}` : `/dashboard/purchase/purchase-booking-journal-report?q=${encodeURIComponent(r.ref ?? "")}`, country: r.country }),
  },
  {
    detector: "payment_without_posting", group: "accounting", severity: "needs_review",
    run: (sql, scope) => sql`
      SELECT p.id, coalesce(p.reference_no, p.entry_serial, po.purchase_order_no) AS ref, p.entry_date, p.amount, p.currency_code, c.name AS country
      FROM public.purchase_order_payments p JOIN public.purchase_orders po ON po.id = p.purchase_order_id
      LEFT JOIN public.countries c ON c.id = po.country_id
      WHERE p.deleted_at IS NULL AND p.status = 'posted' AND p.roznamcha_entry_id IS NULL AND ${sqlScopeCondition(sql, scope, "po")}
      ORDER BY p.entry_date DESC LIMIT ${LIMIT}`,
    map: (r) => ({ reference: r.ref, detail: `${r.currency_code ?? ""} ${Number(r.amount ?? 0).toLocaleString("en-US")}`, date: iso(r.entry_date), href: `/dashboard/journal/purchase-order-payment/history?q=${encodeURIComponent(r.ref ?? "")}`, country: r.country }),
  },
  {
    detector: "settlement_discrepancy", group: "accounting", severity: "needs_review",
    run: (sql, scope) => sql`
      SELECT ev.* FROM public.settlement_exceptions_v ev WHERE ${sqlScopeCondition(sql, scope, "ev")} LIMIT ${LIMIT}`,
    map: (r) => ({ reference: r.source_reference_no ?? r.reference_no ?? r.id ?? "—", detail: r.exception_type ?? r.reason ?? null, date: iso(r.source_date ?? r.created_at), href: "/dashboard/settlement", country: r.country_name ?? null }),
  },
  // ── Receivables / payables / workflow ──────────────────────────────────
  {
    detector: "overdue_receivable", group: "receivables", severity: "needs_review",
    run: (sql, scope) => sql`
      SELECT so.sales_order_no AS ref, so.customer_name, so.remaining_amount, so.currency_code, so.order_date, c.name AS country
      FROM public.sales_orders so LEFT JOIN public.countries c ON c.id = so.country_id
      WHERE so.deleted_at IS NULL AND coalesce(so.remaining_amount,0) > 0 AND coalesce(so.payment_status,'') NOT IN ('completed','paid','cancelled')
        AND coalesce(so.order_date, so.created_at::date) < current_date - 30 AND ${sqlScopeCondition(sql, scope, "so")}
      ORDER BY so.order_date LIMIT ${LIMIT}`,
    map: (r) => ({ reference: r.ref, detail: `${r.customer_name ?? ""} · ${r.currency_code ?? ""} ${Number(r.remaining_amount).toLocaleString("en-US")}`, date: iso(r.order_date), href: `/dashboard/journal/sales-order-payment/remaining?q=${encodeURIComponent(r.ref ?? "")}`, country: r.country }),
  },
  {
    detector: "overdue_payable", group: "receivables", severity: "needs_review",
    run: (sql, scope) => sql`
      SELECT po.purchase_order_no AS ref, po.remaining_due, po.currency_code, po.created_at, c.name AS country
      FROM public.purchase_orders po LEFT JOIN public.countries c ON c.id = po.country_id
      WHERE po.deleted_at IS NULL AND coalesce(po.remaining_due,0) > 0 AND po.payment_status::text NOT IN ('completed','cancelled')
        AND po.created_at < now() - interval '30 days' AND ${sqlScopeCondition(sql, scope, "po")}
      ORDER BY po.created_at LIMIT ${LIMIT}`,
    map: (r) => ({ reference: r.ref, detail: `${r.currency_code ?? ""} ${Number(r.remaining_due).toLocaleString("en-US")}`, date: iso(r.created_at), href: `/dashboard/journal/purchase-order-payment/remaining?q=${encodeURIComponent(r.ref ?? "")}`, country: r.country }),
  },
  {
    detector: "incomplete_workflow", group: "receivables", severity: "needs_review",
    run: (sql, scope) => sql`
      SELECT po.purchase_order_no AS ref, po.created_at, c.name AS country, 'purchase' AS kind
      FROM public.purchase_orders po LEFT JOIN public.countries c ON c.id = po.country_id
      WHERE po.deleted_at IS NULL AND coalesce(po.status,'draft') = 'draft' AND po.created_at < now() - interval '14 days' AND ${sqlScopeCondition(sql, scope, "po")}
      UNION ALL
      SELECT so.sales_order_no, so.created_at, c.name, 'sales'
      FROM public.sales_orders so LEFT JOIN public.countries c ON c.id = so.country_id
      WHERE so.deleted_at IS NULL AND coalesce(so.sales_status,'draft') = 'draft' AND so.created_at < now() - interval '14 days' AND ${sqlScopeCondition(sql, scope, "so")}
      ORDER BY 2 LIMIT ${LIMIT}`,
    map: (r) => ({ reference: r.ref, detail: r.kind, date: iso(r.created_at), href: r.kind === "sales" ? `/dashboard/sales/sales-booking-journal-report?q=${encodeURIComponent(r.ref ?? "")}` : `/dashboard/purchase/purchase-booking-journal-report?q=${encodeURIComponent(r.ref ?? "")}`, country: r.country }),
  },
  {
    detector: "pending_approval", group: "receivables", severity: "needs_review",
    run: (sql, scope) => sql`
      SELECT a.request_no AS ref, a.action, a.target_table, a.created_at, c.name AS country
      FROM public.approval_requests a LEFT JOIN public.countries c ON c.id = a.country_id
      WHERE a.deleted_at IS NULL AND a.status = 'pending' AND a.created_at < now() - interval '2 days' AND ${sqlScopeCondition(sql, scope, "a")}
      ORDER BY a.created_at LIMIT ${LIMIT}`,
    map: (r) => ({ reference: r.ref, detail: `${r.action ?? ""} · ${r.target_table ?? ""}`, date: iso(r.created_at), href: "/dashboard/ai-entry/approvals", country: r.country }),
  },
  // ── CRM ────────────────────────────────────────────────────────────────
  {
    detector: "stale_crm_followup", group: "crm", severity: "reminder",
    run: (sql, scope) => sql`
      SELECT ci.inquiry_no AS ref, ci.customer_name, ci.follow_up_date AS d, c.name AS country, 'inquiry' AS kind, ci.id::text AS id
      FROM public.customer_inquiries ci LEFT JOIN public.countries c ON c.id = ci.country_id
      WHERE ci.deleted_at IS NULL AND ci.follow_up_date < current_date AND coalesce(ci.status,'') NOT IN ('closed','converted','lost','won')
        AND ${sqlScopeCondition(sql, scope, "ci")}
      UNION ALL
      SELECT a.reference_no, a.party_name, a.next_follow_up::date, a.country_name, 'crm_action', a.id::text
      -- crm_action_items keeps its scope ids as text: expose them as uuid for the one scope rule.
      FROM (
        SELECT x.reference_no, x.party_name, x.next_follow_up, x.country_name, x.id, x.is_completed,
               CASE WHEN x.country_id::text ~* '^[0-9a-f-]{36}$' THEN x.country_id::text::uuid END AS country_id,
               CASE WHEN x.country_branch_id::text ~* '^[0-9a-f-]{36}$' THEN x.country_branch_id::text::uuid END AS country_branch_id,
               CASE WHEN x.city_branch_id::text ~* '^[0-9a-f-]{36}$' THEN x.city_branch_id::text::uuid END AS city_branch_id
        FROM public.crm_action_items x
      ) a
      WHERE coalesce(a.is_completed,false) = false AND a.next_follow_up < now() AND ${sqlScopeCondition(sql, scope, "a")}
      ORDER BY 3 LIMIT ${LIMIT}`,
    map: (r) => ({ reference: r.ref ?? "—", detail: r.customer_name, date: iso(r.d), href: r.kind === "inquiry" ? `/dashboard/customer-inquiries?id=${r.id}` : "/dashboard/crm?report=due-followup", country: r.country }),
  },
  // ── Shipping / clearing ───────────────────────────────────────────────
  {
    detector: "eta_passed_no_update", group: "shipping", severity: "needs_review",
    run: (sql, scope) => sql`
      SELECT b.bl_number AS ref, b.container_number, b.eta, b.shipment_status, c.name AS country
      FROM public.shipping_bl_records b LEFT JOIN public.countries c ON c.id = b.country_id
      WHERE b.deleted_at IS NULL AND b.eta IS NOT NULL AND b.eta < current_date
        AND coalesce(b.shipment_status,'') NOT IN ('arrived','delivered','completed','cleared','closed')
        AND b.updated_at < b.eta::timestamptz + interval '1 day' AND ${sqlScopeCondition(sql, scope, "b")}
      ORDER BY b.eta LIMIT ${LIMIT}`,
    map: (r) => ({ reference: r.ref ?? "—", detail: `${r.container_number ?? ""} · ${r.shipment_status ?? ""}`, date: iso(r.eta), href: `/dashboard/shipping-line/tracking?q=${encodeURIComponent(r.ref ?? "")}`, country: r.country }),
  },
  {
    detector: "missing_shipping_document", group: "shipping", severity: "reminder",
    run: (sql, scope) => sql`
      SELECT b.bl_number AS ref, b.created_at, c.name AS country
      FROM public.shipping_bl_records b LEFT JOIN public.countries c ON c.id = b.country_id
      WHERE b.deleted_at IS NULL AND (coalesce(b.container_number,'') = '' OR coalesce(b.vessel_name,'') = '')
        AND ${sqlScopeCondition(sql, scope, "b")}
      ORDER BY b.created_at DESC LIMIT ${LIMIT}`,
    map: (r) => ({ reference: r.ref ?? "—", detail: null, date: iso(r.created_at), href: `/dashboard/shipping-line/bl-entry?q=${encodeURIComponent(r.ref ?? "")}`, country: r.country }),
  },
  // ── HR / payroll ──────────────────────────────────────────────────────
  {
    detector: "payroll_exception", group: "hr", severity: "critical",
    run: (sql, scope) => sql`
      SELECT r.run_no AS ref, r.period_month, e.employee_code, l.net_salary, c.name AS country
      FROM public.hr_payroll_run_lines l JOIN public.hr_payroll_runs r ON r.id = l.run_id
      JOIN public.employees e ON e.id = l.employee_id LEFT JOIN public.countries c ON c.id = r.country_id
      WHERE r.deleted_at IS NULL AND coalesce(r.status,'') NOT IN ('cancelled','reversed')
        AND (coalesce(l.net_salary,0) < 0 OR (coalesce(l.gross_salary,0) = 0 AND coalesce(l.worked_days,0) > 0))
        AND ${sqlScopeCondition(sql, scope, "r")}
      ORDER BY r.period_month DESC LIMIT ${LIMIT}`,
    map: (r) => ({ reference: `${r.ref} · ${r.employee_code}`, detail: `net ${Number(r.net_salary ?? 0).toFixed(2)}`, date: iso(r.period_month), href: `/dashboard/general-office/payroll?run=${encodeURIComponent(r.ref ?? "")}`, country: r.country }),
  },
  {
    // UAE WPS: approved runs with no SIF after 3 days, SIFs rejected by the agent with no
    // replacement, and SIFs submitted more than 5 days ago with no outcome recorded.
    detector: "wps_exception", group: "hr", severity: "critical",
    run: (sql, scope) => sql`
      SELECT * FROM (
        SELECT r.run_no AS ref, 'no_sif' AS kind, r.approved_at AS at, c.name AS country
        FROM public.hr_payroll_runs r JOIN public.countries c ON c.id = r.country_id AND upper(c.iso2) = 'AE'
        WHERE r.deleted_at IS NULL AND r.status IN ('approved','posted','paid') AND r.approved_at < now() - interval '3 days'
          AND NOT EXISTS (SELECT 1 FROM public.hr_wps_sif_files f WHERE f.run_id = r.id AND f.status NOT IN ('cancelled','rejected'))
          AND ${sqlScopeCondition(sql, scope, "r")}
        UNION ALL
        SELECT f.file_no, f.status, f.updated_at, c.name
        FROM public.hr_wps_sif_files f LEFT JOIN public.countries c ON c.id = f.country_id
        WHERE ((f.status = 'rejected' AND NOT EXISTS (SELECT 1 FROM public.hr_wps_sif_files g WHERE g.run_id = f.run_id AND g.status NOT IN ('cancelled','rejected')))
            OR (f.status = 'submitted' AND f.submitted_at < now() - interval '5 days'))
          AND ${sqlScopeCondition(sql, scope, "f")}
      ) x ORDER BY at NULLS LAST LIMIT ${LIMIT}`,
    map: (r) => ({ reference: r.ref, detail: null, date: iso(r.at), href: "/dashboard/general-office/wps-sif", country: r.country }),
  },
  {
    detector: "missing_attendance_before_payroll", group: "hr", severity: "needs_review",
    run: (sql, scope) => sql`
      SELECT e.employee_code AS ref, r.run_no, r.period_month, c.name AS country
      FROM public.hr_payroll_runs r
      JOIN public.hr_payroll_run_lines l ON l.run_id = r.id
      JOIN public.employees e ON e.id = l.employee_id
      LEFT JOIN public.countries c ON c.id = r.country_id
      WHERE r.deleted_at IS NULL AND r.status IN ('draft','calculated','reviewed')
        AND NOT EXISTS (
          SELECT 1 FROM public.office_attendance a
          WHERE a.employee_id = e.id AND a.deleted_at IS NULL
            AND date_trunc('month', a.attendance_date) = date_trunc('month', (r.period_month || '-01')::date)
        )
        AND ${sqlScopeCondition(sql, scope, "r")}
      ORDER BY r.period_month DESC LIMIT ${LIMIT}`,
    map: (r) => ({ reference: r.ref, detail: r.run_no, date: iso(r.period_month), href: "/dashboard/general-office/leave-attendance", country: r.country }),
  },
  {
    detector: "employee_document_expired", group: "hr", severity: "needs_review",
    run: (sql, scope) => sql`
      SELECT e.employee_code AS ref, k.document_type, k.expiry_date, c.name AS country
      FROM public.hr_employee_kyc_documents k JOIN public.employees e ON e.id = k.employee_id
      LEFT JOIN public.countries c ON c.id = k.country_id
      WHERE k.deleted_at IS NULL AND k.expiry_date IS NOT NULL AND k.expiry_date < current_date + 30
        AND ${sqlScopeCondition(sql, scope, "k")}
      ORDER BY k.expiry_date LIMIT ${LIMIT}`,
    map: (r) => ({ reference: r.ref, detail: r.document_type, date: iso(r.expiry_date), href: "/dashboard/general-office/employee-kyc", country: r.country }),
  },
  // ── Company / tax compliance ───────────────────────────────────────────
  {
    detector: "company_license_expiry", group: "compliance", severity: "reminder",
    run: (sql, _scope, session) => sql`
      SELECT co.id, co.company_code, coalesce(co.legal_name, co.name) AS name, co.license_expiry_date, c.name AS country
      FROM public.companies co LEFT JOIN public.countries c ON c.id = co.country_id
      WHERE co.deleted_at IS NULL AND co.license_expiry_date IS NOT NULL AND co.license_expiry_date < current_date + 30
        AND coalesce(co.company_status,'active') NOT IN ('closed')
        AND ${countryOnly(sql, session, "co.country_id")}
      ORDER BY co.license_expiry_date LIMIT ${LIMIT}`,
    map: (r) => ({ reference: r.company_code ?? r.name, detail: r.name, date: iso(r.license_expiry_date), href: `/dashboard/settings/company-setup?view=360&companyId=${r.id}`, country: r.country }),
  },
  {
    detector: "tax_filing_deadline", group: "compliance", severity: "reminder",
    // VAT periods (due 28 days after period end) and Corporate Tax returns (due 9 months after
    // the financial year) that are not filed and fall due within 15 / 45 days (or are overdue).
    run: (sql, _scope, session) => sql`
      SELECT * FROM (
        SELECT p.period_code AS ref, (p.period_end + 28) AS due, t.legal_name, c.name AS country, '/dashboard/tax-einvoicing/uae/vat-return' AS href
        FROM public.uae_tax_periods p JOIN public.uae_tax_entities t ON t.id = p.tax_entity_id
        LEFT JOIN public.countries c ON c.id = t.country_id
        WHERE p.deleted_at IS NULL AND p.filed_at IS NULL AND coalesce(p.status,'') NOT IN ('filed','closed')
          AND p.period_end + 28 < current_date + 15
          AND ${countryOnly(sql, session, "t.country_id")}
        UNION ALL
        SELECT r.return_no, r.filing_deadline, t.legal_name, c.name, '/dashboard/tax-einvoicing/uae/corporate-tax?return=' || r.id
        FROM public.uae_ct_returns r JOIN public.uae_tax_entities t ON t.id = r.tax_entity_id
        LEFT JOIN public.countries c ON c.id = r.country_id
        WHERE r.deleted_at IS NULL AND r.status NOT IN ('filed','paid','cancelled')
          AND r.filing_deadline < current_date + 45
          AND ${countryOnly(sql, session, "r.country_id")}
      ) x ORDER BY due LIMIT ${LIMIT}`,
    map: (r) => ({ reference: r.ref, detail: r.legal_name, date: iso(r.due), href: r.href, country: r.country }),
  },
];

export const DETECTOR_CODES = DETECTORS.map((d) => d.detector);

/** Run every detector for the caller's scope. A detector that fails reports zero + an error flag,
 *  so one broken source never hides the rest. */
export async function runControlChecks(session: ErpSession): Promise<{ generatedAt: string; results: Array<DetectorResult & { error?: boolean }> }> {
  const scope = sessionSqlScope(session);
  const results = await withReadPg(async (sql) =>
    Promise.all(
      DETECTORS.map(async (d) => {
        try {
          const rows = (await d.run(sql, scope, session)) as any[];
          const findings = rows.map((r) => ({ detector: d.detector, severity: d.severity, ...d.map(r) }));
          return { detector: d.detector, group: d.group, severity: d.severity, count: findings.length, findings };
        } catch (e) {
          console.warn("[smart-ops] detector failed", d.detector, (e as Error)?.message);
          return { detector: d.detector, group: d.group, severity: d.severity, count: 0, findings: [], error: true };
        }
      })
    )
  );
  return { generatedAt: new Date().toISOString(), results: results ?? [] };
}
