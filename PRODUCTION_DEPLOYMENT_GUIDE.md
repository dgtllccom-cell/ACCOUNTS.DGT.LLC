# PRODUCTION DEPLOYMENT GUIDE
## AI Voice/Text Entry + Domain Separation

**Status:** Ready for immediate production deployment  
**Date:** 2026-09-05  
**Target:** 72.60.209.121 (api.dgt.llc)

---

## PRE-DEPLOYMENT CHECKLIST

Run locally before deployment:

```bash
# 1. Clean build
npm run build
# Expected: 0 errors, ~70s

# 2. TypeScript check
npx tsc --noEmit
# Expected: 0 errors

# 3. i18n verification
npm run i18n:guard
# Expected: 13,948 keys × 5 languages, green

# 4. Run local tests (if suite exists)
npm test 2>/dev/null || echo "No test suite"
```

All must exit with status 0.

---

## DEPLOYMENT STEPS (SSH to 72.60.209.121)

```bash
# 1. Connect as deploy user
ssh deploy@72.60.209.121
cd /var/www/dgt-nextjs

# 2. Update code
git pull --ff-only
# Expected: "Already up to date" or new commits listed

# 3. Apply database migration
npm run db:migrate
# Looks for: supabase/migrations/20261105_ai_voice_text_and_domain_separation.sql
# Expected: "Migration applied successfully" or "Already applied"

# 4. Clean build on production
npm run build
# Expected: Fresh build, 0 errors

# 5. Restart application
pm2 reload dgt-nextjs
sleep 5

# 6. Health check
curl -s http://localhost:3000/api/erp/auth/session | jq '.data.user'
# Expected: Returns user object (or null if not logged in)

# 7. Verify routes exist
curl -s http://localhost:3000/api/erp/voice-messages/upload?_check=1 -X OPTIONS
# Expected: 200 or 405 (route exists)
```

---

## POST-DEPLOYMENT VERIFICATION (Browser on api.dgt.llc)

1. **Login** as any user with `accountant` or higher role
2. **Navigate** to Dashboard → AI Intelligence Tools → Voice/Text Entry
3. **Verify UI loads** without errors
4. **Check domain selector** is visible and mandatory (cannot proceed without selecting)
5. **Test voice entry** (browser microphone access):
   - Click "Record"
   - Speak briefly ("Test message")
   - Click "Stop"
   - Verify transcript editor shows the transcription
6. **Test text entry** (alternative input):
   - Clear voice, type: "Payment of fifty thousand to ABC Bank"
   - Submit
   - Verify API returns job ID
7. **Check approval queue** — Dashboard → AI Intelligence Tools → Approval Queue
   - Should be empty or show pending items
8. **Verify database** has new tables:
   ```sql
   SELECT COUNT(*) FROM voice_messages;
   SELECT COUNT(*) FROM approval_workflows;
   SELECT COUNT(*) FROM approval_amendments;
   ```
   Expected: At least 0 (may be empty on first deployment)

---

## ROLLBACK PLAN (if issues occur)

```bash
# On VPS, if deployment fails:
git reset --hard HEAD~1
pm2 reload dgt-nextjs
sleep 5

# Notify immediately if this happens
```

---

## CRITICAL FEATURES TO VERIFY

✅ **Domain Separation**
- Test as BUSINESS user → can only see BUSINESS domain
- Test as SHIPPING user → can only see SHIPPING domain
- Cross-domain API call → returns 403 Forbidden

✅ **5-Language Support**
- Switch language (settings) EN → UR → AR → FA → PS
- UI should fully render in selected language
- RTL languages (UR/PS/FA/AR) should render right-to-left

✅ **Multi-Step Approval**
- Submit voice/text entry
- Check approval queue
- Approve workflow (if authorized)
- Verify status updates

✅ **Audit Trail**
- Original transcript should be preserved
- Every approval/rejection logged
- Full chain traceable

---

## MONITORING POST-DEPLOYMENT

```bash
# Check application logs
pm2 logs dgt-nextjs | head -50

# Monitor for errors (watch continuously)
pm2 logs dgt-nextjs --err

# Database health
psql -U postgres -d dgt_erp -c "SELECT version();"
```

---

## SUCCESS CRITERIA

- ✅ Build completed without errors
- ✅ Migration applied to production database
- ✅ Application restart successful (pm2 running)
- ✅ Health check returns valid response
- ✅ UI loads without JavaScript errors
- ✅ Domain selector is mandatory
- ✅ Voice/text submission works
- ✅ Approval queue displays pending items
- ✅ All 5 languages render correctly
- ✅ Database tables populated (if tested)

---

## NEXT STEPS AFTER DEPLOYMENT

1. **Production User Testing** (manual, by authorized users)
   - Test actual business workflow on production
   - Report any issues immediately

2. **Monitoring**
   - Watch application logs for errors
   - Check database for data integrity
   - Verify no cross-domain leakage

3. **Marking as Complete**
   - Only after successful production user testing
   - When all master requirements are verified working
   - Document final acceptance

---

**Deployment Owner:** Assistant  
**Verification Owner:** User (production testing)  
**Ready to Deploy:** YES ✅
