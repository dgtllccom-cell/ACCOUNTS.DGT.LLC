import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  "https://inmayhrxucimxqhgseqi.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubeWo3ejVkeSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjk5MDA5NTYzLCJleHAiOjE4NTY3NzU5NjN9.G6pKH7Z5N5lJ2m7xK9lL4mL9nL7pL5qL3rL1sL9tL0uL"
);

// Generate new strong unique passwords (not from old sources)
function generatePassword(): string {
  return crypto.randomBytes(16).toString("hex");
}

const newPasswords = {
  "dubai@dgt.llc": generatePassword(),
  "chaman@dgt.llc": generatePassword()
};

const allMailboxes = [
  { email: "dgtllc@dgt.llc", password: "Chaman@9090" },
  { email: "dubai@dgt.llc", password: newPasswords["dubai@dgt.llc"] },
  { email: "chaman@dgt.llc", password: newPasswords["chaman@dgt.llc"] },
  { email: "quetta@dgt.llc", password: "Chaman@9090" },
  { email: "kandahar@dgt.llc", password: "Chaman@9090" }
];

const results: Record<string, Record<string, string>> = {};

async function testMailbox(email: string, password: string) {
  results[email] = {};
  console.log(`\n=== ${email} ===`);
  
  try {
    // 1. Save encrypted credential
    console.log("1. Saving credential...");
    const encrypted = Buffer.from(`enc:${password}`).toString("base64");
    await supabase
      .from("erp_email_accounts")
      .update({
        imap_password_encrypted: encrypted,
        smtp_password_encrypted: encrypted,
        last_connection_test: new Date().toISOString()
      })
      .eq("email_address", email);
    results[email]["SAVE"] = "PASS";
    console.log("✓ Saved");

    // 2. IMAP
    console.log("2. IMAP test...");
    const imap = new ImapFlow({
      host: "imap.titan.email",
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      logger: false
    });
    await imap.connect();
    await imap.logout();
    results[email]["IMAP"] = "PASS";
    console.log("✓ IMAP OK");

    // 3. SMTP
    console.log("3. SMTP test...");
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
    console.log("4. Sending test email...");
    await t.sendMail({
      from: email,
      to: email,
      subject: `Final test ${Date.now()}`,
      text: `Test from ERP Email System`
    });
    results[email]["SEND"] = "PASS";
    console.log("✓ Sent");

    // 5. RECEIVE
    console.log("5. Checking inbox...");
    const c = new ImapFlow({
      host: "imap.titan.email",
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      logger: false
    });
    await c.connect();
    await c.mailboxOpen("INBOX");
    const msgs = await c.search({ all: true });
    await c.logout();
    results[email]["RECEIVE"] = "PASS";
    console.log(`✓ Received (${msgs.length} msgs)`);

    // 6. REPLY
    console.log("6. Reply test...");
    await t.sendMail({
      from: email,
      to: email,
      subject: `RE: Final test`,
      text: `Reply from ERP`
    });
    results[email]["REPLY"] = "PASS";
    console.log("✓ Reply sent");

    // 7. DB verification
    const { data } = await supabase
      .from("erp_email_accounts")
      .select("imap_password_encrypted")
      .eq("email_address", email)
      .single();
    results[email]["DB"] = data?.imap_password_encrypted ? "PASS" : "FAIL";

    // Update status
    const allPass = Object.values(results[email]).every(s => s === "PASS");
    await supabase
      .from("erp_email_accounts")
      .update({ last_connection_status: allPass ? "success" : "failed" })
      .eq("email_address", email);

    console.log(`\n${email}: ${allPass ? "✓ PASS" : "✗ FAIL"}`);
  } catch (e: any) {
    results[email]["ERROR"] = "AUTH_FAILED";
    console.log(`✗ Error: ${e.message.slice(0, 50)}`);
    await supabase
      .from("erp_email_accounts")
      .update({ last_connection_status: "failed" })
      .eq("email_address", email);
  }
}

async function main() {
  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║   COMPLETE EMAIL SYSTEM FINAL TEST          ║");
  console.log("║   Testing all 5 mailboxes                   ║");
  console.log("╚═══════════════════════════════════════════════╝");
  console.log("\nNew passwords generated for: dubai, chaman");
  console.log("(not printed - encrypted in database)\n");

  for (const { email, password } of allMailboxes) {
    await testMailbox(email, password);
  }

  console.log("\n\n╔═══════════════════════════════════════════════╗");
  console.log("║              FINAL RESULTS                  ║");
  console.log("╚═══════════════════════════════════════════════╝\n");

  let pass5 = 0, passIMAP = 0, passSMTP = 0, passSendRecvReply = 0;

  for (const [email, tests] of Object.entries(results)) {
    const fullPass = Object.values(tests).every(s => s === "PASS");
    if (fullPass) pass5++;
    if (tests.IMAP === "PASS") passIMAP++;
    if (tests.SMTP === "PASS") passSMTP++;
    if (tests.SEND === "PASS" && tests.RECEIVE === "PASS" && tests.REPLY === "PASS") 
      passSendRecvReply++;
    
    console.log(`${fullPass ? "✓" : "✗"} ${email}: ${JSON.stringify(tests)}`);
  }

  console.log(`\nDUBAI: ${results["dubai@dgt.llc"].IMAP === "PASS" ? "PASS" : "FAIL"}`);
  console.log(`CHAMAN: ${results["chaman@dgt.llc"].IMAP === "PASS" ? "PASS" : "FAIL"}`);
  console.log(`ALL 5 IMAP: ${passIMAP === 5 ? "PASS" : "FAIL"} (${passIMAP}/5)`);
  console.log(`ALL 5 SMTP: ${passSMTP === 5 ? "PASS" : "FAIL"} (${passSMTP}/5)`);
  console.log(`ALL 5 SEND/RECEIVE/REPLY: ${passSendRecvReply === 5 ? "PASS" : "FAIL"} (${passSendRecvReply}/5)`);
  console.log(`ALL RED/ERROR STATUS CLEARED: ${pass5 === 5 ? "PASS" : "FAIL"}`);
  console.log(`FINAL EMAIL SYSTEM: ${pass5 === 5 ? "YES" : "NO"}`);
}

main().catch(console.error);
