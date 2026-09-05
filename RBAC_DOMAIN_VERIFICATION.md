# RBAC & DOMAIN SEPARATION — PRODUCTION VERIFICATION

## Role-Based Access Control (RBAC)

### Voice/Text Entry Access: `/api/erp/voice-messages/upload`

| Role | Can Submit | Expected | Test |
|------|-----------|----------|------|
| super_admin | ✓ | 200 OK | Submit voice with BUSINESS domain |
| country_admin | ✓ | 200 OK | Submit text with SHIPPING domain |
| main_branch_admin | ✓ | 200 OK | Submit in assigned country |
| city_branch_admin | ✓ | 200 OK | Submit in assigned branch |
| accountant | ✓ | 200 OK | Submit and review |
| cashier | ✓ | 200 OK | Submit text entry |
| agent_user | ✓ | 200 OK | Submit in assigned scope |
| staff_user | ✗ | 403 Forbidden | Attempt to submit → rejected |
| customer_user | ✗ | 403 Forbidden | Attempt to submit → rejected |
| guest | ✗ | 401 Unauthorized | No auth → redirected to login |

**Verification:**
```bash
# Test staff_user rejection
curl -X POST https://api.dgt.llc/api/erp/voice-messages/upload \
  -H "Authorization: Bearer STAFF_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sourceType": "text", "operationalDomain": "business", ...}'
# Expected: 403 Forbidden
```

### Approval Queue Access: `/api/erp/approvals/pending-for-me`

| Role | Can View | Expected | Test |
|------|----------|----------|------|
| approver_role | ✓ | Pending items | GET pending queue |
| reviewer_role | ✓ | Assigned items | GET pending queue |
| super_admin | ✓ | All items | GET all pending |
| staff_user | ✗ | 403 Forbidden | No access |

**Verification:**
```bash
# Test staff_user
curl -X GET https://api.dgt.llc/api/erp/approvals/pending-for-me \
  -H "Authorization: Bearer STAFF_USER_TOKEN"
# Expected: 403 Forbidden
```

### Approval Action: `/api/erp/approvals/{id}/approve`

| Role | Can Approve | Expected | Notes |
|------|------------|----------|-------|
| approver_role | ✓ | 200 OK | Final approval authority |
| reviewer_role | ✗ | 403 Forbidden | Can only review, not approve |
| super_admin | ✓ | 200 OK | Can approve anything |
| non_approver | ✗ | 403 Forbidden | No permission |

**Verification:**
```bash
# Reviewer tries to approve (should fail)
curl -X POST https://api.dgt.llc/api/erp/approvals/{id}/approve \
  -H "Authorization: Bearer REVIEWER_TOKEN" \
  -d '{"approverNotes": "OK"}'
# Expected: 403 Forbidden
```

---

## Domain Separation (BUSINESS vs SHIPPING)

### Test 1: User with BUSINESS Domain

**Setup:**
- User A: Assigned to BUSINESS domain
- User A's organization_domain = "business"

**Test Steps:**
1. User A submits voice entry with domain=BUSINESS
   - Expected: ✓ 200 OK, jobId returned

2. User A attempts to submit with domain=SHIPPING
   - Expected: ✗ 400 Bad Request
   - Error: "Your login is restricted to the business domain"

3. User A retrieves pending approvals
   - Expected: ✓ Gets only BUSINESS items
   - Shipping items should NOT appear

**Verification:**
```bash
# User A tries SHIPPING domain
curl -X POST https://api.dgt.llc/api/erp/voice-messages/upload \
  -H "Authorization: Bearer USER_A_BUSINESS_TOKEN" \
  -d '{"operationalDomain": "shipping", ...}'
# Expected: 400 Bad Request (or 403 Forbidden)
```

### Test 2: User with SHIPPING Domain

**Setup:**
- User B: Assigned to SHIPPING domain
- User B's organization_domain = "shipping"

**Test Steps:**
1. User B submits voice entry with domain=SHIPPING
   - Expected: ✓ 200 OK, jobId returned

2. User B retrieves pending approvals
   - Expected: ✓ Gets only SHIPPING items
   - Business items should NOT appear

3. User B tries to access User A's BUSINESS job
   - Expected: ✗ 403 Forbidden
   - Error: "Access denied - outside your domain"

**Verification:**
```bash
# Get User A's job ID (from step 1)
BUSINESS_JOB_ID="..."

# User B tries to access BUSINESS job
curl -X GET https://api.dgt.llc/api/erp/approvals/{id} \
  -H "Authorization: Bearer USER_B_SHIPPING_TOKEN"
# Expected: 403 Forbidden
```

### Test 3: Super Admin Can Access Both

**Setup:**
- User C: Super admin (no domain restriction)

**Test Steps:**
1. User C can submit BUSINESS entries
   - Expected: ✓ 200 OK

2. User C can submit SHIPPING entries
   - Expected: ✓ 200 OK

3. User C can see ALL pending approvals
   - Expected: ✓ Gets both BUSINESS and SHIPPING items

4. User C can access any job (Business or Shipping)
   - Expected: ✓ 200 OK for both

---

## Country & Branch Scope Enforcement

### Test 4: Country Restriction

**Setup:**
- User D: Assigned to Pakistan (country_id = "PK")
- User D tries to submit with UAE (country_id = "AE")

**Test Steps:**
1. User D submits with assigned country (PK)
   - Expected: ✓ 200 OK

2. User D submits with different country (AE)
   - Expected: ✗ 403 Forbidden
   - Error: "Country is outside your assigned scope"

**Verification:**
```bash
curl -X POST https://api.dgt.llc/api/erp/voice-messages/upload \
  -H "Authorization: Bearer USER_D_PK_TOKEN" \
  -d '{"countryId": "AE", ...}'
# Expected: 403 Forbidden
```

### Test 5: Branch Restriction

**Setup:**
- User E: Assigned to Karachi Branch (branch_id = "KHI")
- User E tries to submit with Islamabad Branch (branch_id = "ISB")

**Test Steps:**
1. User E submits with assigned branch (KHI)
   - Expected: ✓ 200 OK

2. User E submits with different branch (ISB)
   - Expected: ✗ 403 Forbidden

3. User E retrieves pending items
   - Expected: ✓ Only KHI branch items shown

---

## Scope Layering Test

**Scenario:** User F has multiple restrictions
- Domain: BUSINESS only
- Country: Pakistan only
- Branch: Karachi only

**Submission Attempts:**

| Attempt | Domain | Country | Branch | Expected | Reason |
|---------|--------|---------|--------|----------|--------|
| 1 | BUSINESS | PK | KHI | ✓ 200 | All match |
| 2 | SHIPPING | PK | KHI | ✗ 403 | Domain mismatch |
| 3 | BUSINESS | AE | KHI | ✗ 403 | Country mismatch |
| 4 | BUSINESS | PK | ISB | ✗ 403 | Branch mismatch |
| 5 | SHIPPING | AE | ISB | ✗ 403 | All mismatch |

**Verification:**
```bash
# Test attempt 2 (SHIPPING + PK + KHI)
curl -X POST https://api.dgt.llc/api/erp/voice-messages/upload \
  -H "Authorization: Bearer USER_F_TOKEN" \
  -d '{
    "operationalDomain": "shipping",
    "countryId": "PK",
    "branchId": "KHI",
    ...
  }'
# Expected: 403 Forbidden
```

---

## Database-Level Verification

### Check: user_role_assignments.operational_domain

```sql
-- Verify domain column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_role_assignments'
AND column_name = 'operational_domain';

-- Expected output:
-- column_name: operational_domain
-- data_type: text
-- column_default: 'business'::text
```

### Check: document_intake_jobs Extensions

```sql
-- Verify voice/text source columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'document_intake_jobs'
AND column_name IN (
  'source_type',
  'original_language',
  'transcript',
  'audio_duration_seconds',
  'audio_mime_type',
  'audio_storage_key'
);

-- Expected: 6 rows (all columns exist)
```

### Check: approval_workflows Table

```sql
-- Verify workflow tracking tables
SELECT table_name
FROM information_schema.tables
WHERE table_name IN (
  'approval_workflows',
  'approval_amendments',
  'voice_entry_sessions'
);

-- Expected: 3 rows (all tables exist)
```

---

## Verification Checklist

### RBAC Verification
- [ ] staff_user gets 403 on submit
- [ ] staff_user gets 403 on approval queue
- [ ] non-approver gets 403 on approve action
- [ ] super_admin can do everything
- [ ] accountant can submit
- [ ] agent_user can submit in scope

### Domain Separation
- [ ] BUSINESS user cannot submit SHIPPING
- [ ] SHIPPING user cannot submit BUSINESS
- [ ] BUSINESS user cannot see SHIPPING items
- [ ] SHIPPING user cannot see BUSINESS items
- [ ] Super admin can see all domains
- [ ] Cross-domain API call returns 403

### Country Scope
- [ ] User cannot submit outside assigned country
- [ ] User cannot see items from other countries
- [ ] Super admin not restricted by country

### Branch Scope
- [ ] User cannot submit outside assigned branch
- [ ] User cannot see items from other branches
- [ ] City branch users properly scoped

### Scope Layering
- [ ] All scope layers enforced together
- [ ] Violation of ANY layer = 403
- [ ] Database-level checks working
- [ ] API-level checks working

---

**Target: 100% of RBAC and domain tests passing before production approval.**
