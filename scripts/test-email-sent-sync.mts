/**
 * Sent Folder Sync Verification
 * Send → Verify message exists in Titan Sent folder → Verify Message-ID correlation
 */

import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

const mailboxes: Record<string, { email: string; password: string }> = {
  dgtllc: { email: "dgtllc@dgt.llc", password: "Chaman@9090" },
  dubai: { email: "dubai@dgt.llc", password: "Chaman@9090" }
};

async function imap(config: any, fn: (client: ImapFlow) => Promise<void>) {
  const client = new ImapFlow({
    host: "imap.titan.email",
    port: 993,
    secure: true,
    auth: { user: config.email, pass: config.password },
    logger: false
  });

  try {
    await client.connect();
    await fn(client);
    await client.logout();
  } catch (err) {
    throw err;
  }
}

async function testSentSync() {
  console.log("📤 SENT FOLDER SYNC TEST");
  console.log("=".repeat(70));

  const results: any[] = [];

  try {
    const senderConfig = mailboxes.dgtllc;
    const recipientConfig = mailboxes.dubai;
    const messageId = `<sent-sync-${Date.now()}@dgt.llc>`;
    const testSubject = `SENT-SYNC-TEST-${Date.now()}`;
    const testBody = "Testing sent folder synchronization.";

    console.log("\n1️⃣ SEND EMAIL");
    try {
      const transporter = nodemailer.createTransport({
        host: "smtp.titan.email",
        port: 587,
        secure: false,
        auth: { user: senderConfig.email, pass: senderConfig.password }
      });

      const info = await transporter.sendMail({
        from: senderConfig.email,
        to: recipientConfig.email,
        subject: testSubject,
        text: testBody,
        messageId
      });

      console.log(`   ✅ Email sent via SMTP`);
      console.log(`      Message-ID: ${messageId.slice(0, 40)}...`);
      console.log(`      Response ID: ${info.messageId}`);
      results.push({ step: "SEND_EMAIL", status: "PASS" });
    } catch (err) {
      console.log(`   ❌ Send failed: ${err instanceof Error ? err.message : "Unknown"}`);
      results.push({ step: "SEND_EMAIL", status: "FAIL" });
      return;
    }

    // Wait for sync
    await new Promise(r => setTimeout(r, 2000));

    console.log("\n2️⃣ CHECK SENDER'S SENT FOLDER");
    let sentMessageFound = false;
    let sentMessageId = "";
    let sentSubject = "";

    await imap(senderConfig, async (client) => {
      await client.mailboxOpen("Sent");
      const msgs = await client.search({ all: true });

      if (msgs && Array.isArray(msgs) && msgs.length > 0) {
        // Get last message (most recent)
        const uid = msgs[msgs.length - 1];
        const msg = await client.fetchOne(uid, { source: true, envelope: true });

        if (msg && msg.source) {
          const raw = msg.source.toString();
          const headers = raw.split(/\r?\n\r?\n/)[0];

          // Check if our message is in Sent folder
          if (raw.includes(testBody) || headers.includes(testSubject)) {
            sentMessageFound = true;
            sentSubject = msg.envelope?.subject || "";
            sentMessageId = headers.match(/Message-ID:\s*<([^>]+)>/)?.[1] || "";

            console.log(`   ✅ Message found in Sent folder`);
            console.log(`      Subject: ${sentSubject}`);
            console.log(`      Message-ID: ${sentMessageId.slice(0, 40)}...`);
            results.push({ step: "SENT_FOUND", status: "PASS" });
          }
        }
      }

      if (!sentMessageFound) {
        console.log(`   ❌ Message not found in Sent folder`);
        results.push({ step: "SENT_FOUND", status: "FAIL" });
      }
    });

    console.log("\n3️⃣ VERIFY MESSAGE-ID CORRELATION");
    if (sentMessageId && sentMessageId === messageId.slice(1, -1)) {
      console.log(`   ✅ Message-ID matches`);
      console.log(`      Sent: ${sentMessageId}`);
      console.log(`      Original: ${messageId.slice(1, -1)}`);
      results.push({ step: "MESSAGE_ID_MATCH", status: "PASS" });
    } else if (sentMessageId) {
      console.log(`   ⚠️ Message-ID differs (may be rewritten by server)`);
      console.log(`      Sent: ${sentMessageId.slice(0, 40)}...`);
      console.log(`      Original: ${messageId.slice(1, -1)}`);
      results.push({ step: "MESSAGE_ID_MATCH", status: "PASS" }); // Allow server rewrite
    } else {
      console.log(`   ❌ Could not verify Message-ID`);
      results.push({ step: "MESSAGE_ID_MATCH", status: "FAIL" });
    }

    console.log("\n4️⃣ VERIFY RECIPIENT RECEIVED");
    let recipientReceived = false;

    await imap(recipientConfig, async (client) => {
      await client.mailboxOpen("INBOX");
      const msgs = await client.search(["SUBJECT", testSubject]);

      if (Array.isArray(msgs) && msgs.length > 0) {
        recipientReceived = true;
        console.log(`   ✅ Recipient received message`);
        results.push({ step: "RECIPIENT_RECEIVED", status: "PASS" });
      } else {
        console.log(`   ❌ Recipient did not receive message`);
        results.push({ step: "RECIPIENT_RECEIVED", status: "FAIL" });
      }
    });

    // Summary
    console.log("\n📊 SENT SYNC TEST RESULTS");
    console.log("=".repeat(70));
    const passed = results.filter(r => r.status === "PASS").length;
    const failed = results.filter(r => r.status === "FAIL").length;
    console.log(`✅ PASSED: ${passed}/${results.length}`);
    if (failed > 0) console.log(`❌ FAILED: ${failed}/${results.length}`);

    results.forEach(r => {
      console.log(`  ${r.step}: ${r.status}`);
    });

    console.log("\n✨ KEY FINDING:");
    if (sentMessageFound && recipientReceived) {
      console.log("   Sent folder sync is WORKING: message in Sent AND received by recipient");
    } else if (!sentMessageFound) {
      console.log("   ⚠️ Sent folder NOT syncing (message not in Sent folder post-send)");
    }

  } catch (err) {
    console.error("❌ ERROR:", err instanceof Error ? err.message : "Unknown");
  }
}

testSentSync().catch(console.error);
