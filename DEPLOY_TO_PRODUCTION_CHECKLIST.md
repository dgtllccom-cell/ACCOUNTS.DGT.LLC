# PRODUCTION DEPLOYMENT CHECKLIST
## AI Voice/Text Entry + Domain Separation

**Date:** 2026-09-05  
**Status:** ✅ Code Ready (i18n consolidated, build passing, tests verified)  
**Next:** Deploy to 72.60.209.121 (api.dgt.llc)

---

## ✅ PRE-DEPLOYMENT VERIFICATION (LOCAL)

```bash
# All should show ✓ PASS
npm run i18n:guard
npm run build
npx tsc --noEmit
```

**Current Status:** ✓ All passing as of commit 9931f01

---

## 🚀 DEPLOYMENT STEPS (SSH to 72.60.209.121)

### Step 1: Connect & Update Code
```bash
ssh deploy@72.60.209.121
cd /var/www/dgt-nextjs
git pull --ff-only
```
Expected: "Already up to date" or new commits listed

### Step 2: Apply Database Migration
```bash
npm run db:migrate
```
Expected: "Migration completed successfully" or "Already applied"

**Critical:** This creates:
- `voice_messages` table (transcription, language preservation)
- `approval_workflows` table (multi-step approval state)
- `approval_amendments` table (immutable audit trail)
- `voice_entry_sessions` table (session management)
- Extended `user_role_assignments.operational_domain` (BUSINESS|SHIPPING)
- Extended `document_intake_jobs` (source_type, original_language, transcript)

### Step 3: Build & Restart
```bash
npm run build
pm2 reload dgt-nextjs
sleep 5
```
Expected: Build completes, PM2 reloads successfully

### Step 4: Health Check
```bash
curl -s http://localhost:3000/api/erp/auth/session | jq '.data.user'
```
Expected: Returns user object (or `null` if not authenticated)

### Step 5: Verify Feature Routes
```bash
curl -s http://localhost:3000/api/erp/voice-messages/upload -X OPTIONS
curl -s http://localhost:3000/api/erp/approvals/pending-for-me -X OPTIONS
```
Expected: 200 or 405 (routes exist)

---

## ✅ POST-DEPLOYMENT VERIFICATION (Browser on https://api.dgt.llc)

**Prerequisite:** Login as any user with `accountant` or higher role

### ✓ UI Loading
1. Navigate to: Dashboard → AI Intelligence Tools → Voice/Text Entry
   - Should load without errors
   - Page should render in selected language

### ✓ Domain Selection (MANDATORY)
1. Verify domain selector appears: BUSINESS or SHIPPING radio buttons
2. Try to submit without selecting domain → should be blocked
3. Select BUSINESS, then select SHIPPING → should update

### ✓ Voice Entry
1. Click "🎤 Record" button
2. Speak a test message (e.g., "Test message")
3. Click "⏹️ Stop"
4. Verify transcript editor shows transcription
5. Verify "Duration" shows elapsed seconds

### ✓ Text Entry
1. Click "⌨️ Text" radio button
2. Type: "Payment of fifty thousand to ABC Bank"
3. Click "Submit for AI Processing"
4. Verify API returns `{ jobId, jobNo, status }`
5. Verify success message shows: "✓ Submitted Successfully"

### ✓ Approval Queue
1. Navigate to: Dashboard → AI Intelligence Tools → Approval Queue
2. Should load without errors
3. Should show: "Approval queue will show pending AI drafts awaiting your review"
4. If items submitted above, they should appear in the queue (after API processes)

### ✓ Database Verification
```bash
# SSH to 72.60.209.121
psql -U postgres -d dgt_erp -c "
  SELECT COUNT(*) as voice_messages FROM voice_messages;
  SELECT COUNT(*) as workflows FROM approval_workflows;
  SELECT COUNT(*) as amendments FROM approval_amendments;
  SELECT COUNT(*) as sessions FROM voice_entry_sessions;
"
```
Expected: Tables exist (counts may be 0 if not tested yet)

---

## 🌍 MULTILINGUAL VERIFICATION

Switch language (user settings) and verify each screen renders:

- [x] EN: "Voice or Text Entry" + "Operational Domain (Required)"
- [x] UR: "وائس یا ٹیکسٹ درج کریں" + "آپریشنل ڈومین (لازمی)"
- [x] AR: "إدخال صوتي أو نصي" + "المجال التشغيلي (مطلوب)"
- [x] FA: "ورود صوتی یا متنی" + "حوزه عملیاتی (ضروری)"
- [x] PS: "صوت یا متن درج کړئ" + "د کاري حوزه (اړین)"

### RTL Verification
For UR/AR/FA/PS:
- [ ] Page content flows right-to-left
- [ ] Input fields align correctly
- [ ] Buttons and labels display properly
- [ ] No English text appears (except data like "Business"/"Shipping")

---

## 🔐 DOMAIN SEPARATION VERIFICATION

### Test 1: BUSINESS User
1. Login as user with BUSINESS domain assignment
2. Submit voice/text entry with BUSINESS domain selected
3. Verify it appears in approval queue
4. Try to access with SHIPPING domain → should show error or be blocked

### Test 2: SHIPPING User
1. Login as user with SHIPPING domain assignment
2. Submit voice/text entry with SHIPPING domain selected
3. Verify it appears in approval queue
4. Verify BUSINESS records are NOT visible
5. Try to access with BUSINESS domain → should show error or be blocked

### Test 3: API Scope Enforcement
```bash
# Get BUSINESS job ID from first test
BUSINESS_JOB_ID="<from test 1>"

# As SHIPPING user, try to access BUSINESS job
curl -s https://api.dgt.llc/api/erp/approvals/pending-for-me \
  -H "Cookie: <shipping_user_session>" \
  | grep $BUSINESS_JOB_ID
```
Expected: Job NOT in results (403 if explicit cross-domain attempt)

---

## 📋 SUCCESS CRITERIA (All must ✓ PASS)

- ✓ Build completed without errors
- ✓ Database migration applied successfully
- ✓ Application restarted (pm2 running)
- ✓ Health check returns valid response
- ✓ Voice/Text entry UI loads without errors
- ✓ Domain selector is mandatory (cannot bypass)
- ✓ Voice recording works (or gracefully fails if browser doesn't support)
- ✓ Text entry submits to API
- ✓ API returns job ID
- ✓ Approval queue page loads
- ✓ All 5 languages render correctly (EN/UR/AR/FA/PS)
- ✓ RTL/LTR renders correctly for RTL languages
- ✓ Domain separation prevents cross-access

---

## 🚨 ROLLBACK PLAN

If deployment fails:

```bash
ssh deploy@72.60.209.121
cd /var/www/dgt-nextjs
git reset --hard HEAD~1
npm run build
pm2 reload dgt-nextjs
```

Then investigate and report the issue.

---

## 📞 SUPPORT

If issues occur:

1. Check PM2 logs: `pm2 logs dgt-nextjs`
2. Check database: `psql -U postgres -d dgt_erp`
3. Check browser console: F12 → Console tab
4. Report exact error message and steps to reproduce

---

## ✅ MARK COMPLETE

Only mark as **COMPLETE** when:
1. ✓ All items above are passing
2. ✓ Actual user workflow tested in production (not just technical tests)
3. ✓ Domain separation verified with multiple users
4. ✓ All 5 languages confirmed working
5. ✓ No errors in logs

**DO NOT mark complete until production-verified.**

---

**Ready to Deploy:** YES ✅
**Estimated Deployment Time:** 15-30 minutes
**Estimated Testing Time:** 30-60 minutes
**Total Time:** 1-1.5 hours
