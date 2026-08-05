-- Read-only diagnostics for duplicate Purchase/Sales Bill posting.
-- Safe to re-run any time against any environment; makes no writes.
--
-- Background: a bug in app/api/erp/purchases/orders/[id]/transfer/route.ts caused every Purchase
-- Bill transfer to write BOTH a roznamcha_entries/roznamcha_lines posting (via the
-- post_purchase_booking_transfer RPC) AND a separate journal_entries/journal_lines posting for the
-- same bill, and had no guard against re-transferring the same bill twice. Both issues were fixed in
-- migrations/20260812_roznamcha_posting_idempotency_and_category.sql and the transfer route itself.
-- Run this after applying the fix (or periodically) to confirm no duplicate postings exist.

-- 1. Mirrored journal_entries for purchase orders (should be 0 rows / 0 totals after the fix;
--    any pre-existing rows here are leftover duplicates from before the fix and should be reviewed
--    and reversed with a correcting entry, never deleted directly, before being reported as resolved).
select je.id as journal_entry_id, je.entry_no, je.source_id as purchase_order_id, je.entry_date,
       jl.account_id, jl.debit, jl.credit
from journal_entries je
join journal_lines jl on jl.journal_entry_id = je.id
where je.source_type = 'purchase_order'
order by je.entry_date desc;

-- 2. Purchase orders with more than one active roznamcha posting (re-transfer duplicates).
select po.id as purchase_order_id, po.purchase_order_no, po.ledger_posting_status,
       count(re.id) as roznamcha_entry_count,
       array_agg(re.id order by re.created_at) as roznamcha_entry_ids,
       array_agg(re.voucher_no order by re.created_at) as voucher_numbers
from purchase_orders po
join roznamcha_entries re
  on re.source_module = 'purchase'
  and re.source_transaction_id = po.id
  and re.deleted_at is null
  and re.status <> 'cancelled'
where po.deleted_at is null
group by po.id, po.purchase_order_no, po.ledger_posting_status
having count(re.id) > 1
order by roznamcha_entry_count desc;

-- 3. Sales orders with more than one active roznamcha posting.
select so.id as sales_order_id, so.sales_order_no, so.ledger_posting_status,
       count(re.id) as roznamcha_entry_count,
       array_agg(re.id order by re.created_at) as roznamcha_entry_ids
from sales_orders so
join roznamcha_entries re
  on re.source_module = 'sales'
  and re.source_transaction_id = so.id
  and re.deleted_at is null
  and re.status <> 'cancelled'
where so.deleted_at is null
group by so.id, so.sales_order_no, so.ledger_posting_status
having count(re.id) > 1
order by roznamcha_entry_count desc;

-- 4. Global debit/credit balance sanity check across all posting tables.
select
  (select coalesce(sum(debit), 0) from roznamcha_lines) as roznamcha_debit,
  (select coalesce(sum(credit), 0) from roznamcha_lines) as roznamcha_credit,
  (select coalesce(sum(debit), 0) from journal_lines) as journal_debit,
  (select coalesce(sum(credit), 0) from journal_lines) as journal_credit,
  (select coalesce(sum(debit), 0) from ledger_posting_lines) as ledger_posting_debit,
  (select coalesce(sum(credit), 0) from ledger_posting_lines) as ledger_posting_credit;
