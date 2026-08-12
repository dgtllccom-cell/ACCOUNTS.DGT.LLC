# ERP COMPLETION ROADMAP - PHASE 2 THROUGH 8

## PHASE 1: RBAC ✅ FRAMEWORK EXISTS
- [x] Role definitions (super_admin, country_admin, etc.)
- [x] Permission matrix
- [x] Session scope tracking
- [x] Authorization middleware
- [x] Scope enforcement on critical endpoints (ledgers, roznamcha, accounts)
- [🔧] FIXED: Customer/Banks scope filtering
- [ ] TEST: Cross-country access attempt (MUST fail)
- [ ] TEST: Branch-level isolation
- [ ] TEST: Full hierarchy: Super Admin → Country → Branch → User

## PHASE 2: DAILY EXCHANGE RATE MASTER 🟡 COMPONENT EXISTS
**Component Location:** `features/currency/daily-exchange-rate-manager.tsx`
- [ ] VERIFY: Form accepts new rate entry (Buying Rate / Selling Rate / Credit Rate / Debit Rate)
- [ ] VERIFY: Historical rates never overwritten (preserved with timestamps)
- [ ] VERIFY: Rate date/time tracked correctly
- [ ] VERIFY: Integration with Ledger (transaction uses applicable rate)
- [ ] VERIFY: Registry/Table displays all historical rates
- [ ] TEST: Create rate → save → verify DB → refresh → see in list
- [ ] TEST: Edit rate → confirm doesn't overwrite old rates
- [ ] TEST: Super Admin dashboard shows all countries' latest rates
- [ ] TEST: Print/PDF export with date range

## PHASE 3: MASTER DATA STANDARDIZATION 🟡 PARTIALLY EXISTS

### 3A. Customer/Person Master ✅
- [x] Form with 4 steps
- [x] Company details card
- [x] Registry/Table
- [ ] TEST: New → Save → Verify DB → View → Edit → Delete
- [ ] TEST: Reuse in Accounts, Invoices, Roznamcha
- [ ] TEST: Language switching (EN → UR → AR → FA → PS)
- [ ] TEST: Search, Filter, Pagination
- [ ] TEST: Print Profile with all details
- [ ] TEST: Export CSV/PDF

### 3B. Company Master 🟡 EXISTS BUT NEEDS STANDARDIZATION
- [ ] VERIFY: Unified Registry (not fragmented)
- [ ] TEST: New → Save → Registry → View → Edit → Delete
- [ ] TEST: Links to Countries, Branches properly
- [ ] TEST: Print/Export

### 3C. Warehouse Master 🟡 EXISTS BUT NEEDS AUDIT
**What's needed:**
- [ ] VERIFY: Owner uses shared Customer/Person Master
- [ ] TEST: New → Save → Registry → View → Edit → Delete
- [ ] TEST: Owner lookup and auto-linking
- [ ] TEST: Reuse in Inventory, Purchase, Sales
- [ ] TEST: Print/Export

### 3D. Location Management 🔴 DATABASE AUDIT NEEDED
**Requirements:**
- [ ] Verify database table hierarchy: Country → State → City → District → Area
- [ ] Verify each level has proper IDs and parent relationships
- [ ] Verify multilingual storage (EN/UR/AR/FA/PS)
- [ ] Verify no hardcoded values in UI
- [ ] CREATE: Professional Location Summary Report
- [ ] TEST: Full location hierarchy drill-down

## PHASE 4: COUNTRY ADMIN ACCOUNTING PACKAGE
### 4A. Accounts ✅ EXISTS
- [ ] TEST: Create new account
- [ ] TEST: Account appears in registry immediately
- [ ] TEST: View account details
- [ ] TEST: Edit account (if allowed)
- [ ] TEST: Account Report (country-scoped)
- [ ] TEST: Print/PDF account statement

### 4B. Ledger ✅ EXISTS
- [ ] TEST: Create new ledger
- [ ] TEST: Ledger registry shows only user's country/branch
- [ ] TEST: View ledger statement
- [ ] TEST: Account Ledger Report
- [ ] TEST: Country Ledger Report
- [ ] TEST: Branch Ledger Report
- [ ] TEST: Date range filtering (From Date → To Date)
- [ ] TEST: Print/PDF with professional format

### 4C. Cash Entry / Roznamcha ✅ EXISTS
- [ ] TEST: Create cash entry with exchange rate
- [ ] TEST: Entry appears in registry
- [ ] TEST: Verify exchange rate used is correct (historical, not current)
- [ ] TEST: Refresh → data persists
- [ ] TEST: Roznamcha Report with date range
- [ ] TEST: Print/PDF

### 4D. Invoice 🟡 EXISTS
- [ ] TEST: Create invoice (Sales)
- [ ] TEST: Invoice registry
- [ ] TEST: Invoice report
- [ ] TEST: Print/PDF

### 4E. General Ledger Report 🟡 VERIFY
- [ ] TEST: From Date → To Date filtering
- [ ] TEST: Scope filtering (Country-scoped for country_admin)
- [ ] TEST: Totals calculation
- [ ] TEST: Print/PDF with professional format
- [ ] TEST: Excel/CSV export with same filters

## PHASE 5: REPORTING & PRINT/PDF/EXPORT STANDARDIZATION 🔴 AUDIT NEEDED

**All applicable reports must include:**
- [ ] Report title and type
- [ ] Company/Country/Branch/User information
- [ ] From Date → To Date (where applicable)
- [ ] Authorized scope (who is viewing this)
- [ ] Professional table layout
- [ ] Totals and summary rows where applicable
- [ ] Generated Date/Time
- [ ] Page information (page X of Y)

**Reports to audit/fix:**
- [ ] Account Report
- [ ] Account Ledger Report
- [ ] General Ledger Report
- [ ] Country Ledger Report
- [ ] Branch Ledger Report
- [ ] Trial Balance Report
- [ ] Journal/Roznamcha Report
- [ ] Exchange Rate Report
- [ ] Invoice Report
- [ ] Purchase Report
- [ ] Customer/Person Master Report
- [ ] Company Master Report
- [ ] Warehouse Report
- [ ] Location Summary Report
- [ ] Bank Report
- [ ] Outstanding/Recovery Report
- [ ] Daily Reports

**For each report:**
- [ ] Verify Print Preview shows professional layout
- [ ] Verify Print to PDF works
- [ ] Verify Excel/CSV export includes all filters & dates
- [ ] Verify exported data respects authorized scope
- [ ] TEST: EN/UR/AR/FA/PS language rendering
- [ ] TEST: RTL alignment for RTL languages

## PHASE 6: MULTILINGUAL & RTL/LTR SUPPORT 🟡 INFRASTRUCTURE EXISTS

**Test Sequence: EN → UR → AR → FA → PS → EN**

For each language:
- [ ] Navigation/Menus
- [ ] Form labels and placeholders
- [ ] Table headers and data
- [ ] Dynamic database values (countries, companies, customers, etc.)
- [ ] Dropdown options
- [ ] Error messages
- [ ] Reports and Print Preview
- [ ] PDF exports
- [ ] CSV/Excel exports
- [ ] RTL/LTR rendering (UR/AR/FA/PS = RTL, EN = LTR)

**Verify:**
- [ ] No mixed-language interfaces (English labels with Urdu data, etc.)
- [ ] Proper font rendering for each language
- [ ] RTL text alignment for RTL languages
- [ ] Form inputs properly aligned
- [ ] Tables properly aligned

## PHASE 7: DATABASE & API INTEGRITY AUDIT 🔴 CRITICAL

**For each table:**
- [ ] Verify real database table exists (not fake data)
- [ ] Verify scope columns present (country_id, branch_id, etc.)
- [ ] Verify foreign key relationships correct
- [ ] Verify CRUD operations persist correctly
- [ ] Verify audit logging captures action, user, scope

**Tables to audit:**
- countries, states, cities, districts
- companies, branches, city_branches
- customers, customer_contacts, customer_registrations
- accounts, ledgers
- currency_rates, exchange_rate_history
- roznamcha (journal entries)
- invoices, purchases
- warehouses, inventory
- bank accounts, bank details
- users, role_assignments

**API endpoints to verify:**
- [ ] All GET endpoints apply scope filters
- [ ] All POST endpoints validate scope before creation
- [ ] All PUT endpoints validate scope before update
- [ ] All DELETE endpoints validate scope before deletion
- [ ] All responses include proper error handling
- [ ] Session scope is properly enforced

## PHASE 8: END-TO-END SECURITY & WORKFLOW TESTING

### 8A. RBAC Cross-Country/Branch Isolation
**TEST YOURSELF (don't ask user):**
1. Log in as Country Admin (Pakistan)
2. Attempt direct URL to India's account: MUST FAIL
3. Attempt API call with countryId=India: MUST FAIL
4. Verify can only see Pakistan data
5. Log in as Branch Admin (Karachi)
6. Attempt to access Lahore branch data: MUST FAIL
7. Verify can only see Karachi branch

### 8B. Complete Master Data Lifecycle
For Customer/Person Master:
1. New → clean form
2. Fill all fields
3. Submit/Save → DB verification
4. Refresh → data persists
5. View in registry
6. Search/filter → found correctly
7. Edit → changes persist
8. Print Profile → professional layout
9. Export PDF → includes all data
10. Export CSV → includes all data
11. Delete (if permission allows)
12. Reuse in Accounts → works

### 8C. Complete Accounting Workflow
1. Create Account
2. Create Ledger
3. Post Roznamcha entry with exchange rate
4. Verify rate is historical (exact rate used)
5. View in General Ledger
6. Generate Report with date range
7. Print/PDF/Export with same filters & scope
8. Verify totals calculated correctly

### 8D. Permission Testing
- [ ] Super Admin can see/do everything
- [ ] Country Admin cannot create account for different country
- [ ] City Branch Admin cannot access sibling branches
- [ ] User without "create_account" permission gets 403
- [ ] User without "approve" permission cannot approve

## BLOCKERS TO RESOLVE

[ ] Build completion status - WAITING
[ ] Browser testing setup - READY
[ ] Database connectivity - VERIFY
[ ] Production access for testing - VERIFY

## TEST RESULTS TRACKING

```
STATUS TEMPLATE:
Module: [NAME]
Feature: [FEATURE]
Test Case: [DESCRIPTION]
Expected: [WHAT SHOULD HAPPEN]
Actual: [WHAT ACTUALLY HAPPENED]
Status: PASS / FAIL / BLOCKED
Evidence: [SCREENSHOT/ERROR/DETAILS]
```

---

**TOTAL WORK ITEMS:** 150+
**ESTIMATED COMPLETION TIME:** 8-12 hours of systematic testing
**APPROACH:** Build → Test → Fix → Retest → Only mark PASS when real workflow verified

