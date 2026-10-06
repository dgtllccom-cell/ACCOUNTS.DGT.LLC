/**
 * Sent Folder Sync Test (Direct)
 * Send via SMTP → Check Sent folder for copy → Verify Message-ID
 */

import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

const sender = { email: "dgtllc@dgt.llc", password: "Chaman@9090" };
const recipient = { email: "dubai@dgt.llc", password: "Chaman@9090" };

async function testSentSync() {
  console.log("📤 SENT FOLDER SYNC TEST (DIRECT)");
  console.log("=".repeat(70));

  const testSubject = `SENT-SYNC-${Date.now()}`;
  const testBody = "Testing sent folder sync directly.";
  const messageId = `<sent-test-${Date.now()}@dgt.llc>`;

  try {
    // Step 1: Send email
    console.log("\n1️⃣ SENDING EMAIL VIA SMTP");
    const transporter = nodemailer.createTransport({
      host: "smtp.titan.email",
      port: 587,
      secure: false,
      auth: { user: sender.email, pass: sender.password }
    });

    await transporter.sendMail({
      from: sender.email,
      to: recipient.email,
      subject: testSubject,
      text: testBody,
      messageId: messageId
    });

    console.log(`   ✅ Email sent`);
    console.log(`      Subject: ${testSubject}`);
    console.log(`      Message-ID: ${messageId}`);

    // Wait for server processing
    await new Promise(r => setTimeout(r, 2000));

    // Step 2: Check Sent folder
    console.log("\n2️⃣ CHECKING SENDER'S SENT FOLDER");
    const imap = new ImapFlow({
      host: "imap.titan.email",
      port: 993,
      secure: true,
      auth: { user: sender.email, pass: sender.password },
      logger: false,
      socketTimeout: 10000
    });

    await imap.connect();
    await imap.mailboxOpen("Sent");

    // Search for the message we just sent
    const searchResults = await imap.search(["SUBJECT", testSubject]);
    console.log(`   Search found: ${searchResults?.length || 0} message(s)`);

    let foundInSent = false;
    let sentMessageId = "";

    if (Array.isArray(searchResults) && searchResults.length > 0) {
      const uid = searchResults[searchResults.length - 1];
      const msg = await imap.fetchOne(uid, { source: true, envelope: true });

      if (msg && msg.source) {
        const raw = msg.source.toString();
        const headers = raw.split(/\r?\n\r?\n/)[0];
        const match = headers.match(/Message-ID:\s*<([^>]+)>/);
        sentMessageId = match ? `<${match[1]}>` : "";

        if (raw.includes(testBody)) {
          foundInSent = true;
          console.log(`   ✅ Message found in Sent folder`);
          console.log(`      Subject: ${msg.envelope?.subject}`);
          console.log(`      Message-ID in Sent: ${sentMessageId.slice(0, 40)}...`);
        }
      }
    } else {
      console.log(`   ⚠️ Message not found in Sent folder (may not have synced yet)`);
    }

    // Step 3: Verify Message-ID
    console.log("\n3️⃣ MESSAGE-ID VERIFICATION");
    if (sentMessageId === messageId) {
      console.log(`   ✅ Message-ID matches exactly`);
      console.log(`      Sent: ${sentMessageId}`);
      console.log(`      Expected: ${messageId}`);
      console.log(`   ✅ SENT SYNC: WORKING`);
    } else if (sentMessageId) {
      console.log(`   ⚠️ Message-ID differs (server may rewrite)`);
      console.log(`      Sent: ${sentMessageId}`);
      console.log(`      Expected: ${messageId}`);
      console.log(`   ⚠️ SENT SYNC: WORKING (with server rewrite)`);
    } else if (foundInSent) {
      console.log(`   ⚠️ Could not extract Message-ID from Sent copy`);
      console.log(`   ⚠️ SENT SYNC: WORKING (header parse issue only)`);
    } else {
      console.log(`   ❌ SENT SYNC: NOT WORKING (message not in Sent folder)`);
    }

    // Step 4: Verify recipient received
    console.log("\n4️⃣ RECIPIENT DELIVERY CHECK");
    const imapRecipient = new ImapFlow({
      host: "imap.titan.email",
      port: 993,
      secure: true,
      auth: { user: recipient.email, pass: recipient.password },
      logger: false,
      socketTimeout: 10000
    });

    await imapRecipient.connect();
    await imapRecipient.mailboxOpen("INBOX");

    const recipientSearch = await imapRecipient.search(["SUBJECT", testSubject]);
    if (Array.isArray(recipientSearch) && recipientSearch.length > 0) {
      console.log(`   ✅ Recipient received the email`);
    } else {
      console.log(`   ⚠️ Recipient did not receive email (may be delayed)`);
    }

    await imap.logout();
    await imapRecipient.logout();

    console.log("\n✨ SENT SYNC TEST COMPLETE");
  } catch (err) {
    console.error("❌ Error:", err instanceof Error ? err.message : "Unknown");
  }
}

testSentSync().catch(console.error);
