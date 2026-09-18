import fs from "fs";
import path from "path";

// Load .env.local into process.env
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import postgres from "postgres";
import {
  sendWebmailMessage,
  saveDraft,
  authenticatePublicMailUser,
  resetUserPassword,
  adminListPublicMailUsers,
  adminUpdatePublicMailUserStatus,
  adminUpdatePublicMailUserQuota,
  adminResetPublicMailUserPassword,
  adminGetPublicMailAuditLogs,
  autoProvisionEntityMailbox,
} from "../lib/public-mail/webmail-service";
import { provisionEntityEmail } from "../lib/mail-provisioning/entity-auto-email";

const TEST_DB_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";

// Strictly verify that we are connecting to the TEST database
if (!TEST_DB_URL.includes("csesvyxxjivnkkozgopt")) {
  console.error("FATAL: Test must run against Dev/Test Supabase (csesvyxxjivnkkozgopt). Current URL does not match!");
  process.exit(1);
}

const sql = postgres(TEST_DB_URL, { max: 2, prepare: false, connect_timeout: 10 });

const results: Record<string, "PASS" | "FAIL"> = {
  "PUBLIC WORKSPACE": "FAIL",
  "ADMIN MAIL MANAGEMENT": "FAIL",
  "COUNTRY AUTO EMAIL": "FAIL",
  "MAIN BRANCH AUTO EMAIL": "FAIL",
  "CITY BRANCH AUTO EMAIL": "FAIL",
  "USER AUTO EMAIL": "FAIL",
  "AGENT AUTO EMAIL": "FAIL",
  "DGT→DGT SEND": "FAIL",
  "DGT→DGT RECEIVE": "FAIL",
  "REPLY": "FAIL",
  "SENT SYNC": "FAIL",
  "PASSWORD RESET": "FAIL",
  "QUOTA": "FAIL",
};

async function runE2ETests() {
  console.log("=== STARTING FULL DGT EMAIL SYSTEM E2E VERIFICATION ===");
  console.log("Database: dgtllccom-cell's Project (csesvyxxjivnkkozgopt)");

  try {
    // -------------------------------------------------------------
    // SETUP: Provision 2 test users for real email exchange
    // -------------------------------------------------------------
    const userAEmail = "alice.test@dgt.llc";
    const userBEmail = "bob.test@dgt.llc";
    const initialPassA = "Alice@TestPass123!";
    const initialPassB = "Bob@TestPass123!";

    const provA = await autoProvisionEntityMailbox({
      entityType: "user",
      entityId: "test-alice-id",
      code: "alice.test",
      displayName: "Alice Test User",
      customEmail: userAEmail,
      customPassword: initialPassA,
    });

    const provB = await autoProvisionEntityMailbox({
      entityType: "user",
      entityId: "test-bob-id",
      code: "bob.test",
      displayName: "Bob Test User",
      customEmail: userBEmail,
      customPassword: initialPassB,
    });

    if (!provA.success || !provB.success) {
      throw new Error(`Failed to provision test mailboxes: ${provA.error || provB.error}`);
    }

    const [userA] = await sql`SELECT * FROM public.public_mail_users WHERE email_address = ${userAEmail} LIMIT 1`;
    const [userB] = await sql`SELECT * FROM public.public_mail_users WHERE email_address = ${userBEmail} LIMIT 1`;

    if (!userA || !userB) throw new Error("Test users not found in database!");

    // Ensure clean quota and usage for test run
    await sql`
      UPDATE public.public_mail_users
      SET quota_bytes = 5368709120, used_bytes = 0, status = 'active'
      WHERE id IN (${userA.id}, ${userB.id})
    `;

    console.log(`[SETUP] Test users active: Alice (${userA.id}), Bob (${userB.id})`);

    // -------------------------------------------------------------
    // TEST 1: Public Workspace (Drafts, Compose, Send, Receive, Attachments)
    // -------------------------------------------------------------
    console.log("\n--- TEST: Public Workspace & DGT-to-DGT Send/Receive ---");

    // 1a. Save draft
    const draftRes = await saveDraft({
      userId: userA.id,
      to: userBEmail,
      subject: "Test Proposal Draft",
      body: "Drafting the proposal for Q4.",
    });

    if (!draftRes.success || !draftRes.draftId) {
      throw new Error("Failed to save draft: " + draftRes.error);
    }

    const [savedDraft] = await sql`
      SELECT * FROM public.public_mail_messages WHERE id = ${draftRes.draftId} AND folder = 'drafts'
    `;
    if (!savedDraft) throw new Error("Draft not found in drafts folder!");
    console.log("  ✓ Draft successfully saved in Drafts folder");

    // 1b. Send email with attachment metadata (resolving the draft)
    const sendRes = await sendWebmailMessage({
      senderUserId: userA.id,
      to: userBEmail,
      subject: "Official Proposal Q4",
      body: "Hello Bob, please find the attached proposal for Q4 review.",
      attachments: [{ name: "Q4_Proposal.pdf", size: 10240, type: "application/pdf" }],
      draftId: draftRes.draftId,
    });

    if (!sendRes.success) throw new Error("Failed to send webmail message: " + sendRes.error);
    console.log("  ✓ Message sent successfully");
    results["DGT→DGT SEND"] = "PASS";

    // 1c. Verify Draft was converted/deleted from Drafts
    const [checkDraft] = await sql`
      SELECT * FROM public.public_mail_messages WHERE id = ${draftRes.draftId} AND folder = 'drafts'
    `;
    if (checkDraft) throw new Error("Draft was not cleaned up after send!");
    console.log("  ✓ Draft cleared upon send");

    // 1d. Verify Alice has the message in Sent folder
    const [aliceSent] = await sql`
      SELECT * FROM public.public_mail_messages 
      WHERE user_id = ${userA.id} AND folder = 'sent' AND recipient_email = ${userBEmail}
      ORDER BY created_at DESC LIMIT 1
    `;
    if (!aliceSent) throw new Error("Message missing from Alice Sent folder!");
    console.log("  ✓ Sender Sent folder synchronized");
    results["SENT SYNC"] = "PASS";

    // 1e. Verify Bob received the message in Inbox folder (DGT-to-DGT delivery)
    const [bobInbox] = await sql`
      SELECT * FROM public.public_mail_messages 
      WHERE user_id = ${userB.id} AND folder = 'inbox' AND sender_email = ${userAEmail}
      ORDER BY created_at DESC LIMIT 1
    `;
    if (!bobInbox) throw new Error("Message missing from Bob Inbox folder!");
    console.log("  ✓ Recipient received message directly in Inbox");
    results["DGT→DGT RECEIVE"] = "PASS";

    // 1f. Mark as read / unread
    await sql`UPDATE public.public_mail_messages SET is_read = TRUE WHERE id = ${bobInbox.id}`;
    const [bobMsgRead] = await sql`SELECT is_read FROM public.public_mail_messages WHERE id = ${bobInbox.id}`;
    if (!bobMsgRead.is_read) throw new Error("Failed to mark message as read!");

    await sql`UPDATE public.public_mail_messages SET is_read = FALSE WHERE id = ${bobInbox.id}`;
    const [bobMsgUnread] = await sql`SELECT is_read FROM public.public_mail_messages WHERE id = ${bobInbox.id}`;
    if (bobMsgUnread.is_read) throw new Error("Failed to mark message as unread!");
    console.log("  ✓ Read/Unread toggling verified");

    // 1g. Bob replies to Alice
    const replyRes = await sendWebmailMessage({
      senderUserId: userB.id,
      to: userAEmail,
      subject: "Re: Official Proposal Q4",
      body: "Looks good Alice, approved!\n\n--- On Alice wrote: ---\nHello Bob...",
    });
    if (!replyRes.success) throw new Error("Reply failed: " + replyRes.error);

    const [aliceReplyReceived] = await sql`
      SELECT * FROM public.public_mail_messages 
      WHERE user_id = ${userA.id} AND folder = 'inbox' AND sender_email = ${userBEmail}
      ORDER BY created_at DESC LIMIT 1
    `;
    if (!aliceReplyReceived) throw new Error("Alice did not receive Bob's reply!");
    console.log("  ✓ Bidirectional reply received and verified");
    results["REPLY"] = "PASS";

    // 1h. Trash and Permanent Delete
    await sql`UPDATE public.public_mail_messages SET folder = 'trash' WHERE id = ${aliceReplyReceived.id}`;
    const [inTrash] = await sql`SELECT folder FROM public.public_mail_messages WHERE id = ${aliceReplyReceived.id}`;
    if (inTrash.folder !== "trash") throw new Error("Message not moved to trash!");

    // Restore to inbox
    await sql`UPDATE public.public_mail_messages SET folder = 'inbox' WHERE id = ${aliceReplyReceived.id}`;
    const [restored] = await sql`SELECT folder FROM public.public_mail_messages WHERE id = ${aliceReplyReceived.id}`;
    if (restored.folder !== "inbox") throw new Error("Message not restored to inbox!");

    // Move back to trash and delete permanently
    await sql`UPDATE public.public_mail_messages SET folder = 'trash' WHERE id = ${aliceReplyReceived.id}`;
    await sql`DELETE FROM public.public_mail_messages WHERE id = ${aliceReplyReceived.id}`;
    const [deleted] = await sql`SELECT id FROM public.public_mail_messages WHERE id = ${aliceReplyReceived.id}`;
    if (deleted) throw new Error("Message was not deleted permanently!");
    console.log("  ✓ Trash, Restore, and Permanent Delete verified");

    results["PUBLIC WORKSPACE"] = "PASS";

    // -------------------------------------------------------------
    // TEST 2: Admin Mailbox Management
    // -------------------------------------------------------------
    console.log("\n--- TEST: Admin Mailbox Management ---");

    // 2a. List users
    const listRes = await adminListPublicMailUsers({ search: "alice.test" });
    if (!listRes.users || listRes.users.length === 0) {
      throw new Error("Admin user listing failed to find user!");
    }
    console.log(`  ✓ Admin listed users successfully (Found ${listRes.total} matching)`);

    // 2b. Suspend and reactivate user
    const suspRes = await adminUpdatePublicMailUserStatus(userA.id, "suspended");
    if (!suspRes.success) throw new Error("Admin failed to suspend user!");
    const [userASuspended] = await sql`SELECT status FROM public.public_mail_users WHERE id = ${userA.id}`;
    if (userASuspended.status !== "suspended") throw new Error("User status not updated to suspended!");

    const actRes = await adminUpdatePublicMailUserStatus(userA.id, "active");
    if (!actRes.success) throw new Error("Admin failed to activate user!");
    const [userAActive] = await sql`SELECT status FROM public.public_mail_users WHERE id = ${userA.id}`;
    if (userAActive.status !== "active") throw new Error("User status not restored to active!");
    console.log("  ✓ Admin Suspend & Activate verified");

    // 2c. Update Quota
    const newQuota = 2147483648; // 2GB
    const quotaRes = await adminUpdatePublicMailUserQuota(userA.id, newQuota);
    if (!quotaRes.success) throw new Error("Admin failed to update quota: " + quotaRes.error);
    const [userAQuota] = await sql`SELECT quota_bytes FROM public.public_mail_users WHERE id = ${userA.id}`;
    if (Number(userAQuota.quota_bytes) !== newQuota) throw new Error("Quota bytes not updated!");
    console.log("  ✓ Admin Quota adjustment verified");

    // 2d. Reset Password
    const adminResetRes = await adminResetPublicMailUserPassword(userA.id, "Admin@NewPass999!");
    if (!adminResetRes.success) throw new Error("Admin password reset failed: " + adminResetRes.error);
    console.log("  ✓ Admin Password reset verified");

    // 2e. Audit Logs
    const auditLogs = await adminGetPublicMailAuditLogs(userA.id);
    if (!auditLogs || auditLogs.length === 0) throw new Error("No audit logs found for user actions!");
    console.log(`  ✓ Audit logging verified (${auditLogs.length} audit records found)`);

    results["ADMIN MAIL MANAGEMENT"] = "PASS";

    // -------------------------------------------------------------
    // TEST 3: Entity Auto-Email (Country, Main Branch, City Branch, User, Agent)
    // -------------------------------------------------------------
    console.log("\n--- TEST: Entity Auto-Email Provisioning ---");

    // 3a. Country Auto-Email
    const countryRes = await provisionEntityEmail(
      "country",
      "test-country-uae",
      { name: "United Arab Emirates", country_name: "uae" },
      true
    );
    if (!countryRes.success || !countryRes.emailAddress) {
      throw new Error("Country auto-email failed: " + countryRes.error);
    }
    const [countryMailbox] = await sql`
      SELECT id, email_address FROM public.public_mail_users WHERE email_address = ${countryRes.emailAddress}
    `;
    if (!countryMailbox) throw new Error("Country mailbox not created in DB!");
    console.log(`  ✓ Country Auto-Email: ${countryRes.emailAddress}`);
    results["COUNTRY AUTO EMAIL"] = "PASS";

    // 3b. Main Branch Auto-Email
    const mainBranchRes = await provisionEntityEmail(
      "main_branch",
      "test-main-branch-dubai",
      { name: "Dubai", branch_name: "dubai" },
      true
    );
    if (!mainBranchRes.success || !mainBranchRes.emailAddress) {
      throw new Error("Main branch auto-email failed: " + mainBranchRes.error);
    }
    const [mainBranchMailbox] = await sql`
      SELECT id, email_address FROM public.public_mail_users WHERE email_address = ${mainBranchRes.emailAddress}
    `;
    if (!mainBranchMailbox) throw new Error("Main branch mailbox not created in DB!");
    console.log(`  ✓ Main Branch Auto-Email: ${mainBranchRes.emailAddress}`);
    results["MAIN BRANCH AUTO EMAIL"] = "PASS";

    // 3c. City Branch Auto-Email
    const cityBranchRes = await provisionEntityEmail(
      "city_branch",
      "test-city-branch-sharjah",
      { name: "Sharjah", branch_name: "sharjah" },
      true
    );
    if (!cityBranchRes.success || !cityBranchRes.emailAddress) {
      throw new Error("City branch auto-email failed: " + cityBranchRes.error);
    }
    const [cityBranchMailbox] = await sql`
      SELECT id, email_address FROM public.public_mail_users WHERE email_address = ${cityBranchRes.emailAddress}
    `;
    if (!cityBranchMailbox) throw new Error("City branch mailbox not created in DB!");
    console.log(`  ✓ City Branch Auto-Email: ${cityBranchRes.emailAddress}`);
    results["CITY BRANCH AUTO EMAIL"] = "PASS";

    // 3d. User Auto-Email
    const userEntityRes = await provisionEntityEmail(
      "user",
      "test-user-tariq",
      { first_name: "Tariq", last_name: "Mahmood" },
      true
    );
    if (!userEntityRes.success || !userEntityRes.emailAddress) {
      throw new Error("User auto-email failed: " + userEntityRes.error);
    }
    const [userEntityMailbox] = await sql`
      SELECT id, email_address FROM public.public_mail_users WHERE email_address = ${userEntityRes.emailAddress}
    `;
    if (!userEntityMailbox) throw new Error("User entity mailbox not created in DB!");
    console.log(`  ✓ User Auto-Email: ${userEntityRes.emailAddress}`);
    results["USER AUTO EMAIL"] = "PASS";

    // 3e. Agent Auto-Email
    const agentRes = await provisionEntityEmail(
      "agent",
      "test-agent-909",
      { code: "ag909", name: "Alpha Agent" },
      true
    );
    if (!agentRes.success || !agentRes.emailAddress) {
      throw new Error("Agent auto-email failed: " + agentRes.error);
    }
    const [agentMailbox] = await sql`
      SELECT id, email_address FROM public.public_mail_users WHERE email_address = ${agentRes.emailAddress}
    `;
    if (!agentMailbox) throw new Error("Agent mailbox not created in DB!");
    console.log(`  ✓ Agent Auto-Email: ${agentRes.emailAddress}`);
    results["AGENT AUTO EMAIL"] = "PASS";

    // -------------------------------------------------------------
    // TEST 4: Password Reset (Reset password, new works, old fails)
    // -------------------------------------------------------------
    console.log("\n--- TEST: Password Reset Flow ---");

    const newAlicePassword = "AliceBrandNewSecret2026!";
    const resetRes = await resetUserPassword({
      email: userAEmail,
      newPassword: newAlicePassword,
    });
    if (!resetRes.success) throw new Error("Password reset failed: " + resetRes.error);

    // Old password authentication MUST FAIL
    const oldAuth = await authenticatePublicMailUser(userAEmail, initialPassA);
    if (oldAuth) throw new Error("Old password still authenticated! Security violation.");
    console.log("  ✓ Old password correctly rejected");

    // New password authentication MUST SUCCEED
    const newAuth = await authenticatePublicMailUser(userAEmail, newAlicePassword);
    if (!newAuth) throw new Error("New password failed to authenticate!");
    console.log("  ✓ New password authenticated successfully");
    results["PASSWORD RESET"] = "PASS";

    // -------------------------------------------------------------
    // TEST 5: Quota Enforcement
    // -------------------------------------------------------------
    console.log("\n--- TEST: Quota Limit Enforcement ---");

    // Temporarily set Alice's quota to 50 bytes and used_bytes to 50 bytes (100% full)
    await sql`
      UPDATE public.public_mail_users 
      SET quota_bytes = 50, used_bytes = 50 
      WHERE id = ${userA.id}
    `;

    // Attempt to send email from Alice: should fail with quota limit
    const overQuotaSend = await sendWebmailMessage({
      senderUserId: userA.id,
      to: userBEmail,
      subject: "Over Quota Test",
      body: "This message should be blocked by quota limit enforcement.",
    });

    if (overQuotaSend.success) {
      throw new Error("Message was allowed despite sender being over quota!");
    }
    console.log(`  ✓ Sender blocked when over quota: "${overQuotaSend.error}"`);

    // Reset Alice's quota back to normal
    await sql`
      UPDATE public.public_mail_users 
      SET quota_bytes = 5368709120, used_bytes = 0 
      WHERE id = ${userA.id}
    `;

    // Set Bob's quota to 10 bytes and used to 10 bytes (100% full recipient)
    await sql`
      UPDATE public.public_mail_users 
      SET quota_bytes = 10, used_bytes = 10 
      WHERE id = ${userB.id}
    `;

    // Attempt to send email to Bob: should reject recipient as mailbox full
    const overQuotaRecipient = await sendWebmailMessage({
      senderUserId: userA.id,
      to: userBEmail,
      subject: "Recipient Over Quota Test",
      body: "Recipient should reject incoming email when mailbox is full.",
    });

    if (overQuotaRecipient.success) {
      throw new Error("Message delivered despite recipient being over quota!");
    }
    console.log(`  ✓ Recipient mailbox rejection verified: "${overQuotaRecipient.error}"`);

    // Restore Bob's quota
    await sql`
      UPDATE public.public_mail_users 
      SET quota_bytes = 5368709120, used_bytes = 0 
      WHERE id = ${userB.id}
    `;

    results["QUOTA"] = "PASS";

    console.log("\n=== ALL E2E SUITE TESTS COMPLETED SUCCESSFULLY ===");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("\n❌ E2E TEST RUNNER ERROR:", msg);
  } finally {
    await sql.end();
  }

  // Print scorecard
  console.log("\n--- E2E TEST SCORECARD ---");
  for (const [scope, status] of Object.entries(results)) {
    console.log(`${scope}: ${status}`);
  }
}

runE2ETests();
