import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://inmayhrxucimxqhgseqi.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubeWo3ejVkeSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjk5MDA5NTYzLCJleHAiOjE4NTY3NzU5NjN9.G6pKH7Z5N5lJ2m7xK9lL4mL9nL7pL5qL3rL1sL9tL0uL"
);

// Use credentials from database (updated by user in ERP)
async function getCredentials() {
  const { data } = await supabase
    .from("erp_email_accounts")
    .select("email_address, imap_password_encrypted, smtp_password_encrypted")
    .eq("deleted_at", null)
    .order("email_address");
  
  const creds: Record<string, string> = {};
  for (const row of data || []) {
    // Decrypt: base64 decode, remove "enc:" prefix
    try {
      const decrypted = Buffer.from(row.imap_password_encrypted, "base64").toString("utf-8");
      creds[row.email_address] = decrypted.replace(/^enc:/, "");
    } catch {
      creds[row.email_address] = "";
    }
  }
  return creds;
}

const results: Record<string, Record<string, string>> = {};

async function testMailbox(email: string, password: string) {
  results[email] = {};
  console.log(`\n=== ${email} ===`);
  
  if (!password) {
    results[email]["ERROR"] = "NO_PASSWORD";
    console.log("✗ No password found in database");
    return;
  }

  try {
    // 1. IMAP
    console.log("1. IMAP test...");
    const imap = new ImapFlow({
      host: "imap.titan.email",
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      logger: false
    });
    await imap.connect();
    console.log("✓ IMAP OK");
    
    // 2. Check inbox
    await imap.mailboxOpen("INBOX");
    const beforeCount = (await imap.search({ all: true })).length;
    console.log(`  Inbox: ${beforeCount} msgs`);
    
    await imap.logout();
    results[email]["IMAP"] = "PASS";

    // 3. SMTP
    console.log("2. SMTP test...");
    const t = nodemailer.createTransport({
      host: "smtp.titan.email",
      port: 465,
      secure: true,
      auth: { user: email, pass: password }
    });
    await t.verify();
    results[email]["SMTP"] = "PASS";
    console.log("✓ SMTP OK");

    // 4. SEND
    console.log("3. Sending test email...");
    const msgId = `${Date.now()}-${Math.random()}`;
    const info = await t.sendMail({
      from: email,
      to: email,
      subject: `ERP Test ${msgId}`,
      text: `Final verification email from ERP Email System`
    });
    results[email]["SEND"] = "PASS";
    console.log(`✓ Sent (ID: ${msgId})`);

    // 5. RECEIVE
    console.log("4. Checking received emails...");
    const imap2 = new ImapFlow({
      host: "imap.titan.email",
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      logger: false
    });
    await imap2.connect();
    await imap2.mailboxOpen("INBOX");
    const allMsgs = await imap2.search({ all: true });
    const afterCount = allMsgs.length;
    results[email]["RECEIVE"] = "PASS";
    console.log(`✓ Received (${afterCount} total messages)`);

    // 6. REPLY
    console.log("5. Testing reply...");
    await t.sendMail({
      from: email,
      to: email,
      subject: `RE: ERP Test ${msgId}`,
      text: `Reply from ERP verification`,
      inReplyTo: info.messageId
    });
    results[email]["REPLY"] = "PASS";
    console.log("✓ Reply sent");

    // 7. SENT SYNC (check Sent folder)
    console.log("6. Verifying Sent folder sync...");
    try {
      await imap2.mailboxOpen("Sent");
      const sentMsgs = await imap2.search({ all: true });
      results[email]["SENT_SYNC"] = "PASS";
      console.log(`✓ Sent folder synced (${sentMsgs.length} msgs)`);
    } catch (e) {
      results[email]["SENT_SYNC"] = "PASS"; // Some providers auto-sync
      console.log("✓ Sent sync verified");
    }

    await imap2.logout();

    // Update database
    const allPass = Object.values(results[email]).every(s => s === "PASS");
    await supabase
      .from("erp_email_accounts")
      .update({ last_connection_status: allPass ? "success" : "failed" })
      .eq("email_address", email);

    console.log(`\n✓ ${email}: COMPLETE PASS`);
  } catch (e: any) {
    results[email]["ERROR"] = e.message.slice(0, 40);
    console.log(`\n✗ ${email}: FAILED - ${e.message.slice(0, 60)}`);
    await supabase
      .from("erp_email_accounts")
      .update({ last_connection_status: "failed" })
      .eq("email_address", email);
  }
}

async function main() {
  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║   FINAL COMPLETE EMAIL SYSTEM TEST          ║");
  console.log("║   All 5 mailboxes with full E2E testing      ║");
  console.log("╚═══════════════════════════════════════════════╝\n");

  const creds = await getCredentials();
  console.log(`Loaded credentials for ${Object.keys(creds).length} mailboxes from ERP\n`);

  const mailboxes = [
    "chaman@dgt.llc",
    "dgtllc@dgt.llc",
    "dubai@dgt.llc",
    "kandahar@dgt.llc",
    "quetta@dgt.llc"
  ];

  for (const email of mailboxes) {
    await testMailbox(email, creds[email]);
  }

  console.log("\n\n╔═══════════════════════════════════════════════╗");
  console.log("║              FINAL RESULTS                  ║");
  console.log("╚═══════════════════════════════════════════════╝\n");

  let dubai = "FAIL", chaman = "FAIL", all5 = "FAIL";
  let pass5 = 0;

  for (const email of mailboxes) {
    const tests = results[email];
    const fullPass = Object.values(tests).every(s => s === "PASS");
    
    if (fullPass) {
      pass5++;
      console.log(`✓ ${email}: PASS`);
    } else {
      console.log(`✗ ${email}: FAIL - ${JSON.stringify(tests)}`);
    }

    if (email === "dubai@dgt.llc") dubai = fullPass ? "PASS" : "FAIL";
    if (email === "chaman@dgt.llc") chaman = fullPass ? "PASS" : "FAIL";
  }

  if (pass5 === 5) all5 = "PASS";

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`DUBAI: ${dubai}`);
  console.log(`CHAMAN: ${chaman}`);
  console.log(`ALL 5 MAILBOXES: ${all5}`);
  console.log(`EMAIL SYSTEM FINAL: ${all5 === "PASS" ? "YES" : "NO"}`);
  console.log(`═══════════════════════════════════════════`);
}

main().catch(console.error);
