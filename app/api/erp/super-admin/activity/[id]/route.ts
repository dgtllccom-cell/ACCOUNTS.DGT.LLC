/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession, ErpAuthError } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Super Admin — full detail for a single roznamcha (financial) entry.
 * READ-ONLY, super-admin only, REAL data only. Every section is populated from the actual saved
 * record; sections with no backing data (e.g. attachments — none are stored against roznamcha
 * entries) come back empty so the UI can hide them rather than fabricate anything.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) throw new ErpAuthError("Super Admin access is required for the ERP activity monitor.");

    const { id } = await context.params;
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) return apiOk({ found: false });

    const detail = await withLocalPg(async (sql) => {
      const [e] = await sql`
        select
          e.id::text, e.voucher_no, e.journal_no, e.reference_no, e.source_reference_no,
          e.narration, e.type::text, e.entry_category, e.source_module, e.source_transaction_type,
          e.status::text, e.entry_date, e.created_at, e.approved_at, e.posted_at,
          cp.full_name created_by, ap.full_name approved_by,
          co.name country_name, coalesce(cib.name, cb.name) branch_name
        from roznamcha_entries e
        left join profiles cp on cp.id = e.created_by
        left join profiles ap on ap.id = e.approved_by
        left join countries co on co.id = e.country_id
        left join city_branches cib on cib.id = e.city_branch_id
        left join country_branches cb on cb.id = e.country_branch_id
        where e.id = ${id} and e.deleted_at is null`;

      if (!e) return null;

      const lines = await sql`
        select
          l.id::text, l.account_number, l.customer_number, l.manual_reference_number,
          l.description, l.debit::numeric, l.credit::numeric, l.currency,
          l.usd_rate::numeric, l.usd_amount::numeric,
          lg.name ledger_name, lg.code ledger_code
        from roznamcha_lines l
        left join ledgers lg on lg.id = l.ledger_id
        where l.roznamcha_entry_id = ${id}
        order by l.debit desc nulls last`;

      const audit = await sql`
        select a.action, a.created_at, ap.full_name actor
        from audit_logs a
        left join profiles ap on ap.id = a.actor_id
        where a.entity_table = 'roznamcha_entries' and a.entity_id = ${id}
        order by a.created_at asc
        limit 100`;

      const attachments = await sql`
        select path, mime_type, size_bytes, created_at
        from attachments
        where owner_table = 'roznamcha_entries' and owner_id = ${id} and deleted_at is null
        order by created_at asc`;

      return { e, lines, audit, attachments };
    });

    if (!detail) return apiOk({ found: false });

    const num = (n: any) => Number(n || 0);
    const { e, lines, audit, attachments } = detail as any;

    const mappedLines = (lines as any[]).map((l) => ({
      accountCode: l.account_number || l.ledger_code || "",
      accountName: l.ledger_name || l.account_number || "",
      description: l.description || "",
      debit: num(l.debit),
      credit: num(l.credit),
      currency: l.currency || "",
      usdRate: num(l.usd_rate),
      usdAmount: num(l.usd_amount),
      party: l.customer_number || ""
    }));

    const totalDebit = mappedLines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = mappedLines.reduce((s, l) => s + l.credit, 0);
    const totalUsd = mappedLines.reduce((s, l) => s + l.usdAmount, 0);
    const currency = mappedLines.find((l) => l.currency)?.currency || "";
    const usdRate = mappedLines.find((l) => l.usdRate)?.usdRate || 0;

    // Lifecycle events derived from the record itself, merged with the audit_logs history.
    const lifecycle: Array<{ action: string; actor: string; at: string }> = [];
    if (e.created_at) lifecycle.push({ action: "Created", actor: e.created_by || "", at: e.created_at });
    if (e.approved_at) lifecycle.push({ action: "Approved", actor: e.approved_by || "", at: e.approved_at });
    if (e.posted_at) lifecycle.push({ action: "Posted", actor: e.created_by || "", at: e.posted_at });
    (audit as any[]).forEach((a) => lifecycle.push({ action: a.action || "Updated", actor: a.actor || "", at: a.created_at }));
    lifecycle.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    return apiOk({
      found: true,
      general: {
        entryNo: e.voucher_no || e.journal_no || e.reference_no || e.id.slice(0, 8),
        voucherNo: e.voucher_no || "",
        journalNo: e.journal_no || "",
        referenceNo: e.reference_no || e.source_reference_no || "",
        entryType: e.source_transaction_type || e.type || "",
        sourceModule: e.source_module || "",
        category: e.entry_category || "",
        description: e.narration || "",
        status: e.status || "",
        date: e.entry_date || e.created_at,
        createdAt: e.created_at,
        postedAt: e.posted_at,
        approvedAt: e.approved_at,
        createdBy: e.created_by || "",
        approvedBy: e.approved_by || "",
        country: e.country_name || "",
        branch: e.branch_name || "",
        currency,
        exchangeRate: usdRate
      },
      amounts: {
        totalDebit, totalCredit, totalUsd,
        net: totalDebit - totalCredit,
        currency
      },
      lines: mappedLines,
      audit: lifecycle,
      attachments: (attachments as any[]).map((a) => ({
        name: String(a.path || "").split("/").pop() || a.path,
        mime: a.mime_type || "",
        size: num(a.size_bytes),
        at: a.created_at
      }))
    });
  } catch (error) {
    return handleApiError(error);
  }
}
