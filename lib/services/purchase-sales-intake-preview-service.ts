import { withLocalPg } from "@/lib/db/local-postgres";
import { assertRowInScope, type IntakeScope } from "@/lib/document-intelligence/scope";

/**
 * Purchase / Sales AI Document Intake — accounting preview (before posting).
 *
 * Builds the mandatory "Accounting Preview" for a Purchase or Sales document that
 * has been reviewed in the Document Intake Center — WITHOUT posting anything and
 * WITHOUT inventing an FX rate or a second accounting engine:
 *
 *   • Functional / base currency = countries.currency_code of the job's country
 *     (exactly what the verified post_purchase_order_payment resolves).
 *   • Historical rate = the rate the reviewer confirmed on the document, else the
 *     approved Daily Exchange Rate (get_daily_rate) for that country/branch/date,
 *     else 1 when original == functional. The reviewer confirms it in the wizard.
 *   • Final / base amount = round(original amount × rate, 2)  (INVARIANT).
 *   • DR total = CR total = final amount → balanced by construction; the flag is
 *     surfaced so a missing amount blocks posting.
 *
 * The AI can SUGGEST the Purchase/Debit and Supplier/Credit ledgers (name match,
 * scored), but the user picks and confirms the real accounts + rate in the
 * existing Purchase/Sales wizard, which runs the verified posting path.
 */

type FieldRow = { field_key: string; corrected_value: string | null; normalized_value: string | null; raw_value: string | null };

function fv(fields: FieldRow[], key: string): string | null {
  const f = fields.find((x) => x.field_key === key);
  return f ? (f.corrected_value ?? f.normalized_value ?? f.raw_value ?? null) || null : null;
}
function num(s: string | null): number | null {
  if (s == null) return null;
  const n = Number(String(s).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
const round2 = (n: number) => Number(n.toFixed(2));

export type IntakeAccountSel = { debitAccountId?: string | null; creditAccountId?: string | null };

export class PurchaseSalesIntakePreviewService {
  async previewFromJob(jobId: string, scope: IntakeScope, sel: IntakeAccountSel = {}) {
    return withLocalPg(async (sql) => {
      const job = (await sql`SELECT * FROM public.document_intake_queue_v WHERE id = ${jobId}`)?.[0];
      if (!job) return null;
      assertRowInScope(scope, job);

      const tm = job.target_module as string | null;
      if (tm !== "purchase_orders" && tm !== "sales_orders") {
        throw new Error("This document is not routed to Purchase or Sales — choose that purpose first.");
      }
      const side: "purchase" | "sales" = tm === "sales_orders" ? "sales" : "purchase";

      const fields = (await sql`SELECT field_key, corrected_value, normalized_value, raw_value
        FROM public.document_intake_fields WHERE job_id = ${jobId}`) as FieldRow[];

      // ── scope + functional currency (verified-engine rule) ────────────────
      const ctx = (await sql`
        SELECT c.name AS country_name, c.currency_code AS functional_currency,
               cb.name AS country_branch_name, city.name AS city_branch_name, co.name AS company_name
        FROM (SELECT 1) x
        LEFT JOIN public.countries c        ON c.id = ${job.country_id}
        LEFT JOIN public.country_branches cb ON cb.id = ${job.country_branch_id}
        LEFT JOIN public.city_branches city  ON city.id = ${job.city_branch_id}
        LEFT JOIN public.companies co        ON co.id = ${job.company_id}
      `)?.[0] ?? {};
      const functionalCurrency: string = (ctx.functional_currency || "USD").toUpperCase();

      // ── amounts + rate from the reviewed document ────────────────────────
      const originalCurrency = (fv(fields, "currency") || functionalCurrency).toUpperCase().slice(0, 3);
      const originalAmount = num(fv(fields, "grand_total")) ?? num(fv(fields, "subtotal")) ?? num(fv(fields, "advance_amount"));
      const documentDate = fv(fields, "document_date") || fv(fields, "contract_start_date") || null;
      const contractNo = fv(fields, "contract_number") || fv(fields, "manual_contract_number") || job.contract_reference || null;
      const partyName = side === "sales"
        ? (fv(fields, "customer_name") || fv(fields, "contract_parties") || null)
        : (fv(fields, "supplier_name") || fv(fields, "contract_parties") || null);

      // ── approved Daily Exchange Rate for this scope + date ───────────────
      let dailyRate: number | null = null;
      let dailyRateDate: string | null = null;
      if (originalCurrency !== functionalCurrency) {
        try {
          const r = (await sql`SELECT * FROM get_daily_rate(${job.country_id}::uuid, ${job.country_branch_id ?? null}::uuid,
            ${documentDate ?? new Date().toISOString().slice(0, 10)}::date)`)?.[0];
          const cand = Number(r?.selling_rate ?? r?.buying_rate ?? r?.credit_rate ?? r?.debit_rate ?? 0);
          if (cand > 0) { dailyRate = cand; dailyRateDate = r?.rate_date ?? null; }
        } catch {
          const r = (await sql`SELECT rate_date, selling_rate, buying_rate, credit_rate
            FROM public.daily_usd_rates
            WHERE country_id = ${job.country_id} AND deleted_at IS NULL
              AND (${job.country_branch_id ? sql`country_branch_id = ${job.country_branch_id}` : sql`TRUE`})
              AND rate_date <= ${documentDate ?? new Date().toISOString().slice(0, 10)}::date
            ORDER BY rate_date DESC LIMIT 1`)?.[0];
          const cand = Number(r?.selling_rate ?? r?.buying_rate ?? r?.credit_rate ?? 0);
          if (cand > 0) { dailyRate = cand; dailyRateDate = r?.rate_date ?? null; }
        }
      }

      const extractedRate = num(fv(fields, "exchange_rate"));
      let exchangeRate: number;
      let rateSource: "document" | "daily_rate" | "implied_1";
      if (originalCurrency === functionalCurrency) { exchangeRate = 1; rateSource = "implied_1"; }
      else if (extractedRate && extractedRate > 0 && Math.abs(extractedRate - 1) > 1e-9) { exchangeRate = extractedRate; rateSource = "document"; }
      else if (dailyRate && dailyRate > 0) { exchangeRate = dailyRate; rateSource = "daily_rate"; }
      else { exchangeRate = 1; rateSource = "implied_1"; }

      const finalAmount = originalAmount != null ? round2(originalAmount * exchangeRate) : null;

      // ── DR / CR account: explicit selection, else AI suggestion ──────────
      const scopeLedger = (extra: any) => sql`
        l.deleted_at IS NULL AND l.is_active
        AND (l.scope = 'global' OR l.country_id IS NOT DISTINCT FROM ${job.country_id} OR l.country_id IS NULL)
        AND (${job.city_branch_id ? sql`l.city_branch_id IS NOT DISTINCT FROM ${job.city_branch_id} OR l.city_branch_id IS NULL` : sql`TRUE`})
        ${extra}`;

      type LedgerPick = {
        id: string; code: string | null; name: string | null; currency: string | null; normalBalance: string | null;
        reason?: string | null; confidence?: number | null;
        options?: Array<{ id: string; code: string | null; name: string | null }>;
      };

      const resolveLedger = async (id: string | null | undefined): Promise<LedgerPick | null> => {
        if (!id) return null;
        const r = (await sql`SELECT id, code, name, currency, normal_balance FROM public.ledgers l WHERE l.id = ${id} AND l.deleted_at IS NULL`)?.[0];
        if (!r) return null;
        return { id: r.id, code: r.code, name: r.name, currency: r.currency, normalBalance: r.normal_balance };
      };

      const suggestLedger = async (kind: "debit" | "credit"): Promise<LedgerPick | null> => {
        // credit(purchase)/debit(sales) = the counterparty ledger by name;
        // debit(purchase)/credit(sales) = a purchases / sales control ledger.
        const wantParty = (side === "purchase" && kind === "credit") || (side === "sales" && kind === "debit");
        const toPick = (rows: any[], reason: string, confidence: number): LedgerPick => ({
          id: rows[0].id, code: rows[0].code, name: rows[0].name, currency: rows[0].currency, normalBalance: rows[0].normal_balance,
          reason, confidence, options: rows.map((o) => ({ id: o.id, code: o.code, name: o.name })),
        });
        if (wantParty && partyName) {
          const p = partyName.toUpperCase().slice(0, 14);
          const rows = await sql`SELECT id, code, name, currency, normal_balance FROM public.ledgers l
            WHERE ${scopeLedger(sql`AND upper(l.name) LIKE ${"%" + p + "%"}`)} LIMIT 5`;
          if (rows?.length) return toPick(rows as any[], `name match: "${partyName}"`, 0.6);
        }
        const kw = side === "purchase" ? "PURCHASE" : "SALES";
        const rows = await sql`SELECT id, code, name, currency, normal_balance FROM public.ledgers l
          WHERE ${scopeLedger(sql`AND (upper(l.name) LIKE ${"%" + kw + "%"} OR upper(l.code) LIKE ${"%" + kw + "%"})`)} LIMIT 5`;
        if (rows?.length) return toPick(rows as any[], `${kw.toLowerCase()} control ledger`, 0.4);
        return null;
      };

      const debitAccount = (await resolveLedger(sel.debitAccountId)) ?? (await suggestLedger("debit"));
      const creditAccount = (await resolveLedger(sel.creditAccountId)) ?? (await suggestLedger("credit"));
      const accountsConfirmed = Boolean(sel.debitAccountId && sel.creditAccountId);

      // ── duplicate-posting check (same contract in Purchase/Sales) ───────
      let duplicateOf: any = null;
      if (contractNo) {
        const cNorm = contractNo.toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (side === "purchase") {
          duplicateOf = (await sql`SELECT id, purchase_order_no AS ref, status FROM public.purchase_orders
            WHERE deleted_at IS NULL AND country_id IS NOT DISTINCT FROM ${job.country_id}
              AND upper(regexp_replace(coalesce(purchase_contract_no,''),'[^A-Za-z0-9]','','g')) = ${cNorm} LIMIT 1`)?.[0] ?? null;
        } else {
          duplicateOf = (await sql`SELECT id, sales_order_no AS ref, sales_status AS status FROM public.sales_orders
            WHERE deleted_at IS NULL AND country_id IS NOT DISTINCT FROM ${job.country_id}
              AND upper(regexp_replace(coalesce(sales_contract_no,''),'[^A-Za-z0-9]','','g')) = ${cNorm} LIMIT 1`)?.[0] ?? null;
        }
      }

      const drTotal = finalAmount;
      const crTotal = finalAmount;
      const balanced = finalAmount != null && finalAmount > 0 && drTotal === crTotal;

      return {
        jobNo: job.job_no,
        side,
        docTypeCode: job.doc_type_code,
        preview: {
          business: ctx.company_name || null,
          country: ctx.country_name || null,
          branch: ctx.city_branch_name || ctx.country_branch_name || null,
          debitAccount: debitAccount
            ? { id: (debitAccount as any).id ?? null, code: (debitAccount as any).code ?? null, name: (debitAccount as any).name ?? null, currency: (debitAccount as any).currency ?? null,
                suggested: !sel.debitAccountId, reason: (debitAccount as any).reason ?? null, confidence: (debitAccount as any).confidence ?? null,
                options: (debitAccount as any).options ?? undefined }
            : { id: null, name: "Select the Purchase / Debit account", suggested: false },
          creditAccount: creditAccount
            ? { id: (creditAccount as any).id ?? null, code: (creditAccount as any).code ?? null, name: (creditAccount as any).name ?? null, currency: (creditAccount as any).currency ?? null,
                suggested: !sel.creditAccountId, reason: (creditAccount as any).reason ?? null, confidence: (creditAccount as any).confidence ?? null,
                options: (creditAccount as any).options ?? undefined }
            : { id: null, name: side === "sales" ? "Select the Customer / Credit account" : "Select the Supplier / Credit account", suggested: false },
          originalCurrency,
          originalAmount,
          exchangeRate,
          rateSource,           // 'document' | 'daily_rate' | 'implied_1'
          dailyRate,
          dailyRateDate,
          functionalCurrency,
          finalAmount,
          drTotal,
          crTotal,
          documentDate,
          contractNo,
          partyName,
          sourceDocument: job.original_filename,
        },
        checks: {
          amountPresent: originalAmount != null,
          balanced,
          balancedMessage: balanced ? null
            : (originalAmount == null ? "No amount was extracted — enter it before posting."
               : "Debit and Credit totals are not balanced."),
          rateConfirmed: rateSource === "document" || rateSource === "implied_1",
          rateMessage: rateSource === "daily_rate"
            ? `Using the approved Daily Exchange Rate${dailyRateDate ? ` (${dailyRateDate})` : ""} — confirm it in the wizard.`
            : rateSource === "implied_1" && originalCurrency !== functionalCurrency
            ? "No rate found — enter the historical rate in the wizard before posting."
            : null,
          accountsConfirmed,
          accountsMessage: accountsConfirmed ? null : "Select and confirm the Debit and Credit accounts in the wizard before posting.",
          duplicateOf: duplicateOf ? { id: duplicateOf.id, ref: duplicateOf.ref, status: duplicateOf.status } : null,
        },
        // The AI never posts. Posting happens in the existing Purchase/Sales
        // wizard → verified post_purchase_booking_transfer / sales transfer path.
        canPost: false,
      };
    });
  }
}

export const purchaseSalesIntakePreviewService = new PurchaseSalesIntakePreviewService();
