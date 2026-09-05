# PRODUCTION TESTING — MASTER CHECKLIST

## PHASE 1: PRE-DEPLOYMENT (Local Verification) ✓ COMPLETE

- [x] Build verification: `npm run build` ✓
- [x] i18n verification: `npm run i18n:guard` ✓ (13,972 keys)
- [x] TypeScript verification: All errors fixed
- [x] Security scan: No exposed secrets in current code
- [x] Database migration: Ready (20261105_ai_voice_text_and_domain_separation.sql)
- [x] Git commits: All changes committed locally
- [x] API documentation: Comprehensive endpoint list
- [x] UI documentation: Full feature checklist
- [x] RBAC/Domain documentation: Complete access matrix
- [x] i18n documentation: 5-language verification plan

---

## PHASE 2: DEPLOYMENT TO PRODUCTION (When Repo is PRIVATE)

### 2.1 Code Deployment
- [ ] Repository confirmed PRIVATE on GitHub
- [ ] All local commits pushed to main
- [ ] Auto-deployment triggered (watch logs)
- [ ] Build succeeds on production build server
- [ ] Application restarts without errors
- [ ] `pm2 status` shows "online" for dgt-nextjs

### 2.2 Database Migration
- [ ] SSH to production
- [ ] Run: `npm run db:migrate`
- [ ] Verify: All 4 new tables created
  - [ ] `voice_entry_sessions` exists
  - [ ] `approval_workflows` exists
  - [ ] `approval_amendments` exists
  - [ ] Extensions to `document_intake_jobs` applied
- [ ] Verify: No table conflicts or rollback needed
- [ ] Verify: All indexes created
- [ ] Verify: RLS policies enabled

### 2.3 Production Health Check
- [ ] Application accessible: https://api.dgt.llc
- [ ] Not showing 502/503 errors
- [ ] Dashboard loads without errors
- [ ] No console errors in production
- [ ] PM2 logs clean (`pm2 logs dgt-nextjs`)

---

## PHASE 3: ROUTE VERIFICATION (API Connectivity)

### 3.1 Voice/Text Submission Route
```bash
curl -X POST https://api.dgt.llc/api/erp/voice-messages/upload \
  -H "Authorization: Bearer SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "text",
    "originalLanguage": "en",
    "operationalDomain": "business",
    "transcript": "Test payment"
  }'

Expected:
{
  "jobId": "uuid",
  "jobNo": "AI-2026-...",
  "status": "submitted",
  "nextStep": "intent_analysis"
}
```

- [ ] Route returns 200 OK
- [ ] jobId in UUID format
- [ ] jobNo in expected format
- [ ] nextStep is valid

### 3.2 Pending Approvals Route
```bash
curl -X GET https://api.dgt.llc/api/erp/approvals/pending-for-me \
  -H "Authorization: Bearer SESSION_TOKEN"

Expected:
{
  "rows": [...]
}
```

- [ ] Route returns 200 OK
- [ ] Returns array of pending items
- [ ] Each item has required fields
- [ ] Pagination works

### 3.3 Approval Route
```bash
curl -X POST https://api.dgt.llc/api/erp/approvals/{id}/approve \
  -H "Authorization: Bearer APPROVER_TOKEN" \
  -d '{
    "approverNotes": "Approved"
  }'

Expected:
{
  "workflowId": "uuid",
  "status": "approved",
  "message": "Draft approved and ready for posting"
}
```

- [ ] Route returns 200 OK
- [ ] Status changes to "approved"
- [ ] Timestamp recorded

---

## PHASE 4: UI FUNCTIONALITY TESTING

### 4.1 Voice/Text Entry Page Load
- [ ] Navigate to: https://api.dgt.llc/dashboard/ai-entry/voice-text
- [ ] Page loads without 404 or 500 errors
- [ ] All page elements visible
- [ ] No console JavaScript errors
- [ ] Page loads within 2 seconds

### 4.2 Domain Selector Test
- [ ] Domain selector visible and clickable
- [ ] "Business" and "Shipping" radio buttons present
- [ ] Selecting each domain updates state
- [ ] Cannot submit without selecting domain
- [ ] Default is "Business"

### 4.3 Source Type Selection
- [ ] "Voice" and "Text" radio buttons present
- [ ] Voice selected by default
- [ ] Switching to Text hides voice controls
- [ ] Switching to Voice shows recording controls

### 4.4 Voice Recording Test
- [ ] Browser requests microphone permission
- [ ] "Record" button clickable
- [ ] Recording starts and duration increments
- [ ] "Stop" button stops recording
- [ ] Recording status displays correctly
- [ ] Duration persists after stop

### 4.5 Text Entry Test
- [ ] Textarea accepts text input
- [ ] Can paste text into field
- [ ] Can type in all 5 languages
- [ ] Placeholder text visible when empty

### 4.6 Form Submission
- [ ] Clicking "Submit" sends API request
- [ ] Loading indicator shows during submission
- [ ] Success message appears on success
- [ ] Success message shows job ID
- [ ] Can submit another entry after success

### 4.7 Error Handling
- [ ] Empty transcript → error message shown
- [ ] Large transcript (>50KB) → error message
- [ ] Missing domain → error or block submission
- [ ] Network error → user-friendly error message
- [ ] User can retry after error

### 4.8 Approval Queue Page Load
- [ ] Navigate to: https://api.dgt.llc/dashboard/ai-entry/approvals
- [ ] Page loads without errors
- [ ] Title visible: "Approval Queue"
- [ ] Description text visible
- [ ] Pending items displayed (if any exist)

### 4.9 Approval Actions
- [ ] "Approve" button visible and clickable
- [ ] "Reject" button visible and clickable
- [ ] "Return" button visible and clickable
- [ ] Clicking "Approve" sends API request
- [ ] Status updates to "approved" after approval
- [ ] Approved items no longer in queue

---

## PHASE 5: DOMAIN SEPARATION TESTING

### 5.1 BUSINESS Domain User
- [ ] User login with BUSINESS domain assignment
- [ ] Can submit with domain="BUSINESS"
  - [ ] Expected: ✓ Success
- [ ] Attempt to submit with domain="SHIPPING"
  - [ ] Expected: ✗ Error (domain restricted)
- [ ] View approval queue
  - [ ] Expected: Only BUSINESS items shown
  - [ ] Expected: No SHIPPING items visible

### 5.2 SHIPPING Domain User
- [ ] User login with SHIPPING domain assignment
- [ ] Can submit with domain="SHIPPING"
  - [ ] Expected: ✓ Success
- [ ] Attempt to submit with domain="BUSINESS"
  - [ ] Expected: ✗ Error (domain restricted)
- [ ] View approval queue
  - [ ] Expected: Only SHIPPING items shown
  - [ ] Expected: No BUSINESS items visible

### 5.3 Cross-Domain Access Test
- [ ] BUSINESS user tries to access SHIPPING item ID
  - [ ] Expected: ✗ 403 Forbidden
- [ ] SHIPPING user tries to access BUSINESS item ID
  - [ ] Expected: ✗ 403 Forbidden
- [ ] Super admin can access both domains
  - [ ] Expected: ✓ Access allowed

---

## PHASE 6: RBAC (Role-Based Access) TESTING

### 6.1 Unauthorized Users
- [ ] staff_user attempts to submit voice/text
  - [ ] Expected: ✗ 403 Forbidden
- [ ] staff_user attempts to view approval queue
  - [ ] Expected: ✗ 403 Forbidden
- [ ] guest (unauthenticated) tries to access page
  - [ ] Expected: Redirected to login

### 6.2 Authorized Users
- [ ] accountant submits voice/text
  - [ ] Expected: ✓ Success
- [ ] accountant views approval queue
  - [ ] Expected: ✓ Sees pending items
- [ ] approver approves workflow
  - [ ] Expected: ✓ Status changes to approved
- [ ] super_admin can do all actions
  - [ ] Expected: ✓ Unrestricted access

### 6.3 Permission Boundaries
- [ ] reviewer can see pending items
- [ ] reviewer cannot approve workflows
  - [ ] Expected: ✗ 403 on approve action
- [ ] accountant can review items
- [ ] accountant cannot approve final
  - [ ] Expected: ✗ 403 on approve (if not authorized)

---

## PHASE 7: 5-LANGUAGE SUPPORT TESTING

### 7.1 Language Switching
- [ ] Settings has language selector
- [ ] Can select: EN, UR, AR, FA, PS
- [ ] Selecting language updates page immediately
- [ ] Selected language persists on page reload
- [ ] All 5 languages available

### 7.2 English (EN) Page
- [ ] Title: "Voice or Text Entry"
- [ ] All labels in English
- [ ] Form elements render left-to-right
- [ ] Placeholder text in English
- [ ] Buttons and messages in English
- [ ] Success message in English

### 7.3 Urdu (UR) Page — RTL
- [ ] Title: "وائس یا ٹیکسٹ درج کریں"
- [ ] All labels in Urdu
- [ ] Text flows right-to-left
- [ ] Form layout mirrors for RTL
- [ ] No English text visible (except data)
- [ ] Success message in Urdu
- [ ] Can input Urdu text in textarea

### 7.4 Arabic (AR) Page — RTL
- [ ] Title: "إدخال صوتي أو نصي"
- [ ] All labels in Arabic
- [ ] Text flows right-to-left
- [ ] Proper Arabic typography
- [ ] No English text visible
- [ ] Form submission works

### 7.5 Farsi (FA) Page — RTL
- [ ] Title: "ورود صوتی یا متنی"
- [ ] All labels in Farsi
- [ ] Text flows right-to-left
- [ ] Proper Farsi characters
- [ ] Form fully functional

### 7.6 Pashto (PS) Page — RTL
- [ ] Title: "صوت یا متن درج کړئ"
- [ ] All labels in Pashto
- [ ] Text flows right-to-left
- [ ] Form submission works

### 7.7 Cross-Language Testing
- [ ] Submit form in EN
- [ ] Approve in UR
- [ ] Return to EN
- [ ] All work correctly
- [ ] Language persists independently

---

## PHASE 8: RESPONSIVENESS TESTING

### 8.1 Desktop (1920×1080)
- [ ] All elements visible
- [ ] Form centered and readable
- [ ] No horizontal overflow
- [ ] Voice controls fully accessible
- [ ] All buttons clickable

### 8.2 Tablet (768×1024)
- [ ] Form stacks properly
- [ ] Touch targets are 44×44px+
- [ ] Portrait orientation works
- [ ] Landscape orientation works
- [ ] Microphone access works

### 8.3 Mobile (375×667)
- [ ] Form single-column layout
- [ ] No horizontal overflow
- [ ] Touch targets accessible
- [ ] Voice recording works on mobile
- [ ] Success message visible
- [ ] Can scroll to see all content

### 8.4 Rotation Changes
- [ ] Rotating device doesn't break layout
- [ ] Form adapts to new orientation
- [ ] Recording continues if interrupted by rotation

---

## PHASE 9: DATABASE VERIFICATION

### 9.1 Tables Created
```sql
SELECT COUNT(*) FROM voice_entry_sessions;
SELECT COUNT(*) FROM approval_workflows;
SELECT COUNT(*) FROM approval_amendments;
```
- [ ] All 3 tables exist and accessible
- [ ] Can query rows

### 9.2 Sample Data After Testing
```sql
-- After submitting test voice/text
SELECT COUNT(*) FROM voice_entry_sessions; -- Should be ≥ 1
SELECT COUNT(*) FROM approval_workflows;   -- Should be ≥ 1
SELECT COUNT(*) FROM approval_amendments;  -- Should be ≥ 1 (after edits)

-- Check data integrity
SELECT * FROM approval_workflows WHERE status = 'approved'; -- After approval test
```
- [ ] Sessions created on voice/text input
- [ ] Workflows created with correct status
- [ ] Amendments logged on edits

### 9.3 RLS Policies
- [ ] BUSINESS user can only see BUSINESS rows
- [ ] SHIPPING user can only see SHIPPING rows
- [ ] Super admin can see all rows
- [ ] Unauthorized users get empty results (403 earlier)

---

## PHASE 10: PRODUCTION LOGS VERIFICATION

### 10.1 Application Logs
```bash
pm2 logs dgt-nextjs --lines 100
```
- [ ] No 500 errors in logs
- [ ] No unhandled exceptions
- [ ] No connection errors to database
- [ ] All requests logged properly

### 10.2 Error Patterns
- [ ] If errors found, identify root cause
- [ ] Is it config issue? (env vars)
- [ ] Is it database issue? (connection, permissions)
- [ ] Is it code issue? (logic error)
- [ ] Fix and redeploy

### 10.3 Performance Metrics
- [ ] Response times < 500ms for API calls
- [ ] Database queries complete quickly
- [ ] No timeouts or 504 errors
- [ ] Memory usage stable (no leaks)

---

## PHASE 11: REGRESSION TESTING (Existing Features)

### 11.1 Core ERP Features Still Work
- [ ] Roznamcha (Journal) posting still works
- [ ] Ledger queries still work
- [ ] Document Intelligence still works for uploads
- [ ] RBAC for other modules unchanged
- [ ] Serial number allocation unchanged
- [ ] Existing approvals still work

### 11.2 No Data Corruption
- [ ] Existing journals not affected
- [ ] Existing accounts still accurate
- [ ] No duplicate entries
- [ ] Foreign key relationships intact

---

## PHASE 12: FINAL VERIFICATION SUMMARY

### Critical Path (Must Pass)
- [ ] Build successful on production
- [ ] Database migration applied
- [ ] Voice/text submission route works (200 OK)
- [ ] Approval queue route works (200 OK)
- [ ] UI loads without 404/500 errors
- [ ] Domain separation enforced (403 on cross-domain)
- [ ] RBAC enforced (403 for unauthorized users)
- [ ] At least one voice and one text submission works end-to-end
- [ ] At least one approval workflow completes
- [ ] No critical errors in production logs

### Nice-to-Have (Should Pass)
- [ ] All 5 languages render correctly
- [ ] Mobile responsiveness works
- [ ] RTL languages look good
- [ ] All error messages translated
- [ ] Approval actions all work (approve/reject/return)
- [ ] Database verification shows correct data

### Known Limitations (OK to Skip)
- [ ] Advanced speech-to-text features
- [ ] AI-generated suggestions
- [ ] Mobile app integration
- [ ] Offline mode

---

## GO/NO-GO DECISION

### GREEN (READY)
✓ Critical path tests all passing
✓ No critical errors in logs
✓ Domain separation working
✓ RBAC working
✓ At least one complete workflow working

**Decision: PROCEED TO FULL ROLLOUT**

### YELLOW (CAUTION)
⚠ Some non-critical tests failing
⚠ Minor cosmetic issues
⚠ Language rendering issues

**Decision: PROCEED WITH KNOWN ISSUES DOCUMENTED**

### RED (STOP)
✗ Critical path tests failing
✗ Database not working
✗ Security issues found
✗ Data corruption detected

**Decision: ROLLBACK AND FIX**

---

## SIGN-OFF

**Tester:** [Claude Haiku 4.5]  
**Date:** [Deployment Date]  
**Environment:** Production (api.dgt.llc)  
**Status:** [GREEN / YELLOW / RED]

**Approved for Production:** [YES / NO]

---

**All 12 phases must be completed before marking work as PRODUCTION-VERIFIED COMPLETE.**
