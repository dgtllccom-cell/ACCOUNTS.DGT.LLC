import { withLocalPg } from "@/lib/db/local-postgres";
import { assertRowInScope, type IntakeScope } from "@/lib/document-intelligence/scope";

/**
 * Cash / Bank Roznamcha pre-post preview (spec §15).
 *
 * Builds the "before posting" summary for a finance document that has been
 * reviewed in the Document Intake Center — WITHOUT posting anything. The AI
 * never writes to roznamcha_entries / roznamcha_lines / journal / ledgers. The
 * human posts through the existing Cash / Bank Roznamcha screen, which keeps the
 * balanced-Dr/Cr and duplicate-posting guards; this preview surfaces the same
 * checks up-front and flags a likely duplicate.
 */

type FieldRow = { field_key: string; corrected_value: string | null; normalized_value: string | null; raw_value: string | null };

function fv(fields: FieldRow[], key: string): string | null {
  const f = fields.find((x) => x.field_key === key);
  return f ? (f.corrected_value ?? f.normalized_value ?? f.raw_value ?? null) || null : null;
}
function num(s: string | null): number | null {
  if (!s) return null;
  const n = Number(String(s).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function paymentMethodOf(docTypeCode: string | null, raw: string | null): "cash" | "bank_transfer" | "cheque" | "other" {
  const s = (raw || "").toLowerCase();
  if (/cheque|check/.test(s)) return "cheque";
  if (/cash/.test(s)) return "cash";
  if (/transfer|wire|tt|swift|online/.test(s)) return "bank_transfer";
  if (docTypeCode === "cheque_image") return "cheque";
  if (docTypeCode === "cash_receipt" || docTypeCode === "cash_voucher") return "cash";
  if (docTypeCode === "bank_transfer_advice" || docTypeCode === "payment_confirmation") return "bank_transfer";
  return "other";
}

function chequeStatusOf(raw: string | null): "pending" | "cleared" | "dishonoured" | "cancelled" | null {
  const s = (raw || "").toLowerCase();
  if (!s) return null;
  if (/dishonou?red|bounced|returned/.test(s)) return "dishonoured";
  if (/cancelled|stop\s*payment/.test(s)) return "cancelled";
  if (/cleared|honou?red/.test(s)) return "cleared";
  if (/post\s*dated|pdc|pending/.test(s)) return "pending";
  return null;
}

export class RoznamchaIntakePreviewService {
  async previewFromJob(jobId: string, scope: IntakeScope) {
    return withLocalPg(async (sql) => {
      const job = (await sql`SELECT * FROM public.document_intake_queue_v WHERE id = ${jobId}`)?.[0];
      if (!job) return null;
      assertRowInScope(scope, job);
      if (job.target_module !== "roznamcha_entries") {
        throw new Error("This document is not routed to Cash / Bank Roznamcha.");
      }
      const fields = (await sql`SELECT field_key, corrected_value, normalized_value, raw_value
        FROM public.document_intake_fields WHERE job_id = ${jobId}`) as FieldRow[];

      const currency = fv(fields, "currency");
      const finalAmount = num(fv(fields, "grand_total")) ?? num(fv(fields, "paid_amount")) ?? num(fv(fields, "advance_amount"));
      const exchangeRate = num(fv(fields, "exchange_rate")) ?? 1;
      const method = paymentMethodOf(job.doc_type_code, fv(fields, "payment_method"));
      const chequeStatus = method === "cheque" ? (chequeStatusOf(fv(fields, "cheque_status")) ?? "pending") : null;

      const billNumber = fv(fields, "invoice_number") || fv(fields, "cheque_number") || null;
      const manualBillNumber = fv(fields, "manual_contract_number") || null;
      const entryDate = fv(fields, "document_date") || fv(fields, "value_date") || null;
      const counterparty = fv(fields, "supplier_name") || fv(fields, "customer_name") || null;
      const sourceReference = fv(fields, "contract_number") || fv(fields, "po_number") || fv(fields, "so_number") || job.contract_reference || null;

      // serial SCHEMES that would be used (numbers are allocated only at post time)
      const lastSerials = (await sql`SELECT super_admin_serial, country_serial, branch_serial, main_branch_transaction_serial, city_branch_transaction_serial, entry_serial
        FROM public.roznamcha_entries
        WHERE country_id IS NOT DISTINCT FROM ${job.country_id} AND deleted_at IS NULL
        ORDER BY created_at DESC LIMIT 1`)?.[0] ?? {};

      // balanced Dr/Cr check — a single payment is Dr one / Cr one for finalAmount
      const balanced = !!finalAmount && finalAmount > 0;

      // duplicate-posting check
      const dupWhere = [
        sql`re.deleted_at IS NULL`,
        sql`re.country_id IS NOT DISTINCT FROM ${job.country_id}`,
      ];
      if (manualBillNumber) dupWhere.push(sql`re.source_reference_no = ${manualBillNumber} OR re.reference_no = ${manualBillNumber}`);
      else if (billNumber) dupWhere.push(sql`re.reference_no = ${billNumber} OR re.source_reference_no = ${billNumber}`);
      else dupWhere.push(sql`false`);
      if (entryDate) dupWhere.push(sql`re.entry_date = ${entryDate}`);
      const dupW = dupWhere.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      const dup = (billNumber || manualBillNumber)
        ? (await sql`SELECT re.id, re.voucher_no, re.entry_serial, re.entry_date, re.base_currency_amount
            FROM public.roznamcha_entries re WHERE ${dupW} LIMIT 1`)?.[0] ?? null
        : null;

      return {
        jobNo: job.job_no,
        docTypeCode: job.doc_type_code,
        preview: {
          superAdminSerialScheme: lastSerials.super_admin_serial ? "next after " + lastSerials.super_admin_serial : "allocated on posting",
          countrySerialScheme: lastSerials.country_serial ? "next after " + lastSerials.country_serial : "allocated on posting",
          branchSerialScheme: lastSerials.branch_serial ? "next after " + lastSerials.branch_serial : "allocated on posting",
          entrySerialScheme: lastSerials.entry_serial ? "next after " + lastSerials.entry_serial : "allocated on posting",
          billNumber,
          manualBillNumber,
          debitAccount: method === "cash" ? "Cash in hand (select on posting)" : method === "cheque" ? "Bank / Cheques receivable (select on posting)" : "Bank account (select on posting)",
          creditAccount: counterparty ? `${counterparty} (select ledger on posting)` : "Counterparty ledger (select on posting)",
          originalCurrency: currency,
          exchangeRate,
          finalAmount,
          baseAmount: finalAmount != null ? Number((finalAmount * (exchangeRate || 1)).toFixed(2)) : null,
          sourceModule: job.source_module_hint || "document_intake",
          sourceReference,
          paymentMethod: method,
          chequeStatus,
          entryDate,
          counterparty,
        },
        checks: {
          balanced,
          balancedMessage: balanced ? null : "No usable amount was extracted — enter the amount before posting.",
          amountPresent: finalAmount != null,
          duplicateOf: dup ? { id: dup.id, voucherNo: dup.voucher_no, entrySerial: dup.entry_serial, entryDate: dup.entry_date, amount: dup.base_currency_amount } : null,
        },
      };
    });
  }
}

export const roznamchaIntakePreviewService = new RoznamchaIntakePreviewService();
