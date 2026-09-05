# Print/Report Visual Verification Plan

**Status:** Ready for execution  
**Code Verification:** ✅ All CSS improvements confirmed in codebase  
**Build Verification:** ✅ Compiles without errors (exit code 0)  
**Browser Testing:** ⏳ Requires authenticated dev/prod session

---

## Three Reports — Visual Testing Plan

### Report 1: General Ledger / General Print Preview

**Route:** `/dashboard/ledger/country` (or similar General Ledger endpoint)  
**Component:** `ledger-general-report-view.tsx`  
**Print Function:** `openUniversalPrintReport()`  
**CSS File:** `lib/reports/universal-print-engine.ts`

**Test Case 1.1: A4 Portrait — Page Breaks**
```
Action: Open General Ledger report with 50+ rows
        Click "Print / Save as PDF"
        Choose "Portrait" orientation

Verify:
  ✓ No rows split mid-table across pages
  ✓ Header repeats on each page
  ✓ Footer consistent on all pages
  ✓ Table borders complete (not cut off)
  ✓ Totals row stays with its section
  ✓ At least 3 orphaned lines never appear at bottom
  ✓ At least 3 widowed lines never appear at top
```

**Test Case 1.2: A4 Landscape — Column Widths**
```
Action: Open General Ledger with many columns
        Click "Print / Save as PDF"
        Choose "Landscape" orientation

Verify:
  ✓ All columns visible without horizontal scroll
  ✓ Long account names wrap within cells
  ✓ Column widths consistent (not collapsed/expanded)
  ✓ Numbers align right in their cells
  ✓ Text wrapping preserves readability
  ✓ Grid lines complete around all cells
```

**Test Case 1.3: All 5 Languages — RTL/LTR**
```
Action: For each language (EN, UR, AR, FA, PS):
        Open General Ledger
        Switch language
        Open Print Preview

Verify (EN):
  ✓ Text left-aligned
  ✓ Filter strip items flow left-to-right
  ✓ Tables left-aligned
  ✓ No visual RTL artifacts

Verify (UR/AR/FA/PS):
  ✓ Text right-aligned (not mixed)
  ✓ Filter strip items flow right-to-left
  ✓ Tables right-aligned
  ✓ Numbers still render in standard form (123 not ٣٢١)
  ✓ No English text in labels (all translated)
  ✓ Proper typography for each language
```

---

### Report 2: Account Ledger Statement

**Route:** `/dashboard/accounts` (Account General Report)  
**Component:** `account-general-report-view.tsx`  
**Print Function:** `openA4ReportWindow()`  
**CSS File:** `lib/reports/open-a4-report-window.ts`

**Test Case 2.1: A4 Portrait — Row Integrity**
```
Action: Open Account Ledger
        Select an account
        Click "Print Account Register"

Verify:
  ✓ Account header block stays together (no split)
  ✓ Info table rows don't orphan
  ✓ Owner card stays intact
  ✓ All sections complete on each page
  ✓ Long account names wrap, not overflow
  ✓ No excessive blank space
```

**Test Case 2.2: Multiple Pages — Pagination**
```
Action: Open Account Ledger with 15+ accounts
        Print full register (all accounts)

Verify:
  ✓ Each account block starts clean (no orphaned rows)
  ✓ Page breaks occur between accounts
  ✓ Header repeats on each page
  ✓ Page numbers visible
  ✓ No split account info mid-page
  ✓ Spacing consistent across page breaks
```

**Test Case 2.3: Empty/Low-Row Cases**
```
Action: Test with account having:
        - No extra details (minimal fields)
        - Only 1-2 line of info
        - Very long account name

Verify:
  ✓ Single-line accounts still print correctly
  ✓ Long names wrap within cell width
  ✓ No excessive white space
  ✓ Layout doesn't break with minimal data
```

---

### Report 3: Access Registration Report

**Route:** User management / User profile  
**Component:** `open-user-a4-report-window.ts`  
**Print Function:** Custom window.open()  
**CSS File:** `lib/reports/open-user-a4-report-window.ts`

**Test Case 3.1: User List — Table Page Breaks**
```
Action: Open Access Registration Report for user list
        Generate A4 report
        Open Print Preview or save as PDF

Verify:
  ✓ User rows never split mid-row
  ✓ Table header repeats on new page
  ✓ Role/Permission entries stay with user
  ✓ No orphaned fields at page boundaries
  ✓ Page counter displays (Page 1, Page 2, etc)
  ✓ Confidential notice on each page
```

**Test Case 3.2: Multi-Page Report — Consistency**
```
Action: Generate report for 50+ users

Verify:
  ✓ All pages have same header format
  ✓ Section titles complete (not cut off)
  ✓ Spacing consistent across pages
  ✓ Footer (confidential notice) on all pages
  ✓ No content overlap
  ✓ User ID / code clearly visible
```

**Test Case 3.3: RTL Language Support**
```
Action: Generate report in UR/AR/FA/PS

Verify:
  ✓ Text right-aligned in RTL languages
  ✓ Table layout mirrors correctly
  ✓ Header text proper direction
  ✓ Badge/tags display correctly
  ✓ No mixed direction text
```

---

## Device & Browser Testing

### Desktop (1920×1080)
**Print Preview Test:**
```
✓ Page fits in preview without scroll
✓ Zoom 100% shows full content
✓ All borders/lines visible
✓ Text readable without magnification
✓ Print button visible and functional
```

### Tablet (768×1024)
**Source View:**
```
✓ Form controls accessible
✓ Print button reachable without scroll
✓ Mobile view shows full interface
```

**Print Output:**
```
✓ PDF renders correctly on tablet
✓ Print preview scales appropriately
✓ Touch-friendly print controls
```

### Mobile (375×667)
**Source View:**
```
✓ Single-column layout
✓ Print button accessible
✓ No horizontal scroll needed
```

**Print Output:**
```
✓ PDF generates without errors
✓ Mobile-to-PDF pipeline works
✓ Responsive breakpoints respected
```

---

## PDF Export Testing

**For Each Report:**

```
✓ PDF generates without JavaScript errors
✓ PDF file size reasonable (not bloated)
✓ PDF opens in Adobe Reader
✓ PDF opens in browser PDF viewer
✓ Page count matches print preview
✓ All pages have complete content
✓ Images/logos render (if present)
✓ Colors preserved (print-color-adjust: exact working)
✓ Text searchable in PDF
✓ Text copyable from PDF
```

---

## Browser Print Test

**For Each Report:**

Using native browser Print (Ctrl+P / Cmd+P):

```
✓ Print dialog opens without errors
✓ A4 paper size selectable
✓ Portrait/Landscape orientation works
✓ Margins respected (12mm)
✓ Background colors print (if configured)
✓ Print preview matches actual output
✓ Browser print headers/footers don't interfere
✓ Print-to-PDF works
✓ Print-to-printer produces correct output
```

---

## Regression Testing (Existing Features)

**Verify Print Changes Don't Break:**

```
✓ Non-printed dashboard features unchanged
✓ Form interactions not affected
✓ Filtering/sorting still works
✓ Data integrity unaffected
✓ No JavaScript console errors
✓ No performance degradation
✓ Mobile responsiveness unchanged
✓ Other reports still functional
```

---

## Execution Checklist

### Pre-Testing
- [ ] Repository is PRIVATE (security requirement met)
- [ ] Latest build deployed to dev/prod
- [ ] Authenticated session active (dev or prod)
- [ ] Browser developer tools ready (for error checking)
- [ ] PDF reader available (Adobe Reader or browser PDF.js)

### Report 1: General Ledger
- [ ] Test 1.1: A4 Portrait page breaks
- [ ] Test 1.2: A4 Landscape columns
- [ ] Test 1.3: EN language (LTR)
- [ ] Test 1.3: UR language (RTL)
- [ ] Test 1.3: AR language (RTL)
- [ ] Test 1.3: FA language (RTL)
- [ ] Test 1.3: PS language (RTL)

### Report 2: Account Ledger
- [ ] Test 2.1: A4 Portrait row integrity
- [ ] Test 2.2: Multi-page pagination
- [ ] Test 2.3: Edge cases (empty/long names)
- [ ] Test device compatibility (desktop/tablet/mobile)
- [ ] Test PDF export

### Report 3: Access Registration
- [ ] Test 3.1: Table page breaks
- [ ] Test 3.2: Multi-page consistency
- [ ] Test 3.3: RTL language support
- [ ] Test device compatibility
- [ ] Test PDF export

### Browser & PDF
- [ ] Browser print test (all reports)
- [ ] PDF export test (all reports)
- [ ] PDF reader compatibility
- [ ] Regression test (other features)

---

## Sign-Off Criteria

**Print work is COMPLETE when:**

✅ All three reports print without errors  
✅ Page breaks work correctly (no orphaned rows)  
✅ All 5 languages render correctly  
✅ RTL languages display with correct direction  
✅ No text overflow in A4 landscape  
✅ PDF export works for all reports  
✅ No regression in existing features  

**Print work is INCOMPLETE if:**

❌ Rows split mid-page  
❌ Long text overflows columns  
❌ RTL languages show mixed direction  
❌ Page breaks create orphaned content  
❌ Any language missing translations  
❌ PDF generation fails  

---

## Notes for Next Session

**When Production is Ready:**

1. Deploy commits to production (once repo is PRIVATE)
2. Execute this visual testing plan in production environment
3. Fix any issues found (update CSS, rebuild, redeploy)
4. Re-run testing to verify fixes
5. Mark print work PRODUCTION-VERIFIED COMPLETE

**Expected Timeline:**

- Basic visual checks: 30-45 min per report
- All 5 languages: +15 min per report
- PDF/Browser testing: +20 min per report
- **Total estimated:** 3-4 hours for complete verification

**If Issues Found:**

- CSS changes are low-risk (print-only)
- No business logic or data integrity affected
- Fixes can redeploy quickly
- Re-test affected report only

---

**This plan is ready for execution. Pass to next session once environment is ready.**
