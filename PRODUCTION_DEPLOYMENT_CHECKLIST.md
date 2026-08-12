# Production Deployment & Testing Checklist

**Status:** 🔴 CRITICAL FIX READY - AWAITING DEPLOYMENT  
**Date:** August 12, 2026  
**Server:** 72.60.209.121

---

## 🔴 CRITICAL: Production Not Yet Updated

**Current Status:** Production server at 72.60.209.121 shows HTTP 500 error on `/dashboard/accounts/setup`

**Root Cause:** Bugfix not yet deployed to production

**Commits Ready to Deploy:**
- `470cf6f` - fix(goods): connect Origin Country dropdown to Location Management Country Master
- `1871f5c` - fix(accounts): null reference error in account setup form  
- `ec7a3c8` - feat(customer-master): add dual-card company details to customer profiles
- `7298ee4` - docs: add comprehensive incident investigation and deployment guides

---

## DEPLOYMENT STEPS (For Server Admin)

### Step 1: SSH to Production Server
```bash
ssh dgtll@72.60.209.121
```

### Step 2: Pull Latest Code
```bash
cd /path/to/ACCOUNTS.DGT.LLC
git pull origin main
# Expected: Should pull 4 new commits
```

### Step 3: Build Production Bundle
```bash
npm run build
# This will take ~2-3 minutes
# Expected output: .next directory generated
```

### Step 4: Restart Application
```bash
pm2 restart all
# Expected: All services should show "online" status
```

### Step 5: Verify Deployment
```bash
# Check PM2 status
pm2 status

# Check logs for errors
pm2 logs | tail -100

# Test the endpoint (should NOT show 500 error)
curl http://72.60.209.121/dashboard/accounts/setup
# Expected: 307 or 200 response
```

---

## ✅ TESTING CHECKLIST (After Deployment)

### Phase 1: Critical Bugfix Verification

**Test: /dashboard/accounts/setup Page Load**
- [ ] Navigate to http://72.60.209.121/dashboard/accounts/setup
- [ ] ✅ Page loads WITHOUT "Module Temporary Exception" error
- [ ] ✅ Form displays correctly (all 6 steps visible)
- [ ] ✅ No console errors (check browser DevTools F12)
- [ ] ✅ No 500 server errors

**Test: Account Creation Workflow**
1. [ ] Step 1: Select Country → Dropdown works
2. [ ] Step 1: Select Branch Type → Options appear
3. [ ] Step 1: Select Branch → Branch populates
4. [ ] Step 2: Enter Account Details → Form accepts input
5. [ ] Step 3: Set Balance & Currency → Fields functional
6. [ ] Step 4: Assign Customer (optional) → Customer picker works
7. [ ] Step 5: Review Details → Summary displays correctly
8. [ ] Step 6: Save Account → Success message appears
9. [ ] ✅ NO crash when message is null (the bug fix)
10. [ ] ✅ Saved account appears in accounts list

**Test: Message State Handling (the specific bug)**
- [ ] Clear message (empty string) → No crash ✅
- [ ] Error message displays → No crash ✅
- [ ] Success message displays → Saved variable = true ✅
- [ ] Null message state → NO crash (this is the fix!) ✅

### Phase 2: Customer Company Details Feature

**Test: Customer Profile with Company Details Card**
- [ ] Navigate to /dashboard/settings/customers
- [ ] Click "Add Customer"
- [ ] Fill customer info through all 4 steps
- [ ] Step 4: Fill company details (Company Name, Reg #, Tax #, Business Type, Phone, Email, Country, City, State, Address)
- [ ] Save customer
- [ ] View customer profile
- [ ] ✅ "Customer Company Details" card displays all 10 fields
- [ ] ✅ All fields populated correctly from form

### Phase 3: Goods Master Country Master Connection

**Test: Origin Country Connects to Location Management**
1. [ ] Navigate to /dashboard/settings/management/goods
2. [ ] Click "Add Goods Master"
3. [ ] Create test goods: HS Code="999999", Name="TEST PRODUCT"
4. [ ] Save goods master
5. [ ] Select goods to view variations
6. [ ] Click "Add Variation"
7. [ ] ✅ Origin Country dropdown shows countries from Location Management (NOT hardcoded list)
8. [ ] ✅ Countries display in current language (EN/UR/AR/FA/PS)
9. [ ] Select a country and save variation
10. [ ] ✅ Country ID stored correctly
11. [ ] Refresh page
12. [ ] ✅ Selected country still shows in variation grid

**Test: Country Master Sync**
1. [ ] Go to /dashboard/settings/management/locations → Country Master
2. [ ] Create NEW test country: "Test Country", ISO2="ZZ"
3. [ ] Return to Goods Master
4. [ ] Click "Add Variation" again
5. [ ] ✅ New country appears in Origin Country dropdown immediately
6. [ ] Test country lifecycle:
   - [ ] Create → appears in dropdown ✅
   - [ ] Edit name → dropdown shows updated name ✅
   - [ ] Deactivate → does NOT appear in dropdown ✅
   - [ ] Reactivate → appears again in dropdown ✅

### Phase 4: Multilingual Support

**Test: Language-Specific Display**
1. [ ] Set language to English → Countries show in English
2. [ ] Set language to Urdu → Countries show in Urdu (RTL layout)
3. [ ] Set language to Arabic → Countries show in Arabic (RTL layout)
4. [ ] Set language to Pashto → Countries show in Pashto (RTL layout)
5. [ ] Set language to Farsi → Countries show in Farsi (RTL layout)
6. [ ] ✅ All languages display correct translated names
7. [ ] ✅ Underlying Country ID remains the same across language changes

### Phase 5: Server Health Check

**PM2 Logs**
```bash
pm2 logs | grep -i "error\|exception\|null\|undefined" | tail -50
```
- [ ] ✅ No "Cannot read properties of null" errors
- [ ] ✅ No account setup errors
- [ ] ✅ No goods master errors
- [ ] ✅ No location management errors

**Error Rate**
- [ ] ✅ No spike in 500 errors post-deployment
- [ ] ✅ Normal request volume and response times
- [ ] ✅ No memory leaks or CPU spikes

---

## 📋 Test Results Summary

### Critical Bugfix (/dashboard/accounts/setup)
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Page loads without error | ✅ Yes | | 🔲 |
| No "Module Exception" error | ✅ No error | | 🔲 |
| Account creation works end-to-end | ✅ Works | | 🔲 |
| Message null state doesn't crash | ✅ Safe | | 🔲 |
| Saved account persists | ✅ Yes | | 🔲 |

### Customer Features
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Company details card displays | ✅ Yes | | 🔲 |
| All 10 company fields present | ✅ Yes | | 🔲 |
| Data saves and loads correctly | ✅ Yes | | 🔲 |

### Goods Master Country Connection
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Origin Country uses Location Master | ✅ Yes | | 🔲 |
| New countries auto-appear in dropdown | ✅ Yes | | 🔲 |
| Country data syncs properly | ✅ Yes | | 🔲 |
| Multilingual display works | ✅ Yes | | 🔲 |

---

## 🚨 Rollback Plan (If Critical Issues Found)

If deployment causes blocking issues:

```bash
# Revert to previous commit
git revert 470cf6f  # Goods Master fix (can be safely reverted)
git revert 1871f5c  # Accounts fix (CRITICAL - DO NOT REVERT without good reason)

# Rebuild and restart
npm run build
pm2 restart all
```

**Note:** The accounts bugfix (1871f5c) is CRITICAL and shouldn't be reverted. It fixes a production-blocking error.

---

## ✅ Sign-Off

**Deployment Completed By:** ___________________  
**Date & Time:** ______________  
**Testing Completed By:** ___________________  
**Date & Time:** ______________  

**Overall Status:** 
- [ ] 🔴 BLOCKED - Critical issues found
- [ ] 🟡 WARNING - Minor issues, proceed with caution  
- [ ] 🟢 PASS - All tests passing, production healthy

**Issues Found (if any):**
```
[List any issues found during testing]
```

**Sign-Off:** ___________________

---

## Post-Deployment Monitoring (24 Hours)

Schedule checks:
- [ ] 1 hour post-deployment: No new errors in logs
- [ ] 4 hours post-deployment: Performance metrics stable
- [ ] 8 hours post-deployment: No user-reported issues
- [ ] 24 hours post-deployment: Full stability confirmation

Monitor:
- PM2 error rates
- API response times
- Customer/goods/location feature usage
- Browser console errors (test from multiple clients)
- Payment/transaction processing (if applicable)

---

## Contact for Issues

**If deployment fails or issues arise:**

1. Check PM2 logs: `pm2 logs | tail -100`
2. Verify git pull succeeded: `git log -1`
3. Check build output: `npm run build` (observe for errors)
4. Restart: `pm2 restart all`
5. Contact: [Admin name and contact]

**Critical Issue Escalation:** [Escalation procedure]
