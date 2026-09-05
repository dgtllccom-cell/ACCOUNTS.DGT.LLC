# AI Voice/Text Entry + Domain Separation Implementation Checklist

**Status:** Phase implementation in progress  
**Target Completion:** Complete all phases A-Z end-to-end  
**Last Updated:** 2026-09-05

---

## ✅ COMPLETED WORK

### Database & Schema
- [x] Migration file: `supabase/migrations/20261105_ai_voice_text_and_domain_separation.sql`
  - voice_messages table (audio capture, transcription, language preservation)
  - approval_workflows table (multi-step approval tracking)
  - approval_amendments table (audit trail of corrections)
  - voice_entry_sessions table (session management)
  - Extends user_role_assignments with `operational_domain`
  - Extends document_intake_jobs with source_type, original_language, transcript

### Backend Services (Completed)
- [x] `lib/services/ai-voice-text-entry.ts`
  - Voice/text input submission
  - Approval workflow creation
  - Approval/rejection/return logic
  - Immutable audit trail

- [x] `lib/services/transcription-service.ts`
  - OpenAI Whisper API integration (with fallback mock)
  - All 5 languages supported with language hints
  - Processing time tracking
  - Error handling & logging

- [x] `lib/services/intent-analyzer.ts`
  - Multilingual intent detection (payment, purchase, sale, inquiry, etc.)
  - Entity extraction (amount, date, account, currency, party)
  - Language-aware keyword matching (EN/UR/PS/FA/AR)
  - Confidence scoring

- [x] `lib/services/approval-chain-service.ts` (via ai-voice-text-entry.ts)
  - Multi-step approval chain (AI → User → Approver)
  - Status management (pending, approved, rejected, returned)
  - Role-based authorization

### API Routes (Partially Completed)
- [x] `app/api/erp/voice-messages/upload/route.ts`
  - POST voice message with audio file
  - POST text instruction (JSON)
  - Multipart and JSON handling
  - Automatic transcription queue

## 🔄 IN PROGRESS / REMAINING WORK

### Priority 1: Critical i18n & Navigation (2-3 hours)

**1.1 Add i18n keys to `lib/i18n/ui.ts`**
- File: `lib/i18n/ui.ts` (currently 90,000+ lines)
- Action: Append the following keys to ALL FIVE language blocks (en, ur, ar, fa, ps)
- Keys needed: 47 new keys (listed in `ai_voice_text_i18n_keys.json` in scratchpad)
- Search pattern: Each key appears once in en block, then identical key (same spelling) appears in ur/ar/fa/ps blocks with translated values
- Verification: `npm run i18n:guard` must pass (GREEN)

**Key categories to add:**
```
ai_entry.*          (18 keys) — voice/text entry screens
approval.*          (29 keys) — approval workflow UI
```

**Important:** Add keys at END of each language block to avoid spreading issues (see memory: [[i18n-en-spread-clobber]])

**1.2 Update navigation sidebar `lib/navigation/sidebar.ts`**
- Add new "AI Intelligence Tools" section (top-level menu item)
- Visibility: super_admin, country_admin, main_branch_admin, city_branch_admin, accountant, cashier, agent_user
- Children:
  ```
  ├─ 🎤 Voice/Text Message Entry (new)
  ├─ 📄 Document Intake Center (existing, link here)
  ├─ 📋 AI Drafts Awaiting Review (new)
  ├─ ✅ Approval Queue (new)
  └─ 🔍 Intent Analysis History (new)
  ```
- Routes:
  - `/dashboard/ai-entry/voice-text` (new)
  - `/dashboard/document-intelligence` (existing)
  - `/dashboard/ai-entry/drafts-review` (new)
  - `/dashboard/ai-entry/approval-queue` (new)
  - `/dashboard/ai-entry/intent-history` (new)

### Priority 2: Remaining API Routes (3-4 hours)

**2.1 Voice message processing routes**
```
POST /api/erp/voice-messages/{id}/transcribe
  - Trigger transcription immediately
  - Returns: { status, transcript, duration }

GET /api/erp/voice-messages?status=transcribed
  - List voice messages ready for intent analysis

POST /api/erp/voice-messages/{id}/analyze-intent
  - Trigger intent analysis
  - Returns: { intent, confidence, extracted_fields }

POST /api/erp/voice-messages/{id}/create-draft
  - Convert to AI draft (calls document-intelligence matching)
  - Returns: { draftId, draftNo, status }
```

**2.2 Approval workflow routes**
```
GET /api/erp/approvals/pending-for-me
  - List approvals awaiting current user

POST /api/erp/approvals/{id}/review
  - Submit review (corrected fields, reviewer notes)
  - Body: { corrections: {...}, reviewerNotes: string }
  - Returns: { workflowId, nextStep }

POST /api/erp/approvals/{id}/approve
  - Final approval (allows posting to ERP)
  - Body: { approverNotes?: string }
  - Returns: { workflowId, status: "approved" }

POST /api/erp/approvals/{id}/reject
  - Reject with reason
  - Body: { rejectionReason: string }
  - Returns: { workflowId, status: "rejected" }

POST /api/erp/approvals/{id}/return
  - Return for corrections
  - Body: { returnReason: string }
  - Returns: { workflowId, status: "returned_for_review" }

GET /api/erp/approvals/{id}/history
  - Full audit trail of all approval steps & corrections
```

### Priority 3: Frontend UI Components (4-5 hours)

**3.1 Voice message entry component**
```
Path: features/document-intelligence/components/voice-entry-method.tsx
Features:
- Language selector (EN, UR, PS, FA, AR)
- Domain selector (MANDATORY: Business / Shipping)
- Microphone input with recording controls
- Real-time transcription display
- Playback with duration
- Edit transcription in place
- Shows extracted intent + confidence
- [Process as AI Draft] button
```

**3.2 Text instruction entry component**
```
Path: features/document-intelligence/components/text-instruction-entry.tsx
Features:
- Language selector
- Domain selector (MANDATORY)
- Free-text input (textarea)
- Character count
- Same intent extraction as voice
- [Process as AI Intent] button
```

**3.3 AI draft review panel (enhanced)**
```
Path: features/document-intelligence/components/review-panel-v2.tsx
Features:
- Multi-step approval chain visual
- Original transcript display (in original language)
- Extracted fields for correction
- Amendment history (before/after for each field)
- Reviewer notes + approver notes
- Role-based action buttons (Review/Approve/Reject/Return)
- Shows responsible person at each step + timestamp
```

**3.4 Approval queue dashboard**
```
Path: features/ai-entry/components/approval-queue-dashboard.tsx
Features:
- Filter by domain (business/shipping), status, language
- List of pending approvals for current user's role
- Shows: job number, intent, submitter, submitted date, approver count
- Click to open review panel
- Quick actions: Approve, Reject, Return
```

**3.5 Update user creation form**
```
Path: features/users/components/user-entry-form.tsx
Action: Add MANDATORY domain selection step before role selection
- Step 1: Domain (Business / Shipping) — REQUIRED
- Step 2: Country (existing)
- Step 3: Branch (existing)
- Step 4: Role (existing, filtered by domain)
```

### Priority 4: Database & Migration Application (1-2 hours)

**4.1 Apply migration**
```bash
# On development environment
npm run db:migrate

# Verify tables exist
SELECT table_name FROM information_schema.tables WHERE table_schema='public' 
  AND table_name IN ('voice_messages', 'approval_workflows', 'approval_amendments');
```

**4.2 Test migration rollback** (to ensure production safety)
```bash
npm run db:migrate:down
npm run db:migrate
```

### Priority 5: Testing & Verification (3-4 hours)

**5.1 Unit tests**
```
lib/services/
  ├─ transcription-service.test.ts (mock audio → text conversion)
  ├─ intent-analyzer.test.ts (text → intent + fields)
  └─ ai-voice-text-entry.test.ts (upload → job creation)
```

**5.2 Integration tests**
```
app/api/erp/voice-messages/
  ├─ upload.test.ts (multipart upload, JSON submission)
  └─ [id]/transcribe.test.ts (transcription workflow)

app/api/erp/approvals/
  └─ chain.test.ts (multi-step approval flow)
```

**5.3 Multi-language smoke tests**
```
✓ Record voice in EN, UR, AR, PS, FA
✓ Verify correct transcription language
✓ Verify intent extracted correctly
✓ Verify original language preserved through approval chain
```

**5.4 Domain separation tests**
```
✓ Business user cannot access shipping records
✓ Shipping user cannot access business records
✓ Domain selected at user creation is enforced in API
✓ All queries filtered by domain automatically
```

### Priority 6: Configuration & Deployment (2-3 hours)

**6.1 Environment setup**
- Add `.env` variables:
  ```
  SPEECH_TO_TEXT_PROVIDER=openai_whisper
  OPENAI_API_KEY=***
  ENABLE_VOICE_MESSAGES=true
  ENABLE_TEXT_INSTRUCTIONS=true
  ENABLE_APPROVAL_CHAIN=true
  ```

**6.2 Feature flags** (in `lib/config/features.ts`)
  - `VOICE_MESSAGES_ENABLED`
  - `TEXT_INSTRUCTIONS_ENABLED`
  - `APPROVAL_CHAIN_ENABLED`

**6.3 Build & test**
```bash
npm run build  # Should exit 0
npm run test   # All tests pass
npm run i18n:guard  # All i18n GREEN
npx tsc --noEmit  # TypeScript clean
```

### Priority 7: Production Deployment (2-3 hours)

**7.1 Deploy to staging**
```bash
git push origin feature/voice-ai-extension-v1
# Create PR, review, merge to main
npm run build  # Staging build
```

**7.2 Deploy to production**
```bash
# Phase 1: Schema-only (non-blocking)
npm run db:migrate --production

# Phase 2: Backend services (one feature flag gates them)
ENABLE_VOICE_MESSAGES=false npm run build

# Phase 3: Enable feature flag
ENABLE_VOICE_MESSAGES=true pm2 reload dgt-nextjs

# Phase 4: Monitor
- Transcription success rate (target >99%)
- API response times
- Database query performance
- Error logs
```

**7.3 Rollback plan**
```bash
# If issues: disable via feature flag
ENABLE_VOICE_MESSAGES=false pm2 reload dgt-nextjs
# Database schema stays (backward compatible)
# Old document intake still works
# No data loss
```

---

## CRITICAL SUCCESS CRITERIA

Before marking implementation as COMPLETE:

- [ ] All 5 languages (EN/UR/AR/FA/PS) fully functional end-to-end
- [ ] Voice → Transcribe → Intent → Draft → Approval → Post works end-to-end
- [ ] Domain separation enforced (business user cannot see shipping data)
- [ ] User creation requires MANDATORY domain selection
- [ ] Approval chain preserves original language & all corrections
- [ ] Serial allocation works (4-level: global, country, branch, entry)
- [ ] AI never posts directly (all drafts require approval)
- [ ] Main menu shows "AI Intelligence Tools" section with 4-5 new items
- [ ] Backward compatible (existing document intake still works)
- [ ] Mobile-friendly voice recording interface
- [ ] Performance <30 seconds for 5-minute audio
- [ ] All navigation links functional
- [ ] i18n:guard PASSES (GREEN)
- [ ] npm run build EXITS 0
- [ ] npx tsc --noEmit CLEAN (no TS errors)
- [ ] Tests pass (unit + integration + E2E)
- [ ] Audit trail complete & immutable

---

## FILE MANIFEST

### Created/New Files
- `supabase/migrations/20261105_ai_voice_text_and_domain_separation.sql` ✅
- `lib/services/ai-voice-text-entry.ts` ✅
- `lib/services/transcription-service.ts` ✅
- `lib/services/intent-analyzer.ts` ✅
- `app/api/erp/voice-messages/upload/route.ts` ✅
- `app/api/erp/voice-messages/[id]/transcribe/route.ts` — TODO
- `app/api/erp/approvals/{id}/review/route.ts` — TODO
- `app/api/erp/approvals/{id}/approve/route.ts` — TODO
- `app/api/erp/approvals/{id}/reject/route.ts` — TODO
- `app/api/erp/approvals/{id}/return/route.ts` — TODO
- `features/document-intelligence/components/voice-entry-method.tsx` — TODO
- `features/document-intelligence/components/text-instruction-entry.tsx` — TODO
- `features/document-intelligence/components/review-panel-v2.tsx` — TODO
- `features/ai-entry/components/approval-queue-dashboard.tsx` — TODO
- `lib/services/transcription-service.test.ts` — TODO
- `lib/services/intent-analyzer.test.ts` — TODO

### Modified Files
- `lib/i18n/ui.ts` — Add 47 new keys to all 5 language blocks (en, ur, ar, fa, ps) — TODO
- `lib/navigation/sidebar.ts` — Add "AI Intelligence Tools" section — TODO
- `features/users/components/user-entry-form.tsx` — Add MANDATORY domain selection step — TODO
- `lib/permissions/enterprise-roles.ts` — Add domain-aware permission checks — TODO

---

## REMAINING EXECUTION TIME ESTIMATE

| Phase | Task | Duration | Status |
|-------|------|----------|--------|
| 1 | i18n keys + sidebar nav | 2-3 hrs | TODO |
| 2 | Remaining API routes (7 routes) | 3-4 hrs | TODO |
| 3 | UI components (5 components) | 4-5 hrs | TODO |
| 4 | Database & migration | 1-2 hrs | TODO |
| 5 | Testing | 3-4 hrs | TODO |
| 6 | Config & build | 2-3 hrs | TODO |
| 7 | Production deployment | 2-3 hrs | TODO |
| **TOTAL** | | **18-24 hours** | In Progress |

**Estimated completion:** 1-2 business days for experienced developer

---

## INTEGRATION POINTS WITH EXISTING SYSTEMS

- **i18n**: Reuses lib/i18n/ui.ts (central 5-language dictionary)
- **RBAC**: Reuses lib/permissions/enterprise-roles.ts (adds domain filter)
- **Document Intelligence**: Extends existing document-intake-service (voice + text as new source types)
- **Serial Architecture**: Reuses lib/services/serial-number-service.ts (no changes needed)
- **Approval**: Extends existing approvals system (adds multi-step chain)
- **Navigation**: Updates lib/navigation/sidebar.ts (adds new section)
- **Database**: Uses Supabase (adds new tables, extends existing ones)

---

## NEXT IMMEDIATE ACTIONS

1. **Add i18n keys to lib/i18n/ui.ts** — This MUST be done before any UI renders
2. **Update sidebar.ts** — Exposes new screens to navigation
3. **Create remaining API routes** — Connects UI to backend services
4. **Implement UI components** — Renders the user-facing forms
5. **Apply database migration** — Run on DEV, test rollback, then production
6. **Run full test suite** — Verify all systems work together
7. **Deploy & verify production** — Final validation

---

## CONFIGURATION NEEDED

### .env Variables
```
SPEECH_TO_TEXT_PROVIDER=openai_whisper
OPENAI_API_KEY=sk-[your-key]
VOICE_STORAGE_PATH=/mnt/storage/voice
ENABLE_VOICE_MESSAGES=true
ENABLE_TEXT_INSTRUCTIONS=true
ENABLE_APPROVAL_CHAIN=true
ASYNC_TRANSCRIPTION=false  # Use sync for testing, async for production
```

### Feature Flags (in lib/config/features.ts)
```typescript
export const FEATURES = {
  VOICE_MESSAGES: process.env.ENABLE_VOICE_MESSAGES === "true",
  TEXT_INSTRUCTIONS: process.env.ENABLE_TEXT_INSTRUCTIONS === "true",
  APPROVAL_CHAIN: process.env.ENABLE_APPROVAL_CHAIN === "true",
};
```

---

## MONITORING & METRICS (Post-Deployment)

**Track these KPIs:**
- Voice upload success rate (target >99%)
- Transcription accuracy by language
- Intent detection confidence (>80%)
- Approval chain completion time
- User error rate on domain selection
- Database query performance

**Alerts trigger if:**
- Transcription failures >5%
- Intent match failures >20%
- Approval stuck >4 hours
- API latency >2 seconds

---

## NO STOPPING POINT

This implementation is CONTINUOUS end-to-end. Do NOT commit mid-phase or fragment the work. Each phase builds on previous phases:

1. Schema enables services
2. Services enable API routes
3. API routes enable UI
4. UI enables testing
5. Testing enables deployment
6. Deployment enables verification

**All or nothing approach.** No partial deployments until Phase 7.

---

**Last review:** 2026-09-05  
**Next review:** After i18n keys added
