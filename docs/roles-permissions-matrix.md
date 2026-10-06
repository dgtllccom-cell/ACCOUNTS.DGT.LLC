# Roles and Permissions Matrix

## Roles

- Super Admin
- Country Admin
- Main Branch Admin
- City Branch Admin
- Accountant
- Cashier
- Agent User
- Staff User
- Auditor / Viewer

## Permission Scope

| Role | Scope | Main Permissions |
| --- | --- | --- |
| Super Admin | Global | manage all countries, branches, users, ledgers, approvals, reports, USD rates |
| Country Admin | Assigned country | manage country users, main branch, city branches, rates, reports |
| Main Branch Admin | Assigned country main branch | manage branch operations, city branches, users, ledgers |
| City Branch Admin | Assigned city branch | manage local users, daily transactions, Roznamcha, reports |
| Accountant | Assigned scope | accounts, journals, ledgers, reports |
| Cashier | Assigned scope | cash receipt, cash payment, bank deposit, vouchers |
| Agent User | Assigned tasks | shipping, clearing, customers, collection tasks |
| Staff User | Assigned tasks | data entry and assigned records |
| Auditor / Viewer | Assigned scope | read-only reports and audit trail |

## Hierarchy Rules

| Area | Hierarchy | Isolation rule |
| --- | --- | --- |
| ERP Branches | Super Admin -> Country -> Main Branch -> City Branch -> Users | Super Admin sees all. Country users see only their country. Branch users see only their assigned branch/city. |
| Multi-Company Branding | Parent Business Group -> Country Company Profile -> Branches | Parent branding is global. Country company branding and data stay inside that country unless Super Admin grants access. |
| Clearing Agents | Super Admin -> Clearing Agent Head Office -> Country Branch -> City Branch | One clearing agent cannot see another clearing agent's records. Country/city clearing branches remain inside assigned country/city scope. |
| Transfers | Sender User -> Receiver User | Records remain isolated until an official transfer is accepted or approved. Transfer history must be retained. |
| Branch Ledger | Country Company -> Authorized Ledgers -> Branch Entries | Ledger entries store country company, branch, user, date/time, ledger, debit/credit, reference, remarks, approval, and modification history. |
| Inter-Branch Accounting | Source Branch -> Destination Branch | Transfers stay inside one country company and retain source branch, destination branch, transaction history, approval status, and audit trail. |

## Permission Resources

- countries
- business_groups
- country_company_profiles
- country_branches
- city_branches
- users
- roles
- permissions
- accounts
- ledgers
- journal_entries
- roznamcha
- transactions
- approvals
- reports
- currency_rates
- settings
- modules
- audit_logs
- clearing_agents
- clearing_agent_branches
- assignments
- record_transfers
- inter_branch_transfers
- messages
- purchases
- sales
- bookings
- customers
- banks
- warehouses
- shipping_records
- settings

## Workflow Architecture

- User Registration stores role, country/main-branch/city-branch scope, and checkbox permissions.
- Purchase stays auto-enabled for every active country and branch.
- Every country can have one active country company profile with logo, address, registration, tax, banking, email, website, and document branding metadata.
- Dashboards, PDFs, print pages, email templates, reports, purchases, sales, bookings, and warehouse/customer documents should resolve branding from the logged-in user's country company profile, with the parent business group available for header/footer branding.
- Assignments support alerts, tasks, instructions, and notifications from Super Admin to countries, branches, clearing agents, and users.
- Record transfers store sender, receiver, date/time, status, and target record identity.
- PDF/print/email actions should use the same three-dot action pattern: Print, Download PDF, Send Email.
- Audit events track create, edit, delete, transfer, print, download PDF, email, approval, and rejection.
- Branch ledger reports should read from branch-scoped ledger posting batches/lines and show source country company, branch, user, ledger, debit, credit, reference, approval status, and remarks.

## PDF / Email Standard

- All business documents must use A4 layout with company branding, header, footer, document title, branch/country scope, generated date, and action audit.
- PDF/email permissions are enforced through report export, message create/read, attachment read/create, and audit log read permissions.

## Rule

Permissions alone are not enough. Every access check must also verify scope:

- country scope.
- main branch scope.
- city branch scope.
- assigned task/user scope.
