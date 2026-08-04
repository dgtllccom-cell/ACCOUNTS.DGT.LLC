import type { SupportedLanguage } from "@/lib/i18n/languages";

export type UiKey =
  // Sidebar navigation
  | "nav.dashboard"
  | "nav.super_admin_dashboard"
  | "nav.country_dashboard"
  | "nav.city_dashboard"
  | "nav.agent_dashboard"
  | "nav.shipping_line_dashboard"
  | "nav.clearing_agent_dashboard"
  | "nav.new_entry"
  | "nav.branch_entry"
  | "nav.branch_menu"
  | "nav.super_admin_branch"
  | "nav.country_branch"
  | "nav.city_branch"
  | "nav.user_entry"
  | "nav.user_form"
  | "nav.user_journal_report"
  | "nav.accounts"
  | "nav.new_account"
  | "nav.new_account_general_report"
  | "nav.account_setup_report"
  | "nav.super_admin_account_entry"
  | "nav.daily_payment_entry"
  | "nav.journal"
  | "nav.purchase_order_payment"
  | "nav.purchase_order_payment_advance"
  | "nav.purchase_order_payment_advance_completed"
  | "nav.purchase_order_payment_remaining"
  | "nav.purchase_order_payment_charges"
  | "nav.purchase_order_payment_history"
  | "nav.sales_transfer_payment"
  | "nav.sales_order_payment"
  | "nav.sales_order_payment_advance"
  | "nav.sales_order_payment_advance_completed"
  | "nav.sales_order_payment_remaining"
  | "nav.sales_order_payment_charges"
  | "nav.sales_order_payment_history"
  | "nav.final_payments"
  | "nav.final_payments_advance_nil"
  | "nav.purchase_order_management"
  | "nav.product_units"
  | "nav.product_brands"
  | "nav.product_categories"
  | "nav.warehouses"
  | "nav.truck_registration"
  | "nav.truck_loading"
  | "nav.import_loading"
  | "nav.transit_loading"
  | "nav.walkthrough_video"
  | "tt.title"
  | "tt.select_truck"
  | "tt.date"
  | "tt.company"
  | "tt.goods"
  | "tt.qty"
  | "tt.unit"
  | "tt.route"
  | "tt.border"
  | "tt.destination"
  | "tt.customs"
  | "tt.container"
  | "tt.seal"
  | "tt.remarks"
  | "tt.add"
  | "tt.edit"
  | "tt.delete"
  | "tt.save"
  | "tt.cancel"
  | "tt.search"
  | "tt.empty"
  | "il.title"
  | "il.select_truck"
  | "il.date"
  | "il.bill"
  | "il.importer"
  | "il.supplier"
  | "il.goods"
  | "il.qty"
  | "il.unit"
  | "il.customs"
  | "il.border"
  | "il.origin"
  | "il.dest_country"
  | "il.agent"
  | "il.remarks"
  | "il.add"
  | "il.edit"
  | "il.delete"
  | "il.save"
  | "il.cancel"
  | "il.search"
  | "il.empty"
  | "tl.title"
  | "tl.select_truck"
  | "tl.date"
  | "tl.serial"
  | "tl.goods"
  | "tl.qty"
  | "tl.unit"
  | "tl.net_weight"
  | "tl.gross_weight"
  | "tl.destination"
  | "tl.remarks"
  | "tl.add"
  | "tl.edit"
  | "tl.delete"
  | "tl.save"
  | "tl.cancel"
  | "tl.search"
  | "tl.empty"
  | "tr.title"
  | "tr.number"
  | "tr.reg_no"
  | "tr.type"
  | "tr.owner"
  | "tr.owner_mobile"
  | "tr.company"
  | "tr.driver"
  | "tr.driver_mobile"
  | "tr.status"
  | "tr.reg_expiry"
  | "tr.ins_expiry"
  | "tr.add"
  | "tr.edit"
  | "tr.delete"
  | "tr.save"
  | "tr.cancel"
  | "tr.search"
  | "tr.empty"
  | "pc.title"
  | "pc.code"
  | "pc.name"
  | "pc.description"
  | "pc.active"
  | "pc.add"
  | "pc.edit"
  | "pc.delete"
  | "pc.save"
  | "pc.cancel"
  | "pc.search"
  | "pc.empty"
  | "pb.title"
  | "pb.code"
  | "pb.name"
  | "pb.description"
  | "pb.active"
  | "pb.add"
  | "pb.edit"
  | "pb.delete"
  | "pb.save"
  | "pb.cancel"
  | "pb.search"
  | "pb.empty"
  | "pu.title"
  | "pu.code"
  | "pu.name"
  | "pu.base"
  | "pu.factor"
  | "pu.active"
  | "pu.add"
  | "pu.edit"
  | "pu.delete"
  | "pu.save"
  | "pu.cancel"
  | "pu.search"
  | "pu.empty"
  | "nav.local_purchase_management"
  | "nav.sales_order_management"
  | "nav.local_sales_management"
  | "nav.new_purchase_order"
  | "nav.booking_purchase_orders"
  | "nav.booking_confirm"
  | "nav.purchase_invoice"
  | "nav.purchase_order_report"
  | "nav.confirmed_purchase_orders"
  | "nav.container_loading"
  | "nav.shipping_documents"
  | "nav.shipment_details"
  | "nav.generate_bl"
  | "nav.bl_report"
  | "nav.shipment_report"
  | "nav.finalized_purchase_orders"
  | "nav.purchase_order_tracking"
  | "nav.stock"
  | "nav.tax"
  | "nav.booking_stock"
  | "nav.confirmed_stock"
  | "nav.import_stock"
  | "nav.journal_stock"
  | "nav.journal_stock_report"
  | "nav.document_management"
  | "nav.general_office_management"
  | "nav.employee_master_setup"
  | "nav.employee_management"
  | "nav.departments"
  | "nav.designations"
  | "nav.attendance"
  | "nav.leave_management"
  | "nav.payroll_salary"
  | "nav.office_assets"
  | "nav.office_documents"
  | "nav.employee_id_cards"
  | "nav.employee_reports"
  | "nav.scanner_integration"
  | "nav.all_reports_catalog"
  | "nav.journal_bill_checking"
  | "nav.journal_booking_stock"
  | "nav.warehouse_stock"
  | "nav.in_transit_stock"
  | "nav.export_stock"
  | "nav.delivered_stock"
  | "nav.stock_reports"
  | "nav.salesman_report"
  | "nav.country_report"
  | "nav.branch_report"
  | "nav.journal_report"
  | "nav.journal_salesman_report"
  | "nav.journal_country_report"
  | "nav.journal_branch_report"
  | "nav.roznamcha"
  | "nav.expenses_bill"
  | "nav.all_roznamcha"
  | "nav.roznamcha_all_report"
  | "nav.super_admin_roznamcha"
  | "nav.country_roznamcha"
  | "nav.branch_roznamcha"
  | "nav.cash_entry"
  | "nav.cash_entry_super_admin"
  | "nav.cash_entry_country"
  | "nav.cash_entry_branch"
  | "nav.ledgers"
  | "nav.new_ledger"
  | "nav.super_admin_ledger"
  | "nav.country_ledger"
  | "nav.branch_ledger"
  | "nav.ledger_general_report"
  | "nav.ledger_outstanding"
  | "nav.ledger_super_admin_detailed"
  | "nav.ledger_country_detailed"
  | "nav.shipping_clearing"
  | "nav.shipping_line"
  | "nav.bl_entry"
  | "nav.shipping_agent_entry"
  | "nav.clearing_agent"
  | "nav.agent_custom_entry"
  | "nav.clearing_bill_entry"
  | "nav.payment_bill_entry"
  | "nav.purchase_sale"
  | "nav.purchase"
  | "nav.purchase_transfer_payment"
  | "nav.purchase_order"
  | "nav.purchase_confirm"
  | "nav.purchase_loading_records"
  | "nav.purchase_booking_journal_report"
  | "nav.purchase_booking_register"
  | "nav.local_purchase"
  | "nav.sales"
  | "nav.sales_order"
  | "nav.sales_confirm"
  | "nav.local_sales"
  | "nav.reports"
  | "nav.search_portal"
  | "nav.daily_reports"
  | "nav.daily_payment_report"
  | "nav.roznamcha_report"
  | "nav.all_roznamcha_reports"
  | "nav.ledger_reports"
  | "nav.ledger_journal_reports"
  | "nav.super_admin_journal_report"
  | "nav.country_journal_report"
  | "nav.city_journal_report"
  | "nav.construction_journal_report"
  | "nav.super_admin_ledger_report"
  | "nav.country_ledger_report"
  | "nav.branch_ledger_report"
  | "nav.branch_general_report"
  | "nav.other_reports"
  | "nav.kyc_reports"
  | "nav.sales_report"
  | "nav.purchase_report"
  | "nav.exchange_rate_report"
  | "nav.super_admin_exchange_rate"
  | "nav.audit_report"
  | "nav.profit_loss_report"
  | "nav.balance_sheet"
  | "nav.trial_balance"
  | "nav.message_system"
  | "nav.messages_email"
  | "nav.messages_whatsapp"
  | "nav.whatsapp_inbox"
  | "nav.whatsapp_setup"
  | "nav.messages_internal"
  | "nav.notification_center"
  | "nav.settings"
  | "nav.management"
  | "nav.location_form"
  | "nav.location_country"
  | "nav.location_state"
  | "nav.location_city"
  | "nav.location_tehsil"
  | "nav.company_form"
  | "nav.customers_form"
  | "nav.profit_loss_report"
  | "nav.balance_sheet"
  | "nav.trial_balance"
  | "nav.message_system"
  | "nav.messages_email"
  | "nav.messages_whatsapp"
  | "nav.whatsapp_inbox"
  | "nav.whatsapp_setup"
  | "nav.messages_internal"
  | "nav.notification_center"
  | "nav.return_sms_reply"
  | "nav.ai_mobile_reply"
  | "sms_reply.title"
  | "sms_reply.subtitle"
  | "sms_reply.inbox"
  | "sms_reply.reminders"
  | "sms_reply.templates"
  | "sms_reply.ai_rules"
  | "sms_reply.contacts"
  | "sms_reply.reports"
  | "nav.settings"
  | "nav.management"
  | "nav.master_forms"
  | "nav.form_settings"
  | "nav.system_settings"
  | "nav.location_form"
  | "nav.company_form"
  | "nav.customers_form"
  | "nav.employee_management"
  | "nav.contract_type"
  | "nav.company_registration_type"
  | "nav.bank_form"
  | "nav.contact_type"
  | "nav.document_type"
  | "nav.account_type"
  | "nav.goods_master"
  | "nav.loading_port_master"
  | "nav.received_port_master"
  | "nav.port_master"
  | "nav.tax"
  | "nav.tax_settings"
  | "nav.chs_products"
  // Tax UI Keys
  | "tax.title"
  | "tax.subtitle"
  | "tax.select_country"
  | "tax.add_new_tax"
  | "tax.edit_tax"
  | "tax.tax_name"
  | "tax.tax_code"
  | "tax.tax_rate"
  | "tax.trn_number"
  | "tax.applies_to"
  | "tax.purchase"
  | "tax.sales"
  | "tax.both"
  | "tax.expense"
  | "tax.is_default"
  | "tax.is_active"
  | "tax.actions"
  | "tax.no_taxes_found"
  | "tax.saved_successfully"
  | "tax.deleted_successfully"
  | "nav.dashboard_settings"
  | "nav.template_color"
  | "nav.template_purple"
  | "nav.template_blue"
  | "nav.template_green"
  | "nav.template_gold"
  | "nav.template_cyan"
  | "nav.translations_management"
  | "nav.pakistan"
  | "nav.afghanistan"
  | "nav.india"
  | "nav.uae_dubai"
  | "nav.iran"
  // Common
  | "common.coming_soon"
  // Dashboard widgets
  | "dash.total_branches"
  | "dash.total_users"
  | "dash.daily_sales"
  | "dash.daily_purchases"
  | "dash.profit_loss"
  | "dash.recent_transactions"
  | "dash.pending_approvals"
  | "dash.currency_rates"
  | "dash.quick_actions"
  | "dash.sales_overview"
  | "dash.branch_performance"
  // Auth/Login UI
  | "auth.welcome_back"
  | "auth.sign_in_continue"
  | "auth.user_id_or_email"
  | "auth.password"
  | "auth.remember_me"
  | "auth.forgot_password"
  | "auth.sign_in"
  | "auth.or_continue_with"
  | "auth.sign_in_google"
  | "auth.choose_theme"
  | "auth.support"
  // Roznamcha Report UI
  | "roz.report_subtitle"
  | "roz.filters"
  | "roz.country"
  | "roz.branch"
  | "roz.all"
  | "roz.search"
  | "roz.search_placeholder"
  | "roz.select_entry_hint"
  | "roz.entries"
  | "roz.date"
  | "roz.voucher_no"
  | "roz.journal_no"
  | "roz.narration"
  | "roz.status"
  | "roz.posted_at"
  | "roz.approved_at"
  | "roz.created_by"
  | "roz.no_entries"
  | "roz.entry_details"
  | "roz.lines"
  | "roz.reference_no"
  | "roz.payment_entry_type"
  | "roz.ledger"
  | "roz.account"
  | "roz.description"
  | "roz.currency"
  | "roz.debit"
  | "roz.credit"
  | "roz.no_lines"
  | "roz.not_found"
  // Ledger Report UI
  | "ledger.report_title"
  | "ledger.report_subtitle"
  | "ledger.print"
  | "ledger.export_csv"
  | "ledger.actions"
  | "ledger.account_details"
  | "ledger.company_details"
  | "ledger.branch_details"
  | "ledger.summary"
  | "ledger.session_details"
  | "ledger.filters"
  | "ledger.entries_table_title"
  | "ledger.ac_name"
  | "ledger.ac_number"
  | "ledger.economic_name"
  | "ledger.category"
  | "ledger.account_title"
  | "ledger.account_type"
  | "ledger.currency"
  | "ledger.contract_no"
  | "ledger.contract_date"
  | "ledger.contract_type"
  | "ledger.company_name"
  | "ledger.business_title"
  | "ledger.registration_number"
  | "ledger.trn"
  | "ledger.website"
  | "ledger.branch_name"
  | "ledger.branch_account_no"
  | "ledger.country"
  | "ledger.state_city"
  | "ledger.address"
  | "ledger.entries"
  | "ledger.total_debit"
  | "ledger.total_credit"
  | "ledger.current_balance"
  | "ledger.last_transaction"
  | "ledger.last_reference"
  | "ledger.ledger_status"
  | "ledger.normal_balance"
  | "ledger.ledger_scope"
  | "ledger.exchange_rate_local_to_usd"
  | "ledger.exchange_rate_ph"
  | "ledger.exchange_rate_hint"
  | "ledger.session_branch"
  | "ledger.user_name"
  | "ledger.user_id"
  | "ledger.roles"
  | "ledger.filter_account_no"
  | "ledger.filter_account_no_ph"
  | "ledger.select_account"
  | "ledger.select_account_ph"
  | "ledger.loading"
  | "ledger.date_preset"
  | "ledger.preset_yesterday"
  | "ledger.preset_this_week"
  | "ledger.preset_this_month"
  | "ledger.preset_today"
  | "ledger.preset_last_7"
  | "ledger.preset_last_30"
  | "ledger.preset_custom"
  | "ledger.from_date"
  | "ledger.to_date"
  | "ledger.branch_filter"
  | "ledger.all_branches"
  | "ledger.apply"
  | "ledger.reset"
  | "ledger.showing_range"
  | "ledger.select_account_hint"
  | "ledger.entry_search_ph"
  | "ledger.rows"
  | "ledger.page"
  | "ledger.col_date"
  | "ledger.col_branch"
  | "ledger.col_serial"
  | "ledger.col_user"
  | "ledger.col_roz"
  | "ledger.col_account_name"
  | "ledger.col_account_no"
  | "ledger.col_name"
  | "ledger.source_ledger"
  | "ledger.source_roznamcha"
  | "ledger.col_no"
  | "ledger.col_details"
  | "ledger.col_debit"
  | "ledger.col_credit"
  | "ledger.col_total"
  | "ledger.col_ex_rate"
  | "ledger.col_debit_usd"
  | "ledger.col_credit_usd"
  | "ledger.no_data"
  | "ledger.no_entries"
  | "ledger.totals"
  | "ledger.pagination_hint"
  | "ledger.prev"
  | "ledger.next"
  | "ledger.entries_label"
  | "ledger.entries_table"
  // Form fields & Buttons
  | "form.from"
  | "form.to"
  | "form.quantity"
  | "form.debit_credit"
  | "form.submit"
  | "form.reset"
  | "form.transaction_rate"
  | "form.operation"
  | "form.final_amount"
  | "form.remarks_notes"
  | "form.save"
  | "form.save_view"
  | "form.save_submit"
  | "form.search_account"
  | "form.daily_payment_date"
  | "form.roznamcha_type"
  | "form.roznamcha_number"
  | "form.roznamcha_category"
  | "form.currency_type"
  // ERP Reports System — Dedicated nav entries
  | "nav.super_admin_reports"
  | "nav.country_reports"
  | "nav.branch_reports"
  | "nav.reports_hub"
  // ERP Reports System — Report type labels
  | "report.purchase"
  | "report.sales"
  | "report.loading"
  | "report.transfer"
  | "report.payment"
  | "report.remaining"
  | "report.ledger"
  | "report.roznamcha"
  | "report.journal"
  | "report.cash"
  | "report.inventory"
  | "report.daily_comprehensive"
  | "report.purchase_booking"
  | "report.user_activity"
  | "report.audit_log"
  | "report.exchange_rate"
  // ERP Reports System — Panel titles
  | "report.panel_super_admin"
  | "report.panel_country"
  | "report.panel_branch"
  | "report.panel_subtitle_super"
  | "report.panel_subtitle_country"
  | "report.panel_subtitle_branch"
  // ERP Reports System — Filter bar labels
  | "report.filter_country"
  | "report.filter_branch"
  | "report.filter_main_branch"
  | "report.filter_date_from"
  | "report.filter_date_to"
  | "report.filter_currency"
  | "report.filter_exchange_rate"
  | "report.filter_user"
  | "report.filter_report_type"
  | "report.filter_all_countries"
  | "report.filter_all_branches"
  | "report.filter_all_users"
  | "report.filter_all_currencies"
  | "report.filter_reset"
  | "report.filter_apply"
  | "report.filter_date_range"
  // ERP Reports System — KPI cards
  | "report.kpi_total_records"
  | "report.kpi_total_debit"
  | "report.kpi_total_credit"
  | "report.kpi_net_balance"
  | "report.kpi_total_purchase"
  | "report.kpi_total_sales"
  | "report.kpi_total_payment"
  | "report.kpi_total_remaining"
  // ERP Reports System — Export toolbar
  | "report.export_pdf"
  | "report.export_excel"
  | "report.export_csv"
  | "report.print"
  | "report.share_whatsapp"
  | "report.share_email"
  | "report.reload"
  | "report.search"
  | "report.search_placeholder"
  // ERP Reports System — Table
  | "report.no_data"
  | "report.loading"
  | "report.error"
  | "report.generated_at"
  | "report.scope_label"
  | "report.scope_global"
  | "report.scope_country"
  | "report.scope_branch"
  // ERP Reports System — Column headers
  | "report.col_date"
  | "report.col_serial"
  | "report.col_description"
  | "report.col_debit"
  | "report.col_credit"
  | "report.col_balance"
  | "report.col_currency"
  | "report.col_status"
  | "report.col_branch"
  | "report.col_country"
  | "report.col_user"
  | "report.col_amount"
  | "report.col_reference";

type Dict = Record<UiKey, string>;

const en: Dict = {
  "nav.dashboard": "Dashboard",
  "nav.super_admin_dashboard": "Super Admin Dashboard",
  "nav.country_dashboard": "Country Dashboard",
  "nav.city_dashboard": "City Dashboard",
  "nav.agent_dashboard": "Agent Dashboard",
  "nav.shipping_line_dashboard": "Shipping Line Dashboard",
  "nav.clearing_agent_dashboard": "Clearing Agent Dashboard",
  "nav.new_entry": "New Entries",
  "nav.branch_entry": "Branch",
  "nav.branch_menu": "Branch",
  "nav.super_admin_branch": "Super Admin Branch",
  "nav.country_branch": "Country Branch",
  "nav.city_branch": "City Branch",
  "nav.user_entry": "User Registration & Employees",
  "nav.user_form": "New User Registration / Employee Form",
  "nav.user_journal_report": "User & Employee Master Report",
  "nav.accounts": "Accounts",
  "nav.new_account": "New Account Setup",
  "nav.new_account_general_report": "Account General Report",
  "nav.account_setup_report": "Account Setup Report",
  "nav.super_admin_account_entry": "Super Admin Account Entry",
  "nav.daily_payment_entry": "Daily Payment Entry",
  "nav.journal": "Daily Payment Entry",
  "nav.purchase_order_payment": "Purchase Order Payment",
  "nav.purchase_order_payment_advance": "Advance Payment",
  "nav.purchase_order_payment_advance_completed": "Completed Advance",
  "nav.purchase_order_payment_remaining": "Remaining Payment",
  "nav.purchase_order_payment_charges": "Credit Payment",
  "nav.purchase_order_payment_history": "Payment History",
  "nav.sales_transfer_payment": "Sales Transfer Payment",
  "nav.sales_order_payment": "Sales Order Payment",
  "nav.sales_order_payment_advance": "Sales Advance",
  "nav.sales_order_payment_advance_completed": "Completed Advance",
  "nav.sales_order_payment_remaining": "Remaining Payment",
  "nav.sales_order_payment_charges": "Final Credit",
  "nav.sales_order_payment_history": "Final Account",
  "nav.final_payments": "Final Payments",
  "nav.final_payments_advance_nil": "Advance Payment Nil Receipt",
  "nav.purchase_order_management": "Purchase Order Management",
  "nav.product_units": "Product Units",
  "nav.product_brands": "Product Brands",
  "nav.product_categories": "Product Categories",
  "nav.warehouses": "Warehouses",
  "nav.truck_registration": "Truck Registration",
  "nav.truck_loading": "Truck Loading",
  "nav.import_loading": "Import Loading",
  "nav.transit_loading": "Transit Loading",
  "nav.walkthrough_video": "System Walkthrough Video",
  "tt.title": "Transit Loading",
  "tt.select_truck": "Select Truck",
  "tt.date": "Transit Date",
  "tt.company": "Transit Company",
  "tt.goods": "Goods",
  "tt.qty": "Quantity",
  "tt.unit": "Unit",
  "tt.route": "Transit Route",
  "tt.border": "Border",
  "tt.destination": "Destination",
  "tt.customs": "Customs Info",
  "tt.container": "Container No",
  "tt.seal": "Seal No",
  "tt.remarks": "Remarks",
  "tt.add": "New Transit",
  "tt.edit": "Edit",
  "tt.delete": "Delete",
  "tt.save": "Save",
  "tt.cancel": "Cancel",
  "tt.search": "Search transits...",
  "tt.empty": "No transits found",
  "il.title": "Import Loading",
  "il.select_truck": "Select Truck",
  "il.date": "Import Date",
  "il.bill": "Bill Number",
  "il.importer": "Importer",
  "il.supplier": "Supplier",
  "il.goods": "Goods",
  "il.qty": "Quantity",
  "il.unit": "Unit",
  "il.customs": "Customs Office",
  "il.border": "Border Crossing",
  "il.origin": "Country of Origin",
  "il.dest_country": "Destination Country",
  "il.agent": "Clearing Agent",
  "il.remarks": "Remarks",
  "il.add": "New Import",
  "il.edit": "Edit",
  "il.delete": "Delete",
  "il.save": "Save",
  "il.cancel": "Cancel",
  "il.search": "Search imports...",
  "il.empty": "No imports found",
  "tl.title": "Truck Loading",
  "tl.select_truck": "Select Truck",
  "tl.date": "Loading Date",
  "tl.serial": "Serial",
  "tl.goods": "Goods",
  "tl.qty": "Quantity",
  "tl.unit": "Unit",
  "tl.net_weight": "Net Weight",
  "tl.gross_weight": "Gross Weight",
  "tl.destination": "Destination",
  "tl.remarks": "Remarks",
  "tl.add": "New Loading",
  "tl.edit": "Edit",
  "tl.delete": "Delete",
  "tl.save": "Save",
  "tl.cancel": "Cancel",
  "tl.search": "Search loadings...",
  "tl.empty": "No loadings found",
  "tr.title": "Truck Registration",
  "tr.number": "Truck Number",
  "tr.reg_no": "Registration No",
  "tr.type": "Truck Type",
  "tr.owner": "Owner Name",
  "tr.owner_mobile": "Owner Mobile",
  "tr.company": "Transport Company",
  "tr.driver": "Driver Name",
  "tr.driver_mobile": "Driver Mobile",
  "tr.status": "Status",
  "tr.reg_expiry": "Reg. Expiry",
  "tr.ins_expiry": "Insurance Expiry",
  "tr.add": "Add Truck",
  "tr.edit": "Edit",
  "tr.delete": "Delete",
  "tr.save": "Save",
  "tr.cancel": "Cancel",
  "tr.search": "Search trucks...",
  "tr.empty": "No trucks found",
  "pc.title": "Product Categories",
  "pc.code": "Category Code",
  "pc.name": "Category Name",
  "pc.description": "Description",
  "pc.active": "Active",
  "pc.add": "Add Category",
  "pc.edit": "Edit",
  "pc.delete": "Delete",
  "pc.save": "Save",
  "pc.cancel": "Cancel",
  "pc.search": "Search categories...",
  "pc.empty": "No categories found",
  "pb.title": "Product Brands",
  "pb.code": "Brand Code",
  "pb.name": "Brand Name",
  "pb.description": "Description",
  "pb.active": "Active",
  "pb.add": "Add Brand",
  "pb.edit": "Edit",
  "pb.delete": "Delete",
  "pb.save": "Save",
  "pb.cancel": "Cancel",
  "pb.search": "Search brands...",
  "pb.empty": "No brands found",
  "pu.title": "Product Units",
  "pu.code": "Unit Code",
  "pu.name": "Unit Name",
  "pu.base": "Base Unit",
  "pu.factor": "Conversion Factor",
  "pu.active": "Active",
  "pu.add": "Add Unit",
  "pu.edit": "Edit",
  "pu.delete": "Delete",
  "pu.save": "Save",
  "pu.cancel": "Cancel",
  "pu.search": "Search units...",
  "pu.empty": "No units found",
  "nav.local_purchase_management": "Local Purchase Management",
  "nav.sales_order_management": "Sales Order Management",
  "nav.local_sales_management": "Local Sales Management",
  "nav.new_purchase_order": "New Purchase Booking Order",
  "nav.booking_purchase_orders": "Booking Purchase Orders",
  "nav.booking_confirm": "Booking Confirm",
  "nav.purchase_invoice": "Purchase Invoice",
  "nav.purchase_order_report": "Purchase Order Report",
  "nav.confirmed_purchase_orders": "Confirmed Purchase Orders",
  "nav.container_loading": "Container Loading",
  "nav.shipping_documents": "Shipping Documents",
  "nav.shipment_details": "Shipment Details",
  "nav.generate_bl": "Generate Bill of Lading",
  "nav.bl_report": "B/L Report",
  "nav.shipment_report": "Shipment Report",
  "nav.finalized_purchase_orders": "Finalized Purchase Orders",
  "nav.purchase_order_tracking": "Purchase Order Tracking",
  "nav.stock": "Stock",
  "nav.tax": "Tax",
  "nav.booking_stock": "Booking Stock",
  "nav.confirmed_stock": "Confirmed Stock",
  "nav.import_stock": "Import Stock",
  "nav.journal_stock": "Journal Stock",
  "nav.journal_stock_report": "Journal Stock Report",
  "nav.journal_stock_checking_report": "Journal Stock Checking Report",
  "nav.document_management": "Document Management & Hardware Scanner",
  "nav.general_office_management": "General Office Management",
  "nav.employee_master_setup": "Employee Master Setup",
  "nav.employee_management": "Employee Management",
  "nav.departments": "Departments",
  "nav.designations": "Designations",
  "nav.attendance": "Attendance",
  "nav.leave_management": "Leave Management",
  "nav.payroll_salary": "Payroll & Salary",
  "nav.office_assets": "Office Assets",
  "nav.office_documents": "Office Documents",
  "nav.employee_id_cards": "Employee ID Cards",
  "nav.employee_reports": "Employee Reports",
  "nav.scanner_integration": "Direct Scanner Capture",
  "nav.all_reports_catalog": "All ERP Reports Catalog",
  "nav.journal_bill_checking": "Journal Bill Checking",
  "nav.journal_booking_stock": "Journal Booking Stock",
  "nav.warehouse_stock": "Warehouse Stock",
  "nav.in_transit_stock": "In Transit Stock",
  "nav.export_stock": "Export Stock",
  "nav.delivered_stock": "Delivered Stock",
  "nav.stock_reports": "Stock Reports",
  "nav.salesman_report": "Salesman Report",
  "nav.country_report": "Country Report",
  "nav.branch_report": "Branch Report",
  "nav.journal_report": "Journal Report",
  "nav.journal_salesman_report": "Journal Salesman Report",
  "nav.journal_country_report": "Journal Country Report",
  "nav.journal_branch_report": "Journal Branch Report",
  "nav.roznamcha": "Daily Payment Entry",
  "nav.expenses_bill": "Expenses Bill",
  "nav.all_roznamcha": "All Roznamcha",
  "nav.roznamcha_all_report": "Roznamcha All Report",
  "nav.super_admin_roznamcha": "Super Admin Roznamcha",
  "nav.country_roznamcha": "Country Roznamcha",
  "nav.branch_roznamcha": "City Roznamcha",
  "nav.cash_entry": "Cash Entry",
  "nav.cash_entry_super_admin": "Super Admin Cash Entry",
  "nav.cash_entry_country": "Country Cash Entry",
  "nav.cash_entry_branch": "Branch Cash Entry",
  "nav.ledgers": "Ledgers",
  "nav.new_ledger": "New Ledger",
  "nav.super_admin_ledger": "Super Admin Ledger",
  "nav.country_ledger": "Country Ledger",
  "nav.branch_ledger": "City Ledger",
  "nav.ledger_general_report": "Ledger General Report",
  "nav.kyc_reports": "KYC Reports",
  "nav.ledger_outstanding": "Outstanding & Recovery Ledger",
  "nav.ledger_super_admin_detailed": "Super Admin Ledger (Detailed)",
  "nav.ledger_country_detailed": "Country Ledger (Detailed)",
  "nav.shipping_clearing": "Shipping Line / Clearing Agent",
  "nav.shipping_line": "Shipping Line",
  "nav.bl_entry": "B/L Entry",
  "nav.shipping_agent_entry": "Shipping Agent Entry",
  "nav.clearing_agent": "Clearing Agent",
  "nav.agent_custom_entry": "Agent Custom Entry",
  "nav.clearing_bill_entry": "Bill Entry",
  "nav.payment_bill_entry": "Payment Bill Entry",
  "nav.purchase_sale": "Purchase & Sale",
  "nav.purchase": "Purchase",
  "nav.purchase_transfer_payment": "Purchase Transfer Payment",
  "nav.purchase_order": "Purchase Order",
  "nav.purchase_confirm": "Purchase Confirm",
  "nav.purchase_loading_records": "Purchase Loading Records",
  "nav.purchase_booking_journal_report": "Purchase Booking Journal Report",
  "nav.purchase_booking_register": "Purchase Booking Register",
  "nav.local_purchase": "Local Purchase",
  "nav.sales": "Sales",
  "nav.sales_order": "Sales Order",
  "nav.sales_confirm": "Sales Confirm",
  "nav.local_sales": "Local Sales",
  "nav.reports": "Reports",
  "nav.search_portal": "Global Search",
  "nav.daily_reports": "Daily Reports",
  "nav.daily_payment_report": "Daily Payment Report",
  "nav.roznamcha_report": "Roznamcha Report",
  "nav.all_roznamcha_reports": "All Roznamcha Reports",
  "nav.ledger_reports": "Ledger Reports",
  "nav.ledger_journal_reports": "Ledger Journal Reports",
  "nav.super_admin_journal_report": "Super Admin Journal Report",
  "nav.country_journal_report": "Country Journal Report",
  "nav.city_journal_report": "City Journal Report",
  "nav.construction_journal_report": "Construction Journal Report",
  "nav.super_admin_ledger_report": "Super Admin Ledger Report",
  "nav.country_ledger_report": "Country Ledger Report",
  "nav.branch_ledger_report": "Branch Ledger Report",
  "nav.branch_general_report": "Branch General Report",
  "nav.other_reports": "Other Reports",
  "nav.kyc_reports": "KYC Reports",
  "nav.sales_report": "Sales Report",
  "nav.purchase_report": "Purchase Report",
  "nav.exchange_rate_report": "Exchange Rate Report",
  "nav.super_admin_exchange_rate": "Daily Exchange Rate",
  "nav.audit_report": "Audit Report",
  "nav.profit_loss_report": "Profit/Loss Report",
  "nav.balance_sheet": "Balance Sheet",
  "nav.trial_balance": "Trial Balance",
  "nav.message_system": "Message System",
  "nav.messages_email": "Email",
  "nav.messages_whatsapp": "WhatsApp",
  "nav.whatsapp_inbox": "WhatsApp Inbox",
  "nav.whatsapp_setup": "Account Setup",
  "nav.messages_internal": "Internal Message",
  "nav.notification_center": "Notification Center",
  "nav.settings": "Settings",
  "nav.management": "Management",
  "nav.master_forms": "Master Forms",
  "nav.form_settings": "Form Settings",
  "nav.system_settings": "System Settings",
  "nav.location_form": "Location Management",
  "nav.location_country": "Country Master",
  "nav.location_state": "State Master",
  "nav.location_city": "City Master",
  "nav.location_tehsil": "Tehsil Master",
  "nav.company_form": "Company Form",
  "nav.customers_form": "Customers Form",
  "nav.employee_management": "Employee Management",
  "nav.contract_type": "Contract Type",
  "nav.company_registration_type": "Company Registration No Type",
  "nav.bank_form": "Bank Form",
  "nav.contact_type": "Contact Type",
  "nav.document_type": "Document Type",
  "nav.account_type": "Account Type",
  "nav.goods_master": "Goods Master",
  "nav.loading_port_master": "Loading Port Master",
  "nav.received_port_master": "Received Port Master",
  "nav.port_master": "Port / Boundary Master",
  "nav.chs_products": "CHS Product Management",
  "nav.dashboard_settings": "Dashboard Settings",
  "nav.template_color": "Template Color",
  "nav.template_purple": "Purple",
  "nav.template_blue": "Blue",
  "nav.template_green": "Green",
  "nav.template_gold": "Gold",
  "nav.template_cyan": "Cyan",
  "nav.translations_management": "Local Translation Management",
  "nav.pakistan": "Pakistan",
  "nav.afghanistan": "Afghanistan",
  "nav.india": "India",
  "nav.uae_dubai": "UAE (Dubai)",
  "nav.iran": "Iran",
  "dash.total_branches": "Total Branches",
  "dash.total_users": "Total Users",
  "dash.daily_sales": "Daily Sales",
  "dash.daily_purchases": "Daily Purchases",
  "dash.profit_loss": "Profit / Loss",
  "dash.recent_transactions": "Recent Transactions",
  "dash.pending_approvals": "Pending Approvals",
  "dash.currency_rates": "Currency Exchange Rates",
  "dash.quick_actions": "Quick Access",
  "dash.sales_overview": "Sales Overview",
  "dash.branch_performance": "Branch Performance",
  "auth.welcome_back": "Welcome Back",
  "auth.sign_in_continue": "Sign in to continue to your account",
  "auth.user_id_or_email": "User ID / Email",
  "auth.password": "Password",
  "auth.remember_me": "Remember me",
  "auth.forgot_password": "Forgot Password?",
  "auth.sign_in": "Sign In",
  "auth.or_continue_with": "or continue with",
  "auth.sign_in_google": "Sign in with Google",
  "auth.choose_theme": "Choose Theme",
  "auth.support": "Support",

  // Roznamcha Report UI
  "roz.report_subtitle": "Daily payment journal report with filters and entry details.",
  "roz.filters": "Filters",
  "roz.country": "Country",
  "roz.branch": "Branch",
  "roz.all": "All",
  "roz.search": "Search",
  "roz.search_placeholder": "Search voucher, narration, account...",
  "roz.select_entry_hint": "Select an entry to view details.",
  "roz.entries": "Entries",
  "roz.date": "Date",
  "roz.voucher_no": "Voucher No",
  "roz.journal_no": "Journal No",
  "roz.narration": "Narration",
  "roz.status": "Status",
  "roz.posted_at": "Posted At",
  "roz.approved_at": "Approved At",
  "roz.created_by": "Created By",
  "roz.no_entries": "No entries found.",
  "roz.entry_details": "Entry Details",
  "roz.lines": "Lines",
  "roz.reference_no": "Reference No",
  "roz.payment_entry_type": "Entry Type",
  "roz.ledger": "Ledger",
  "roz.account": "Account",
  "roz.description": "Description",
  "roz.currency": "Currency",
  "roz.debit": "Debit",
  "roz.credit": "Credit",
  "roz.no_lines": "No lines found.",
  "roz.not_found": "Entry not found.",
  "common.coming_soon": "Coming soon.",

  // Ledger Report UI
  "ledger.report_title": "Ledger Report",
  "ledger.report_subtitle": "Account statement with totals, filters, and exchange rates.",
  "ledger.print": "Print",
  "ledger.export_csv": "Excel (CSV)",
  "ledger.actions": "Actions",
  "ledger.account_details": "Account Details",
  "ledger.company_details": "Company Details",
  "ledger.branch_details": "Branch Details",
  "ledger.summary": "Ledger Summary",
  "ledger.session_details": "Session / Login Details",
  "ledger.filters": "Filters",
  "ledger.entries_table_title": "Ledger Entries",
  "ledger.ac_name": "A/c Name",
  "ledger.ac_number": "A/c Number",
  "ledger.economic_name": "Economic Name",
  "ledger.category": "Category",
  "ledger.account_title": "Account Title",
  "ledger.account_type": "Type",
  "ledger.currency": "Currency",
  "ledger.contract_no": "Contract No",
  "ledger.contract_date": "Contract Date",
  "ledger.contract_type": "Contract Type",
  "ledger.company_name": "Company Name",
  "ledger.business_title": "Business Title",
  "ledger.registration_number": "Registration Number",
  "ledger.trn": "TRN",
  "ledger.website": "Website",
  "ledger.branch_name": "Branch Name",
  "ledger.branch_account_no": "Branch A/c No",
  "ledger.country": "Country",
  "ledger.state_city": "State / City",
  "ledger.address": "Address",
  "ledger.entries": "Entries",
  "ledger.total_debit": "Dr",
  "ledger.total_credit": "Cr",
  "ledger.current_balance": "Balance",
  "ledger.last_transaction": "Last Transaction",
  "ledger.last_reference": "Last Voucher/Ref",
  "ledger.ledger_status": "Status",
  "ledger.normal_balance": "Normal Balance",
  "ledger.ledger_scope": "Ledger Scope",
  "ledger.exchange_rate_local_to_usd": "Exchange Rate (Local->USD)",
  "ledger.exchange_rate_ph": "e.g. 278.50",
  "ledger.exchange_rate_hint": "Preview-only override. Transaction-time rates are still shown in the table.",
  "ledger.session_branch": "Session Branch",
  "ledger.user_name": "User Name",
  "ledger.user_id": "User ID",
  "ledger.roles": "Roles",
  "ledger.filter_account_no": "Account No",
  "ledger.filter_account_no_ph": "Search account no, name, company...",
  "ledger.select_account": "Select Account / Ledger",
  "ledger.select_account_ph": "Select account",
  "ledger.loading": "Loading...",
  "ledger.date_preset": "Date Preset",
  "ledger.preset_yesterday": "Yesterday",
  "ledger.preset_this_week": "This Week",
  "ledger.preset_this_month": "This Month",
  "ledger.preset_today": "Today",
  "ledger.preset_last_7": "Last 7 Days",
  "ledger.preset_last_30": "Last 30 Days",
  "ledger.preset_custom": "Custom",
  "ledger.from_date": "From Date",
  "ledger.to_date": "To Date",
  "ledger.branch_filter": "Select Branch",
  "ledger.all_branches": "All Branches",
  "ledger.apply": "Apply",
  "ledger.reset": "Reset",
  "ledger.showing_range": "Showing",
  "ledger.select_account_hint": "Select an account to view ledger entries.",
  "ledger.entry_search_ph": "Search voucher, details, user...",
  "ledger.rows": "Rows",
  "ledger.page": "Page",
  "ledger.col_date": "Date",
  "ledger.col_branch": "Branch",
  "ledger.col_serial": "Serial",
  "ledger.col_user": "User",
  "ledger.col_roz": "Roz#",
  "ledger.col_account_name": "Account Name",
  "ledger.col_account_no": "Account No",
  "ledger.col_name": "Name",
  "ledger.source_ledger": "Ledger",
  "ledger.source_roznamcha": "Roznamcha",
  "ledger.col_no": "No.",
  "ledger.col_details": "Details",
  "ledger.col_debit": "Dr.",
  "ledger.col_credit": "Cr.",
  "ledger.col_total": "Total",
  "ledger.col_ex_rate": "Ex. Rate",
  "ledger.col_debit_usd": "Dr. (USD)",
  "ledger.col_credit_usd": "Cr. (USD)",
  "ledger.no_data": "No data. Select an account first.",
  "ledger.no_entries": "No entries found for this date range.",
  "ledger.totals": "Totals",
  "ledger.pagination_hint": "Page size:",
  "ledger.prev": "Previous",
  "ledger.next": "Next",
  "ledger.entries_label": "Ledger Entries",
  "ledger.entries_table": "Ledger Entries",
  // Form fields & Buttons
  "form.from": "From",
  "form.to": "To",
  "form.quantity": "Quantity (Foreign Amount)",
  "form.debit_credit": "Debit / Credit Entry",
  "form.submit": "Submit",
  "form.reset": "Reset",
  "form.transaction_rate": "Transaction Rate",
  "form.operation": "Operation",
  "form.final_amount": "Final Amount",
  "form.remarks_notes": "Remarks / Notes",
  "form.save": "Save",
  "form.save_view": "Save & View",
  "form.save_submit": "Save & Submit",
  "form.search_account": "Search Account (Name or Number)",
  "form.daily_payment_date": "Daily Payment Date",
  "form.roznamcha_type": "Roznamcha Type",
  "form.roznamcha_number": "Roznamcha Number",
  "form.roznamcha_category": "Roznamcha Category",
  "form.currency_type": "Currency Type",
  // ERP Reports System — nav
  "nav.super_admin_reports": "Super Admin Reports",
  "nav.country_reports": "Country Reports",
  "nav.branch_reports": "Branch Reports",
  "nav.reports_hub": "Reports Hub",
  // ERP Reports System — report types
  "report.purchase": "Purchase Report",
  "report.sales": "Sales Report",
  "report.loading": "Loading Report",
  "report.transfer": "Transfer Report",
  "report.payment": "Payment Report",
  "report.remaining": "Remaining Balance Report",
  "report.ledger": "Ledger Report",
  "report.roznamcha": "Roznamcha Report",
  "report.journal": "Journal Report",
  "report.cash": "Cash Report",
  "report.inventory": "Inventory Report",
  "report.daily_comprehensive": "Comprehensive Daily Report",
  "report.purchase_booking": "Purchase Booking Report",
  "report.user_activity": "User Activity Report",
  "report.audit_log": "Audit Log Report",
  "report.exchange_rate": "Exchange Rate Report",
  // ERP Reports System — panel titles
  "report.panel_super_admin": "Super Admin Reports Panel",
  "report.panel_country": "Country Reports Panel",
  "report.panel_branch": "Branch Reports Panel",
  "report.panel_subtitle_super": "All Countries, All Branches, All Reports",
  "report.panel_subtitle_country": "Your Country Reports",
  "report.panel_subtitle_branch": "Your Branch Reports",
  // ERP Reports System — filters
  "report.filter_country": "Country",
  "report.filter_branch": "Branch",
  "report.filter_main_branch": "Main Branch",
  "report.filter_date_from": "From Date",
  "report.filter_date_to": "To Date",
  "report.filter_currency": "Currency",
  "report.filter_exchange_rate": "Exchange Rate",
  "report.filter_user": "User",
  "report.filter_report_type": "Report Type",
  "report.filter_all_countries": "All Countries",
  "report.filter_all_branches": "All Branches",
  "report.filter_all_users": "All Users",
  "report.filter_all_currencies": "All Currencies",
  "report.filter_reset": "Reset Filters",
  "report.filter_apply": "Apply",
  "report.filter_date_range": "Date Range",
  // ERP Reports System — KPI cards
  "report.kpi_total_records": "Total Records",
  "report.kpi_total_debit": "Total Debit",
  "report.kpi_total_credit": "Total Credit",
  "report.kpi_net_balance": "Net Balance",
  "report.kpi_total_purchase": "Total Purchase",
  "report.kpi_total_sales": "Total Sales",
  "report.kpi_total_payment": "Total Payment",
  "report.kpi_total_remaining": "Total Remaining",
  // ERP Reports System — export toolbar
  "report.export_pdf": "Export PDF",
  "report.export_excel": "Export Excel",
  "report.export_csv": "Export CSV",
  "report.print": "Print",
  "report.share_whatsapp": "Share via WhatsApp",
  "report.share_email": "Share via Email",
  "report.reload": "Reload",
  "report.search": "Search",
  "report.search_placeholder": "Search report data...",
  // ERP Reports System — table
  "report.no_data": "No data found",
  "report.loading": "Loading report...",
  "report.error": "Error loading report",
  "report.generated_at": "Generated At",
  "report.scope_label": "Access Scope",
  "report.scope_global": "Global",
  "report.scope_country": "Country",
  "report.scope_branch": "Branch",
  // ERP Reports System — columns
  "report.col_date": "Date",
  "report.col_serial": "Serial",
  "report.col_description": "Description",
  "report.col_debit": "Debit",
  "report.col_credit": "Credit",
  "report.col_balance": "Balance",
  "report.col_currency": "Currency",
  "report.col_status": "Status",
  "report.col_branch": "Branch",
  "report.col_country": "Country",
  "report.col_user": "User",
  "report.col_amount": "Amount",
  "report.col_reference": "Reference",
  // Tax System
  "nav.tax": "Tax Setup & Rates",
  "nav.tax_settings": "Country Tax Settings",
  "tax.title": "Country Tax Management",
  "tax.subtitle": "Configure multi-country tax rates, VAT/GST registration numbers, and defaults per country",
  "tax.select_country": "Select Country",
  "tax.add_new_tax": "Add New Tax Rate",
  "tax.edit_tax": "Edit Tax Rate",
  "tax.tax_name": "Tax Name",
  "tax.tax_code": "Tax Code",
  "tax.tax_rate": "Tax Rate (%)",
  "tax.trn_number": "TRN / Tax Reg Number",
  "tax.applies_to": "Applies To",
  "tax.purchase": "Purchase Only",
  "tax.sales": "Sales Only",
  "tax.both": "Both Purchase & Sales",
  "tax.expense": "Expenses Only",
  "tax.is_default": "Set as Country Default Tax",
  "tax.is_active": "Active Status",
  "tax.actions": "Actions",
  "tax.no_taxes_found": "No tax rates configured for this country",
  "tax.saved_successfully": "Tax configuration saved successfully",
  "tax.deleted_successfully": "Tax configuration deleted successfully",
  // Return SMS Reply & Mobile AI Module
  "nav.return_sms_reply": "Return SMS Reply",
  "nav.ai_mobile_reply": "AI Mobile – Return WhatsApp Reply",
  "sms_reply.title": "Return SMS Reply — AI Communication Centre",
  "sms_reply.subtitle": "Centralized WhatsApp & Email AI communication center for multi-country, automated business replies and payment reminders",
  "sms_reply.inbox": "Unified Inbox",
  "sms_reply.reminders": "Payment Reminders",
  "sms_reply.templates": "Reply Templates",
  "sms_reply.ai_rules": "AI & Safety Rules",
  "sms_reply.contacts": "Contacts & Consent",
  "sms_reply.reports": "Communication Reports"
};

const ur: Dict = {
  ...en,
  "nav.dashboard": "ڈیش بورڈ",
  "nav.super_admin_dashboard": "سپر ایڈمن ڈیش بورڈ",
  "nav.country_dashboard": "کنٹری ڈیش بورڈ",
  "nav.city_dashboard": "سٹی ڈیش بورڈ",
  "nav.agent_dashboard": "ایجنٹ ڈیش بورڈ",
  "nav.shipping_line_dashboard": "شپنگ لائن ڈیش بورڈ",
  "nav.clearing_agent_dashboard": "کلیئرنگ ایجنٹ ڈیش بورڈ",
  "nav.new_entry": "نئی انٹریز",
  "nav.branch_entry": "برانچ",
  "nav.branch_menu": "برانچ",
  "nav.super_admin_branch": "سپر ایڈمن برانچ",
  "nav.country_branch": "کنٹری برانچ",
  "nav.city_branch": "سٹی برانچ",
  "nav.user_entry": "یوزر",
  "nav.user_form": "یوزر رجسٹریشن",
  "nav.user_journal_report": "یوزر جرنل رپورٹ",
  "nav.accounts": "اکاؤنٹس",
  "nav.new_account": "نیا اکاؤنٹ سیٹ اپ",
  "nav.new_account_general_report": "اکاؤنٹ جنرل رپورٹ",
  "nav.account_setup_report": "Account Setup Report",
  "nav.super_admin_account_entry": "سپر ایڈمن اکاؤنٹ انٹری",
  "nav.daily_payment_entry": "ڈیلی پیمنٹ انٹری",
  "nav.journal": "روزنامچہ",
  "nav.purchase_order_payment": "پرچیز آرڈر پیمنٹ",
  "nav.purchase_order_payment_advance": "ایڈوانس پیمنٹ",
  "nav.purchase_order_payment_advance_completed": "ایڈوانس مکمل",
  "nav.purchase_order_payment_remaining": "بقایا پیمنٹ",
  "nav.purchase_order_payment_charges": "کریڈٹ پیمنٹ",
  "nav.purchase_order_payment_history": "پیمنٹ ہسٹری",
  "nav.sales_transfer_payment": "سیلز ٹرانسفر پیمنٹ",
  "nav.sales_order_payment": "سیلز آرڈر پیمنٹ",
  "nav.sales_order_payment_advance": "سیلز ایڈوانس",
  "nav.sales_order_payment_advance_completed": "ایڈوانس مکمل",
  "nav.sales_order_payment_remaining": "بقایا پیمنٹ",
  "nav.sales_order_payment_charges": "فائنل کریڈٹ",
  "nav.sales_order_payment_history": "فائنل اکاؤنٹ",
  "nav.final_payments": "فائنل پیمنٹس",
  "nav.final_payments_advance_nil": "ایڈوانس پیمنٹ نل رسید",
  "nav.purchase_order_management": "Purchase Order Management",
  "nav.product_units": "پروڈکٹ یونٹس",
  "nav.product_brands": "پروڈکٹ برانڈز",
  "nav.product_categories": "پروڈکٹ کیٹگریز",
  "nav.warehouses": "گودام",
  "nav.truck_registration": "ٹرک رجسٹریشن",
  "nav.truck_loading": "ٹرک لوڈنگ",
  "nav.import_loading": "امپورٹ لوڈنگ",
  "nav.transit_loading": "ٹرانزٹ لوڈنگ",
  "nav.walkthrough_video": "سسٹم ویڈیو واک تھرو",
  "tt.title": "ٹرانزٹ لوڈنگ",
  "tt.select_truck": "ٹرک منتخب کریں",
  "tt.date": "ٹرانزٹ تاریخ",
  "tt.company": "ٹرانزٹ کمپنی",
  "tt.goods": "مال",
  "tt.qty": "مقدار",
  "tt.unit": "یونٹ",
  "tt.route": "ٹرانزٹ روٹ",
  "tt.border": "بارڈر",
  "tt.destination": "منزل",
  "tt.customs": "کسٹمز معلومات",
  "tt.container": "کنٹینر نمبر",
  "tt.seal": "سیل نمبر",
  "tt.remarks": "تفصیل",
  "tt.add": "نیا ٹرانزٹ",
  "tt.edit": "ترمیم",
  "tt.delete": "حذف",
  "tt.save": "محفوظ کریں",
  "tt.cancel": "منسوخ",
  "tt.search": "ٹرانزٹ تلاش کریں...",
  "tt.empty": "کوئی ٹرانزٹ نہیں",
  "il.title": "امپورٹ لوڈنگ",
  "il.select_truck": "ٹرک منتخب کریں",
  "il.date": "امپورٹ تاریخ",
  "il.bill": "بل نمبر",
  "il.importer": "امپورٹر",
  "il.supplier": "سپلائر",
  "il.goods": "مال",
  "il.qty": "مقدار",
  "il.unit": "یونٹ",
  "il.customs": "کسٹمز آفس",
  "il.border": "بارڈر",
  "il.origin": "ملکِ اصل",
  "il.dest_country": "منزل ملک",
  "il.agent": "کلیئرنگ ایجنٹ",
  "il.remarks": "تفصیل",
  "il.add": "نیا امپورٹ",
  "il.edit": "ترمیم",
  "il.delete": "حذف",
  "il.save": "محفوظ کریں",
  "il.cancel": "منسوخ",
  "il.search": "امپورٹ تلاش کریں...",
  "il.empty": "کوئی امپورٹ نہیں",
  "tl.title": "ٹرک لوڈنگ",
  "tl.select_truck": "ٹرک منتخب کریں",
  "tl.date": "لوڈنگ تاریخ",
  "tl.serial": "سیریل",
  "tl.goods": "مال",
  "tl.qty": "مقدار",
  "tl.unit": "یونٹ",
  "tl.net_weight": "نیٹ وزن",
  "tl.gross_weight": "گراس وزن",
  "tl.destination": "منزل",
  "tl.remarks": "تفصیل",
  "tl.add": "نئی لوڈنگ",
  "tl.edit": "ترمیم",
  "tl.delete": "حذف",
  "tl.save": "محفوظ کریں",
  "tl.cancel": "منسوخ",
  "tl.search": "لوڈنگ تلاش کریں...",
  "tl.empty": "کوئی لوڈنگ نہیں",
  "tr.title": "ٹرک رجسٹریشن",
  "tr.number": "ٹرک نمبر",
  "tr.reg_no": "رجسٹریشن نمبر",
  "tr.type": "ٹرک قسم",
  "tr.owner": "مالک کا نام",
  "tr.owner_mobile": "مالک موبائل",
  "tr.company": "ٹرانسپورٹ کمپنی",
  "tr.driver": "ڈرائیور نام",
  "tr.driver_mobile": "ڈرائیور موبائل",
  "tr.status": "اسٹیٹس",
  "tr.reg_expiry": "رجسٹریشن ایکسپائری",
  "tr.ins_expiry": "انشورنس ایکسپائری",
  "tr.add": "ٹرک شامل کریں",
  "tr.edit": "ترمیم",
  "tr.delete": "حذف",
  "tr.save": "محفوظ کریں",
  "tr.cancel": "منسوخ",
  "tr.search": "ٹرک تلاش کریں...",
  "tr.empty": "کوئی ٹرک نہیں ملا",
  "pc.title": "پروڈکٹ کیٹگریز",
  "pc.code": "کیٹگری کوڈ",
  "pc.name": "کیٹگری نام",
  "pc.description": "تفصیل",
  "pc.active": "فعال",
  "pc.add": "کیٹگری شامل کریں",
  "pc.edit": "ترمیم",
  "pc.delete": "حذف",
  "pc.save": "محفوظ کریں",
  "pc.cancel": "منسوخ",
  "pc.search": "کیٹگری تلاش کریں...",
  "pc.empty": "کوئی کیٹگری نہیں ملی",
  "pb.title": "پروڈکٹ برانڈز",
  "pb.code": "برانڈ کوڈ",
  "pb.name": "برانڈ نام",
  "pb.description": "تفصیل",
  "pb.active": "فعال",
  "pb.add": "برانڈ شامل کریں",
  "pb.edit": "ترمیم",
  "pb.delete": "حذف",
  "pb.save": "محفوظ کریں",
  "pb.cancel": "منسوخ",
  "pb.search": "برانڈ تلاش کریں...",
  "pb.empty": "کوئی برانڈ نہیں ملا",
  "pu.title": "پروڈکٹ یونٹس",
  "pu.code": "یونٹ کوڈ",
  "pu.name": "یونٹ نام",
  "pu.base": "بنیادی یونٹ",
  "pu.factor": "کنورژن فیکٹر",
  "pu.active": "فعال",
  "pu.add": "یونٹ شامل کریں",
  "pu.edit": "ترمیم",
  "pu.delete": "حذف",
  "pu.save": "محفوظ کریں",
  "pu.cancel": "منسوخ",
  "pu.search": "یونٹ تلاش کریں...",
  "pu.empty": "کوئی یونٹ نہیں ملا",
  "nav.local_purchase_management": "لوکل پرچیز مینجمنٹ",
  "nav.sales_order_management": "سیلز آرڈر مینجمنٹ",
  "nav.local_sales_management": "لوکل سیلز مینجمنٹ",
  "nav.new_purchase_order": "New Purchase Booking Order",
  "nav.booking_purchase_orders": "Booking Purchase Orders",
  "nav.booking_confirm": "Booking Confirm",
  "nav.purchase_invoice": "Purchase Invoice",
  "nav.purchase_order_report": "Purchase Order Report",
  "nav.confirmed_purchase_orders": "Confirmed Purchase Orders",
  "nav.container_loading": "Container Loading",
  "nav.shipping_documents": "Shipping Documents",
  "nav.shipment_details": "Shipment Details",
  "nav.generate_bl": "Generate Bill of Lading",
  "nav.bl_report": "B/L Report",
  "nav.shipment_report": "Shipment Report",
  "nav.finalized_purchase_orders": "Finalized Purchase Orders",
  "nav.purchase_order_tracking": "Purchase Order Tracking",
  "nav.stock": "Stock",
  "nav.booking_stock": "Booking Stock",
  "nav.confirmed_stock": "Confirmed Stock",
  "nav.import_stock": "Import Stock",
  "nav.journal_stock": "جرنل اسٹاک",
  "nav.journal_stock_report": "جرنل اسٹاک رپورٹ",
  "nav.journal_stock_checking_report": "جرنل اسٹاک چیکنگ رپورٹ",
  "nav.document_management": "ڈاکیومنٹ مینجمنٹ اور اسکینر",
  "nav.general_office_management": "جنرل آفس مینجمنٹ",
  "nav.employee_master_setup": "ملازمین ماسٹر سیٹ اپ",
  "nav.employee_management": "ملازمین کی دیکھ بھال",
  "nav.departments": "شعبہ جات",
  "nav.designations": "عہدے",
  "nav.attendance": "حاضری",
  "nav.leave_management": "چھٹیوں کی ترسیل",
  "nav.payroll_salary": "تنخواہ اور پی رول",
  "nav.office_assets": "آفس اثاثہ جات",
  "nav.office_documents": "آفس دستاویزات",
  "nav.employee_id_cards": "ایمپلائی آئی ڈی کارڈز",
  "nav.employee_reports": "ملازمین کی رپورٹس",
  "nav.scanner_integration": "ڈائریکٹ اسکینر کیپچر",
  "nav.all_reports_catalog": "تمام ای آر پی رپورٹس کیٹلاگ",
  "nav.journal_bill_checking": "جرنل بل چیکنگ",
  "nav.warehouse_stock": "Warehouse Stock",
  "nav.in_transit_stock": "In Transit Stock",
  "nav.export_stock": "Export Stock",
  "nav.delivered_stock": "Delivered Stock",
  "nav.stock_reports": "اسٹاک رپورٹس",
  "nav.salesman_report": "سیلزمین رپورٹ",
  "nav.country_report": "کنٹری رپورٹ",
  "nav.branch_report": "برانچ رپورٹ",
  "nav.journal_report": "جرنل رپورٹ",
  "nav.journal_salesman_report": "جرنل سیلز مین رپورٹ",
  "nav.journal_country_report": "جرنل کنٹری رپورٹ",
  "nav.journal_branch_report": "جرنل برانچ رپورٹ",
  "nav.roznamcha": "ڈیلی پیمنٹ انٹری",
  "nav.expenses_bill": "اخراجات کا بل",
  "nav.all_roznamcha": "تمام روزنامچہ",
  "nav.roznamcha_all_report": "روزنامچہ آل رپورٹ",
  "nav.super_admin_roznamcha": "سپر ایڈمن روزنامچہ",
  "nav.country_roznamcha": "کنٹری روزنامچہ",
  "nav.branch_roznamcha": "سٹی روزنامچہ",
  "nav.cash_entry": "کیش انٹری",
  "nav.cash_entry_super_admin": "سپر ایڈمن کیش انٹری",
  "nav.cash_entry_country": "کنٹری کیش انٹری",
  "nav.cash_entry_branch": "برانچ کیش انٹری",
  "nav.ledgers": "لیجر",
  "nav.new_ledger": "نیا لیجر",
  "nav.super_admin_ledger": "سپر ایڈمن لیجر",
  "nav.country_ledger": "کنٹری لیجر",
  "nav.branch_ledger": "سٹی لیجر",
  "nav.ledger_general_report": "لیجر جنرل رپورٹ",
  "nav.ledger_outstanding": "بقایا اور ریکوری لیجر",
  "nav.ledger_super_admin_detailed": "سپر ایڈمن لیجر (تفصیلی)",
  "nav.ledger_country_detailed": "کنٹری لیجر (تفصیلی)",
  "nav.shipping_clearing": "شپنگ لائن / کلیئرنگ ایجنٹ",
  "nav.shipping_line": "شپنگ لائن",
  "nav.bl_entry": "بی ایل انٹری",
  "nav.shipping_agent_entry": "شپنگ ایجنٹ انٹری",
  "nav.clearing_agent": "کلیئرنگ ایجنٹ",
  "nav.agent_custom_entry": "ایجنٹ کسٹم انٹری",
  "nav.clearing_bill_entry": "بل انٹری",
  "nav.payment_bill_entry": "پیمنٹ بل انٹری",
  "nav.purchase_sale": "خرید و فروخت",
  "nav.purchase": "خرید",
  "nav.purchase_transfer_payment": "Purchase Transfer Payment",
  "nav.purchase_order": "پرچیز آرڈر",
  "nav.purchase_confirm": "پرچیز کنفرم",
  "nav.purchase_loading_records": "پرچیز لوڈنگ ریکارڈز",
  "nav.purchase_booking_journal_report": "پرچیز بکنگ جرنل رپورٹ",
  "nav.purchase_booking_register": "پرچیز بکنگ رجسٹر",
  "nav.local_purchase": "لوکل پرچیز",
  "nav.sales": "سیلز",
  "nav.sales_order": "سیلز آرڈر",
  "nav.sales_confirm": "سیلز کنفرم",
  "nav.local_sales": "لوکل سیلز",
  "nav.reports": "رپورٹس",
  "nav.search_portal": "عمومی تلاش",
  "nav.daily_reports": "ڈیلی رپورٹس",
  "nav.daily_payment_report": "ڈیلی پیمنٹ رپورٹ",
  "nav.roznamcha_report": "روزنامچہ رپورٹ",
  "nav.all_roznamcha_reports": "تمام روزنامچہ رپورٹس",
  "nav.ledger_reports": "لیجر رپورٹس",
  "nav.ledger_journal_reports": "لیجر جرنل رپورٹس",
  "nav.super_admin_journal_report": "سپر ایڈمن جرنل رپورٹ",
  "nav.country_journal_report": "کنٹری جرنل رپورٹ",
  "nav.city_journal_report": "سٹی جرنل رپورٹ",
  "nav.construction_journal_report": "کنسٹرکشن جرنل رپورٹ",
  "nav.super_admin_ledger_report": "سپر ایڈمن لیجر رپورٹ",
  "nav.country_ledger_report": "کنٹری لیجر رپورٹ",
  "nav.branch_ledger_report": "برانچ لیجر رپورٹ",
  "nav.branch_general_report": "برانچ جنرل رپورٹ",
  "nav.other_reports": "دیگر رپورٹس",
  "nav.sales_report": "سیلز رپورٹ",
  "nav.purchase_report": "پرچیز رپورٹ",
  "nav.exchange_rate_report": "ایکسچینج ریٹ رپورٹ",
  "nav.audit_report": "آڈٹ رپورٹ",
  "nav.profit_loss_report": "نفع / نقصان رپورٹ",
  "nav.balance_sheet": "بیلنس شیٹ",
  "nav.trial_balance": "ٹرائل بیلنس",
  "nav.message_system": "میسج سسٹم",
  "nav.messages_email": "ای میل",
  "nav.messages_whatsapp": "واٹس ایپ",
  "nav.messages_internal": "اندرونی پیغام",
  "nav.notification_center": "نوٹیفکیشن سینٹر",
  "nav.settings": "سیٹنگز",
  "nav.management": "مینجمنٹ",
  "nav.location_form": "لوکیشن مینجمنٹ",
  "nav.location_country": "کنٹری ماسٹر",
  "nav.location_state": "اسٹیٹ ماسٹر",
  "nav.location_city": "سٹی ماسٹر",
  "nav.location_tehsil": "تحصیل ماسٹر",
  "nav.company_form": "کمپنی فارم",
  "nav.customers_form": "کسٹمر فارم",
  "nav.employee_management": "ملازمین کی رجسٹریشن",
  "nav.contract_type": "کانٹریکٹ ٹائپ",
  "nav.company_registration_type": "کمپنی رجسٹریشن نمبر ٹائپ",
  "nav.bank_form": "بینک فارم",
  "nav.contact_type": "کانٹیکٹ ٹائپ",
  "nav.document_type": "ڈاکومنٹ ٹائپ",
  "nav.account_type": "اکاؤنٹ ٹائپ",
  "nav.goods_master": "گڈز ماسٹر",
  "nav.loading_port_master": "لوڈنگ پورٹ ماسٹر",
  "nav.received_port_master": "ریسیوڈ پورٹ ماسٹر",
  "nav.port_master": "پورٹ / باؤنڈری ماسٹر",
  "nav.chs_products": "سی ایچ ایس پروڈکٹ مینجمنٹ",
  "nav.dashboard_settings": "ڈیش بورڈ سیٹنگز",
  "nav.template_color": "ٹیمپلیٹ کلر",
  "nav.template_purple": "پرپل",
  "nav.template_blue": "بلیو",
  "nav.template_green": "گرین",
  "nav.template_gold": "گولڈ",
  "nav.template_cyan": "سایان",
  "nav.pakistan": "پاکستان",
  "nav.afghanistan": "افغانستان",
  "nav.india": "بھارت",
  "nav.uae_dubai": "دبئی (یو اے ای)",
  "nav.iran": "ایران",
  "auth.welcome_back": "خوش آمدید",
  "auth.sign_in_continue": "اپنی اکاؤنٹ تک رسائی کے لیے سائن اِن کریں",
  "auth.user_id_or_email": "یوزر آئی ڈی / ای میل",
  "auth.password": "پاس ورڈ",
  "auth.remember_me": "مجھے یاد رکھیں",
  "auth.forgot_password": "پاس ورڈ بھول گئے؟",
  "auth.sign_in": "سائن اِن",
  "auth.or_continue_with": "یا جاری رکھیں",
  "auth.sign_in_google": "گوگل کے ساتھ سائن اِن",
  "auth.choose_theme": "تھیم منتخب کریں",
  "auth.support": "سپورٹ",

  // Roznamcha Report UI
  "roz.report_subtitle": "روزنامچہ رپورٹ، فلٹرز اور انٹری تفصیل کے ساتھ۔",
  "roz.filters": "فلٹرز",
  "roz.country": "کنٹری",
  "roz.branch": "برانچ",
  "roz.all": "سب",
  "roz.search": "تلاش",
  "roz.search_placeholder": "واؤچر، نرییشن، اکاؤنٹ... تلاش کریں",
  "roz.select_entry_hint": "تفصیل دیکھنے کے لیے انٹری منتخب کریں۔",
  "roz.entries": "انٹریز",
  "roz.date": "تاریخ",
  "roz.voucher_no": "واؤچر نمبر",
  "roz.journal_no": "جرنل نمبر",
  "roz.narration": "نرییشن",
  "roz.status": "اسٹیٹس",
  "roz.no_entries": "کوئی انٹری نہیں ملی۔",
  "roz.entry_details": "انٹری تفصیل",
  "roz.lines": "لائنز",
  "roz.reference_no": "ریفرنس نمبر",
  "roz.payment_entry_type": "انٹری ٹائپ",
  "roz.ledger": "لیجر",
  "roz.account": "اکاؤنٹ",
  "roz.description": "تفصیل",
  "roz.currency": "کرنسی",
  "roz.debit": "ڈیبٹ",
  "roz.credit": "کریڈٹ",
  "roz.no_lines": "کوئی لائن نہیں ملی۔",
  "roz.not_found": "انٹری نہیں ملی۔",
  "common.coming_soon": "جلد آ رہا ہے۔",

  // Ledger columns
  "ledger.col_branch": "برانچ",
  "ledger.col_user": "یوزر",
  "ledger.col_roz": "روز#",
  "ledger.col_account_name": "اکاؤنٹ نام",
  "ledger.col_account_no": "اکاؤنٹ نمبر",
  "ledger.export_csv": "ایکسل (CSV)",
  "ledger.report_title": "لیجر رپورٹ",
  "ledger.report_subtitle": "اکاؤنٹ اسٹیٹمنٹ، ٹوٹلز، فلٹرز اور ایکسچینج ریٹس کے ساتھ۔",
  "ledger.print": "پرنٹ",
  "ledger.account_details": "اکاؤنٹ تفصیل",
  "ledger.company_details": "کمپنی تفصیل",
  "ledger.branch_details": "برانچ تفصیل",
  "ledger.summary": "لیجر خلاصہ",
  "ledger.session_details": "سیشن / لاگن تفصیل",
  "ledger.filters": "فلٹرز",
  "ledger.entries_table_title": "لیجر انٹریز",
  "ledger.ac_name": "اکاؤنٹ نام",
  "ledger.ac_number": "اکاؤنٹ نمبر",
  "ledger.economic_name": "لیجر نام",
  "ledger.category": "کیٹیگری",
  "ledger.account_title": "اکاؤنٹ ٹائٹل",
  "ledger.account_type": "ٹائپ",
  "ledger.currency": "کرنسی",
  "ledger.contract_no": "کنٹریکٹ نمبر",
  "ledger.contract_date": "کنٹریکٹ تاریخ",
  "ledger.contract_type": "کنٹریکٹ ٹائپ",
  "ledger.company_name": "کمپنی نام",
  "ledger.business_title": "بزنس ٹائٹل",
  "ledger.registration_number": "رجسٹریشن نمبر",
  "ledger.trn": "TRN",
  "ledger.website": "ویب سائٹ",
  "ledger.branch_name": "برانچ نام",
  "ledger.branch_account_no": "برانچ اکاؤنٹ نمبر",
  "ledger.country": "کنٹری",
  "ledger.state_city": "اسٹیٹ / سٹی",
  "ledger.address": "ایڈریس",
  "ledger.entries": "انٹریز",
  "ledger.total_debit": "ڈیبٹ",
  "ledger.total_credit": "کریڈٹ",
  "ledger.current_balance": "بیلنس",
  "ledger.exchange_rate_local_to_usd": "ایکسچینج ریٹ (لوکل→USD)",
  "ledger.exchange_rate_ph": "مثال: 278.50",
  "ledger.exchange_rate_hint": "یہ صرف پریویو اووررائیڈ ہے؛ ٹرانزیکشن ٹائم ریٹس ٹیبل میں نظر آتے رہیں گے۔",
  "ledger.session_branch": "سیشن برانچ",
  "ledger.user_name": "یوزر نام",
  "ledger.user_id": "یوزر آئی ڈی",
  "ledger.roles": "رولز",
  "ledger.filter_account_no": "اکاؤنٹ نمبر",
  "ledger.filter_account_no_ph": "اکاؤنٹ نمبر، نام، کمپنی وغیرہ سرچ کریں...",
  "ledger.select_account": "اکاؤنٹ / لیجر منتخب کریں",
  "ledger.select_account_ph": "اکاؤنٹ منتخب کریں",
  "ledger.loading": "لوڈ ہو رہا ہے...",
  "ledger.from_date": "شروع تاریخ",
  "ledger.to_date": "اختتامی تاریخ",
  "ledger.branch_filter": "برانچ منتخب کریں",
  "ledger.all_branches": "تمام برانچز",
  "ledger.apply": "لاگو کریں",
  "ledger.reset": "ری سیٹ",
  "ledger.showing_range": "دکھا رہا ہے",
  "ledger.select_account_hint": "لیجر انٹریز دیکھنے کے لیے اکاؤنٹ منتخب کریں۔",
  "ledger.rows": "قطاریں",
  "ledger.page": "صفحہ",
  "ledger.col_date": "تاریخ",
  "ledger.col_serial": "سیریل",
  "ledger.col_name": "سورس",
  "ledger.col_details": "تفصیل",
  "ledger.col_debit": "ڈیبٹ",
  "ledger.col_credit": "کریڈٹ",
  "ledger.col_total": "رننگ بیلنس",
  "ledger.col_ex_rate": "ایکسچینج ریٹ",
  "ledger.col_debit_usd": "ڈیبٹ (USD)",
  "ledger.col_credit_usd": "کریڈٹ (USD)",
  "ledger.no_data": "ڈیٹا نہیں ہے۔ پہلے اکاؤنٹ منتخب کریں۔",
  "ledger.no_entries": "اس تاریخ رینج کے لیے کوئی انٹری نہیں ملی۔",
  "ledger.totals": "ٹوٹلز",
  "ledger.pagination_hint": "پیج سائز:",
  "ledger.prev": "پچھلا",
  "ledger.next": "اگلا",
  "ledger.source_ledger": "لیجر",
  "ledger.source_roznamcha": "روزنامچہ",
  "form.from": "سے",
  "form.to": "تک",
  "form.quantity": "مقدار (غیر ملکی رقم)",
  "form.debit_credit": "ڈیبٹ / کریڈٹ انٹری",
  "form.submit": "جمع کریں",
  "form.reset": "ری سیٹ",
  "form.transaction_rate": "ٹرانزیکشن ریٹ",
  "form.operation": "عمل",
  "form.final_amount": "حتمی رقم",
  "form.remarks_notes": "ریمارکس / نوٹس",
  "form.save": "محفوظ کریں",
  "form.save_view": "محفوظ کریں اور دیکھیں",
  "form.save_submit": "محفوظ اور جمع کریں",
  "form.search_account": "اکاؤنٹ تلاش کریں (نام یا نمبر)",
  "form.daily_payment_date": "ڈیلی پیمنٹ کی تاریخ",
  "form.roznamcha_type": "روزنامچہ کی قسم",
  "form.roznamcha_number": "روزنامچہ نمبر",
  "form.roznamcha_category": "روزنامچہ کیٹیگری",
  "form.currency_type": "کرنسی کی قسم",
  // ERP Reports — Urdu overrides
  "nav.super_admin_reports": "سپر ایڈمن رپورٹس",
  "nav.country_reports": "کنٹری رپورٹس",
  "nav.branch_reports": "برانچ رپورٹس",
  "nav.reports_hub": "رپورٹس ہب",
  "report.purchase": "خریداری رپورٹ",
  "report.sales": "فروخت رپورٹ",
  "report.loading": "لوڈنگ رپورٹ",
  "report.transfer": "ٹرانسفر رپورٹ",
  "report.payment": "ادائیگی رپورٹ",
  "report.remaining": "باقی رقم رپورٹ",
  "report.ledger": "لیجر رپورٹ",
  "report.roznamcha": "روزنامچہ رپورٹ",
  "report.journal": "جرنل رپورٹ",
  "report.cash": "نقد رپورٹ",
  "report.inventory": "اسٹاک رپورٹ",
  "report.daily_comprehensive": "یومی جامع رپورٹ",
  "report.purchase_booking": "خرید بکنگ رپورٹ",
  "report.user_activity": "یوزر سرگرمی رپورٹ",
  "report.audit_log": "آڈٹ لاگ رپورٹ",
  "report.exchange_rate": "ایکسچینج ریٹ رپورٹ",
  "report.panel_super_admin": "سپر ایڈمن رپورٹ پینل",
  "report.panel_country": "کنٹری رپورٹ پینل",
  "report.panel_branch": "برانچ رپورٹ پینل",
  "report.panel_subtitle_super": "تمام ممالک، تمام برانچز، تمام رپورٹس",
  "report.panel_subtitle_country": "آپ کے ملک کی رپورٹس",
  "report.panel_subtitle_branch": "آپ کی برانچ کی رپورٹس",
  "report.filter_country": "ملک",
  "report.filter_branch": "برانچ",
  "report.filter_main_branch": "مین برانچ",
  "report.filter_date_from": "سے تاریخ",
  "report.filter_date_to": "تک تاریخ",
  "report.filter_currency": "کرنسی",
  "report.filter_exchange_rate": "ایکسچینج ریٹ",
  "report.filter_user": "یوزر",
  "report.filter_report_type": "رپورٹ کی قسم",
  "report.filter_all_countries": "تمام ممالک",
  "report.filter_all_branches": "تمام برانچز",
  "report.filter_all_users": "تمام یوزرز",
  "report.filter_all_currencies": "تمام کرنسیاں",
  "report.filter_reset": "فلٹر ریسیٹ",
  "report.filter_apply": "لاگو کریں",
  "report.filter_date_range": "تاریخ رینج",
  "report.kpi_total_records": "کل ریکارڈز",
  "report.kpi_total_debit": "کل ڈیبٹ",
  "report.kpi_total_credit": "کل کریڈٹ",
  "report.kpi_net_balance": "نیٹ بیلنس",
  "report.kpi_total_purchase": "کل خریداری",
  "report.kpi_total_sales": "کل فروخت",
  "report.kpi_total_payment": "کل ادائیگی",
  "report.kpi_total_remaining": "کل باقی رقم",
  "report.export_pdf": "PDF برآمدگی",
  "report.export_excel": "Excel برآمدگی",
  "report.export_csv": "CSV برآمدگی",
  "report.print": "پرنٹ",
  "report.share_whatsapp": "واٹس ایپ پر شیئر کریں",
  "report.share_email": "ای میل پر شیئر کریں",
  "report.reload": "دوبارہ لوڈ کریں",
  "report.search": "تلاش",
  "report.search_placeholder": "رپورٹ دیٹا تلاش کریں...",
  "report.no_data": "کوئی ڈیٹا نہیں",
  "report.loading": "رپورٹ لوڈ ہو رہی ہے...",
  "report.error": "رپورٹ لوڈ کرنے میں خطا",
  "report.generated_at": "تیار کیا گیا",
  "report.scope_label": "رسائی کی سطح",
  "report.scope_global": "گلوبل",
  "report.scope_country": "ملک",
  "report.scope_branch": "برانچ",
  "report.col_date": "تاریخ",
  "report.col_serial": "سیریل",
  "report.col_description": "تفصیل",
  "report.col_debit": "ڈیبٹ",
  "report.col_credit": "کریڈٹ",
  "report.col_balance": "بیلنس",
  "report.col_currency": "کرنسی",
  "report.col_status": "حیثیت",
  "report.col_branch": "برانچ",
  "report.col_country": "ملک",
  "report.col_user": "یوزر",
  "report.col_amount": "رقم",
  "report.col_reference": "حوالہ",
  // Tax System Urdu
  "nav.tax": "ٹیکس سیٹ اپ اور شرحیں",
  "nav.tax_settings": "ملکی ٹیکس سیٹنگز",
  "tax.title": "ملکی ٹیکس مینجمنٹ",
  "tax.subtitle": "ملک وار ٹیکس کی شرحیں، VAT/GST رجسٹریشن نمبر، اور طے شدہ ریٹس کی سیٹنگ کریں",
  "tax.select_country": "ملک منتخب کریں",
  "tax.add_new_tax": "نیا ٹیکس شامل کریں",
  "tax.edit_tax": "ٹیکس میں ترمیم کریں",
  "tax.tax_name": "ٹیکس کا نام",
  "tax.tax_code": "ٹیکس کوڈ",
  "tax.tax_rate": "ٹیکس شرح (%)",
  "tax.trn_number": "TRN / ٹیکس رجسٹریشن نمبر",
  "tax.applies_to": "لاگو ہوتا ہے",
  "tax.purchase": "صرف خریداری پر",
  "tax.sales": "صرف فروخت پر",
  "tax.both": "خریداری اور فروخت دونوں",
  "tax.expense": "صرف اخراجات پر",
  "tax.is_default": "ملکی ڈیفالٹ ٹیکس رکھیں",
  "tax.is_active": "فعال حیثیت",
  "tax.actions": "اقدامات",
  "tax.no_taxes_found": "اس ملک کے لیے کوئی ٹیکس ریٹ قائم نہیں ہے",
  "tax.saved_successfully": "ٹیکس کی ترتیب کامیابی سے محفوظ ہو گئی",
  "tax.deleted_successfully": "ٹیکس کی ترتیب ختم ہو گئی",
  // Return SMS Reply Urdu
  "nav.return_sms_reply": "Return SMS Reply",
  "sms_reply.title": "ریٹرن SMS رپلائی — AI مواصلاتی مرکز",
  "sms_reply.subtitle": "واٹس ایپ اور ای میل کا مرکزی اے آئی مواصلاتی مرکز، برائے خودکار کاروباری جوابات اور ادائیگی یاد دہانیاں",
  "sms_reply.inbox": "یونیفائیڈ ان باکس",
  "sms_reply.reminders": "ادائیگی کی یاد دہانیاں",
  "sms_reply.templates": "جوابی ٹیمپلیٹس",
  "sms_reply.ai_rules": "اے آئی اور حفاظتی قواعد",
  "sms_reply.contacts": "رابطے اور رضامندی",
  "sms_reply.reports": "مواصلاتی رپورٹس"
};

const ar: Dict = {
  ...en,
  "nav.dashboard": "لوحة التحكم",
  "nav.super_admin_dashboard": "لوحة المشرف الأعلى",
  "nav.country_dashboard": "لوحة الدولة",
  "nav.city_dashboard": "لوحة الفرع",
  "nav.agent_dashboard": "لوحة الوكيل",
  "nav.shipping_line_dashboard": "لوحة الشحن",
  "nav.clearing_agent_dashboard": "لوحة التخليص",
  "nav.new_entry": "إدخالات جديدة",
  "nav.branch_entry": "الفروع",
  "nav.branch_menu": "الفروع",
  "nav.super_admin_branch": "فرع المشرف الأعلى",
  "nav.country_branch": "فرع الدولة",
  "nav.city_branch": "فرع المدينة",
  "nav.user_entry": "المستخدم",
  "nav.user_form": "تسجيل المستخدم",
  "nav.user_journal_report": "تقرير يومية المستخدم",
  "nav.accounts": "الحسابات",
  "nav.new_account": "حساب جديد",
  "nav.new_account_general_report": "تقرير الحسابات العامة الجديدة",
  "nav.super_admin_account_entry": "إدخال حساب (مشرف أعلى)",
  "nav.daily_payment_entry": "مدفوعات يومية",
  "nav.journal": "دفتر اليومية",
  "nav.purchase_order_payment": "دفع أمر الشراء",
  "nav.purchase_order_payment_advance": "الدفع المقدم",
  "nav.purchase_order_payment_advance_completed": "اكتمل الدفع المقدم",
  "nav.purchase_order_payment_remaining": "الدفع المتبقي",
  "nav.purchase_order_payment_charges": "الدفع الآجل",
  "nav.purchase_order_payment_history": "سجل المدفوعات",
  "nav.sales_transfer_payment": "دفع حوالة المبيعات",
  "nav.sales_order_payment": "دفع أمر البيع",
  "nav.sales_order_payment_advance": "دفعة مقدمة مبيعات",
  "nav.sales_order_payment_advance_completed": "اكتمل الدفع المقدم",
  "nav.sales_order_payment_remaining": "الدفع المتبقي",
  "nav.sales_order_payment_charges": "رصيد نهائي",
  "nav.sales_order_payment_history": "سجل المدفوعات",
  "nav.purchase_order_management": "Purchase Order Management",
  "nav.product_units": "وحدات المنتج",
  "nav.product_brands": "علامات المنتج",
  "nav.product_categories": "فئات المنتج",
  "nav.warehouses": "المستودعات",
  "nav.truck_registration": "تسجيل الشاحنة",
  "nav.truck_loading": "تحميل الشاحنة",
  "nav.import_loading": "تحميل الاستيراد",
  "nav.transit_loading": "تحميل العبور",
  "nav.walkthrough_video": "فيديو جولة النظام",
  "tt.title": "تحميل العبور",
  "tt.select_truck": "اختر الشاحنة",
  "tt.date": "تاريخ العبور",
  "tt.company": "شركة العبور",
  "tt.goods": "البضائع",
  "tt.qty": "الكمية",
  "tt.unit": "الوحدة",
  "tt.route": "مسار العبور",
  "tt.border": "الحدود",
  "tt.destination": "الوجهة",
  "tt.customs": "معلومات الجمارك",
  "tt.container": "رقم الحاوية",
  "tt.seal": "رقم الختم",
  "tt.remarks": "ملاحظات",
  "tt.add": "عبور جديد",
  "tt.edit": "تعديل",
  "tt.delete": "حذف",
  "tt.save": "حفظ",
  "tt.cancel": "إلغاء",
  "tt.search": "بحث عن العبور...",
  "tt.empty": "لا يوجد عبور",
  "il.title": "تحميل الاستيراد",
  "il.select_truck": "اختر الشاحنة",
  "il.date": "تاريخ الاستيراد",
  "il.bill": "رقم الفاتورة",
  "il.importer": "المستورد",
  "il.supplier": "المورد",
  "il.goods": "البضائع",
  "il.qty": "الكمية",
  "il.unit": "الوحدة",
  "il.customs": "مكتب الجمارك",
  "il.border": "المعبر الحدودي",
  "il.origin": "بلد المنشأ",
  "il.dest_country": "بلد الوجهة",
  "il.agent": "وكيل التخليص",
  "il.remarks": "ملاحظات",
  "il.add": "استيراد جديد",
  "il.edit": "تعديل",
  "il.delete": "حذف",
  "il.save": "حفظ",
  "il.cancel": "إلغاء",
  "il.search": "بحث عن الواردات...",
  "il.empty": "لا توجد واردات",
  "tl.title": "تحميل الشاحنة",
  "tl.select_truck": "اختر الشاحنة",
  "tl.date": "تاريخ التحميل",
  "tl.serial": "تسلسل",
  "tl.goods": "البضائع",
  "tl.qty": "الكمية",
  "tl.unit": "الوحدة",
  "tl.net_weight": "الوزن الصافي",
  "tl.gross_weight": "الوزن الإجمالي",
  "tl.destination": "الوجهة",
  "tl.remarks": "ملاحظات",
  "tl.add": "تحميل جديد",
  "tl.edit": "تعديل",
  "tl.delete": "حذف",
  "tl.save": "حفظ",
  "tl.cancel": "إلغاء",
  "tl.search": "بحث عن التحميلات...",
  "tl.empty": "لا توجد تحميلات",
  "tr.title": "تسجيل الشاحنة",
  "tr.number": "رقم الشاحنة",
  "tr.reg_no": "رقم التسجيل",
  "tr.type": "نوع الشاحنة",
  "tr.owner": "اسم المالك",
  "tr.owner_mobile": "جوال المالك",
  "tr.company": "شركة النقل",
  "tr.driver": "اسم السائق",
  "tr.driver_mobile": "جوال السائق",
  "tr.status": "الحالة",
  "tr.reg_expiry": "انتهاء التسجيل",
  "tr.ins_expiry": "انتهاء التأمين",
  "tr.add": "إضافة شاحنة",
  "tr.edit": "تعديل",
  "tr.delete": "حذف",
  "tr.save": "حفظ",
  "tr.cancel": "إلغاء",
  "tr.search": "بحث عن الشاحنات...",
  "tr.empty": "لا توجد شاحنات",
  "pc.title": "فئات المنتج",
  "pc.code": "رمز الفئة",
  "pc.name": "اسم الفئة",
  "pc.description": "الوصف",
  "pc.active": "نشط",
  "pc.add": "إضافة فئة",
  "pc.edit": "تعديل",
  "pc.delete": "حذف",
  "pc.save": "حفظ",
  "pc.cancel": "إلغاء",
  "pc.search": "بحث عن الفئات...",
  "pc.empty": "لا توجد فئات",
  "pb.title": "علامات المنتج",
  "pb.code": "رمز العلامة",
  "pb.name": "اسم العلامة",
  "pb.description": "الوصف",
  "pb.active": "نشط",
  "pb.add": "إضافة علامة",
  "pb.edit": "تعديل",
  "pb.delete": "حذف",
  "pb.save": "حفظ",
  "pb.cancel": "إلغاء",
  "pb.search": "بحث عن العلامات...",
  "pb.empty": "لا توجد علامات",
  "pu.title": "وحدات المنتج",
  "pu.code": "رمز الوحدة",
  "pu.name": "اسم الوحدة",
  "pu.base": "الوحدة الأساسية",
  "pu.factor": "معامل التحويل",
  "pu.active": "نشط",
  "pu.add": "إضافة وحدة",
  "pu.edit": "تعديل",
  "pu.delete": "حذف",
  "pu.save": "حفظ",
  "pu.cancel": "إلغاء",
  "pu.search": "بحث عن الوحدات...",
  "pu.empty": "لا توجد وحدات",
  "nav.local_purchase_management": "إدارة المشتريات المحلية",
  "nav.sales_order_management": "إدارة أوامر المبيعات",
  "nav.local_sales_management": "إدارة المبيعات المحلية",
  "nav.new_purchase_order": "New Purchase Booking Order",
  "nav.booking_purchase_orders": "Booking Purchase Orders",
  "nav.booking_confirm": "Booking Confirm",
  "nav.purchase_invoice": "Purchase Invoice",
  "nav.purchase_order_report": "Purchase Order Report",
  "nav.confirmed_purchase_orders": "Confirmed Purchase Orders",
  "nav.container_loading": "Container Loading",
  "nav.shipping_documents": "Shipping Documents",
  "nav.shipment_details": "Shipment Details",
  "nav.generate_bl": "Generate Bill of Lading",
  "nav.bl_report": "B/L Report",
  "nav.shipment_report": "Shipment Report",
  "nav.finalized_purchase_orders": "Finalized Purchase Orders",
  "nav.purchase_order_tracking": "Purchase Order Tracking",
  "nav.stock": "Stock",
  "nav.booking_stock": "Booking Stock",
  "nav.confirmed_stock": "Confirmed Stock",
  "nav.import_stock": "Import Stock",
  "nav.journal_stock": "Journal Stock",
  "nav.journal_stock_report": "Journal Stock Report",
  "nav.journal_stock_checking_report": "Journal Stock Checking Report",
  "nav.document_management": "د اسنادو مدیریت او سکینر",
  "nav.scanner_integration": "مباشر سکین کول",
  "nav.all_reports_catalog": "د ټول راپورونو کټلاګ",
  "nav.warehouse_stock": "Warehouse Stock",
  "nav.in_transit_stock": "In Transit Stock",
  "nav.export_stock": "Export Stock",
  "nav.delivered_stock": "Delivered Stock",
  "nav.roznamcha": "مدفوعات يومية",
  "nav.expenses_bill": "فاتورة المصروفات",
  "nav.all_roznamcha": "كل روزنامچہ",
  "nav.roznamcha_all_report": "تقرير روزنامچہ الشامل",
  "nav.super_admin_roznamcha": "روزنامچہ (مشرف أعلى)",
  "nav.country_roznamcha": "روزنامچہ (دولة)",
  "nav.branch_roznamcha": "روزنامچہ (مدينة)",
  "nav.cash_entry": "إدخال نقدي",
  "nav.cash_entry_super_admin": "إدخال نقدي (مشرف أعلى)",
  "nav.cash_entry_country": "إدخال نقدي (دولة)",
  "nav.cash_entry_branch": "إدخال نقدي (فرع)",
  "nav.ledgers": "دفاتر الأستاذ",
  "nav.new_ledger": "دفتر أستاذ جديد",
  "nav.super_admin_ledger": "دفتر المشرف الأعلى",
  "nav.country_ledger": "دفتر الدولة",
  "nav.branch_ledger": "دفتر الفرع / المدينة",
  "nav.ledger_general_report": "تقرير دفتر الأستاذ العام",
  "nav.ledger_outstanding": "دفتر الأرصدة المستحقة والتحصيل",
  "nav.ledger_super_admin_detailed": "دفتر الأستاذ للمشرف العام (مفصل)",
  "nav.ledger_country_detailed": "دفتر الأستاذ للبلد (مفصل)",
  "nav.shipping_clearing": "الشحن / التخليص",
  "nav.shipping_line": "الشحن",
  "nav.bl_entry": "إدخال بوليصة شحن",
  "nav.shipping_agent_entry": "إدخال وكيل الشحن",
  "nav.clearing_agent": "التخليص",
  "nav.agent_custom_entry": "إدخال وكيل الجمارك",
  "nav.clearing_bill_entry": "إدخال الفاتورة",
  "nav.payment_bill_entry": "إدخال فاتورة الدفع",
  "nav.purchase_sale": "المشتريات والمبيعات",
  "nav.purchase": "المشتريات",
  "nav.purchase_order": "أمر شراء",
  "nav.purchase_confirm": "تأكيد الشراء",
  "nav.purchase_loading_records": "سجلات تحميل الشراء",
  "nav.purchase_booking_journal_report": "تقرير يومية حجز الشراء",
  "nav.purchase_booking_register": "سجل حجز الشراء",
  "nav.local_purchase": "شراء محلي",
  "nav.sales": "المبيعات",
  "nav.sales_order": "أمر بيع",
  "nav.sales_confirm": "تأكيد البيع",
  "nav.local_sales": "بيع محلي",
  "nav.reports": "التقارير",
  "nav.search_portal": "بحث عام",
  "nav.daily_reports": "تقارير يومية",
  "nav.daily_payment_report": "تقرير المدفوعات اليومية",
  "nav.roznamcha_report": "تقرير روزنامچہ",
  "nav.all_roznamcha_reports": "جميع تقارير روزنامچہ",
  "nav.ledger_reports": "تقارير الدفاتر",
  "nav.ledger_journal_reports": "تقارير دفتر اليومية",
  "nav.super_admin_journal_report": "تقرير اليومية للمشرف الأعلى",
  "nav.country_journal_report": "تقرير اليومية للدولة",
  "nav.city_journal_report": "تقرير اليومية للمدينة",
  "nav.construction_journal_report": "تقرير يومية الإنشاءات",
  "nav.super_admin_ledger_report": "تقرير الدفتر (مشرف أعلى)",
  "nav.country_ledger_report": "تقرير الدفتر (دولة)",
  "nav.branch_ledger_report": "تقرير الدفتر (فرع)",
  "nav.branch_general_report": "تقرير الفروع العام",
  "nav.other_reports": "تقارير أخرى",
  "nav.sales_report": "تقرير المبيعات",
  "nav.purchase_report": "تقرير المشتريات",
  "nav.exchange_rate_report": "تقرير أسعار الصرف",
  "nav.audit_report": "تقرير التدقيق",
  "nav.profit_loss_report": "تقرير الأرباح والخسائر",
  "nav.balance_sheet": "الميزانية العمومية",
  "nav.trial_balance": "ميزان المراجعة",
  "nav.message_system": "نظام الرسائل",
  "nav.messages_email": "البريد الإلكتروني",
  "nav.messages_whatsapp": "واتساب",
  "nav.messages_internal": "رسالة داخلية",
  "nav.notification_center": "مركز الإشعارات",
  "nav.settings": "الإعدادات",
  "nav.management": "الإدارة",
  "nav.location_form": "إدارة المواقع",
  "nav.location_country": "رئيسي الدولة",
  "nav.location_state": "رئيسي الولاية",
  "nav.location_city": "رئيسي المدينة",
  "nav.location_tehsil": "رئيسي المقاطعة (التحصيل)",
  "nav.company_form": "نموذج الشركة",
  "nav.customers_form": "نموذج العملاء",
  "nav.employee_management": "إدارة الموظفين",
  "nav.contract_type": "نوع العقد",
  "nav.company_registration_type": "نوع رقم تسجيل الشركة",
  "nav.bank_form": "نموذج البنك",
  "nav.contact_type": "نوع الاتصال",
  "nav.document_type": "نوع الوثيقة",
  "nav.account_type": "نوع الحساب",
  "nav.goods_master": "سجل البضائع",
  "nav.loading_port_master": "سجل موانئ الشحن",
  "nav.received_port_master": "سجل موانئ الوصول",
  "nav.port_master": "رئيسي الموانئ والحدود",
  "nav.chs_products": "إدارة منتجات CHS",
  "nav.dashboard_settings": "إعدادات لوحة التحكم",
  "nav.template_color": "لون القالب",
  "nav.template_purple": "بنفسجي",
  "nav.template_blue": "أزرق",
  "nav.template_green": "أخضر",
  "nav.template_gold": "ذهبي",
  "nav.template_cyan": "سماوي",
  "auth.welcome_back": "مرحباً بعودتك",
  "auth.sign_in_continue": "سجّل الدخول للمتابعة إلى حسابك",
  "auth.user_id_or_email": "معرّف المستخدم / البريد",
  "auth.password": "كلمة المرور",
  "auth.remember_me": "تذكرني",
  "auth.forgot_password": "نسيت كلمة المرور؟",
  "auth.sign_in": "تسجيل الدخول",
  "auth.or_continue_with": "أو تابع عبر",
  "auth.sign_in_google": "تسجيل الدخول عبر Google",
  "auth.choose_theme": "اختر السمة",
  "auth.support": "الدعم",

  // Roznamcha Report UI
  "roz.report_subtitle": "تقرير روزنامچا مع الفلاتر وتفاصيل القيود.",
  "roz.filters": "الفلاتر",
  "roz.country": "الدولة",
  "roz.branch": "الفرع",
  "roz.all": "الكل",
  "roz.search": "بحث",
  "roz.search_placeholder": "ابحث عن القسيمة، البيان، الحساب...",
  "roz.select_entry_hint": "اختر قيداً لعرض التفاصيل.",
  "roz.entries": "القيود",
  "roz.date": "التاريخ",
  "roz.voucher_no": "رقم القسيمة",
  "roz.journal_no": "رقم اليومية",
  "roz.narration": "البيان",
  "roz.status": "الحالة",
  "roz.no_entries": "لا توجد قيود.",
  "roz.entry_details": "تفاصيل القيد",
  "roz.lines": "السطور",
  "roz.reference_no": "رقم المرجع",
  "roz.payment_entry_type": "نوع القيد",
  "roz.ledger": "دفتر الأستاذ",
  "roz.account": "الحساب",
  "roz.description": "الوصف",
  "roz.currency": "العملة",
  "roz.debit": "مدين",
  "roz.credit": "دائن",
  "roz.no_lines": "لا توجد سطور.",
  "roz.not_found": "لم يتم العثور على القيد.",
  "common.coming_soon": "قريباً.",

  // Ledger columns
  "ledger.col_branch": "فرع",
  "ledger.col_user": "مستخدم",
  "ledger.col_roz": "Roz#",
  "ledger.col_account_name": "اسم الحساب",
  "ledger.col_account_no": "رقم الحساب",
  "ledger.export_csv": "إكسل (CSV)",
  "ledger.report_title": "تقرير دفتر الأستاذ",
  "ledger.report_subtitle": "بيان الحساب مع الإجماليات والفلاتر وأسعار الصرف.",
  "ledger.print": "طباعة",
  "ledger.account_details": "تفاصيل الحساب",
  "ledger.company_details": "تفاصيل الشركة",
  "ledger.branch_details": "تفاصيل الفرع",
  "ledger.summary": "ملخص الأستاذ",
  "ledger.session_details": "تفاصيل الجلسة / تسجيل الدخول",
  "ledger.filters": "الفلاتر",
  "ledger.entries_table_title": "قيود الأستاذ",
  "ledger.ac_name": "اسم الحساب",
  "ledger.ac_number": "رقم الحساب",
  "ledger.economic_name": "اسم الأستاذ",
  "ledger.category": "الفئة",
  "ledger.account_title": "عنوان الحساب",
  "ledger.account_type": "النوع",
  "ledger.currency": "العملة",
  "ledger.contract_no": "رقم العقد",
  "ledger.contract_date": "تاريخ العقد",
  "ledger.contract_type": "نوع العقد",
  "ledger.company_name": "اسم الشركة",
  "ledger.business_title": "عنوان النشاط",
  "ledger.registration_number": "رقم التسجيل",
  "ledger.trn": "TRN",
  "ledger.website": "الموقع",
  "ledger.branch_name": "اسم الفرع",
  "ledger.branch_account_no": "رقم حساب الفرع",
  "ledger.country": "الدولة",
  "ledger.state_city": "الولاية / المدينة",
  "ledger.address": "العنوان",
  "ledger.entries": "القيود",
  "ledger.total_debit": "مدين",
  "ledger.total_credit": "دائن",
  "ledger.current_balance": "الرصيد",
  "ledger.exchange_rate_local_to_usd": "سعر الصرف (محلي→USD)",
  "ledger.exchange_rate_ph": "مثال: 278.50",
  "ledger.exchange_rate_hint": "تعديل للمعاينة فقط. تظل أسعار وقت العملية ظاهرة في الجدول.",
  "ledger.session_branch": "فرع الجلسة",
  "ledger.user_name": "اسم المستخدم",
  "ledger.user_id": "معرّف المستخدم",
  "ledger.roles": "الأدوار",
  "ledger.filter_account_no": "رقم الحساب",
  "ledger.filter_account_no_ph": "ابحث برقم الحساب أو الاسم أو الشركة...",
  "ledger.select_account": "اختر الحساب / الأستاذ",
  "ledger.select_account_ph": "اختر حساب",
  "ledger.loading": "جارٍ التحميل...",
  "ledger.from_date": "من تاريخ",
  "ledger.to_date": "إلى تاريخ",
  "ledger.branch_filter": "اختر الفرع",
  "ledger.all_branches": "كل الفروع",
  "ledger.apply": "تطبيق",
  "ledger.reset": "إعادة ضبط",
  "ledger.showing_range": "عرض",
  "ledger.select_account_hint": "اختر حساباً لعرض قيود الأستاذ.",
  "ledger.rows": "الصفوف",
  "ledger.page": "صفحة",
  "ledger.col_date": "التاريخ",
  "ledger.col_serial": "تسلسل",
  "ledger.col_name": "المصدر",
  "ledger.col_details": "التفاصيل",
  "ledger.col_debit": "مدين",
  "ledger.col_credit": "دائن",
  "ledger.col_total": "الرصيد التراكمي",
  "ledger.col_ex_rate": "سعر الصرف",
  "ledger.col_debit_usd": "مدين (USD)",
  "ledger.col_credit_usd": "دائن (USD)",
  "ledger.no_data": "لا توجد بيانات. اختر حساباً أولاً.",
  "ledger.no_entries": "لا توجد قيود ضمن هذا النطاق.",
  "ledger.totals": "الإجماليات",
  "ledger.pagination_hint": "حجم الصفحة:",
  "ledger.prev": "السابق",
  "ledger.next": "التالي",
  "ledger.source_ledger": "دفتر الأستاذ",
  "ledger.source_roznamcha": "روزنامچه",
  "form.from": "من",
  "form.to": "إلى",
  "form.quantity": "الكمية (المبلغ الأجنبي)",
  "form.debit_credit": "قيد مدين / دائن",
  "form.submit": "إرسال",
  "form.reset": "إعادة ضبط",
  "form.transaction_rate": "سعر المعاملة",
  "form.operation": "العملية",
  "form.final_amount": "المبلغ النهائي",
  "form.remarks_notes": "ملاحظات",
  "form.save": "حفظ",
  "form.save_view": "حفظ ومعاينة",
  "form.save_submit": "حفظ وإرسال",
  "form.search_account": "بحث عن الحساب (الاسم أو الرقم)",
  "form.daily_payment_date": "تاريخ الدفع اليومي",
  "form.roznamcha_type": "نوع الروزنامجة",
  "form.roznamcha_number": "رقم الروزنامجة",
  "form.roznamcha_category": "فئة الروزنامجة",
  "form.currency_type": "نوع العملة",
  // ERP Reports — Arabic overrides
  "nav.super_admin_reports": "تقارير المسؤول الأعلى",
  "nav.country_reports": "تقارير الدولة",
  "nav.branch_reports": "تقارير الفرع",
  "nav.reports_hub": "مركز التقارير",
  "report.purchase": "تقرير المشتريات",
  "report.sales": "تقرير المبيعات",
  "report.loading": "تقرير التحميل",
  "report.transfer": "تقرير التحويل",
  "report.payment": "تقرير المدفوعات",
  "report.remaining": "تقرير الرصيد المتبقي",
  "report.ledger": "تقرير دفتر الأستاذ",
  "report.roznamcha": "تقرير اليومية",
  "report.journal": "تقرير دفتر يومية",
  "report.cash": "تقرير الصندوق",
  "report.inventory": "تقرير المخزون",
  "report.daily_comprehensive": "التقرير اليومي الشامل",
  "report.purchase_booking": "تقرير حجز الشراء",
  "report.user_activity": "تقرير نشاط المستخدم",
  "report.audit_log": "تقرير سجل المراجعة",
  "report.exchange_rate": "تقرير أسعار الصرف",
  "report.panel_super_admin": "لوحة تقارير المسؤول الأعلى",
  "report.panel_country": "لوحة تقارير الدولة",
  "report.panel_branch": "لوحة تقارير الفرع",
  "report.panel_subtitle_super": "جميع الدول، جميع الفروع، جميع التقارير",
  "report.panel_subtitle_country": "تقارير دولتك",
  "report.panel_subtitle_branch": "تقارير فرعك",
  "report.filter_country": "الدولة",
  "report.filter_branch": "الفرع",
  "report.filter_main_branch": "الفرع الرئيسي",
  "report.filter_date_from": "من تاريخ",
  "report.filter_date_to": "إلى تاريخ",
  "report.filter_currency": "العملة",
  "report.filter_exchange_rate": "سعر الصرف",
  "report.filter_user": "المستخدم",
  "report.filter_report_type": "نوع التقرير",
  "report.filter_all_countries": "جميع الدول",
  "report.filter_all_branches": "جميع الفروع",
  "report.filter_all_users": "جميع المستخدمين",
  "report.filter_all_currencies": "جميع العملات",
  "report.filter_reset": "إعادة ضبط الفلاتر",
  "report.filter_apply": "تطبيق",
  "report.filter_date_range": "نطاق التاريخ",
  "report.kpi_total_records": "إجمالي السجلات",
  "report.kpi_total_debit": "إجمالي المدين",
  "report.kpi_total_credit": "إجمالي الدائن",
  "report.kpi_net_balance": "صافي الرصيد",
  "report.kpi_total_purchase": "إجمالي المشتريات",
  "report.kpi_total_sales": "إجمالي المبيعات",
  "report.kpi_total_payment": "إجمالي المدفوعات",
  "report.kpi_total_remaining": "إجمالي المتبقي",
  "report.export_pdf": "تصدير PDF",
  "report.export_excel": "تصدير Excel",
  "report.export_csv": "تصدير CSV",
  "report.print": "طباعة",
  "report.share_whatsapp": "مشاركة عبر واتساب",
  "report.share_email": "مشاركة عبر البريد",
  "report.reload": "إعادة تحميل",
  "report.search": "بحث",
  "report.search_placeholder": "بحث في بيانات التقرير...",
  "report.no_data": "لا توجد بيانات",
  "report.loading": "جاري تحميل التقرير...",
  "report.error": "خطأ في تحميل التقرير",
  "report.generated_at": "تاريخ الإنشاء",
  "report.scope_label": "مستوى الوصول",
  "report.scope_global": "عالمي",
  "report.scope_country": "الدولة",
  "report.scope_branch": "الفرع",
  "report.col_date": "التاريخ",
  "report.col_serial": "رقم تسلسلي",
  "report.col_description": "وصف",
  "report.col_debit": "مدين",
  "report.col_credit": "دائن",
  "report.col_balance": "الرصيد",
  "report.col_currency": "العملة",
  "report.col_status": "الحالة",
  "report.col_branch": "الفرع",
  "report.col_country": "الدولة",
  "report.col_user": "المستخدم",
  "report.col_amount": "المبلغ",
  "report.col_reference": "المرجع",
  // Tax System Arabic
  "nav.tax": "إعدادات الضرائب والنسب",
  "nav.tax_settings": "إعدادات ضرائب الدولة",
  "tax.title": "إدارة ضرائب الدول",
  "tax.subtitle": "تهيئة نسب الضرائب وأرقام التسجيل الضريبي VAT/GST لكل دولة",
  "tax.select_country": "اختر الدولة",
  "tax.add_new_tax": "إضافة نسبة ضريبية جديدة",
  "tax.edit_tax": "تعديل النسبة الضريبية",
  "tax.tax_name": "اسم الضريبة",
  "tax.tax_code": "رمز الضريبة",
  "tax.tax_rate": "نسبة الضريبة (%)",
  "tax.trn_number": "رقم التسجيل الضريبي TRN",
  "tax.applies_to": "تطبق على",
  "tax.purchase": "المشتريات فقط",
  "tax.sales": "المبيعات فقط",
  "tax.both": "المشتريات والمبيعات",
  "tax.expense": "المصاريف فقط",
  "tax.is_default": "تعيين كضريبة افتراضية للدولة",
  "tax.is_active": "الحالة",
  "tax.actions": "الإجراءات",
  "tax.no_taxes_found": "لا توجد نسب ضريبية مضافة لهذه الدولة",
  "tax.saved_successfully": "تم حفظ إعدادات الضريبة بنجاح",
  "tax.deleted_successfully": "تم حذف إعدادات الضريبة بنجاح"
};

const fa: Dict = {
  ...en,
  "nav.dashboard": "داشبورد",
  "nav.super_admin_dashboard": "داشبورد سوپر ادمین",
  "nav.country_dashboard": "داشبورد کشور",
  "nav.city_dashboard": "داشبورد شعبه",
  "nav.agent_dashboard": "داشبورد نماینده",
  "nav.shipping_line_dashboard": "داشبورد کشتیرانی",
  "nav.clearing_agent_dashboard": "داشبورد ترخیص",
  "nav.new_entry": "ورودی‌های جدید",
  "nav.branch_entry": "شعبه",
  "nav.branch_menu": "شعبه",
  "nav.branch_general_report": "گزارش عمومی شعبه",
  "nav.super_admin_branch": "شعبه سوپر ادمین",
  "nav.country_branch": "شعبه کشور",
  "nav.city_branch": "شعبه شهر",
  "nav.user_entry": "کاربر",
  "nav.user_form": "ثبت کاربر",
  "nav.user_journal_report": "گزارش ژورنال کاربر",
  "nav.accounts": "حساب‌ها",
  "nav.new_account": "حساب جدید",
  "nav.new_account_general_report": "گزارش عمومی حساب‌های جدید",
  "nav.super_admin_account_entry": "ثبت حساب (سوپر ادمین)",
  "nav.daily_payment_entry": "ثبت پرداخت روزانه",
  "nav.journal": "دفتر روزنامه",
  "nav.purchase_order_payment": "پرداخت سفارش خرید",
  "nav.purchase_order_payment_advance": "پیش پرداخت",
  "nav.purchase_order_payment_advance_completed": "پیش پرداخت تکمیل شد",
  "nav.purchase_order_payment_remaining": "مابقی پرداخت",
  "nav.purchase_order_payment_charges": "پرداخت اعتباری",
  "nav.purchase_order_payment_history": "تاریخچه پرداخت",
  "nav.sales_transfer_payment": "انتقال پرداخت فروش",
  "nav.sales_order_payment": "پرداخت سفارش فروش",
  "nav.sales_order_payment_advance": "پیش پرداخت فروش",
  "nav.sales_order_payment_advance_completed": "پیش پرداخت تکمیل شد",
  "nav.sales_order_payment_remaining": "مابقی پرداخت",
  "nav.sales_order_payment_charges": "اعتبار نهایی",
  "nav.sales_order_payment_history": "تاریخچه پرداخت",
  "nav.purchase_order_management": "Purchase Order Management",
  "nav.product_units": "واحدهای محصول",
  "nav.product_brands": "برندهای محصول",
  "nav.product_categories": "دسته‌های محصول",
  "nav.warehouses": "انبارها",
  "nav.truck_registration": "ثبت کامیون",
  "nav.truck_loading": "بارگیری کامیون",
  "nav.import_loading": "بارگیری واردات",
  "nav.transit_loading": "بارگیری ترانزیت",
  "nav.walkthrough_video": "ویدیو راهنمای سیستم",
  "tt.title": "بارگیری ترانزیت",
  "tt.select_truck": "انتخاب کامیون",
  "tt.date": "تاریخ ترانزیت",
  "tt.company": "شرکت ترانزیت",
  "tt.goods": "کالا",
  "tt.qty": "مقدار",
  "tt.unit": "واحد",
  "tt.route": "مسیر ترانزیت",
  "tt.border": "مرز",
  "tt.destination": "مقصد",
  "tt.customs": "اطلاعات گمرک",
  "tt.container": "شماره کانتینر",
  "tt.seal": "شماره پلمب",
  "tt.remarks": "ملاحظات",
  "tt.add": "ترانزیت جدید",
  "tt.edit": "ویرایش",
  "tt.delete": "حذف",
  "tt.save": "ذخیره",
  "tt.cancel": "لغو",
  "tt.search": "جستجوی ترانزیت...",
  "tt.empty": "ترانزیتی یافت نشد",
  "il.title": "بارگیری واردات",
  "il.select_truck": "انتخاب کامیون",
  "il.date": "تاریخ واردات",
  "il.bill": "شماره فاکتور",
  "il.importer": "واردکننده",
  "il.supplier": "تأمین‌کننده",
  "il.goods": "کالا",
  "il.qty": "مقدار",
  "il.unit": "واحد",
  "il.customs": "اداره گمرک",
  "il.border": "گذرگاه مرزی",
  "il.origin": "کشور مبدأ",
  "il.dest_country": "کشور مقصد",
  "il.agent": "کارگزار ترخیص",
  "il.remarks": "ملاحظات",
  "il.add": "واردات جدید",
  "il.edit": "ویرایش",
  "il.delete": "حذف",
  "il.save": "ذخیره",
  "il.cancel": "لغو",
  "il.search": "جستجوی واردات...",
  "il.empty": "وارداتی یافت نشد",
  "tl.title": "بارگیری کامیون",
  "tl.select_truck": "انتخاب کامیون",
  "tl.date": "تاریخ بارگیری",
  "tl.serial": "سریال",
  "tl.goods": "کالا",
  "tl.qty": "مقدار",
  "tl.unit": "واحد",
  "tl.net_weight": "وزن خالص",
  "tl.gross_weight": "وزن ناخالص",
  "tl.destination": "مقصد",
  "tl.remarks": "ملاحظات",
  "tl.add": "بارگیری جدید",
  "tl.edit": "ویرایش",
  "tl.delete": "حذف",
  "tl.save": "ذخیره",
  "tl.cancel": "لغو",
  "tl.search": "جستجوی بارگیری‌ها...",
  "tl.empty": "بارگیری یافت نشد",
  "tr.title": "ثبت کامیون",
  "tr.number": "شماره کامیون",
  "tr.reg_no": "شماره ثبت",
  "tr.type": "نوع کامیون",
  "tr.owner": "نام مالک",
  "tr.owner_mobile": "موبایل مالک",
  "tr.company": "شرکت حمل‌ونقل",
  "tr.driver": "نام راننده",
  "tr.driver_mobile": "موبایل راننده",
  "tr.status": "وضعیت",
  "tr.reg_expiry": "انقضای ثبت",
  "tr.ins_expiry": "انقضای بیمه",
  "tr.add": "افزودن کامیون",
  "tr.edit": "ویرایش",
  "tr.delete": "حذف",
  "tr.save": "ذخیره",
  "tr.cancel": "لغو",
  "tr.search": "جستجوی کامیون‌ها...",
  "tr.empty": "کامیونی یافت نشد",
  "pc.title": "دسته‌های محصول",
  "pc.code": "کد دسته",
  "pc.name": "نام دسته",
  "pc.description": "توضیحات",
  "pc.active": "فعال",
  "pc.add": "افزودن دسته",
  "pc.edit": "ویرایش",
  "pc.delete": "حذف",
  "pc.save": "ذخیره",
  "pc.cancel": "لغو",
  "pc.search": "جستجوی دسته‌ها...",
  "pc.empty": "دسته‌ای یافت نشد",
  "pb.title": "برندهای محصول",
  "pb.code": "کد برند",
  "pb.name": "نام برند",
  "pb.description": "توضیحات",
  "pb.active": "فعال",
  "pb.add": "افزودن برند",
  "pb.edit": "ویرایش",
  "pb.delete": "حذف",
  "pb.save": "ذخیره",
  "pb.cancel": "لغو",
  "pb.search": "جستجوی برندها...",
  "pb.empty": "برندی یافت نشد",
  "pu.title": "واحدهای محصول",
  "pu.code": "کد واحد",
  "pu.name": "نام واحد",
  "pu.base": "واحد پایه",
  "pu.factor": "ضریب تبدیل",
  "pu.active": "فعال",
  "pu.add": "افزودن واحد",
  "pu.edit": "ویرایش",
  "pu.delete": "حذف",
  "pu.save": "ذخیره",
  "pu.cancel": "لغو",
  "pu.search": "جستجوی واحدها...",
  "pu.empty": "واحدی یافت نشد",
  "nav.local_purchase_management": "مدیریت خرید محلی",
  "nav.sales_order_management": "مدیریت سفارش فروش",
  "nav.local_sales_management": "مدیریت فروش محلی",
  "nav.new_purchase_order": "New Purchase Booking Order",
  "nav.booking_purchase_orders": "Booking Purchase Orders",
  "nav.booking_confirm": "Booking Confirm",
  "nav.purchase_invoice": "Purchase Invoice",
  "nav.purchase_order_report": "Purchase Order Report",
  "nav.confirmed_purchase_orders": "Confirmed Purchase Orders",
  "nav.container_loading": "Container Loading",
  "nav.shipping_documents": "Shipping Documents",
  "nav.shipment_details": "Shipment Details",
  "nav.generate_bl": "Generate Bill of Lading",
  "nav.bl_report": "B/L Report",
  "nav.shipment_report": "Shipment Report",
  "nav.finalized_purchase_orders": "Finalized Purchase Orders",
  "nav.purchase_order_tracking": "Purchase Order Tracking",
  "nav.stock": "Stock",
  "nav.booking_stock": "Booking Stock",
  "nav.confirmed_stock": "Confirmed Stock",
  "nav.import_stock": "Import Stock",
  "nav.journal_stock": "Journal Stock",
  "nav.journal_stock_report": "گزارش ژورنال استاک",
  "nav.journal_stock_checking_report": "گزارش بررسی ژورنال استاک",
  "nav.document_management": "مدیریت اسناد و اسکنر",
  "nav.scanner_integration": "اسکن مستقیم اسناد",
  "nav.all_reports_catalog": "کاتالوگ کامل گزارش‌ها",
  "nav.warehouse_stock": "Warehouse Stock",
  "nav.in_transit_stock": "In Transit Stock",
  "nav.export_stock": "Export Stock",
  "nav.delivered_stock": "Delivered Stock",
  "nav.roznamcha": "ثبت پرداخت روزانه",
  "nav.expenses_bill": "صورتحساب هزینه‌ها",
  "nav.all_roznamcha": "همه روزنامه",
  "nav.roznamcha_all_report": "گزارش جامع روزنامه",
  "nav.super_admin_roznamcha": "روزنامه (سوپر ادمین)",
  "nav.country_roznamcha": "روزنامه (کشور)",
  "nav.branch_roznamcha": "روزنامه (شهر)",
  "nav.cash_entry": "ثبت نقدی",
  "nav.cash_entry_super_admin": "ثبت نقدی (سوپر ادمین)",
  "nav.cash_entry_country": "ثبت نقدی (کشور)",
  "nav.cash_entry_branch": "ثبت نقدی (شعبه)",
  "nav.ledgers": "دفاتر کل",
  "nav.new_ledger": "دفتر کل جدید",
  "nav.super_admin_ledger": "دفتر کل سوپر ادمین",
  "nav.country_ledger": "دفتر کل کشور",
  "nav.branch_ledger": "دفتر کل شعبه / شهر",
  "nav.ledger_general_report": "گزارش عمومی دفتر کل",
  "nav.ledger_outstanding": "دفتر مانده‌های معوق و وصول",
  "nav.ledger_super_admin_detailed": "دفتر کل مدیر ارشد (مفصل)",
  "nav.ledger_country_detailed": "دفتر کل کشور (مفصل)",
  "nav.shipping_clearing": "کشتیرانی / ترخیص",
  "nav.shipping_line": "کشتیرانی",
  "nav.clearing_agent": "ترخیص",
  "nav.purchase_sale": "خرید و فروش",
  "nav.reports": "گزارش‌ها",
  "nav.search_portal": "جستجوی سراسری",
  "nav.all_roznamcha_reports": "همه گزارش‌های روزنامچہ",
  "nav.ledger_reports": "گزارش‌های دفتر کل",
  "nav.ledger_journal_reports": "گزارش‌های ژورنال دفتر کل",
  "nav.super_admin_journal_report": "گزارش ژورنال سوپر ادمین",
  "nav.country_journal_report": "گزارش ژورنال کشور",
  "nav.city_journal_report": "گزارش ژورنال شهر",
  "nav.construction_journal_report": "گزارش ژورنال ساخت‌وساز",
  "nav.settings": "تنظیمات",
  "nav.management": "مدیریت",
  "nav.location_form": "مدیریت مکان‌ها",
  "nav.location_country": "مدیریت کشورها",
  "nav.location_state": "مدیریت استان‌ها",
  "nav.location_city": "مدیریت شهرها",
  "nav.location_tehsil": "مدیریت بخش‌ها (تحصیل)",
  "nav.goods_master": "فهرست کالا",
  "nav.chs_products": "مدیریت محصولات CHS",
  "nav.port_master": "مدیریت بنادر / مرزها",
  "nav.template_color": "رنگ قالب",
  "auth.welcome_back": "خوش آمدید",
  "auth.sign_in_continue": "برای ادامه وارد حساب خود شوید",
  "auth.user_id_or_email": "شناسه کاربر / ایمیل",
  "auth.password": "رمز عبور",
  "auth.remember_me": "مرا به خاطر بسپار",
  "auth.forgot_password": "فراموشی رمز عبور؟",
  "auth.sign_in": "ورود",
  "auth.or_continue_with": "یا ادامه با",
  "auth.sign_in_google": "ورود با Google",
  "auth.choose_theme": "انتخاب قالب",
  "auth.support": "پشتیبانی",

  // Roznamcha Report UI
  "roz.report_subtitle": "گزارش روزنامچه با فیلترها و جزئیات ثبت‌ها.",
  "roz.filters": "فیلترها",
  "roz.country": "کشور",
  "roz.branch": "شعبه",
  "roz.all": "همه",
  "roz.search": "جستجو",
  "roz.search_placeholder": "جستجوی رسید، شرح، حساب...",
  "roz.select_entry_hint": "برای دیدن جزئیات یک ثبت را انتخاب کنید.",
  "roz.entries": "ثبت‌ها",
  "roz.date": "تاریخ",
  "roz.voucher_no": "شماره رسید",
  "roz.journal_no": "شماره ژورنال",
  "roz.narration": "شرح",
  "roz.status": "وضعیت",
  "roz.no_entries": "هیچ رکوردی یافت نشد.",
  "roz.entry_details": "جزئیات ثبت",
  "roz.lines": "ردیف‌ها",
  "roz.reference_no": "شماره مرجع",
  "roz.payment_entry_type": "نوع ثبت",
  "roz.ledger": "دفتر کل",
  "roz.account": "حساب",
  "roz.description": "توضیحات",
  "roz.currency": "ارز",
  "roz.debit": "بدهکار",
  "roz.credit": "بستانکار",
  "roz.no_lines": "هیچ ردیفی وجود ندارد.",
  "roz.not_found": "رکورد یافت نشد.",
  "common.coming_soon": "به زودی.",

  // Ledger columns
  "ledger.col_branch": "شعبه",
  "ledger.col_user": "کاربر",
  "ledger.col_roz": "روز#",
  "ledger.col_account_name": "نام حساب",
  "ledger.col_account_no": "شماره حساب",
  "ledger.export_csv": "اکسل (CSV)",
  "ledger.report_title": "گزارش دفتر کل",
  "ledger.report_subtitle": "صورت حساب با مجموع‌ها، فیلترها و نرخ‌های تبدیل.",
  "ledger.print": "چاپ",
  "ledger.account_details": "جزئیات حساب",
  "ledger.company_details": "جزئیات شرکت",
  "ledger.branch_details": "جزئیات شعبه",
  "ledger.summary": "خلاصه دفتر کل",
  "ledger.session_details": "جزئیات نشست / ورود",
  "ledger.filters": "فیلترها",
  "ledger.entries_table_title": "تراکنش‌های دفتر کل",
  "ledger.ac_name": "نام حساب",
  "ledger.ac_number": "شماره حساب",
  "ledger.economic_name": "نام دفتر کل",
  "ledger.category": "دسته‌بندی",
  "ledger.account_title": "عنوان حساب",
  "ledger.account_type": "نوع",
  "ledger.currency": "ارز",
  "ledger.contract_no": "شماره قرارداد",
  "ledger.contract_date": "تاریخ قرارداد",
  "ledger.contract_type": "نوع قرارداد",
  "ledger.company_name": "نام شرکت",
  "ledger.business_title": "عنوان کسب‌وکار",
  "ledger.registration_number": "شماره ثبت",
  "ledger.trn": "TRN",
  "ledger.website": "وب‌سایت",
  "ledger.branch_name": "نام شعبه",
  "ledger.branch_account_no": "شماره حساب شعبه",
  "ledger.country": "کشور",
  "ledger.state_city": "استان / شهر",
  "ledger.address": "آدرس",
  "ledger.entries": "تراکنش‌ها",
  "ledger.total_debit": "بدهکار",
  "ledger.total_credit": "بستانکار",
  "ledger.current_balance": "مانده",
  "ledger.exchange_rate_local_to_usd": "نرخ تبدیل (محلی→USD)",
  "ledger.exchange_rate_ph": "مثال: 278.50",
  "ledger.exchange_rate_hint": "فقط پیش‌نمایش. نرخ‌های زمان تراکنش در جدول نمایش داده می‌شود.",
  "ledger.session_branch": "شعبه نشست",
  "ledger.user_name": "نام کاربر",
  "ledger.user_id": "شناسه کاربر",
  "ledger.roles": "نقش‌ها",
  "ledger.filter_account_no": "شماره حساب",
  "ledger.filter_account_no_ph": "جستجو شماره، نام، شرکت...",
  "ledger.select_account": "انتخاب حساب / دفتر کل",
  "ledger.select_account_ph": "انتخاب حساب",
  "ledger.loading": "در حال بارگذاری...",
  "ledger.from_date": "از تاریخ",
  "ledger.to_date": "تا تاریخ",
  "ledger.branch_filter": "انتخاب شعبه",
  "ledger.all_branches": "همه شعبه‌ها",
  "ledger.apply": "اعمال",
  "ledger.reset": "بازنشانی",
  "ledger.showing_range": "نمایش",
  "ledger.select_account_hint": "برای مشاهده گزارش، یک حساب انتخاب کنید.",
  "ledger.rows": "ردیف‌ها",
  "ledger.page": "صفحه",
  "ledger.col_date": "تاریخ",
  "ledger.col_serial": "سریال",
  "ledger.col_name": "منبع",
  "ledger.col_details": "جزئیات",
  "ledger.col_debit": "بدهکار",
  "ledger.col_credit": "بستانکار",
  "ledger.col_total": "مانده جاری",
  "ledger.col_ex_rate": "نرخ تبدیل",
  "ledger.col_debit_usd": "بدهکار (USD)",
  "ledger.col_credit_usd": "بستانکار (USD)",
  "ledger.no_data": "داده‌ای نیست. ابتدا یک حساب انتخاب کنید.",
  "ledger.no_entries": "برای این بازه، تراکنشی یافت نشد.",
  "ledger.totals": "مجموع",
  "ledger.pagination_hint": "اندازه صفحه:",
  "ledger.prev": "قبلی",
  "ledger.next": "بعدی",
  "ledger.source_ledger": "دفتر کل",
  "ledger.source_roznamcha": "روزنامچه",
  "form.from": "از",
  "form.to": "به",
  "form.quantity": "مقدار (مبلغ خارجی)",
  "form.debit_credit": "سند بدهکار / بستانکار",
  "form.submit": "ارسال",
  "form.reset": "بازنشانی",
  "form.transaction_rate": "نرخ تراکنش",
  "form.operation": "عملیات",
  "form.final_amount": "مبلغ نهایی",
  "form.remarks_notes": "توضیحات / یادداشت‌ها",
  "form.save": "ذخیره",
  "form.save_view": "ذخیره و مشاهده",
  "form.save_submit": "ذخیره و ارسال",
  "form.search_account": "جستجوی حساب (نام یا شماره)",
  "form.daily_payment_date": "تاریخ پرداخت روزانه",
  "form.roznamcha_type": "نوع روزنامچه",
  "form.roznamcha_number": "شماره روزنامچه",
  "form.roznamcha_category": "دسته روزنامچه",
  "form.currency_type": "نوع ارز",
  // ERP Reports — Persian overrides
  "nav.super_admin_reports": "گزارشات سوپر ادمین",
  "nav.country_reports": "گزارشات کشور",
  "nav.branch_reports": "گزارشات شعبه",
  "nav.reports_hub": "مرکز گزارشات",
  "report.purchase": "گزارش خرید",
  "report.sales": "گزارش فروش",
  "report.loading": "گزارش بارگیری",
  "report.transfer": "گزارش انتقال",
  "report.payment": "گزارش پرداخت",
  "report.remaining": "گزارش مانده",
  "report.ledger": "گزارش دفتر کل",
  "report.roznamcha": "گزارش روزنامه",
  "report.journal": "گزارش دفتر روزنامه",
  "report.cash": "گزارش صندوق",
  "report.inventory": "گزارش انبارداری",
  "report.daily_comprehensive": "گزارش جامع روزانه",
  "report.purchase_booking": "گزارش رزرو خرید",
  "report.user_activity": "گزارش فعالیت کاربر",
  "report.audit_log": "گزارش گزارش حسابرسی",
  "report.exchange_rate": "گزارش نرخ ارز",
  "report.panel_super_admin": "پنل گزارشات سوپر ادمین",
  "report.panel_country": "پنل گزارشات کشور",
  "report.panel_branch": "پنل گزارشات شعبه",
  "report.panel_subtitle_super": "همه کشورها، همه شعبه‌ها، همه گزارشات",
  "report.panel_subtitle_country": "گزارشات کشور شما",
  "report.panel_subtitle_branch": "گزارشات شعبه شما",
  "report.filter_country": "کشور",
  "report.filter_branch": "شعبه",
  "report.filter_main_branch": "شعبه اصلی",
  "report.filter_date_from": "از تاریخ",
  "report.filter_date_to": "تا تاریخ",
  "report.filter_currency": "ارز",
  "report.filter_exchange_rate": "نرخ تبدیل",
  "report.filter_user": "کاربر",
  "report.filter_report_type": "نوع گزارش",
  "report.filter_all_countries": "همه کشورها",
  "report.filter_all_branches": "همه شعبه‌ها",
  "report.filter_all_users": "همه کاربران",
  "report.filter_all_currencies": "همه ارزها",
  "report.filter_reset": "بازنشانی فیلترها",
  "report.filter_apply": "اعمال",
  "report.filter_date_range": "بازه تاریخ",
  "report.kpi_total_records": "کل رکوردها",
  "report.kpi_total_debit": "کل بدهکار",
  "report.kpi_total_credit": "کل بستانکار",
  "report.kpi_net_balance": "مانده خالص",
  "report.kpi_total_purchase": "کل خرید",
  "report.kpi_total_sales": "کل فروش",
  "report.kpi_total_payment": "کل پرداخت",
  "report.kpi_total_remaining": "کل مانده",
  "report.export_pdf": "خروجی PDF",
  "report.export_excel": "خروجی Excel",
  "report.export_csv": "خروجی CSV",
  "report.print": "چاپ",
  "report.share_whatsapp": "اشتراک‌گذاری از طریق واتساپ",
  "report.share_email": "اشتراک‌گذاری از طریق ایمیل",
  "report.reload": "بارگذاری مجدد",
  "report.search": "جستجو",
  "report.search_placeholder": "جستجو در داده‌های گزارش...",
  "report.no_data": "داده‌ای یافت نشد",
  "report.loading": "در حال بارگذاری گزارش...",
  "report.error": "خطا در بارگذاری گزارش",
  "report.generated_at": "ساخته شده در",
  "report.scope_label": "سطح دسترسی",
  "report.scope_global": "جهانی",
  "report.scope_country": "کشور",
  "report.scope_branch": "شعبه",
  "report.col_date": "تاریخ",
  "report.col_serial": "شماره",
  "report.col_description": "توضیح",
  "report.col_debit": "بدهکار",
  "report.col_credit": "بستانکار",
  "report.col_balance": "مانده",
  "report.col_currency": "ارز",
  "report.col_status": "وضعیت",
  "report.col_branch": "شعبه",
  "report.col_country": "کشور",
  "report.col_user": "کاربر",
  "report.col_amount": "مبلغ",
  "report.col_reference": "مرجع"
};

const ps: Dict = {
  ...en,
  "nav.dashboard": "ډشبورډ",
  "nav.super_admin_dashboard": "د سوپر اډمین ډشبورډ",
  "nav.country_dashboard": "د هېواد ډشبورډ",
  "nav.city_dashboard": "د څانګې ډشبورډ",
  "nav.agent_dashboard": "د ایجنټ ډشبورډ",
  "nav.shipping_line_dashboard": "د شپنګ ډشبورډ",
  "nav.clearing_agent_dashboard": "د کلیئرنګ ډشبورډ",
  "nav.new_entry": "نوې انټري",
  "nav.branch_entry": "برانچ",
  "nav.branch_menu": "برانچ",
  "nav.branch_general_report": "د څانګو عمومي راپور",
  "nav.super_admin_branch": "د سوپر اډمین برانچ",
  "nav.country_branch": "د هېواد برانچ",
  "nav.city_branch": "د ښار برانچ",
  "nav.user_entry": "کاروونکی",
  "nav.user_form": "د کاروونکي ثبت",
  "nav.user_journal_report": "د کاروونکي ژورنال راپور",
  "nav.accounts": "اکاونټونه",
  "nav.new_account": "نوی اکاونټ",
  "nav.new_account_general_report": "د نوي اکاونټ عمومي راپور",
  "nav.super_admin_account_entry": "د سوپر اډمین اکاونټ داخلول",
  "nav.daily_payment_entry": "ورځنۍ تادیه",
  "nav.journal": "ورځپاڼه",
  "nav.purchase_order_payment": "د پیرودلو امر تادیه",
  "nav.purchase_order_payment_advance": "مخکینۍ تادیه",
  "nav.purchase_order_payment_remaining": "پاتې تادیه",
  "nav.purchase_order_payment_charges": "اعتباري تادیه",
  "nav.purchase_order_payment_history": "د تادیې تاریخ",
  "nav.sales_transfer_payment": "د پلور د تادیې لیږد",
  "nav.sales_order_payment": "د پلور امر تادیه",
  "nav.sales_order_payment_advance": "د پلور پرمختګ",
  "nav.sales_order_payment_advance_completed": "پرمختګ بشپړ شو",
  "nav.sales_order_payment_remaining": "پاتې تادیه",
  "nav.sales_order_payment_charges": "وروستی کریډیټ",
  "nav.sales_order_payment_history": "د تادیې تاریخ",
  "nav.purchase_order_management": "Purchase Order Management",
  "nav.product_units": "د محصول واحدونه",
  "nav.product_brands": "د محصول برنډونه",
  "nav.product_categories": "د محصول کټګورۍ",
  "nav.warehouses": "ګودامونه",
  "nav.truck_registration": "د لارۍ راجستر",
  "nav.truck_loading": "د لارۍ بار",
  "nav.import_loading": "د واردولو بار",
  "nav.transit_loading": "د ترانزیت بار",
  "nav.walkthrough_video": "د سیسټم لارښود ویډیو",
  "tt.title": "د ترانزیت بار",
  "tt.select_truck": "لارۍ وټاکئ",
  "tt.date": "د ترانزیت نیټه",
  "tt.company": "د ترانزیت شرکت",
  "tt.goods": "توکي",
  "tt.qty": "مقدار",
  "tt.unit": "واحد",
  "tt.route": "د ترانزیت لاره",
  "tt.border": "پوله",
  "tt.destination": "منزل",
  "tt.customs": "د ګمرک معلومات",
  "tt.container": "د کانتینر نمبر",
  "tt.seal": "د سیل نمبر",
  "tt.remarks": "یادښتونه",
  "tt.add": "نوی ترانزیت",
  "tt.edit": "سمون",
  "tt.delete": "ړنګول",
  "tt.save": "خوندي کول",
  "tt.cancel": "لغوه کول",
  "tt.search": "د ترانزیت لټون...",
  "tt.empty": "هیڅ ترانزیت ونه موندل شو",
  "il.title": "د واردولو بار",
  "il.select_truck": "لارۍ وټاکئ",
  "il.date": "د واردولو نیټه",
  "il.bill": "د بل نمبر",
  "il.importer": "واردوونکی",
  "il.supplier": "عرضه‌کوونکی",
  "il.goods": "توکي",
  "il.qty": "مقدار",
  "il.unit": "واحد",
  "il.customs": "د ګمرک دفتر",
  "il.border": "سرحدي معبر",
  "il.origin": "د اصل هېواد",
  "il.dest_country": "د منزل هېواد",
  "il.agent": "د پاکولو استازی",
  "il.remarks": "یادښتونه",
  "il.add": "نوی واردات",
  "il.edit": "سمون",
  "il.delete": "ړنګول",
  "il.save": "خوندي کول",
  "il.cancel": "لغوه کول",
  "il.search": "د وارداتو لټون...",
  "il.empty": "هیڅ واردات ونه موندل شو",
  "tl.title": "د لارۍ بار",
  "tl.select_truck": "لارۍ وټاکئ",
  "tl.date": "د بار نیټه",
  "tl.serial": "سریال",
  "tl.goods": "توکي",
  "tl.qty": "مقدار",
  "tl.unit": "واحد",
  "tl.net_weight": "خالص وزن",
  "tl.gross_weight": "ناخالص وزن",
  "tl.destination": "منزل",
  "tl.remarks": "یادښتونه",
  "tl.add": "نوی بار",
  "tl.edit": "سمون",
  "tl.delete": "ړنګول",
  "tl.save": "خوندي کول",
  "tl.cancel": "لغوه کول",
  "tl.search": "د بارونو لټون...",
  "tl.empty": "هیڅ بار ونه موندل شو",
  "tr.title": "د لارۍ راجستر",
  "tr.number": "د لارۍ نمبر",
  "tr.reg_no": "د راجستر نمبر",
  "tr.type": "د لارۍ ډول",
  "tr.owner": "د مالک نوم",
  "tr.owner_mobile": "د مالک موبایل",
  "tr.company": "د ترانسپورت شرکت",
  "tr.driver": "د چلوونکي نوم",
  "tr.driver_mobile": "د چلوونکي موبایل",
  "tr.status": "حالت",
  "tr.reg_expiry": "د راجستر پای",
  "tr.ins_expiry": "د بیمې پای",
  "tr.add": "لارۍ اضافه کړئ",
  "tr.edit": "سمون",
  "tr.delete": "ړنګول",
  "tr.save": "خوندي کول",
  "tr.cancel": "لغوه کول",
  "tr.search": "د لارو لټون...",
  "tr.empty": "هیڅ لارۍ ونه موندل شوه",
  "pc.title": "د محصول کټګورۍ",
  "pc.code": "د کټګورۍ کوډ",
  "pc.name": "د کټګورۍ نوم",
  "pc.description": "تشریح",
  "pc.active": "فعال",
  "pc.add": "کټګوري اضافه کړئ",
  "pc.edit": "سمون",
  "pc.delete": "ړنګول",
  "pc.save": "خوندي کول",
  "pc.cancel": "لغوه کول",
  "pc.search": "د کټګوریو لټون...",
  "pc.empty": "هیڅ کټګوري ونه موندل شوه",
  "pb.title": "د محصول برنډونه",
  "pb.code": "د برنډ کوډ",
  "pb.name": "د برنډ نوم",
  "pb.description": "تشریح",
  "pb.active": "فعال",
  "pb.add": "برنډ اضافه کړئ",
  "pb.edit": "سمون",
  "pb.delete": "ړنګول",
  "pb.save": "خوندي کول",
  "pb.cancel": "لغوه کول",
  "pb.search": "د برنډونو لټون...",
  "pb.empty": "هیڅ برنډ ونه موندل شو",
  "pu.title": "د محصول واحدونه",
  "pu.code": "د واحد کوډ",
  "pu.name": "د واحد نوم",
  "pu.base": "بنسټیز واحد",
  "pu.factor": "د بدلون فکتور",
  "pu.active": "فعال",
  "pu.add": "واحد اضافه کړئ",
  "pu.edit": "سمون",
  "pu.delete": "ړنګول",
  "pu.save": "خوندي کول",
  "pu.cancel": "لغوه کول",
  "pu.search": "د واحدونو لټون...",
  "pu.empty": "هیڅ واحد ونه موندل شو",
  "nav.local_purchase_management": "د محلي پیرودو مدیریت",
  "nav.sales_order_management": "د پلور د امر مدیریت",
  "nav.local_sales_management": "د محلي پلور مدیریت",
  "nav.new_purchase_order": "New Purchase Booking Order",
  "nav.booking_purchase_orders": "Booking Purchase Orders",
  "nav.booking_confirm": "Booking Confirm",
  "nav.purchase_invoice": "Purchase Invoice",
  "nav.purchase_order_report": "Purchase Order Report",
  "nav.confirmed_purchase_orders": "Confirmed Purchase Orders",
  "nav.container_loading": "Container Loading",
  "nav.shipping_documents": "Shipping Documents",
  "nav.shipment_details": "Shipment Details",
  "nav.generate_bl": "Generate Bill of Lading",
  "nav.bl_report": "B/L Report",
  "nav.shipment_report": "Shipment Report",
  "nav.finalized_purchase_orders": "Finalized Purchase Orders",
  "nav.purchase_order_tracking": "Purchase Order Tracking",
  "nav.stock": "Stock",
  "nav.booking_stock": "Booking Stock",
  "nav.confirmed_stock": "Confirmed Stock",
  "nav.import_stock": "Import Stock",
  "nav.journal_stock": "Journal Stock",
  "nav.journal_stock_report": "د جرنل سټاک راپور",
  "nav.journal_stock_checking_report": "د جرنل سټاک چک راپور",
  "nav.document_management": "إدارة المستندات والماسح الضوئي",
  "nav.scanner_integration": "المسح الضوئي المباشر",
  "nav.all_reports_catalog": "كتالوج جميع التقارير",
  "nav.warehouse_stock": "Warehouse Stock",
  "nav.in_transit_stock": "In Transit Stock",
  "nav.export_stock": "Export Stock",
  "nav.delivered_stock": "Delivered Stock",
  "nav.roznamcha": "ورځنۍ تادیه",
  "nav.expenses_bill": "د لګښتونو بل",
  "nav.all_roznamcha": "ټول روزنامچه",
  "nav.roznamcha_all_report": "د روزنامچه ټول راپور",
  "nav.reports": "راپورونه",
  "nav.search_portal": "عمومي پلټنه",
  "nav.all_roznamcha_reports": "ټول روزنامچه راپورونه",
  "nav.ledger_reports": "د لېجر راپورونه",
  "nav.ledger_journal_reports": "د لېجر جرنل راپورونه",
  "nav.super_admin_journal_report": "د سوپر اډمین جرنل راپور",
  "nav.country_journal_report": "د هېواد جرنل راپور",
  "nav.city_journal_report": "د ښار جرنل راپور",
  "nav.construction_journal_report": "د ساختماني جرنل راپور",
  "nav.settings": "سیټنګونه",
  "nav.location_form": "د موقعیت مدیریت",
  "nav.location_country": "د هېواد ماسټر",
  "nav.location_state": "د ایالت ماسټر",
  "nav.location_city": "د ښار ماسټر",
  "nav.location_tehsil": "د تحصیل ماسټر",
  "auth.forgot_password": "پاسورډ هېر شو؟",
  "auth.sign_in": "ننوتل",
  "auth.or_continue_with": "یا دوام ورکړئ",
  "auth.sign_in_google": "د Google سره ننوتل",
  "auth.choose_theme": "تمپلېټ وټاکئ",
  "auth.support": "سپورټ",

  // Roznamcha Report UI
  "roz.report_subtitle": "د روزنامچې راپور له فلټرونو او د انټرۍ له تفصيل سره.",
  "roz.filters": "فلټرونه",
  "roz.country": "هېواد",
  "roz.branch": "څانګه",
  "roz.all": "ټول",
  "roz.search": "لټون",
  "roz.search_placeholder": "واؤچر، بيان، حساب... ولټوئ",
  "roz.select_entry_hint": "د تفصيل لپاره يوه انټري وټاکئ.",
  "roz.entries": "انټرۍ",
  "roz.date": "نېټه",
  "roz.voucher_no": "واؤچر نمبر",
  "roz.journal_no": "جرنل نمبر",
  "roz.narration": "بيان",
  "roz.status": "حالت",
  "roz.no_entries": "هيڅ انټري ونه موندل شوه.",
  "roz.entry_details": "د انټري تفصيل",
  "roz.lines": "کرښې",
  "roz.reference_no": "ريفرنس نمبر",
  "roz.payment_entry_type": "د انټري ډول",
  "roz.ledger": "لېجر",
  "roz.account": "اکاونټ",
  "roz.description": "تفصيل",
  "roz.currency": "کرنسي",
  "roz.debit": "ډېبېټ",
  "roz.credit": "کرېډېټ",
  "roz.no_lines": "هيڅ کرښه نشته.",
  "roz.not_found": "انټري ونه موندل شوه.",
  "common.coming_soon": "ژر راځي.",
  "nav.super_admin_roznamcha": "د سوپر اډمین روزنامچه",
  "nav.country_roznamcha": "د هېواد روزنامچه",
  "nav.branch_roznamcha": "د څانګې / ښار روزنامچه",
  "nav.cash_entry": "نغدي داخله",
  "nav.cash_entry_super_admin": "نغدي داخلول (سوپر اډمين)",
  "nav.cash_entry_country": "نغدي داخلول (هېواد)",
  "nav.cash_entry_branch": "نغدي داخلول (څانګه)",
  "nav.ledgers": "لېجرونه",
  "nav.new_ledger": "نوی لېجر",
  "nav.super_admin_ledger": "د سوپر اډمین لېجر",
  "nav.country_ledger": "د هېواد لېجر",
  "nav.branch_ledger": "د څانګې / ښار لېجر",
  "nav.ledger_general_report": "د لېجر عمومي راپور",
  "nav.ledger_outstanding": "د پاتې او راټولولو لېجر",
  "nav.ledger_super_admin_detailed": "سوپر اډمین لېجر (تفصيلي)",
  "nav.ledger_country_detailed": "هیواد لېجر (تفصيلي)",
  "ledger.apply": "پلي کړئ",
  "ledger.reset": "ری سیٹ",
  "ledger.prev": "مخکینی",
  "ledger.next": "بل",

  // Ledger columns
  "ledger.col_branch": "څانګه",
  "ledger.col_user": "کارن",
  "ledger.col_roz": "روز#",
  "ledger.col_account_name": "د حساب نوم",
  "ledger.col_account_no": "د حساب نمبر",
  "ledger.export_csv": "Excel (CSV)",
  "ledger.report_title": "لېجر راپور",
  "ledger.report_subtitle": "د حساب سټېټمنټ د ټوټلونو، فلټرونو او تبادلې نرخونو سره.",
  "ledger.print": "پرنټ",
  "ledger.account_details": "د حساب معلومات",
  "ledger.company_details": "د شرکت معلومات",
  "ledger.branch_details": "د څانګې معلومات",
  "ledger.summary": "د لېجر خلاصه",
  "ledger.session_details": "د سیشن / لاګین معلومات",
  "ledger.filters": "فلټرونه",
  "ledger.entries_table_title": "لېجر انټریز",
  "ledger.ac_name": "د حساب نوم",
  "ledger.ac_number": "د حساب نمبر",
  "ledger.economic_name": "د لېجر نوم",
  "ledger.category": "کټېګوري",
  "ledger.account_title": "د حساب عنوان",
  "ledger.account_type": "ډول",
  "ledger.currency": "کرنسي",
  "ledger.contract_no": "د قرارداد نمبر",
  "ledger.contract_date": "د قرارداد نېټه",
  "ledger.contract_type": "د قرارداد ډول",
  "ledger.company_name": "د شرکت نوم",
  "ledger.business_title": "د کاروبار عنوان",
  "ledger.registration_number": "د ثبت نمبر",
  "ledger.trn": "TRN",
  "ledger.website": "وېب پاڼه",
  "ledger.branch_name": "د څانګې نوم",
  "ledger.branch_account_no": "د څانګې حساب نمبر",
  "ledger.country": "هېواد",
  "ledger.state_city": "ایالت / ښار",
  "ledger.address": "پته",
  "ledger.entries": "انټریز",
  "ledger.total_debit": "ډیبټ",
  "ledger.total_credit": "کریډټ",
  "ledger.current_balance": "بیلانس",
  "ledger.exchange_rate_local_to_usd": "تبادله نرخ (لوکل→USD)",
  "ledger.exchange_rate_ph": "لکه: 278.50",
  "ledger.exchange_rate_hint": "دا یوازې پریویو اووررایډ دی؛ د ټرانزیکشن وخت نرخونه په جدول کې ښکاري.",
  "ledger.session_branch": "د سیشن څانګه",
  "ledger.user_name": "د کارن نوم",
  "ledger.user_id": "کارن آی ډي",
  "ledger.roles": "رولونه",
  "ledger.filter_account_no": "د حساب نمبر",
  "ledger.filter_account_no_ph": "د حساب نمبر، نوم، شرکت... لټون",
  "ledger.select_account": "اکاؤنټ / لېجر وټاکئ",
  "ledger.select_account_ph": "اکاؤنټ وټاکئ",
  "ledger.loading": "لوډ کېږي...",
  "ledger.from_date": "له نېټې",
  "ledger.to_date": "تر نېټې",
  "ledger.branch_filter": "څانګه وټاکئ",
  "ledger.all_branches": "ټولې څانګې",
  "ledger.showing_range": "ښيي",
  "ledger.select_account_hint": "د راپور لپاره اکاؤنټ وټاکئ.",
  "ledger.rows": "قطارونه",
  "ledger.page": "پاڼه",
  "ledger.col_date": "نېټه",
  "ledger.col_serial": "سیریل",
  "ledger.col_name": "سرچینه",
  "ledger.col_details": "تفصیل",
  "ledger.col_debit": "ډیبټ",
  "ledger.col_credit": "کریډټ",
  "ledger.col_total": "رننګ بیلانس",
  "ledger.col_ex_rate": "تبادله نرخ",
  "ledger.col_debit_usd": "ډیبټ (USD)",
  "ledger.col_credit_usd": "کریډټ (USD)",
  "ledger.no_data": "ډیټا نشته. لومړی اکاؤنټ وټاکئ.",
  "ledger.no_entries": "په دې نېټه رینج کې انټریز ونه موندل شوې.",
  "ledger.totals": "ټول",
  "ledger.pagination_hint": "پاڼې اندازه:",
  "ledger.source_ledger": "لېجر",
  "ledger.source_roznamcha": "روزنامچه",
  "form.from": "له",
  "form.to": "ته",
  "form.quantity": "مقدار (بهرنی مقدار)",
  "form.debit_credit": "ډیبټ / کریډټ داخله",
  "form.submit": "سپارل",
  "form.reset": "ری سیٹ",
  "form.transaction_rate": "د معاملې نرخ",
  "form.operation": "عملیات",
  "form.final_amount": "وروستی مقدار",
  "form.remarks_notes": "تبصرې / یادښتونه",
  "form.save": "خوندي کول",
  "form.save_view": "خوندي او کتل",
  "form.save_submit": "خوندي او سپارل",
  "form.search_account": "حساب وپلټئ (نوم یا شمیره)",
  "form.daily_payment_date": "ورځنۍ د تادیې نېټه",
  "form.roznamcha_type": "د روزنامچې ډول",
  "form.roznamcha_number": "د روزنامچې شمیره",
  "form.roznamcha_category": "د روزنامچې کټګوري",
  "form.currency_type": "د کرنسۍ ډول",
  // ERP Reports — nav
  "nav.super_admin_reports": "د سوپر اډمین راپورونه",
  "nav.country_reports": "د هیواد راپورونه",
  "nav.branch_reports": "د شاخې راپورونه",
  "nav.reports_hub": "د راپورونو مرکز",
  // ERP Reports — types
  "report.purchase": "د پیرود راپور",
  "report.sales": "د پلور راپور",
  "report.loading": "د بارولو راپور",
  "report.transfer": "د لیږد راپور",
  "report.payment": "د تادیې راپور",
  "report.remaining": "د پاتې رقم راپور",
  "report.ledger": "د لیجر راپور",
  "report.roznamcha": "د روزنامچې راپور",
  "report.journal": "د ژورنال راپور",
  "report.cash": "د نغدو راپور",
  "report.inventory": "د ذخیرو راپور",
  "report.daily_comprehensive": "ورځني جامع راپور",
  "report.purchase_booking": "د پیرود بکنګ راپور",
  "report.user_activity": "د کارونکي فعالیت راپور",
  "report.audit_log": "د پلټنې لاګ راپور",
  "report.exchange_rate": "د اسعارو نرخ راپور",
  // ERP Reports — panels
  "report.panel_super_admin": "د سوپر اډمین راپور پینل",
  "report.panel_country": "د هیواد راپور پینل",
  "report.panel_branch": "د شاخې راپور پینل",
  "report.panel_subtitle_super": "ټول هیوادونه، ټولې شاخې، ټول راپورونه",
  "report.panel_subtitle_country": "ستاسو د هیواد راپورونه",
  "report.panel_subtitle_branch": "ستاسو د شاخې راپورونه",
  // ERP Reports — filters
  "report.filter_country": "هیواد",
  "report.filter_branch": "شاخه",
  "report.filter_main_branch": "اصلي شاخه",
  "report.filter_date_from": "له نېټې",
  "report.filter_date_to": "تر نېټې",
  "report.filter_currency": "کرنسي",
  "report.filter_exchange_rate": "د تبادلې نرخ",
  "report.filter_user": "کارونکی",
  "report.filter_report_type": "د راپور ډول",
  "report.filter_all_countries": "ټول هیوادونه",
  "report.filter_all_branches": "ټولې شاخې",
  "report.filter_all_users": "ټول کارونکي",
  "report.filter_all_currencies": "ټولې اسعارې",
  "report.filter_reset": "بیا تنظیمول",
  "report.filter_apply": "پلي کول",
  "report.filter_date_range": "د نېټې سلسله",
  // ERP Reports — KPI
  "report.kpi_total_records": "ټول ریکارډونه",
  "report.kpi_total_debit": "ټول ډیبیټ",
  "report.kpi_total_credit": "ټول کریډیټ",
  "report.kpi_net_balance": "خالص بیلانس",
  "report.kpi_total_purchase": "ټول پیرود",
  "report.kpi_total_sales": "ټول پلور",
  "report.kpi_total_payment": "ټول تادیه",
  "report.kpi_total_remaining": "ټول پاتې رقم",
  // ERP Reports — export
  "report.export_pdf": "PDF صادرول",
  "report.export_excel": "Excel صادرول",
  "report.export_csv": "CSV صادرول",
  "report.print": "چاپ",
  "report.share_whatsapp": "واټساپ له لارې شریکول",
  "report.share_email": "بریښنالیک له لارې شریکول",
  "report.reload": "بیا ډکول",
  "report.search": "لټون",
  "report.search_placeholder": "د راپور ډاټا لټون وکړئ...",
  // ERP Reports — table
  "report.no_data": "کوم ډاټا نشته",
  "report.loading": "راپور ډکیږي...",
  "report.error": "د راپور بارولو کې خطا",
  "report.generated_at": "جوړ شو",
  "report.scope_label": "د لاسرسي کچه",
  "report.scope_global": "نړیوال",
  "report.scope_country": "هیواد",
  "report.scope_branch": "شاخه",
  // ERP Reports — columns
  "report.col_date": "نېټه",
  "report.col_serial": "شمیره",
  "report.col_description": "تشریح",
  "report.col_debit": "ډیبیټ",
  "report.col_credit": "کریډیټ",
  "report.col_balance": "بیلانس",
  "report.col_currency": "اسعار",
  "report.col_status": "حالت",
  "report.col_branch": "شاخه",
  "report.col_country": "هیواد",
  "report.col_user": "کارونکی",
  "report.col_amount": "مقدار",
  "report.col_reference": "حواله"
};

const dictionaries: Record<SupportedLanguage, Dict> = {
  en,
  ar,
  ur,
  fa,
  ps
};

export function t(lang: SupportedLanguage | string | null | undefined, key: string | null | undefined, defaultValue?: string): string {
  if (!key) return defaultValue ?? "";
  const safeLang = (lang && typeof lang === "string" && ["en", "ar", "ur", "fa", "ps"].includes(lang) ? lang : "en") as SupportedLanguage;
  const dictKey = key as UiKey;
  const dict = dictionaries[safeLang] || dictionaries.en;
  return dict?.[dictKey] ?? en[dictKey] ?? defaultValue ?? key;
}

