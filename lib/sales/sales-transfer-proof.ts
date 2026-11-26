import { scopeSerials, type ScopeSerials } from "./sales-transfer-serials";
import { withLocalPg } from "@/lib/db/local-postgres";

export type SalesTransferProof = {
  journalId: string;
  journalNo: string | null;
  voucherNo: string | null;
  postedAt: string | null;
  scopeSerials: ScopeSerials;
  lines: Array<{ ledgerId: string; code: string | null; name: string | null; debit: number; credit: number; currency: string; scopeSerials: ScopeSerials }>;
};

export async function readSalesTransferProof(order: { id: string; form_data?: any }): Promise<SalesTransferProof | null> {
  const trace = order.form_data?.transferTrace;
  const savedJournal = order.form_data?.transferVerification?.journalId;
  const explicitJournal = String(savedJournal || trace?.roznamchaEntryId || "").trim();
  const linked = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(explicitJournal) ? explicitJournal : null;
  const result = await withLocalPg(async (sql) => {
    const journals = await sql`
      select id, journal_no, voucher_no, posted_at,
        super_admin_serial_number, country_transaction_serial_number, main_branch_transaction_serial, city_branch_transaction_serial
      from public.roznamcha_entries
      where deleted_at is null and status = 'posted'
        and coalesce(operational_domain, 'business') = 'business'
        and source_module = 'sales'
        and ((source_transaction_type = 'sales_transfer_to_payment' and source_transaction_id = ${order.id}::uuid)
          or (${linked ? sql`id = ${linked}::uuid and exists (select 1 from public.sales_order_payments p
            where p.sales_order_id = ${order.id}::uuid and p.roznamcha_entry_id = roznamcha_entries.id
              and p.deleted_at is null and p.status = 'posted')` : sql`false`}))
      limit 2
    `;
    if (journals.length !== 1) return null;
    const journal = journals[0];
    const source = await sql`
      select rl.ledger_id, l.code, l.name, rl.debit, rl.credit, rl.currency,
        rl.super_admin_serial_number, rl.country_transaction_serial_number, rl.main_branch_transaction_serial, rl.city_branch_transaction_serial
      from public.roznamcha_lines rl
      left join public.ledgers l on l.id = rl.ledger_id
      where rl.roznamcha_entry_id = ${journal.id}::uuid
    `;
    const lines = source.map(row => ({
      ledgerId: String(row.ledger_id), code: row.code == null ? null : String(row.code), name: row.name == null ? null : String(row.name),
      debit: Number(row.debit || 0), credit: Number(row.credit || 0), currency: String(row.currency || "").toUpperCase(), scopeSerials: scopeSerials(row),
    }));
    return { journalId: String(journal.id), journalNo: journal.journal_no ?? null, voucherNo: journal.voucher_no ?? null,
      postedAt: journal.posted_at == null ? null : String(journal.posted_at), scopeSerials: scopeSerials(journal), lines };
  });
  return result ?? null;
}


export async function readSalesTransferReceipts(orderId: string, transferJournalId: string, finalCurrency: string) {
  const result = await withLocalPg(async (sql) => {
    const receipts = await sql`
      select case when count(*) filter (where amount is null) = 0 then coalesce(sum(amount), 0) end as received,
             case when count(*) filter (where amount is null and kind = 'advance') = 0
                  then coalesce(sum(amount) filter (where kind = 'advance'), 0) end as advance
      from (
        select p.payment_kind as kind, case when upper(p.currency_code) = upper(${finalCurrency}::text)
          then p.amount else p.base_currency_amount end as amount
        from public.sales_order_payments p
        join public.roznamcha_entries r on r.id = p.roznamcha_entry_id
        where p.sales_order_id = ${orderId}::uuid and p.deleted_at is null and p.status = 'posted'
          and r.deleted_at is null and r.status = 'posted' and coalesce(r.operational_domain, 'business') = 'business'
          and p.payment_kind <> 'booking' and r.id <> ${transferJournalId}::uuid
      ) payments
    `;
    return receipts[0] ?? null;
  });
  return result ?? null;
}
