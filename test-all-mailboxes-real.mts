import { createClient } from "@supabase/supabase-js";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import * as crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "dgt_default_secret_encryption_key_32_bytes";

function decrypt(text: string): string {
  if (!text) return "";
  try {
    const parts = text.split(":");
    const ivHex = parts.shift();
    if (!ivHex) return "";
    const iv = Buffer.from(ivHex, "hex");
    const encryptedText = Buffer.from(parts.join(":"), "hex");
    const key = Buffer.concat([Buffer.from(ENCRYPTION_KEY), Buffer.alloc(32)], 32);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    return "";
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface TestResult {
  email: string;
  password: string;
  imap: boolean;
  imapError?: string;
  smtp: boolean;
  smtpError?: string;
  overall: "PASS" | "FAIL";
}

async function testMailbox(email: string, password: string): Promise<TestResult> {
  const result: TestResult = {
    email,
    password,
    imap: false,
    smtp: false,
    overall: "FAIL"
  };

  // Test IMAP
  try {
    console.log(`  [IMAP] Testing ${email}...`);
    const imap = new ImapFlow({
      host: "imap.titan.email",
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      logger: false,
    });
    await imap.connect();
    await imap.logout();
    result.imap = true;
    console.log(`  [IMAP] ✓ Success`);
  } catch (err: any) {
    result.imapError = err.message;
    console.log(`  [IMAP] ✗ Failed: ${err.message}`);
  }

  // Test SMTP
  try {
    console.log(`  [SMTP] Testing ${email}...`);
    const transporter = nodemailer.createTransport({
      host: "smtp.titan.email",
      port: 465,
      secure: true,
      auth: { user: email, pass: password },
      logger: false,
    });
    await transporter.verify();
    result.smtp = true;
    console.log(`  [SMTP] ✓ Success`);
  } catch (err: any) {
    result.smtpError = err.message;
    console.log(`  [SMTP] ✗ Failed: ${err.message}`);
  }

  result.overall = result.imap && result.smtp ? "PASS" : "FAIL";
  return result;
}

async function main() {
  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║     LIVE EMAIL SYSTEM COMPREHENSIVE DIAGNOSTIC TEST       ║");
  console.log("║        Testing ALL 5 Canonical Mailboxes - REAL ONLY      ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  // Get all 5 mailboxes from database
  const { data: allAccounts, error: dbError } = await supabase
    .from("erp_email_accounts")
    .select("email_address, imap_password_encrypted, last_connection_status")
    .in("email_address", [
      "dgtllc@dgt.llc",
      "dubai@dgt.llc",
      "chaman@dgt.llc",
      "quetta@dgt.llc",
      "kandahar@dgt.llc"
    ])
    .order("email_address");

  if (dbError || !allAccounts) {
    console.error("❌ Database Error:", dbError);
    return;
  }

  console.log("📊 MAILBOX DATABASE STATUS:");
  allAccounts.forEach(acc => {
    const pwd = decrypt(acc.imap_password_encrypted);
    console.log(`  ${acc.email_address}`);
    console.log(`    - Status in DB: ${acc.last_connection_status}`);
    console.log(`    - Password decryptable: ${pwd ? "YES" : "NO"}`);
    console.log(`    - Password length: ${pwd.length || 0}`);
  });

  console.log("\n📧 TESTING IMAP/SMTP AGAINST REAL HOSTINGER SERVERS:\n");

  const results: TestResult[] = [];

  for (const acc of allAccounts) {
    const pwd = decrypt(acc.imap_password_encrypted);

    if (!pwd) {
      console.log(`\n❌ ${acc.email_address}: Cannot decrypt password from database`);
      results.push({
        email: acc.email_address,
        password: "(decrypt failed)",
        imap: false,
        imapError: "Decryption failed",
        smtp: false,
        smtpError: "Decryption failed",
        overall: "FAIL"
      });
      continue;
    }

    console.log(`\n🔍 ${acc.email_address}`);
    const testResult = await testMailbox(acc.email_address, pwd);
    results.push(testResult);
  }

  // Summary Report
  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║                    FINAL TEST RESULTS                     ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  const table = results.map(r => ({
    "Email": r.email,
    "IMAP": r.imap ? "✓ PASS" : `✗ FAIL`,
    "SMTP": r.smtp ? "✓ PASS" : `✗ FAIL`,
    "Overall": r.overall,
    "Issue": r.imapError ? `IMAP: ${r.imapError.substring(0, 40)}` : (r.smtpError ? `SMTP: ${r.smtpError.substring(0, 40)}` : "OK")
  }));

  console.table(table);

  const allPass = results.every(r => r.overall === "PASS");
  const failedMailboxes = results.filter(r => r.overall === "FAIL");

  console.log("\n📋 SUMMARY:");
  console.log(`  Total Tested: ${results.length}`);
  console.log(`  Passed: ${results.filter(r => r.overall === "PASS").length}`);
  console.log(`  Failed: ${failedMailboxes.length}`);

  if (failedMailboxes.length > 0) {
    console.log("\n⚠️  FAILED MAILBOXES:");
    failedMailboxes.forEach(r => {
      console.log(`\n  ${r.email}:`);
      if (r.imapError) console.log(`    IMAP Error: ${r.imapError}`);
      if (r.smtpError) console.log(`    SMTP Error: ${r.smtpError}`);
      console.log(`    → Database password does NOT match Hostinger`);
      console.log(`    → ACTION: Verify real password in Hostinger, update ERP`);
    });
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(allPass ? "✅ ALL MAILBOXES AUTHENTICATED SUCCESSFULLY" : "❌ SOME MAILBOXES FAILED - CREDENTIALS MISMATCH");
  console.log("═══════════════════════════════════════════════════════════\n");

  process.exit(allPass ? 0 : 1);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
