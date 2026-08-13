# Super Admin Reports Panel Implementation Handoff
**Status:** Not modified this session  
**Blocker:** VPS database has no sales data (sales_orders|0, sales_order_payments|0) for live verification  
**Critical Rule:** Real scoped data only; no sample/demo fallback

---

## The Central Rule

**EVERY report must:**
1. Query real data from the database (not sample rows)
2. Apply RBAC scope filters (country, branch, city_branch)
3. Return empty if no data OR user lacks permission
4. Fail closed (show nothing) rather than sample fallback
5. Display in selected language only (no English fallback)

**What NOT to do:**
- ❌ "If API returns empty, show sample data instead"
- ❌ "If translation missing, fall back to English"
- ❌ "If user lacks permission, show global data"
- ❌ Hard-coded demo rows in the report component

---

## Known Report Requirements

### Dashboard/Branch General Report
- ✅ Exists: `app/dashboard/branch-management/general-report/page.tsx`
- ✅ Implemented: Shows countries, branches, users in hierarchy
- ✅ Data source: API `/api/erp/branch-management/report`
- Status: Likely working (not modified this turn)

### Sales/Purchase Reports (NEED TO VERIFY)
- Reports should show: Orders, payments, balances, aging
- Payment modes: Cash, Credit, Advance (each tracked separately)
- Filters: Date range, payment status, payment mode
- Language: Selected language only
- **Blocker:** VPS has no sales data (sales_orders|0)

### Accounting Reports (NEED TO VERIFY)
- Ledger report: Accounts, debit/credit, balance
- Roznamcha report: Daily cash entries with rates
- Journal report: All transactions by date
- Account statement: Opening/closing balances
- **Status:** Export endpoints created but data layer empty

---

## File Structure for Reports

### Report Page (UI)
**Files:** `app/dashboard/reports/*/page.tsx`

```typescript
// MUST NOT:
// const mockData = [ /* sample rows */ ];

// MUST:
// const data = await fetchReportData(params);
// if (!data || data.length === 0) return <EmptyState />;
```

**Required:**
- [ ] Filter bar (date, payment mode, account, etc.)
- [ ] Column chooser (uses real schema, not static list)
- [ ] Real data loading from API
- [ ] Empty state if no data OR permission denied
- [ ] Export buttons (Print, PDF, Excel, CSV)

---

### Report API Route
**Files:** `app/api/erp/reports/*/route.ts` OR `app/api/erp/*/reports/*/export/route.ts`

```typescript
export async function GET(request: NextRequest) {
  // 1. Authenticate
  const session = await requireErpSession();
  
  // 2. Authorize scope
  authorizeApiScope(session, { resource: "reports", action: "read" });
  
  // 3. Parse filters (date, account, payment mode, etc.)
  const filters = parseReportFilters(request);
  
  // 4. Enforce scope in query
  const query = db.from(table)
    .where("country_id", session.countryIds[0])
    .where("branch_id", filters.branchId || session.branchIds[0])
  
  // 5. Execute (MUST NOT have fallback mock data)
  const rows = await query;
  
  // 6. If empty, return empty array (not mock data)
  if (!rows || rows.length === 0) {
    return apiOk({ rows: [], summary: { count: 0 } });
  }
  
  // 7. Translate rows for selected language
  const translated = await translateReportRows(rows, session.language);
  
  // 8. Return only scoped data
  return apiOk({ rows: translated, summary: { ... } });
}
```

**Critical:** If query returns 0 rows, return empty. Do NOT add sample data.

---

## Scope Enforcement Checklist

### For Every Report Query

- [ ] `requireErpSession()` called first
- [ ] `authorizeApiScope()` called with resource="reports"
- [ ] WHERE clause includes `country_id = session.countryIds[0]`
- [ ] WHERE clause includes `branch_id = session.branchIds[0]` (if applicable)
- [ ] WHERE clause includes `city_branch_id = session.cityBranchIds[0]` (if applicable)
- [ ] Non-super-admin users cannot override scope via query params
- [ ] Super admin queries still include scope in WHERE (filtered view, not unfiltered)

### Test Scope Enforcement

1. Log in as Country Admin (Pakistan)
2. View report → Should see only Pakistan data
3. Try to add `?countryId=india` in URL → Should still show Pakistan data only
4. Log in as different Country Admin (India)
5. Original report should NOT show → Empty state
6. Log in as Super Admin
7. Report shows all countries BUT query still has WHERE country_id IN (...)

---

## Filter Bar Implementation

### What Each Filter Must Do

```typescript
// Filter: Date Range
if (filters.from && filters.to) {
  query.where("date", ">=", filters.from)
       .where("date", "<=", filters.to);
}

// Filter: Payment Mode (Cash/Credit/Advance)
if (filters.paymentMode) {
  query.where("payment_mode", filters.paymentMode);
}

// Filter: Account/Ledger
if (filters.accountId) {
  const account = await db.from("accounts").where("id", filters.accountId).first();
  if (!canAccessAccount(session, account)) {
    throw new ErpPermissionError("Account not accessible");
  }
  query.where("account_id", filters.accountId);
}

// Filter: Bill Status (Draft, Posted, Cancelled)
if (filters.status) {
  query.where("status", filters.status);
}
```

**All filters must propagate to the server query, not client-side filtering.**

---

## Implementation Checklist

### Report Data Layer
- [ ] Report API queries real data only
- [ ] Scope filters in WHERE clause
- [ ] If empty result, return empty array (not mock data)
- [ ] Translations applied for selected language
- [ ] Missing translation shows "Translation pending"

### Report UI Layer
- [ ] Filter bar captures and sends all filters to API
- [ ] Filters propagate to server-side query
- [ ] Column chooser uses real schema
- [ ] Empty state displayed if no data
- [ ] No sample/demo fallback

### Print & Export
- [ ] Print button fetches data with current filters
- [ ] Print preview shows same data as screen
- [ ] PDF/Excel/CSV use same filters
- [ ] Export filenames include date range

### Translation
- [ ] Selected language applied to all cells
- [ ] Missing translation shows "Translation pending"
- [ ] No English fallback

### RBAC & Scope
- [ ] Country Admin sees only their country
- [ ] Branch Admin sees only their branch
- [ ] City Branch Admin sees only their city branch
- [ ] User cannot override scope via query params

---

## Handoff Questions for Next Developer

1. Where does the report page fetch its data: from API or hard-coded?
2. Does the filter bar call the API or filter client-side?
3. If the API returns 0 rows, what shows: empty state or sample data?
4. Where are the column names defined: hard-coded or from schema?
5. Does the print button fetch data again or use cached state?
6. If translation is missing for a cell, what shows: English or "Translation pending"?
7. Can a Branch Admin see another branch's data by changing the filter?
8. What query is executed when a Super Admin views the report?

**Answer all eight before marking as "ready for testing."**

---

## Current Blocker

**VPS Database Status:**
```
sales_orders       | 0 rows
sales_order_payments | 0 rows
```

**Action Required:**
Verify VPS database connection and load test data before testing Sales reports. Local database can be used for interim testing if VPS connectivity is delayed.
