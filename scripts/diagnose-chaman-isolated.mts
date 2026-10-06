/**
 * Isolated Chaman@ Diagnostic
 *
 * Runs in isolation from other mailbox tests
 * Tests connection state, TLS, IMAP auth, connection pooling
 * Determines root cause of connection timeout
 */

import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

const testEmail = "chaman@dgt.llc";
const testPassword = "Chaman@9191";

async function diagnose() {
  console.log("🔍 ISOLATED CHAMAN@ DIAGNOSIS");
  console.log("=".repeat(70));
  console.log(`Email: ${testEmail}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  // Test 1: DNS
  console.log("1️⃣ DNS RESOLUTION");
  try {
    const { resolve4 } = await import("dns/promises");
    const ip = await resolve4("imap.titan.email");
    console.log(`   ✅ imap.titan.email → ${ip[0]}`);
  } catch (err) {
    console.log(`   ❌ DNS FAILED: ${err instanceof Error ? err.message : "Unknown"}`);
    return;
  }

  // Test 2: Raw TCP Connection
  console.log("\n2️⃣ RAW TCP CONNECTION (port 993)");
  try {
    const net = await import("net");
    const socket = net.createConnection({ host: "imap.titan.email", port: 993 });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error("TCP connect timeout"));
      }, 15000);

      socket.on("connect", () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve(null);
      });

      socket.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    console.log(`   ✅ TCP connection succeeded`);
  } catch (err) {
    console.log(`   ❌ TCP FAILED: ${err instanceof Error ? err.message : "Unknown"}`);
    console.log(`   Root cause: Network/firewall issue (not credentials)`);
    return;
  }

  // Test 3: TLS Handshake with extended timeout
  console.log("\n3️⃣ TLS HANDSHAKE (60s timeout)");
  try {
    const client = new ImapFlow({
      host: "imap.titan.email",
      port: 993,
      secure: true,
      auth: { user: testEmail, pass: testPassword },
      logger: false,
      socketTimeout: 60000,
      connectionTimeout: 60000
    });

    const start = Date.now();
    await client.connect();
    const duration = Date.now() - start;

    console.log(`   ✅ TLS succeeded in ${duration}ms`);
    console.log(`   Server capabilities: ${(client.capabilities || []).join(", ")}`);

    // Test 4: IMAP Commands
    console.log("\n4️⃣ IMAP COMMANDS");

    try {
      const list = await client.list();
      console.log(`   ✅ LIST: Found ${list.length} folders`);
      for (const box of list) {
        console.log(`      "${box.name}"`);
      }
    } catch (err) {
      console.log(`   ❌ LIST failed: ${err instanceof Error ? err.message : "Unknown"}`);
    }

    try {
      await client.mailboxOpen("INBOX");
      console.log(`   ✅ INBOX OPEN: mailbox status ok`);
      await client.mailboxClose();
    } catch (err) {
      console.log(`   ❌ INBOX OPEN failed: ${err instanceof Error ? err.message : "Unknown"}`);
    }

    // Test 5: SMTP
    console.log("\n5️⃣ SMTP AUTH (port 587)");
    try {
      const transporter = nodemailer.createTransport({
        host: "smtp.titan.email",
        port: 587,
        secure: false,
        auth: { user: testEmail, pass: testPassword },
        connectionTimeout: 15000,
        socketTimeout: 15000
      });

      await transporter.verify();
      console.log(`   ✅ SMTP verified`);
    } catch (err) {
      console.log(`   ⚠️ SMTP issue: ${err instanceof Error ? err.message : "Unknown"}`);
    }

    // Logout
    await client.logout();

    console.log("\n✅ CHAMAN@ MAILBOX OPERATIONAL");

    // Test 6: Retry test (connection pooling)
    console.log("\n6️⃣ CONNECTION RETRY TEST (test pool exhaustion)");
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const retryClient = new ImapFlow({
          host: "imap.titan.email",
          port: 993,
          secure: true,
          auth: { user: testEmail, pass: testPassword },
          logger: false,
          socketTimeout: 30000
        });

        await retryClient.connect();
        await retryClient.logout();
        console.log(`   ✅ Attempt ${attempt}: Connected successfully`);
      } catch (err) {
        console.log(`   ❌ Attempt ${attempt}: ${err instanceof Error ? err.message : "Unknown"}`);
      }
    }

  } catch (err) {
    if (err instanceof Error) {
      console.log(`   ❌ IMAP CONNECTION FAILED`);
      console.log(`   Error: ${err.message}`);
      console.log(`   Code: ${(err as any).code || "N/A"}`);

      if (err.message.includes("timeout") || (err as any).code === "ETIMEOUT") {
        console.log(`\n   ROOT CAUSE: TLS Socket Timeout`);
        console.log(`   - Not an authentication failure`);
        console.log(`   - Likely: provider throttling, rate limiting, or IP block`);
        console.log(`   - Action: Check Titan account status, verify IP is not blocked`);
      } else if (err.message.includes("AUTH") || (err as any).code === "535") {
        console.log(`\n   ROOT CAUSE: IMAP Authentication Failed`);
        console.log(`   - Credentials may be incorrect`);
        console.log(`   - Action: Verify password on Titan portal`);
      }
    }
  }
}

diagnose().catch(console.error);
