/**
 * Quick Sent Folder Test
 * Send → Search in Sent → Verify found
 */

import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

const sender = { email: "dgtllc@dgt.llc", password: "Chaman@9090" };
const recipient = { email: "dubai@dgt.llc", password: "Chaman@9090" };

async function testSentFolderCount() {
  console.log("📤 SENT FOLDER COUNT TEST");
  console.log("=".repeat(70));

  const testSubject = `QS-${Date.now()}`;

  try {
    // Send email
    console.log("\n1️⃣ SENDING");
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
      text: "Quick test"
    });

    console.log(`   ✅ Email sent with subject: ${testSubject}`);

    // Check Sent folder
    await new Promise(r => setTimeout(r, 1500));

    console.log("\n2️⃣ CHECKING SENT FOLDER");
    const imap = new ImapFlow({
      host: "imap.titan.email",
      port: 993,
      secure: true,
      auth: { user: sender.email, pass: sender.password },
      logger: false
    });

    await imap.connect();
    await imap.mailboxOpen("Sent");

    // Get all messages
    const allMsgs = await imap.search({ all: true });
    console.log(`   Total in Sent: ${allMsgs?.length || 0}`);

    // Search for our subject
    const ourMsg = await imap.search(["SUBJECT", testSubject]);
    console.log(`   Found matching subject: ${ourMsg?.length || 0}`);

    if (Array.isArray(ourMsg) && ourMsg.length > 0) {
      console.log(`   ✅ SENT FOLDER SYNC: WORKING`);
      console.log(`   ✅ Message IS in Sent folder after send`);
    } else {
      console.log(`   ⚠️ SENT FOLDER SYNC: UNCERTAIN (message not found)`);
    }

    await imap.logout();

    // Verify recipient got it
    console.log("\n3️⃣ RECIPIENT CHECK");
    const recipImap = new ImapFlow({
      host: "imap.titan.email",
      port: 993,
      secure: true,
      auth: { user: recipient.email, pass: recipient.password },
      logger: false
    });

    await recipImap.connect();
    await recipImap.mailboxOpen("INBOX");

    const recipMsgs = await recipImap.search(["SUBJECT", testSubject]);
    if (Array.isArray(recipMsgs) && recipMsgs.length > 0) {
      console.log(`   ✅ Recipient received`);
    } else {
      console.log(`   ⚠️ Not in recipient inbox yet`);
    }

    await recipImap.logout();

  } catch (err) {
    console.error("Error:", err instanceof Error ? err.message : "Unknown");
  }
}

testSentFolderCount().catch(console.error);
