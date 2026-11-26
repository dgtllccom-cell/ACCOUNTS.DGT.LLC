import { ApiClientError } from "@/lib/api/response";

/** Normalize only positively identified historical postings inside the same order transaction.
 * The 20261202 RPC used an order-keyed source even for receipts. An ambiguous row must not
 * be renamed or allow another posting; receipt versus transfer is determined by book entries,
 * not the old payment_kind alone. No ledger amounts or receipt records are changed here.
 */
export async function normalizeLegacySalesPaymentSources(sql: any, orderId: string, customerLedgerId: string, transferJournalId?: string | null) {
  const rows = await sql`
    select r.id,
      exists(select 1 from public.sales_order_payments p where p.sales_order_id = ${orderId}::uuid
        and p.roznamcha_entry_id = r.id and p.status = 'posted' and p.deleted_at is null
        and p.payment_kind <> 'booking') and
      exists(select 1 from public.roznamcha_lines l where l.roznamcha_entry_id = r.id
        and l.ledger_id = ${customerLedgerId}::uuid and l.credit > 0 and coalesce(l.debit,0) = 0) and
      not exists(select 1 from public.roznamcha_lines l where l.roznamcha_entry_id = r.id
        and l.ledger_id = ${customerLedgerId}::uuid and l.debit > 0) as verified_receipt
    from public.roznamcha_entries r
    where r.source_module = 'sales' and r.source_transaction_type = 'sales_booking_transfer'
      and r.source_transaction_id = ${orderId}::uuid and r.deleted_at is null and r.status <> 'cancelled'
      and coalesce(r.operational_domain, 'business') = 'business'
    for update of r
  `;
  for (const row of rows) {
    if (transferJournalId && row.id === transferJournalId) {
      const duplicate = await sql`
        select id from public.roznamcha_entries where source_module = 'sales'
          and source_transaction_type = 'sales_transfer_to_payment' and source_transaction_id = ${orderId}::uuid
          and deleted_at is null and status <> 'cancelled' limit 1
      `;
      if (duplicate.length) throw requiresReview();
      await sql`update public.roznamcha_entries set source_transaction_type = 'sales_transfer_to_payment'
        where id = ${row.id}::uuid and status = 'posted'`;
    } else if (row.verified_receipt) {
      await sql`update public.roznamcha_entries set source_transaction_type = 'sales_payment', source_transaction_id = id
        where id = ${row.id}::uuid and status = 'posted'`;
    } else {
      throw requiresReview();
    }
  }
}

function requiresReview() {
  return new ApiClientError("This booking has a legacy posting that requires reconciliation before entering another.", {
    status: 409, code: "SALES_LEGACY_POSTING_REVIEW",
  });
}
