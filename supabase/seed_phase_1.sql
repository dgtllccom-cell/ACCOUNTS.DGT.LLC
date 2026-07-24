insert into languages (code, english_name, native_name, direction, is_default, is_active)
values
  ('en', 'English', 'English', 'ltr', true, true),
  ('ar', 'Arabic', 'العربية', 'rtl', false, true),
  ('ur', 'Urdu', 'اردو', 'rtl', false, true),
  ('fa', 'Persian / Farsi', 'فارسی', 'rtl', false, true),
  ('ps', 'Pashto', 'پښتو', 'rtl', false, true)
on conflict (code) do update
set english_name = excluded.english_name,
    native_name = excluded.native_name,
    direction = excluded.direction,
    is_default = excluded.is_default,
    is_active = excluded.is_active,
    updated_at = now();

insert into countries (name, iso2, iso3, currency_code, default_language_code)
select 'Pakistan', 'PK', 'PAK', 'PKR', 'ur'
where not exists (select 1 from countries where lower(name) = lower('Pakistan') and deleted_at is null);

insert into countries (name, iso2, iso3, currency_code, default_language_code)
select 'India', 'IN', 'IND', 'INR', 'en'
where not exists (select 1 from countries where lower(name) = lower('India') and deleted_at is null);

insert into countries (name, iso2, iso3, currency_code, default_language_code)
select 'Iran', 'IR', 'IRN', 'IRR', 'fa'
where not exists (select 1 from countries where lower(name) = lower('Iran') and deleted_at is null);

insert into countries (name, iso2, iso3, currency_code, default_language_code)
select 'Afghanistan', 'AF', 'AFG', 'AFN', 'ps'
where not exists (select 1 from countries where lower(name) = lower('Afghanistan') and deleted_at is null);

insert into countries (name, iso2, iso3, currency_code, default_language_code)
select 'UAE / Dubai', 'AE', 'ARE', 'AED', 'ar'
where not exists (select 1 from countries where lower(name) = lower('UAE / Dubai') and deleted_at is null);

insert into country_branches (country_id, name, code, local_currency, is_main)
select c.id, c.name || ' Main Branch', upper(left(regexp_replace(c.name, '[^a-zA-Z]', '', 'g'), 3)) || '-MAIN', c.currency_code, true
from countries c
where c.deleted_at is null
  and c.name in ('Pakistan', 'India', 'Iran', 'Afghanistan', 'UAE / Dubai')
  and not exists (
    select 1 from country_branches cb
    where cb.country_id = c.id
      and cb.is_main = true
      and cb.deleted_at is null
  );

update countries c
set default_country_branch_id = cb.id,
    updated_at = now()
from country_branches cb
where cb.country_id = c.id
  and cb.is_main = true
  and c.default_country_branch_id is null;

insert into permissions (resource, action, description)
values
  ('countries', 'create', 'Create countries'),
  ('countries', 'read', 'View countries'),
  ('countries', 'update', 'Update countries'),
  ('country_branches', 'create', 'Create country main branches'),
  ('country_branches', 'read', 'View country main branches'),
  ('country_branches', 'update', 'Update country main branches'),
  ('city_branches', 'create', 'Create city branches'),
  ('city_branches', 'read', 'View city branches'),
  ('city_branches', 'update', 'Update city branches'),
  ('ledgers', 'create', 'Create ledgers'),
  ('ledgers', 'read', 'View ledgers'),
  ('ledgers', 'update', 'Update ledgers'),
  ('roznamcha', 'create', 'Create Roznamcha entries'),
  ('roznamcha', 'read', 'View Roznamcha entries'),
  ('roznamcha', 'update', 'Update draft Roznamcha entries'),
  ('roznamcha', 'post', 'Post Roznamcha entries'),
  ('approvals', 'create', 'Create approval requests'),
  ('approvals', 'read', 'View approval requests'),
  ('approvals', 'approve', 'Approve or reject requests'),
  ('currency_rates', 'create', 'Create USD rates'),
  ('currency_rates', 'read', 'View USD rates'),
  ('currency_rates', 'update', 'Update USD rates'),
  ('settings', 'create', 'Create setup values'),
  ('settings', 'read', 'View setup values'),
  ('settings', 'update', 'Update setup values'),
  ('customers', 'create', 'Create customers'),
  ('customers', 'read', 'View customers'),
  ('customers', 'update', 'Update customers'),
  ('modules', 'read', 'View ERP modules'),
  ('audit_logs', 'read', 'View audit logs')
on conflict (resource, action) do nothing;

insert into erp_role_templates (code, name, scope_level, description, is_system)
select role_code, role_name, scope_level::branch_level, description, true
from (
  values
    ('super_admin', 'Super Admin', 'super_admin', 'Global access to all countries, branches, users, ledgers, approvals, reports, and modules.'),
    ('country_admin', 'Country Admin', 'country', 'Country-level administration, users, city branches, currency rates, ledgers, and reports.'),
    ('main_branch_admin', 'Main Branch Admin', 'main_branch', 'Main branch operations and country branch controls.'),
    ('city_branch_admin', 'City Branch Admin', 'city_branch', 'City branch users, daily transactions, Roznamcha, ledgers, and reports.'),
    ('accountant', 'Accountant', 'city_branch', 'Accounting, journals, ledger review, and reports inside assigned scope.'),
    ('cashier', 'Cashier', 'city_branch', 'Cash, receipt, payment, bank deposit, and voucher entries.'),
    ('agent_user', 'Agent User', 'agent', 'Shipping, clearing, customer, and collection tasks assigned to an agent.'),
    ('staff_user', 'Staff User', 'city_branch', 'Assigned data entry and operational tasks only.'),
    ('auditor_viewer', 'Auditor / Viewer', 'city_branch', 'Read-only audit, ledger, and report review.')
) as seed(role_code, role_name, scope_level, description)
where not exists (
  select 1 from erp_role_templates ert
  where ert.code = seed.role_code
    and ert.deleted_at is null
);

with role_permission_seed(role_code, resource, action) as (
  values
    ('super_admin', 'countries', 'create'),
    ('super_admin', 'countries', 'read'),
    ('super_admin', 'countries', 'update'),
    ('super_admin', 'country_branches', 'create'),
    ('super_admin', 'country_branches', 'read'),
    ('super_admin', 'country_branches', 'update'),
    ('super_admin', 'city_branches', 'create'),
    ('super_admin', 'city_branches', 'read'),
    ('super_admin', 'city_branches', 'update'),
    ('super_admin', 'users', 'read'),
    ('super_admin', 'users', 'update'),
    ('super_admin', 'roles', 'read'),
    ('super_admin', 'roles', 'update'),
    ('super_admin', 'accounts', 'create'),
    ('super_admin', 'accounts', 'read'),
    ('super_admin', 'accounts', 'update'),
    ('super_admin', 'ledgers', 'create'),
    ('super_admin', 'ledgers', 'read'),
    ('super_admin', 'ledgers', 'update'),
    ('super_admin', 'journal_entries', 'create'),
    ('super_admin', 'journal_entries', 'read'),
    ('super_admin', 'journal_entries', 'update'),
    ('super_admin', 'journal_entries', 'post'),
    ('super_admin', 'roznamcha', 'create'),
    ('super_admin', 'roznamcha', 'read'),
    ('super_admin', 'roznamcha', 'update'),
    ('super_admin', 'roznamcha', 'post'),
    ('super_admin', 'approvals', 'approve'),
    ('super_admin', 'reports', 'read'),
    ('super_admin', 'reports', 'export'),
    ('super_admin', 'currency_rates', 'create'),
    ('super_admin', 'currency_rates', 'read'),
    ('super_admin', 'currency_rates', 'update'),
    ('super_admin', 'settings', 'create'),
    ('super_admin', 'settings', 'read'),
    ('super_admin', 'settings', 'update'),
    ('super_admin', 'audit_logs', 'read'),
    ('country_admin', 'countries', 'read'),
    ('country_admin', 'country_branches', 'read'),
    ('country_admin', 'city_branches', 'create'),
    ('country_admin', 'city_branches', 'read'),
    ('country_admin', 'city_branches', 'update'),
    ('country_admin', 'users', 'read'),
    ('country_admin', 'users', 'update'),
    ('country_admin', 'ledgers', 'read'),
    ('country_admin', 'roznamcha', 'read'),
    ('country_admin', 'reports', 'read'),
    ('country_admin', 'reports', 'export'),
    ('country_admin', 'currency_rates', 'create'),
    ('country_admin', 'currency_rates', 'read'),
    ('city_branch_admin', 'city_branches', 'read'),
    ('city_branch_admin', 'users', 'read'),
    ('city_branch_admin', 'transactions', 'create'),
    ('city_branch_admin', 'transactions', 'read'),
    ('city_branch_admin', 'roznamcha', 'create'),
    ('city_branch_admin', 'roznamcha', 'read'),
    ('city_branch_admin', 'reports', 'read'),
    ('accountant', 'accounts', 'create'),
    ('accountant', 'accounts', 'read'),
    ('accountant', 'journal_entries', 'create'),
    ('accountant', 'journal_entries', 'read'),
    ('accountant', 'journal_entries', 'post'),
    ('accountant', 'ledgers', 'read'),
    ('accountant', 'reports', 'read'),
    ('cashier', 'roznamcha', 'create'),
    ('cashier', 'roznamcha', 'read'),
    ('cashier', 'transactions', 'create'),
    ('cashier', 'transactions', 'read'),
    ('agent_user', 'transactions', 'create'),
    ('agent_user', 'transactions', 'read'),
    ('staff_user', 'transactions', 'create'),
    ('staff_user', 'transactions', 'read'),
    ('auditor_viewer', 'reports', 'read'),
    ('auditor_viewer', 'audit_logs', 'read'),
    ('auditor_viewer', 'ledgers', 'read')
)
insert into erp_role_template_permissions (role_template_id, permission_id)
select ert.id, p.id
from role_permission_seed seed
join erp_role_templates ert on ert.code = seed.role_code and ert.deleted_at is null
join permissions p on p.resource = seed.resource and p.action = seed.action::permission_action
on conflict do nothing;

insert into management_categories (code, name, description, sort_order)
select code, name, description, sort_order
from (
  values
    ('location', 'Location', 'Country, state/province, city, and area/location setup.', 10),
    ('user_management', 'User Management Setup', 'User role, type, and permission group setup.', 20),
    ('account_setup', 'Account Setup', 'Account, customer, supplier, agent, and ledger type setup.', 30),
    ('contract_setup', 'Contract Setup', 'Contract type, status, and category setup.', 40),
    ('payment_setup', 'Payment Setup', 'Payment method, currency, and exchange rate type setup.', 50),
    ('shipping_setup', 'Shipping Setup', 'Shipping line, container, vessel, and BL type setup.', 60),
    ('clearing_setup', 'Clearing Setup', 'Clearing agent, customs, duty, and document type setup.', 70),
    ('product_setup', 'Product Setup', 'Product category, unit type, and tax type setup.', 80),
    ('bank_setup', 'Bank Setup', 'Bank list and bank account type setup.', 90)
) as seed(code, name, description, sort_order)
where not exists (
  select 1 from management_categories mc
  where mc.code = seed.code
    and mc.deleted_at is null
);

insert into management_parameters (category_id, code, name, description, data_type, is_system)
select mc.id, seed.code, seed.name, seed.description, 'text', true
from management_categories mc
join (
  values
    ('location', 'country', 'Country', 'Reusable country setup.'),
    ('location', 'state_province', 'State / Province', 'Reusable state or province setup.'),
    ('location', 'city', 'City', 'Reusable city setup.'),
    ('location', 'area_location', 'Area / Location', 'Reusable area and location setup.'),
    ('user_management', 'user_role', 'User Role', 'System role names and templates.'),
    ('user_management', 'user_type', 'User Type', 'User type setup.'),
    ('user_management', 'permission_group', 'Permission Group', 'Permission group setup.'),
    ('account_setup', 'account_type', 'Account Type', 'Account type setup.'),
    ('account_setup', 'customer_type', 'Customer Type', 'Customer type setup.'),
    ('account_setup', 'supplier_type', 'Supplier Type', 'Supplier type setup.'),
    ('account_setup', 'agent_type', 'Agent Type', 'Agent type setup.'),
    ('account_setup', 'ledger_type', 'Ledger Type', 'Ledger type setup.'),
    ('contract_setup', 'contract_type', 'Contract Type', 'Contract type setup.'),
    ('contract_setup', 'contract_status', 'Contract Status', 'Contract status setup.'),
    ('contract_setup', 'contract_category', 'Contract Category', 'Contract category setup.'),
    ('payment_setup', 'payment_method', 'Payment Method', 'Payment method setup.'),
    ('payment_setup', 'currency', 'Currency', 'Currency setup.'),
    ('payment_setup', 'exchange_rate_type', 'Exchange Rate Type', 'Exchange rate type setup.'),
    ('shipping_setup', 'shipping_line', 'Shipping Line', 'Shipping line setup.'),
    ('shipping_setup', 'container_type', 'Container Type', 'Container type setup.'),
    ('shipping_setup', 'vessel_type', 'Vessel Type', 'Vessel type setup.'),
    ('shipping_setup', 'bl_type', 'BL Type', 'Bill of lading type setup.'),
    ('clearing_setup', 'clearing_agent', 'Clearing Agent', 'Clearing agent setup.'),
    ('clearing_setup', 'customs_type', 'Customs Type', 'Customs type setup.'),
    ('clearing_setup', 'duty_type', 'Duty Type', 'Duty type setup.'),
    ('clearing_setup', 'document_type', 'Document Type', 'Document type setup.'),
    ('product_setup', 'product_category', 'Product Category', 'Product category setup.'),
    ('product_setup', 'unit_type', 'Unit Type', 'Unit type setup.'),
    ('product_setup', 'tax_type', 'Tax Type', 'Tax type setup.'),
    ('bank_setup', 'bank_list', 'Bank List', 'Bank list setup.'),
    ('bank_setup', 'bank_account_type', 'Bank Account Type', 'Bank account type setup.')
) as seed(category_code, code, name, description) on seed.category_code = mc.code
where not exists (
  select 1 from management_parameters mp
  where mp.category_id = mc.id
    and mp.code = seed.code
    and mp.deleted_at is null
);

insert into payment_methods (code, name, is_bank_required, is_reference_required)
select code, name, is_bank_required, is_reference_required
from (
  values
    ('cash', 'Cash', false, false),
    ('bank_cheque', 'Bank Cheque', true, true),
    ('bank_deposit', 'Bank Deposit', true, true),
    ('bank_transfer', 'Bank Transfer', true, true),
    ('usd_cash', 'USD Cash', false, false)
) as seed(code, name, is_bank_required, is_reference_required)
where not exists (
  select 1 from payment_methods pm
  where pm.code = seed.code
    and pm.deleted_at is null
);

insert into account_groups (code, name, account_kind)
select code, name, account_kind::account_kind
from (
  values
    ('asset', 'Assets', 'asset'),
    ('liability', 'Liabilities', 'liability'),
    ('equity', 'Equity', 'equity'),
    ('income', 'Income', 'income'),
    ('expense', 'Expenses', 'expense')
) as seed(code, name, account_kind)
where not exists (
  select 1 from account_groups ag
  where ag.code = seed.code
    and ag.deleted_at is null
);

insert into account_types (code, name, account_kind, account_group_id)
select seed.code, seed.name, seed.account_kind::account_kind, ag.id
from (
  values
    ('cash', 'Cash Ledger', 'asset', 'asset'),
    ('usd_cash', 'USD Ledger', 'asset', 'asset'),
    ('bank', 'Bank Ledger', 'asset', 'asset'),
    ('customer', 'Customer Account', 'asset', 'asset'),
    ('supplier', 'Supplier Account', 'liability', 'liability'),
    ('income', 'Income Ledger', 'income', 'income'),
    ('expense', 'Expense Ledger', 'expense', 'expense')
) as seed(code, name, account_kind, group_code)
join account_groups ag on ag.code = seed.group_code and ag.deleted_at is null
where not exists (
  select 1 from account_types at
  where at.code = seed.code
    and at.deleted_at is null
);

insert into report_definitions (code, name, module_code, description)
select code, name, module_code, description
from (
  values
    ('daily_report', 'Daily Report', 'fms_core', 'Daily country and branch activity.'),
    ('ledger_report', 'Ledger Report', 'fms_core', 'Ledger detail and balances.'),
    ('roznamcha_report', 'Roznamcha Report', 'fms_core', 'Daily payment journal report.'),
    ('payment_report', 'Payment Report', 'fms_core', 'Payment entries report.'),
    ('receipt_report', 'Receipt Report', 'fms_core', 'Receipt entries report.'),
    ('country_report', 'Country Report', 'fms_core', 'Country-level report.'),
    ('branch_report', 'Branch Report', 'fms_core', 'Branch-level report.'),
    ('usd_report', 'USD Report', 'currency', 'USD conversion and business report.'),
    ('sales_report', 'Sales Report', 'sales_purchase', 'Sales module report.'),
    ('purchase_report', 'Purchase Report', 'sales_purchase', 'Purchase module report.'),
    ('audit_report', 'Audit Report', 'audit', 'Audit activity report.'),
    ('trial_balance', 'Trial Balance', 'fms_core', 'Trial balance.'),
    ('balance_sheet', 'Balance Sheet', 'fms_core', 'Balance sheet.'),
    ('profit_loss', 'Profit / Loss', 'fms_core', 'Profit and loss statement.')
) as seed(code, name, module_code, description)
where not exists (
  select 1 from report_definitions rd
  where rd.code = seed.code
    and rd.deleted_at is null
);

insert into erp_modules (code, name, description, status, is_financial, sort_order)
select code, name, description, status::erp_module_status, is_financial, sort_order
from (
  values
    ('fms_core', 'Financial Management System', 'Core accounting, ledgers, journals, Roznamcha, approvals, and reports.', 'active', true, 10),
    ('shipping_line', 'Shipping Line Module', 'Shipping line, BL, container, vessel, freight, and invoices.', 'planned', true, 20),
    ('clearing_agent', 'Clearing Agent Module', 'Clearing agents, customs clearance, duty charges, and clearing bills.', 'planned', true, 30),
    ('sales_purchase', 'Sales and Purchase Module', 'Purchase orders, confirmations, local purchases, sales orders, and local sales.', 'planned', true, 40),
    ('inventory', 'Inventory Module', 'Stock, items, goods, and inventory movements.', 'planned', true, 50),
    ('warehouse', 'Warehouse Module', 'Warehouse locations, stock transfers, and storage.', 'planned', false, 60),
    ('hr_payroll', 'HR and Payroll Module', 'Employees, attendance, payroll, and HR documents.', 'planned', true, 70),
    ('marketing', 'Marketing Module', 'Campaigns, leads, and business development.', 'planned', false, 80),
    ('document_management', 'Document Management Module', 'Uploads, attachments, files, and document workflows.', 'planned', false, 90),
    ('crm', 'CRM Module', 'Customers, agents, communication, and follow-ups.', 'planned', false, 100),
    ('reports', 'Reporting Module', 'PDF, Excel, print, multilingual reports, and snapshots.', 'active', false, 110)
) as seed(code, name, description, status, is_financial, sort_order)
where not exists (
  select 1 from erp_modules em
  where em.code = seed.code
    and em.deleted_at is null
);
