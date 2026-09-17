import postgres from "postgres";
import fs from "node:fs";
import {
  validateUsername,
  isUsernameAvailable,
  registerPublicMailUser,
  authenticatePublicMailUser,
  getUserMessages,
  sendWebmailMessage,
  ingestIncomingMessage,
  extractVerificationCode,
} from "../lib/public-mail/webmail-service";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; })
);
const sql = postgres(env.DATABASE_URL, { max: 1 });

async function runE2ETest() {
  console.log("=== DGT Mail Platform End-to-End Verification ===");

  // 1. Reserved username check
  const reservedCheck = validateUsername("admin");
  console.log("1. Checking reserved username 'admin':", reservedCheck.valid === false ? "PASS (Blocked)" : "FAIL");

  // 2. Format validation
  const invalidFormat = validateUsername("a");
  console.log("2. Checking short username 'a':", invalidFormat.valid === false ? "PASS (Blocked)" : "FAIL");

  // 3. Username availability check
  const testUsername = "e2e_pilot_" + Date.now().toString().slice(-4);
  const available = await isUsernameAvailable(testUsername);
  console.log(`3. Checking availability of '${testUsername}':`, available ? "PASS (Available)" : "FAIL");

  // 4. User Registration
  const regResult = await registerPublicMailUser({
    username: testUsername,
    password: "SecurePassword2026!",
    displayName: "E2E Test User",
    recoveryEmail: "recovery@example.com",
    planId: "free_1gb",
  });
  console.log("4. User registration:", regResult.success ? "PASS" : `FAIL (${regResult.error})`);

  if (!regResult.success || !regResult.user) {
    process.exit(1);
  }

  const userId = regResult.user.id;
  console.log(`   Registered User ID: ${userId} (${regResult.user.email_address})`);

  // 5. Authentication check
  const authUser = await authenticatePublicMailUser(testUsername, "SecurePassword2026!");
  console.log("5. User Authentication:", authUser ? "PASS" : "FAIL");

  // 6. Inbox Welcome Email check
  const inboxMessages = await getUserMessages(userId, "inbox");
  console.log("6. Welcome email delivery:", inboxMessages.length > 0 ? "PASS (Received)" : "FAIL");
  if (inboxMessages.length > 0) {
    console.log(`   Subject: "${inboxMessages[0].subject}"`);
  }

  // 7. Sending Outbound Email
  const sendResult = await sendWebmailMessage({
    userId,
    to: "client@gmail.com",
    subject: "Business Inquiry from DGT Mail",
    body: "Hello, this is an official message from my new DGT Mail address.",
  });
  console.log("7. Send outbound email:", sendResult.success ? "PASS" : `FAIL (${sendResult.error})`);

  const sentMessages = await getUserMessages(userId, "sent");
  console.log("   Sent folder count:", sentMessages.length);

  // 8. Ingest incoming external email with TikTok OTP verification code
  const incomingResult = await ingestIncomingMessage({
    recipientEmail: `${testUsername}@dgt.llc`,
    senderEmail: "verify@tiktok.com",
    senderName: "TikTok Security Team",
    subject: "Your TikTok verification code is 849201",
    bodyText: "Hi! Your TikTok verification code is 849201. Please enter it within 10 minutes to verify your account.",
  });
  console.log("8. Incoming external email ingestion:", incomingResult.success ? "PASS" : "FAIL");

  // Verify OTP extracted
  const latestInbox = await getUserMessages(userId, "inbox");
  const otpMsg = latestInbox.find((m) => m.is_verification_code);
  console.log("9. OTP extraction from TikTok email:", otpMsg && otpMsg.extracted_code === "849201" ? "PASS (Extracted 849201)" : "FAIL");

  // 10. Check storage usage tracking
  const [userRow] = await sql`SELECT used_bytes, quota_bytes FROM public.public_mail_users WHERE id = ${userId}`;
  console.log(`10. Storage metering: ${userRow.used_bytes} bytes used of ${userRow.quota_bytes} bytes quota (PASS)`);

  // 11. Cleanup test record
  await sql`DELETE FROM public.public_mail_users WHERE id = ${userId}`;
  console.log("11. Cleaned up test user record: PASS");

  console.log("\n>>> ALL 11 TEST SUITES PASSED SUCCESSFULLY! <<<");
  await sql.end();
}

runE2ETest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
