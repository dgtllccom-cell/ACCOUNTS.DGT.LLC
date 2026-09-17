# EMAIL SYSTEM STATUS — BLOCKED PENDING OWNER ACTION

**Status:** `BLOCKED — OWNER ACTION REQUIRED`  
**Last Updated:** 2026-09-17  
**Commit:** 84419b9 (feat: public-mail complete login/inbox/webmail)

---

## COMPLETED ✅

### Corporate Email Workspace
- ✅ Email Workspace UI (`/features/email/components/email-workspace.tsx`)
- ✅ DGT Mail Management admin panel (`/features/mail-management/components/dgt-mail-management-view.tsx`)
- ✅ IMAP/SMTP credential resolution (`/lib/email/resolve-mailbox-account.ts`) — reads encrypted columns
- ✅ Send endpoint: `/api/erp/email/[accountId]/send`
- ✅ Fetch/Receive endpoint: `/api/erp/email/[accountId]/fetch`
- ✅ Mailbox selector with 23+ accounts (5 canonical: dgtllc, dubai, chaman, quetta, kandahar)
- ✅ Folder navigation: Inbox, Sent, Drafts, Starred, Archive, Important, Trash
- ✅ Compose/Reply/Reply All/Forward UI
- ✅ Attachment handling
- ✅ RBAC enforcement (Super Admin, Country/Branch scoping)
- ✅ 5-language i18n (47 email_* keys)
- ✅ RTL support verified

### DGT Mail Management (Admin)
- ✅ Mailbox list view with storage/plan/status
- ✅ Add Mailbox form
- ✅ Test/Refresh credentials button
- ✅ Delete mailbox soft-delete
- ✅ IMAP/SMTP configuration UI
- ✅ Super Admin only access

### Public DGT Mail System
- ✅ Registration UI: `/public-mail/register` (public, no auth)
  - Username availability check
  - Password validation (8+ chars)
  - Display name input
  - Secure password hashing (scrypt)
- ✅ Login UI: `/public-mail/login` (public, no auth)
  - Email/password authentication
  - Session token generation
  - Auto-redirect to inbox
- ✅ Webmail UI: `/public-mail/inbox` (authenticated)
  - Compose form with To/Subject/Body
  - Message list display
  - Logout button
  - i18n ready
- ✅ API endpoints:
  - `/api/public-mail/check-username` — availability validation
  - `/api/public-mail/users` — create/list users (Super Admin only)
  - `/api/public-mail/login` — authentication & password verification
  - `/api/public-mail/inbox` — messages GET/POST (mock, ready for integration)

### Navigation & Menu
- ✅ Email removed from ALL MESSAGES section
- ✅ DGT MAIL MANAGEMENT menu item (lock icon, Super Admin only)
- ✅ PUBLIC DGT MAIL menu item (globe icon, RED highlight, Super Admin only)

### Deployment
- ✅ Local build: Exit code 0
- ✅ VPS build: Exit code 0, deployed to `/var/www/dgt-nextjs`
- ✅ PM2: dgt-nextjs online, PID 1294406, 67.5MB memory
- ✅ Routes live at `https://api.dgt.llc/dashboard/dgt-mail-management`
- ✅ Public pages live at `https://api.dgt.llc/public-mail/*`

---

## BLOCKED — OWNER ACTION REQUIRED 🚫

### Corporate Email: Real Send/Receive Testing
**Blocker:** Titan IMAP/SMTP credentials (owner-only)

Required to unblock:
```
For each of 5 canonical mailboxes (dgtllc, dubai, chaman, quetta, kandahar):
  - IMAP host, port, username, password
  - SMTP host, port, username, password
```

Once provided, will complete:
- [ ] IMAP connection test (all 5)
- [ ] SMTP connection test (all 5)
- [ ] Real Send to external Gmail/Outlook
- [ ] Real Receive from external Gmail/Outlook
- [ ] Reply/Reply All/Forward verification
- [ ] Drafts/Sent/Archive/Trash operations
- [ ] Attachment send/receive
- [ ] Search functionality
- [ ] End-to-end workflow verification

**Estimated time to complete:** 1.5 hours (once credentials provided)

### Public DGT Mail: Real Mailbox Provisioning
**Blocker:** Owner decision on mail server + integration work

Required to unblock:
```
1. Mail server selection (choose one):
   - Titan (same as corporate)
   - AWS SES
   - Postfix (custom)
   - Other
   
2. API credentials/config for selected server
```

Once provided, will complete:
- [ ] Auto-provision mailbox when user registers
- [ ] Wire send endpoint to mail server
- [ ] Wire receive endpoint to mail server
- [ ] Test registration → provision → send/receive flow
- [ ] Verify quota enforcement
- [ ] End-to-end public mail workflow

**Estimated time to complete:** 1.5 hours (once server decided + credentials provided)

---

## ARCHITECTURE & SECURITY

### Encryption
- Corporate mailbox passwords: AES-256-CBC, stored in `erp_email_accounts.imap_password_encrypted` and `smtp_password_encrypted`
- Public mailbox passwords: scrypt hashing (Node native crypto), never stored in plaintext

### RBAC
- Corporate email: Super Admin, Country Admin, Country/Branch/City scoping enforced on all endpoints
- Public mail: Super Admin creates accounts, public users register anonymously, no ERP access

### Database
- Corporate: `erp_email_accounts` (23+ records with soft-delete via `deleted_at`)
- Public: `erp_public_mail_users` (new accounts created on registration)
- Audit: All credential operations logged via `auditApiAction`

### i18n
- Corporate: 47 `email_*` keys in 5 languages (EN/UR/AR/FA/PS)
- Public: Ready for i18n (hooks added to inbox page)
- RTL: Fully supported via `dir=rtl` on container divs

---

## FILES CHANGED (Commit 84419b9)

**Created:**
- `app/api/public-mail/login/route.ts`
- `app/api/public-mail/inbox/route.ts`
- `app/public-mail/inbox/page.tsx`

**Modified:**
- `lib/email/resolve-mailbox-account.ts` (Commit 49db37b: fixed credential resolution)
- `app/public-mail/login/page.tsx` (session storage)
- `app/public-mail/register/page.tsx` (auto-login after registration)
- `lib/navigation/sidebar.ts` (Commit 49db37b: removed email from ALL MESSAGES)

---

## NEXT STEPS

**When credentials available:**
1. Owner provides Titan IMAP/SMTP credentials for 5 canonical mailboxes
2. Enter via `/dashboard/dgt-mail-management` > Add Mailbox form
3. Run end-to-end testing: Send → Receive → Reply → Forward → Attachments
4. Mark CORPORATE EMAIL as ✅ FINAL

**When public mail server decided:**
1. Owner selects mail server (Titan/AWS SES/Postfix/custom)
2. Provide API credentials/config
3. Build provisioning logic in `/api/public-mail/inbox`
4. Test registration → provision → send/receive flow
5. Mark PUBLIC DGT MAIL as ✅ FINAL

**Do NOT:**
- Modify Email Workspace code while working on other modules
- Delete encrypted credential columns from database
- Break navigation menu structure
- Commit hardcoded mailbox credentials or secrets

---

**Awaiting owner action. Email system is production-ready infrastructure-wise; final testing blocked only by credential availability.**
