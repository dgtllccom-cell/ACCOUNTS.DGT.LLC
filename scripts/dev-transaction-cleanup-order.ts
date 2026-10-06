/** Shared by scripts/dev-transaction-cleanup.mts and scripts/dev-transaction-restore.mts (DEV ONLY). */
/** Delete order: children before parents. Every row of each table is removed. */
export const DELETE_ORDER: string[] = [
  // shipping / clearing chain
  "shipping_expense_transfers", "clearing_bill_customer_charges", "clearing_payment_bill_payments", "clearing_payment_bills",
  "clearing_customer_bill_items", "clearing_customer_bill_orders", "clearing_customer_bills", "clearing_order_insurance_policies",
  "clearing_customer_order_goods_verifications", "clearing_customer_order_loading_allocations", "clearing_customer_order_parties",
  "shipping_bl_records", "shipping_line_records", "clearing_customer_order_legs", "inter_country_transfers", "clearing_customer_orders",
  "transit_entries", "truck_loadings",
  "consignment_event", "consignment_receipt", "consignment_sale", "consignment_expense", "consignment_container_good", "consignment_container", "consignment",
  // purchase / local purchase / sales / stock
  "stock_movements", "purchase_lane_events", "purchase_lane_loads", "purchase_order_payments", "purchase_order_expenses", "purchase_order_items",
  "purchase_loading_records", "purchase_orders", "local_purchases",
  "sales_order_payments", "sales_order_items", "sales_orders", "product_inventory_balances",
  "business_edit_invoice_events", "business_edit_invoice_lines", "business_edit_invoice_versions", "business_edit_invoices",
  // finance: receipts, settlement, cash/exchange, bills, roznamcha, journal, ledger postings
  "customer_receipt_allocations", "customer_receipts", "settlement_audit_log", "settlement_transactions", "money_exchange_entries",
  "bank_cheque_transactions", "bill_expense_lines", "bill_expenses", "expenses_bill_lines", "expenses_bills",
  "roznamcha_reversals", "roznamcha_lines", "roznamcha_entries", "journal_reversals", "journal_lines", "journal_entries",
  "ledger_posting_lines", "ledger_posting_batches", "ledger_balances",
  // HR payroll postings
  "hr_wps_payment_results", "hr_wps_sif_lines", "hr_wps_sif_events", "hr_wps_sif_files", "hr_payroll_run_events", "hr_payroll_run_lines",
  "hr_payroll_runs", "employee_salaries_due", "hr_gratuity_settlements",
  // tax filings / e-invoices derived from the transactions above
  "uae_vat_postings", "uae_vat_return_lines", "uae_tax_line_documents", "uae_tax_lines", "uae_vat_returns", "uae_e_invoice_events", "uae_e_invoices",
  "pk_sales_tax_events", "pk_sales_tax_returns", "pk_income_tax_events", "pk_income_tax_returns",
  "uae_ct_adjustments", "uae_ct_documents", "uae_ct_events", "uae_ct_returns",
  // transient request locks keyed on business references of the deleted rows
  "idempotency_keys",
];
