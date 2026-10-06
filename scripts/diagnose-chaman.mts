/**
 * Diagnose chaman@ mailbox connection failure
 */

import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

const testEmail = "chaman@dgt.llc";
const testPassword = "Chaman@9191";

async function diagnose() {
  console.log("🔍 DIAGNOSING CHAMAN@ MAILBOX");
  console.log("========================================");
  console.log(`Email: ${testEmail}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  // Test 1: DNS/Network connectivity
  console.log("1️⃣ DNS RESOLUTION");
  try {
    const { resolve4 } = await import("dns/promises");
    const ip = await resolve4("imap.titan.email");
    console.log(`   ✅ imap.titan.email resolves to ${ip[0]}`);
  } catch (err) {
    console.log(`   ❌ DNS failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    return;
  }

  // Test 2: TLS Connection
  console.log("\n2️⃣ TLS CONNECTION (port 993)");
  try {
    const client = new ImapFlow({
      host: "imap.titan.email",
      port: 993,
      secure: true,
      auth: { user: testEmail, pass: testPassword },
      logger: false,
      socketTimeout: 30000
    });

    const start = Date.now();
    await client.connect();
    const duration = Date.now() - start;
    console.log(`   ✅ Connected in ${duration}ms`);

    // Test 3: CAPABILITY
    console.log("\n3️⃣ SERVER CAPABILITIES");
    const capabilities = client.capabilities || [];
    console.log(`   ${capabilities.join(", ")}`);

    // Test 4: Folder List
    console.log("\n4️⃣ FOLDER STRUCTURE");
    const list = await client.list();
    for (const box of list) {
      console.log(`   "${box.name}"`);
    }

    // Test 5: INBOX Access
    console.log("\n5️⃣ INBOX ACCESS");
    try {
      await client.mailboxOpen("INBOX");
      const status = client.mailbox;
      console.log(`   ✅ Opened INBOX`);
      console.log(`   Messages: ${status?.exists || 0}`);
      console.log(`   Unseen: ${status?.unseen || 0}`);
      await client.mailboxClose();
    } catch (err) {
      console.log(`   ❌ Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }

    // Test 6: SMTP Connection
    console.log("\n6️⃣ SMTP AUTH (port 587)");
    try {
      const transporter = nodemailer.createTransport({
        host: "smtp.titan.email",
        port: 587,
        secure: false,
        auth: { user: testEmail, pass: testPassword },
        connectionTimeout: 10000,
        socketTimeout: 10000
      });

      await transporter.verify();
      console.log(`   ✅ SMTP authenticated`);
    } catch (err) {
      console.log(`   ❌ SMTP failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }

    await client.logout();
    console.log("\n✅ CHAMAN@ MAILBOX OPERATIONAL");

  } catch (err) {
    if (err instanceof Error) {
      console.log(`   ❌ Connection failed`);
      console.log(`   Error type: ${err.name}`);
      console.log(`   Message: ${err.message}`);
      if ("code" in err) {
        console.log(`   Code: ${err.code}`);
      }
    } else {
      console.log(`   ❌ Unknown error`);
    }
  }
}

diagnose().catch(console.error);
