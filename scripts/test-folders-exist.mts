/**
 * Verify Titan folder structure
 * Confirm Drafts, Sent, Archive folders exist
 */

import { ImapFlow } from "imapflow";

const mailbox = {
  email: "dgtllc@dgt.llc",
  password: "Chaman@9090"
};

async function testFolders() {
  console.log("📁 FOLDER STRUCTURE TEST");
  console.log("=".repeat(70));

  const client = new ImapFlow({
    host: "imap.titan.email",
    port: 993,
    secure: true,
    auth: { user: mailbox.email, pass: mailbox.password },
    logger: false,
    socketTimeout: 10000 // 10s timeout
  });

  try {
    console.log("\n1️⃣ CONNECTING...");
    await client.connect();
    console.log("   ✅ Connected");

    console.log("\n2️⃣ LISTING FOLDERS...");
    const folders = await client.list();
    console.log(`   Found ${folders.length} folders:`);

    const requiredFolders = ["INBOX", "Drafts", "Sent", "Archive", "Trash"];
    const foundFolders = new Set<string>();

    folders.forEach(f => {
      const name = f.name.toUpperCase();
      console.log(`      - ${f.name}`);

      // Check for required folders (case-insensitive)
      for (const req of requiredFolders) {
        if (name === req || name.includes(req.toUpperCase())) {
          foundFolders.add(req);
        }
      }
    });

    console.log("\n3️⃣ FOLDER VERIFICATION");
    requiredFolders.forEach(folder => {
      const found = foundFolders.has(folder) || folders.some(f => f.name.toUpperCase().includes(folder.toUpperCase()));
      console.log(`   ${found ? "✅" : "❌"} ${folder}`);
    });

    console.log("\n4️⃣ TEST APPEND TO DRAFTS");
    try {
      const testMessage = `From: ${mailbox.email}
Subject: TEST
Date: ${new Date().toUTCString()}
Message-ID: <test-${Date.now()}@dgt.llc>

Test draft message`;

      console.log("   Attempting append...");
      const result = await Promise.race([
        client.append("Drafts", testMessage, ["\\Draft"]),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Append timeout")), 5000)
        )
      ]);
      console.log("   ✅ Append succeeded");
      console.log(`      UID: ${result}`);
    } catch (err) {
      console.log(`   ❌ Append failed: ${err instanceof Error ? err.message : "Unknown"}`);
    }

    await client.logout();
    console.log("\n✅ Tests complete");
  } catch (err) {
    console.error("❌ Error:", err instanceof Error ? err.message : "Unknown");
  }
}

testFolders().catch(console.error);
