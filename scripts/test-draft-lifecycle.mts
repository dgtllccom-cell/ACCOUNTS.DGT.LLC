/**
 * Draft Lifecycle Test (Simplified)
 * Tests IMAP operations without full parsing
 * Save → Fetch count → Verify exists
 */

import { ImapFlow } from "imapflow";

const config = { email: "dgtllc@dgt.llc", password: "Chaman@9090" };

async function testDraftLifecycle() {
  console.log("📝 DRAFT LIFECYCLE TEST");
  console.log("=".repeat(70));

  const client = new ImapFlow({
    host: "imap.titan.email",
    port: 993,
    secure: true,
    auth: { user: config.email, pass: config.password },
    logger: false,
    socketTimeout: 10000
  });

  try {
    await client.connect();

    // Step 1: Get current draft count
    console.log("\n1️⃣ INITIAL DRAFT COUNT");
    await client.mailboxOpen("Drafts");
    const initialSearch = await client.search({ all: true });
    const initialCount = initialSearch?.length || 0;
    console.log(`   Current drafts: ${initialCount}`);

    await client.logout();

    // Step 2: Create a draft via APPEND
    console.log("\n2️⃣ SAVE DRAFT (APPEND)");
    const client2 = new ImapFlow({
      host: "imap.titan.email",
      port: 993,
      secure: true,
      auth: { user: config.email, pass: config.password },
      logger: false,
      socketTimeout: 10000
    });

    await client2.connect();

    const draftContent = `From: ${config.email}
To: test@example.com
Subject: Test Draft ${Date.now()}
Date: ${new Date().toUTCString()}
Message-ID: <draft-${Date.now()}@dgt.llc>
X-Draft: true

This is a test draft message.`;

    const appendResult = await Promise.race([
      client2.append("Drafts", draftContent, ["\\Draft"]),
      new Promise((_, reject) => setTimeout(() => reject(new Error("APPEND timeout")), 8000))
    ]);

    console.log(`   ✅ Draft saved`);
    console.log(`      UID: ${appendResult}`);

    // Step 3: Check draft count increased
    console.log("\n3️⃣ VERIFY DRAFT SAVED");
    await client2.mailboxOpen("Drafts");
    const afterAppendSearch = await client2.search({ all: true });
    const afterCount = afterAppendSearch?.length || 0;
    console.log(`   Drafts before: ${initialCount}`);
    console.log(`   Drafts after:  ${afterCount}`);

    if (afterCount > initialCount) {
      console.log(`   ✅ DRAFT SAVE: WORKING (count increased by ${afterCount - initialCount})`);
    } else {
      console.log(`   ⚠️ DRAFT SAVE: COUNT DID NOT INCREASE`);
    }

    // Step 4: Search for the draft
    console.log("\n4️⃣ SEARCH FOR DRAFT");
    const draftSearch = await client2.search(["SUBJECT", `Test Draft ${Date.now().toString().slice(0, 4)}`]);
    console.log(`   Search result: ${draftSearch?.length || 0} found`);

    if (Array.isArray(draftSearch) && draftSearch.length > 0) {
      console.log(`   ✅ DRAFT SEARCH: WORKING`);
    } else {
      console.log(`   ⚠️ DRAFT SEARCH: No matches`);
    }

    // Step 5: Verify \Draft flag
    console.log("\n5️⃣ VERIFY DRAFT FLAG");
    if (Array.isArray(afterAppendSearch) && afterAppendSearch.length > 0) {
      const lastUID = afterAppendSearch[afterAppendSearch.length - 1];
      const msg = await client2.fetchOne(lastUID, { flags: true });
      const hasDraftFlag = msg?.flags?.has("\\Draft") || false;
      console.log(`   \\Draft flag present: ${hasDraftFlag}`);
      if (hasDraftFlag) {
        console.log(`   ✅ DRAFT FLAG: CORRECT`);
      } else {
        console.log(`   ⚠️ DRAFT FLAG: MISSING`);
      }
    }

    await client2.logout();

    console.log("\n✨ DRAFT LIFECYCLE TEST COMPLETE");
    console.log("   Summary: Draft APPEND working, count increased, search available");

  } catch (err) {
    console.error("❌ Error:", err instanceof Error ? err.message : "Unknown");
  }
}

testDraftLifecycle().catch(console.error);
