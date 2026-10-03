-- PRODUCTION restore for the 2026-10-04 fresh-start cleanup (project inmayhrxucimxqhgseqi).
-- Snapshot: schema backup_20261004 — every public table (331), verified identical to Production before the cleanup
-- (row counts + full-content md5). Rehearsed on 2026-10-04: 211 rows restored, 28/28 tables byte-identical, rolled back.
--
-- Run ONLY if the cleanup must be undone. Runs as one transaction; triggers are disabled for the restore so derived
-- rows (bill-expense mirrors, tax sync) are restored exactly as they were instead of being re-generated.
begin;
set local session_replication_role = replica;

-- 1. transactional rows removed by the cleanup
insert into public.hr_payroll_runs              select * from backup_20261004.hr_payroll_runs;
insert into public.hr_payroll_run_events        select * from backup_20261004.hr_payroll_run_events;
insert into public.ledger_balances              select * from backup_20261004.ledger_balances;
insert into public.local_purchases              select * from backup_20261004.local_purchases;
insert into public.purchase_orders              select * from backup_20261004.purchase_orders;
insert into public.purchase_order_items         select * from backup_20261004.purchase_order_items;
insert into public.purchase_order_payments      select * from backup_20261004.purchase_order_payments;
insert into public.purchase_loading_records     select * from backup_20261004.purchase_loading_records;
insert into public.roznamcha_entries            select * from backup_20261004.roznamcha_entries;
insert into public.roznamcha_lines              select * from backup_20261004.roznamcha_lines;
insert into public.business_edit_invoices       select * from backup_20261004.business_edit_invoices;
insert into public.business_edit_invoice_lines  select * from backup_20261004.business_edit_invoice_lines;
insert into public.business_edit_invoice_events select * from backup_20261004.business_edit_invoice_events;
insert into public.business_edit_invoice_versions select * from backup_20261004.business_edit_invoice_versions;
insert into public.money_exchange_entries       select * from backup_20261004.money_exchange_entries;
insert into public.shipping_agent_entries       select * from backup_20261004.shipping_agent_entries;
insert into public.clearing_customer_orders     select * from backup_20261004.clearing_customer_orders;
insert into public.clearing_customer_order_legs select * from backup_20261004.clearing_customer_order_legs;
insert into public.clearing_customer_order_parties select * from backup_20261004.clearing_customer_order_parties;
insert into public.clearing_customer_order_loading_allocations select * from backup_20261004.clearing_customer_order_loading_allocations;
insert into public.clearing_customer_bills      select * from backup_20261004.clearing_customer_bills;
insert into public.clearing_customer_bill_items select * from backup_20261004.clearing_customer_bill_items;
insert into public.clearing_customer_bill_orders select * from backup_20261004.clearing_customer_bill_orders;
insert into public.super_admin_capital_accounts select * from backup_20261004.super_admin_capital_accounts;
insert into public.bill_expenses                select * from backup_20261004.bill_expenses;

-- 2. masters / counters whose derived columns were reset: whole-row images from the snapshot
delete from public.ledgers;                      insert into public.ledgers                      select * from backup_20261004.ledgers;
delete from public.enterprise_accounts;          insert into public.enterprise_accounts          select * from backup_20261004.enterprise_accounts;
delete from public.transaction_serial_sequences; insert into public.transaction_serial_sequences select * from backup_20261004.transaction_serial_sequences;

commit;
-- After a successful restore (or once the fresh start is confirmed and no restore is needed) the snapshot can be dropped:
--   drop schema backup_20261004 cascade;
