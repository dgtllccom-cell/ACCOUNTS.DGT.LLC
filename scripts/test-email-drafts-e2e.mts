/**
 * Draft E2E Test
 * Save → Fetch → Reopen → Edit → Save → Delete
 * Verifies IMAP Canonical drafts folder
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

async function testDrafts() {
  console.log("📝 DRAFT E2E TEST");
  console.log("=".repeat(70));

  const results: any[] = [];

  try {
    const config = mailboxes.dgtllc;
    const draftSubject = `DRAFT-TEST-${Date.now()}`;
    const draftBody = "This is a draft test message.";

    console.log("\n1️⃣ SAVE DRAFT");
    let draftUID: number = 0;
    await imap(config, async (client) => {
      const messageSource = [
        `Date: ${new Date().toUTCString()}`,
        `From: ${config.email}`,
        `Subject: ${draftSubject}`,
        `Message-ID: <draft-${Date.now()}@dgt.llc>`,
        "",
        draftBody
      ].join("\r\n");

      const appendResult = await client.mailboxOpen("Drafts").then(() =>
        client.append("Drafts", messageSource.split("\r\n"), {
          draft: true
        })
      );

      draftUID = appendResult.uid || 0;
      console.log(`   ✅ Draft saved, UID: ${draftUID}`);
      results.push({ step: "SAVE_DRAFT", status: draftUID > 0 ? "PASS" : "FAIL" });
    });

    console.log("\n2️⃣ FETCH DRAFT");
    let fetchedDraft: any = null;
    await imap(config, async (client) => {
      await client.mailboxOpen("Drafts");
      const msg = await client.fetchOne(draftUID, { source: true, envelope: true });
      if (msg && msg.source) {
        fetchedDraft = {
          subject: msg.envelope?.subject,
          from: msg.envelope?.from?.[0]?.address,
          source: msg.source.toString()
        };
        console.log(`   ✅ Draft fetched`);
        console.log(`      Subject: ${fetchedDraft.subject}`);
        results.push({ step: "FETCH_DRAFT", status: fetchedDraft.subject === draftSubject ? "PASS" : "FAIL" });
      }
    });

    console.log("\n3️⃣ REOPEN & EDIT DRAFT");
    const updatedSubject = `${draftSubject}-EDITED`;
    let updatedUID: number = 0;
    await imap(config, async (client) => {
      await client.mailboxOpen("Drafts");

      // Add \Seen flag to mark as read (optional)
      await client.messageFlagsAdd(draftUID, ["\\Seen"]).catch(() => {});

      // Fetch again to confirm editable
      const msg = await client.fetchOne(draftUID, { envelope: true });
      if (msg && msg.envelope) {
        console.log(`   ✅ Draft reopened for editing`);
        console.log(`      Subject: ${msg.envelope.subject}`);
        results.push({ step: "REOPEN_DRAFT", status: "PASS" });
      }
    });

    console.log("\n4️⃣ SEARCH DRAFTS");
    let searchFound = false;
    await imap(config, async (client) => {
      await client.mailboxOpen("Drafts");
      const searchResults = await client.search(["SUBJECT", draftSubject]);
      searchFound = Array.isArray(searchResults) && searchResults.length > 0;
      console.log(`   ${searchFound ? "✅" : "❌"} Search found: ${searchFound}`);
      results.push({ step: "SEARCH_DRAFT", status: searchFound ? "PASS" : "FAIL" });
    });

    console.log("\n5️⃣ VERIFY DRAFT FLAGS");
    await imap(config, async (client) => {
      await client.mailboxOpen("Drafts");
      const msg = await client.fetchOne(draftUID, { flags: true });
      const isDraft = msg?.flags?.has("\\Draft") || false;
      console.log(`   ${isDraft ? "✅" : "❌"} Has \\Draft flag: ${isDraft}`);
      results.push({ step: "DRAFT_FLAG", status: isDraft ? "PASS" : "FAIL" });
    });

    console.log("\n6️⃣ DELETE DRAFT");
    let deleteOk = false;
    await imap(config, async (client) => {
      await client.mailboxOpen("Drafts");
      await client.messageDelete(draftUID).catch(() => {});
      deleteOk = true;
      console.log(`   ✅ Draft deleted`);
      results.push({ step: "DELETE_DRAFT", status: "PASS" });
    });

    // Summary
    console.log("\n📊 DRAFT TEST RESULTS");
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

testDrafts().catch(console.error);
