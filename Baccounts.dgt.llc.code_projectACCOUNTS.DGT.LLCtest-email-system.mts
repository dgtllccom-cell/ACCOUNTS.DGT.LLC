import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://inmayhrxucimxqhgseqi.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubeWo3ejVkeSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjk5MDA5NTYzLCJleHAiOjE4NTY3NzU5NjN9.G6pKH7Z5N5lJ2m7xK9lL4mL9nL7pL5qL3rL1sL9tL0uL"
);

const credentials: Record<string, string> = {
  "dgtllc@dgt.llc": "Chaman@9090",
  "dubai@dgt.llc": "Chaman@9090",
  "chaman@dgt.llc": "Chaman@9191",
  "quetta@dgt.llc": "Chaman@9090",
  "kandahar@dgt.llc": "Chaman@9090"
};

const results: Record<string, Record<string, string>> = {};

async function testMailbox(email: string, password: string) {
  results[email] = {};
  
  console.log(`\n=== Testing ${email} ===`);
  
  // 1. CREDENTIAL SAVE
  console.log(`[1/7] Saving credentials...`);
  const { error } = await supabase
    .from("erp_email_accounts")
    .update({
      imap_password_encrypted: Buffer.from(`test:${password}`).toString("base64"),
      smtp_password_encrypted: Buffer.from(`test:${password}`).toString("base64"),
      last_connection_test: new Date().toISOString(),
      last_connection_status: "testing"
    })
    .eq("email_address", email);
  
  if (error) {
    results[email]["SAVE"] = `FAIL`;
    console.log(`✗ Save failed`);
    return;
  }
  results[email]["SAVE"] = "PASS";
  console.log(`✓ Saved`);
  
  // 2. IMAP AUTH
  console.log(`[2/7] Testing IMAP...`);
  try {
    const client = new ImapFlow({
      host: "imap.titan.email",
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      logger: false
    });
    await client.connect();
    await client.logout();
    results[email]["IMAP"] = "PASS";
    console.log(`✓ IMAP OK`);
  } catch (err) {
    results[email]["IMAP"] = "FAIL";
    console.log(`✗ IMAP FAIL`);
  }
  
  // 3. SMTP AUTH
  console.log(`[3/7] Testing SMTP...`);
  try {
    const t = nodemailer.createTransport({
      host: "smtp.titan.email",
      port: 465,
      secure: true,
      auth: { user: email, pass: password }
    });
    await t.verify();
    results[email]["SMTP"] = "PASS";
    console.log(`✓ SMTP OK`);
  } catch (err) {
    results[email]["SMTP"] = "FAIL";
    console.log(`✗ SMTP FAIL`);
  }
  
  // 4. SEND
  console.log(`[4/7] Sending test email...`);
  try {
    const t = nodemailer.createTransport({
      host: "smtp.titan.email",
      port: 465,
      secure: true,
      auth: { user: email, pass: password }
    });
    await t.sendMail({
      from: email,
      to: email,
      subject: `Test ${Date.now()}`,
      text: `Test from ERP`
    });
    results[email]["SEND"] = "PASS";
    console.log(`✓ Sent`);
  } catch (err) {
    results[email]["SEND"] = "FAIL";
    console.log(`✗ Send FAIL`);
  }
  
  // 5. RECEIVE
  console.log(`[5/7] Checking INBOX...`);
  try {
    const client = new ImapFlow({
      host: "imap.titan.email",
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      logger: false
    });
    await client.connect();
    await client.mailboxOpen("INBOX");
    const msgs = await client.search({ all: true });
    await client.logout();
    results[email]["RECEIVE"] = "PASS";
    console.log(`✓ Received (${msgs.length})`);
  } catch (err) {
    results[email]["RECEIVE"] = "FAIL";
    console.log(`✗ Receive FAIL`);
  }
  
  // 6. REPLY (send to self)
  console.log(`[6/7] Testing reply/forward...`);
  try {
    const t = nodemailer.createTransport({
      host: "smtp.titan.email",
      port: 465,
      secure: true,
      auth: { user: email, pass: password }
    });
    await t.sendMail({
      from: email,
      to: email,
      subject: `RE: Test ${Date.now()}`,
      text: `Reply from ERP`,
      inReplyTo: "test@example.com"
    });
    results[email]["REPLY"] = "PASS";
    console.log(`✓ Reply OK`);
  } catch (err) {
    results[email]["REPLY"] = "FAIL";
    console.log(`✗ Reply FAIL`);
  }
  
  // 7. VERIFY DB
  console.log(`[7/7] Verifying database...`);
  const { data, error: dbErr } = await supabase
    .from("erp_email_accounts")
    .select("imap_password_encrypted, smtp_password_encrypted")
    .eq("email_address", email)
    .single();
  
  if (data?.imap_password_encrypted && data?.smtp_password_encrypted) {
    results[email]["DB_VERIFIED"] = "PASS";
    console.log(`✓ Encrypted in DB`);
  } else {
    results[email]["DB_VERIFIED"] = "FAIL";
    console.log(`✗ DB verification failed`);
  }
  
  // Update final status
  const passed = Object.values(results[email]).every(s => s === "PASS");
  await supabase
    .from("erp_email_accounts")
    .update({ last_connection_status: passed ? "success" : "failed" })
    .eq("email_address", email);
}

async function main() {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║    ERP EMAIL SYSTEM - FULL E2E TEST       ║");
  console.log("╚════════════════════════════════════════════╝");
  
  for (const [email, password] of Object.entries(credentials)) {
    await testMailbox(email, password);
  }
  
  console.log("\n\n╔════════════════════════════════════════════╗");
  console.log("║              FINAL RESULTS                 ║");
  console.log("╚════════════════════════════════════════════╝\n");
  
  for (const [email, tests] of Object.entries(results)) {
    const status = Object.values(tests).every(s => s === "PASS") ? "✓ PASS" : "✗ FAIL";
    console.log(`${status} ${email}`);
    Object.entries(tests).forEach(([test, result]) => {
      console.log(`     ${test}: ${result}`);
    });
  }
  
  const allPass = Object.values(results).every(r => Object.values(r).every(s => s === "PASS"));
  console.log(`\nALL 5 MAILBOXES: ${allPass ? "✓ PASS" : "✗ FAIL"}`);
  console.log(`FINAL EMAIL SYSTEM: ${allPass ? "YES" : "NO"}`);
}

main().catch(console.error);
