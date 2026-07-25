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
  | "nav.chs_products"
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
  | "form.currency_type";

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
  "nav.user_entry": "User",
  "nav.user_form": "User Registration",
  "nav.user_journal_report": "User Journal Report",
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
  "form.currency_type": "Currency Type"
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
  "form.currency_type": "کرنسی کی قسم"
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
  "form.currency_type": "نوع العملة"
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
  "form.currency_type": "نوع ارز"
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
  "form.currency_type": "د کرنسۍ ډول"
};

const dictionaries: Record<SupportedLanguage, Dict> = {
  en,
  ar,
  ur,
  fa,
  ps
};

export function t(lang: SupportedLanguage, key: string, defaultValue?: string) {
  const dictKey = key as UiKey;
  return dictionaries[lang]?.[dictKey] ?? en[dictKey] ?? defaultValue ?? key;
}

