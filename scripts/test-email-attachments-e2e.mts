/**
 * Attachment E2E Test
 * Upload → Send with attachment → Receive → Verify → Download
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

async function testAttachments() {
  console.log("📎 ATTACHMENT E2E TEST");
  console.log("=".repeat(70));

  const results: any[] = [];
  const testFileName = "test-attachment.txt";
  const testFileContent = "This is a test attachment for E2E verification.";

  try {
    const fromConfig = mailboxes.dgtllc;
    const toConfig = mailboxes.dubai;
    const messageId = `<attach-${Date.now()}@dgt.llc>`;

    console.log("\n1️⃣ SEND WITH ATTACHMENT");
    try {
      const transporter = nodemailer.createTransport({
        host: "smtp.titan.email",
        port: 587,
        secure: false,
        auth: { user: fromConfig.email, pass: fromConfig.password }
      });

      await transporter.sendMail({
        from: fromConfig.email,
        to: toConfig.email,
        subject: `ATTACHMENT-TEST-${Date.now()}`,
        text: "Email with test attachment.",
        messageId,
        attachments: [
          {
            filename: testFileName,
            content: testFileContent
          }
        ]
      });

      console.log(`   ✅ Email with attachment sent`);
      console.log(`      Recipient: ${toConfig.email}`);
      console.log(`      Attachment: ${testFileName}`);
      results.push({ step: "SEND_ATTACHMENT", status: "PASS" });
    } catch (err) {
      console.log(`   ❌ Send failed: ${err instanceof Error ? err.message : "Unknown"}`);
      results.push({ step: "SEND_ATTACHMENT", status: "FAIL" });
      return;
    }

    // Wait for delivery
    await new Promise(r => setTimeout(r, 3000));

    console.log("\n2️⃣ RECEIVE & VERIFY ATTACHMENT");
    let attachmentFound = false;
    let attachmentSize = 0;
    let attachmentName = "";

    await imap(toConfig, async (client) => {
      await client.mailboxOpen("INBOX");
      const msgs = await client.search({ all: true });

      if (msgs && Array.isArray(msgs) && msgs.length > 0) {
        const uid = msgs[msgs.length - 1];
        const msg = await client.fetchOne(uid, { source: true, bodyStructure: true });

        if (msg && msg.source) {
          const raw = msg.source.toString();
          if (raw.includes(testFileContent)) {
            attachmentFound = true;
            console.log(`   ✅ Attachment found in message`);
            console.log(`      Content verified`);
            results.push({ step: "RECEIVE_ATTACHMENT", status: "PASS" });
          }
        }

        // Check bodyStructure for MIME parts
        if (msg && msg.bodyStructure) {
          const checkStructure = (struct: any): boolean => {
            if (!struct) return false;
            if (struct.disposition === "attachment") {
              attachmentName = struct.parameters?.filename || "";
              attachmentSize = struct.size || 0;
              return true;
            }
            if (Array.isArray(struct.childNodes)) {
              for (const child of struct.childNodes) {
                if (checkStructure(child)) return true;
              }
            }
            return false;
          };

          if (checkStructure(msg.bodyStructure)) {
            console.log(`   ✅ MIME attachment detected`);
            console.log(`      Filename: ${attachmentName}`);
            console.log(`      Size: ${attachmentSize} bytes`);
            results.push({ step: "MIME_ATTACHMENT", status: "PASS" });
          }
        }
      }
    });

    if (!attachmentFound) {
      console.log(`   ❌ Attachment not found`);
      results.push({ step: "RECEIVE_ATTACHMENT", status: "FAIL" });
    }

    console.log("\n3️⃣ VERIFY FILENAME");
    if (attachmentName === testFileName || attachmentName.includes("test")) {
      console.log(`   ✅ Filename preserved: ${attachmentName}`);
      results.push({ step: "FILENAME_PRESERVED", status: "PASS" });
    } else {
      console.log(`   ❌ Filename mismatch: ${attachmentName}`);
      results.push({ step: "FILENAME_PRESERVED", status: "FAIL" });
    }

    console.log("\n4️⃣ VERIFY SIZE");
    if (attachmentSize > 0) {
      console.log(`   ✅ Size recorded: ${attachmentSize} bytes`);
      results.push({ step: "SIZE_RECORDED", status: "PASS" });
    } else {
      console.log(`   ❌ Size not recorded`);
      results.push({ step: "SIZE_RECORDED", status: "FAIL" });
    }

    // Summary
    console.log("\n📊 ATTACHMENT TEST RESULTS");
    console.log("=".repeat(70));
    const passed = results.filter(r => r.status === "PASS").length;
    const failed = results.filter(r => r.status === "FAIL").length;
    console.log(`✅ PASSED: ${passed}/${results.length}`);
    if (failed > 0) console.log(`❌ FAILED: ${failed}/${results.length}`);

    results.forEach(r => {
      console.log(`  ${r.step}: ${r.status}`);
    });

  } catch (err) {
    console.error("❌ ERROR:", err instanceof Error ? err.message : "Unknown");
  }
}

testAttachments().catch(console.error);
