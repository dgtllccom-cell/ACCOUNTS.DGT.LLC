# Local Sales Implementation Handoff
**Status:** Not started this session  
**Blocker:** None - ready to begin  
**Canonical Pattern:** Reuse Sales Booking pipeline (save → payment → Roznamcha → Journal → Ledger)

---

## Scope & Requirements

### What Local Sales Must Do
1. Save a canonical sales record (one row, one truth)
2. Preserve selected payment route end-to-end (Cash/Credit/Advance)
3. Post exactly two balanced accounting lines (DR/CR to distinct ledgers)
4. Enforce scope (country_id, branch_id, city_branch_id) at every layer
5. Display in selected language only (no English fallback; show "Translation pending" if missing)
6. Show proof chain: red/pending until accounting succeeds, black only after full proof

### What Must NOT Happen
- ❌ Save without accounting proof
- ❌ Silent English fallback when translation missing
- ❌ Scope leakage (user seeing another country's data)
- ❌ Unbalanced ledger posting
- ❌ Payment mode lost in transfer

---

## File Inspection Checklist

### 1. Form Save & Submit Handler
**File:** `app/dashboard/sales/local-sales/page.tsx` OR `features/sales/components/local-sales-form.tsx`

**What to find:**
```typescript
// Should call:
// POST /api/erp/sales/local-sales
// With payload: { reference, date, items[], paymentMode, customerId, ... }

// Should NOT:
// - Post directly to roznamcha
// - Skip payment mode preservation
// - Assume English translation fallback
```

**Questions to ask:**
- [ ] Where does form submit POST to?
- [ ] Is paymentMode included in the payload?
- [ ] Is scope (countryId, branchId) captured from session?
- [ ] Does form show "Translation pending" or fallback to English?

---

### 2. Save API Route
**File:** `app/api/erp/sales/local-sales/route.ts`

**Expected flow:**
```
POST /api/erp/sales/local-sales
├─ requireErpSession()
├─ authorizeApiScope({ resource: "sales", action: "create" })
├─ validatePayload(schema)
├─ INSERT INTO sales_orders (reference, date, amount, payment_mode, country_id, branch_id, ...)
│  └─ Capture inserted ID for proof chain
├─ INSERT INTO sales_order_payments (sales_order_id, payment_mode, amount, ...)
│  └─ Link to payment routing
└─ Return { id, status, message }
```

**Checkpoint:**
- [ ] Scope parameters (countryId, branchId, cityBranchId) enforced in WHERE clauses
- [ ] Session scope used to default country_id, branch_id
- [ ] Non-super-admin users cannot specify arbitrary country_id
- [ ] Return includes sales_order_id for proof chain link

---

### 3. Payment Route Dispatcher
**File:** `app/api/erp/sales/local-sales/[id]/transfer/route.ts` OR similar

**Logic tree (same as Sales Booking):**
```
GET /api/erp/sales/local-sales/:id/transfer?paymentMode={cash|credit|advance}
├─ Validate sales_order_id exists and belongs to user's scope
├─ Load payment_mode from sales_order_payments
├─ Route to correct handler:
│  ├─ cash   → POST /api/erp/roznamcha/cash-entry { ... }
│  ├─ credit → POST /api/erp/journal/purchase-order-payment/credit { ... }
│  └─ advance→ POST /api/erp/journal/purchase-order-payment/advance { ... }
├─ Capture Roznamcha/Journal rows
├─ Wait for ledger posting confirmation
└─ Mark sales_order as "Posted" only after ledger proof exists
```

**Critical:** Payment mode must come from the database row, not user input.

---

### 4. List API & Query
**File:** `app/api/erp/sales/local-sales/route.ts` (GET handler)

**Expected flow:**
```
GET /api/erp/sales/local-sales?countryId=X&branchId=Y
├─ requireErpSession()
├─ Build scope filter from session + params
├─ Query:
│  SELECT id, reference, date, amount, payment_mode, status, country_id, branch_id, ...
│  FROM sales_orders
│  WHERE country_id = ? AND branch_id = ? AND city_branch_id = ?
│  ORDER BY date DESC
├─ For each row:
│  ├─ Load translations for `reference` and `status`
│  ├─ Show selected language only
│  ├─ If translation missing: show "Translation pending"
│  └─ Include proof_chain_status (red/pending/black)
└─ Return array
```

**Scope filter must match session scope exactly.**

---

## Proof Chain Verification

### Database Queries to Inspect

**After saving a Local Sales record, verify this chain exists:**

```sql
-- 1. Sales order record
SELECT * FROM sales_orders WHERE reference = 'LOCAL-SALES-001';
-- Must have: id, reference, date, amount, payment_mode, country_id, branch_id, city_branch_id, status

-- 2. Payment link
SELECT * FROM sales_order_payments WHERE sales_order_id = ?;
-- Must have: payment_mode matching sales_orders.payment_mode

-- 3. Roznamcha entry (if cash mode)
SELECT * FROM roznamcha WHERE sales_order_id = ?;
-- Must have: debit/credit amounts, exchange_rate, currency, country_id

-- 4. Journal entry
SELECT * FROM journal_entries WHERE sales_order_id = ?;
-- Must have: TWO rows (one DR, one CR), balanced, distinct accounts

-- 5. Ledger posting
SELECT * FROM ledger_posting WHERE journal_entry_id = ?;
-- Must have: DR and CR lines, balanced, scope keys present

-- 6. Translation rows
SELECT * FROM local_sales_translations WHERE sales_order_id = ? AND language_code = 'ur';
-- If empty: UI must show "Translation pending", NOT English fallback
```

---

## Implementation Checklist

- [ ] **Form & Submit**
  - [ ] Form loads with selected language (not English)
  - [ ] Payment mode selector included and required
  - [ ] Submit handler captures session scope
  - [ ] Submit POSTs to `/api/erp/sales/local-sales`

- [ ] **Save API Route**
  - [ ] Scope validation: `authorizeApiScope()` called
  - [ ] INSERT sales_order with country_id, branch_id, city_branch_id
  - [ ] INSERT sales_order_payments linked
  - [ ] Return includes sales_order_id for transfer
  - [ ] Non-admin users cannot override country_id

- [ ] **Transfer/Payment Route**
  - [ ] Load payment_mode from database (not user input)
  - [ ] Route to correct payment handler (cash/credit/advance)
  - [ ] Wait for ledger posting confirmation
  - [ ] Update sales_order.status only after proof chain complete

- [ ] **List API**
  - [ ] Scope filter applied: country_id, branch_id, city_branch_id
  - [ ] Translations loaded for selected language
  - [ ] Missing translation shows "Translation pending"
  - [ ] Status (red/pending/black) derived from proof chain, not client flag

- [ ] **Proof Chain Status**
  - [ ] Red/Pending: sales_order exists, payment_mode set, but roznamcha/journal/ledger incomplete
  - [ ] Black: all four proof rows exist, balanced, and linked
  - [ ] Status query: `SELECT COUNT(*) FROM proof_chain WHERE sales_order_id = ?`

- [ ] **Scope Enforcement**
  - [ ] City branch user cannot see main branch's sales
  - [ ] Main branch user cannot see city branch's sales (if other branch)
  - [ ] Country user cannot see other country's sales
  - [ ] Super admin can see all, but query still includes scope in WHERE

- [ ] **Translation**
  - [ ] Reference field translated to selected language
  - [ ] Status text translated (Pending, Posted, Cancelled, etc.)
  - [ ] No English fallback in UI
  - [ ] Missing translation key shows "Translation pending"

---

## File Locations (Likely)

```
app/dashboard/sales/local-sales/
├─ page.tsx                          # List view
└─ [id]/edit/page.tsx               # Edit form

app/api/erp/sales/local-sales/
├─ route.ts                          # GET (list), POST (save)
└─ [id]/transfer/route.ts           # GET (dispatch to payment)

features/sales/components/
├─ local-sales-list.tsx             # Table with scope/translation
├─ local-sales-form.tsx             # Form with language selector
└─ local-sales-proof-chain.tsx      # Status indicator

lib/services/
└─ local-sales-service.ts           # Reusable save/transfer logic
```

---

## Reusable Patterns (Copy from Sales Booking)

**Authorization Middleware:**
```typescript
import { authorizeApiScope } from "@/lib/api/scope-middleware";

authorizeApiScope(session, {
  resource: "sales",
  action: "create",
  countryId, branchId, cityBranchId
});
```

**Scope Filtering:**
```typescript
import { buildScopeFilter } from "@/lib/api/scope-middleware";

const scopeFilter = buildScopeFilter(session, { countryId, branchId, cityBranchId });
const query = db.from("sales_orders").where(scopeFilter);
```

**Payment Route Dispatcher:**
```typescript
// From Sales Booking, already proven:
const paymentRoute = getPaymentRoute(paymentMode); // → cash/credit/advance
const response = await fetch(`/api/erp/${paymentRoute}`, { ... });
```

**Translation Resolution:**
```typescript
import { resolveTranslation } from "@/lib/i18n/server";

const referenceText = await resolveTranslation(
  "local_sales_translations",
  sales_order_id,
  selectedLanguage,
  "reference"
); // Returns translated text or "Translation pending"
```

**Proof Chain Query:**
```typescript
const proofChain = await db.raw(`
  SELECT 
    CASE WHEN EXISTS(SELECT 1 FROM sales_orders WHERE id = ?)
         AND EXISTS(SELECT 1 FROM roznamcha WHERE sales_order_id = ?)
         AND EXISTS(SELECT 1 FROM journal_entries WHERE sales_order_id = ?)
         AND EXISTS(SELECT 1 FROM ledger_posting WHERE sales_order_id = ?)
    THEN 'black' ELSE 'pending' END as status
`, [id, id, id, id]);
```

---

## Testing (Next Developer)

**Minimum viable test:**
1. Log in as City Branch Admin
2. Create a Local Sales record with payment_mode="cash"
3. Verify row appears in list (same city branch, not other branches)
4. Verify payment route triggered (Roznamcha created)
5. Verify Journal entries created (DR/CR balanced)
6. Verify Ledger posted
7. Change language to Urdu in UI
8. Verify reference and status show in Urdu, not English
9. Verify proof status shows "black" (not red)
10. Log in as different City Branch Admin
11. Verify original record is NOT visible

---

## Dependencies Already in Place

- ✅ Authorization middleware (`lib/api/scope-middleware.ts`)
- ✅ Payment router (used by Sales Booking)
- ✅ Roznamcha save logic
- ✅ Journal entry creation
- ✅ Ledger posting
- ✅ Translation infrastructure (`lib/i18n/`)
- ✅ Proof chain status patterns (from Sales Booking)

**Do not reinvent; reuse and link.**

---

## Known Gotchas

1. **Payment Mode Mutation:** User input `?paymentMode=` is a DECOY. Always load from database row.
2. **Scope Override:** Super admin can create sales, but query must still filter by scope in WHERE.
3. **Translation Fallback:** If translation is missing, UI shows "Translation pending" or blank, NEVER falls back to English.
4. **Proof Chain Timing:** Mark "Posted" only after ledger posting is confirmed, not after Roznamcha or Journal.
5. **Ledger Distinct:** DR and CR must post to DIFFERENT accounts (not same account both sides).

---

## Handoff Questions for Next Developer

1. Is the payment mode selector visible in the form?
2. Where does the form POST when user clicks Save?
3. Are scope fields (countryId, branchId) captured from session or user input?
4. Does the list query include scope filters in the WHERE clause?
5. Where is the payment_mode read: from form input or from database?
6. After transfer completes, which field is updated to mark "Posted"?
7. If translation is missing for reference, what shows in the UI?
8. How is the status (red/pending/black) determined: from UI state or from proof chain query?

**Answer all eight before marking as "ready for testing."**
