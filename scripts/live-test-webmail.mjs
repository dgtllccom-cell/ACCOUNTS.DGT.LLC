const BASE_URL = "https://api.dgt.llc";

async function main() {
  console.log("=================================================");
  console.log("   DGT WEBMAIL LIVE SYSTEM END-TO-END TEST");
  console.log("   Target URL:", BASE_URL);
  console.log("=================================================\n");

  const timestamp = Math.floor(Date.now() / 1000);
  const user1 = `user.alpha${timestamp % 10000}`;
  const user2 = `user.beta${timestamp % 10000}`;
  const pass1 = "Alpha@Pass2026!";
  const pass2 = "Beta@Pass2026!";

  // 1. Register User 1
  console.log(`[1/8] Registering public mailbox: ${user1}@dgt.llc...`);
  const regRes1 = await fetch(`${BASE_URL}/api/mail/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: user1,
      displayName: "Alpha Tester",
      password: pass1,
      planId: "free_1gb"
    })
  });
  const regData1 = await regRes1.json();
  if (!regData1.success) {
    throw new Error(`User 1 registration failed: ${JSON.stringify(regData1)}`);
  }
  console.log(`  ✅ ${user1}@dgt.llc successfully created!`);

  // 2. Register User 2
  console.log(`\n[2/8] Registering public mailbox: ${user2}@dgt.llc...`);
  const regRes2 = await fetch(`${BASE_URL}/api/mail/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: user2,
      displayName: "Beta Tester",
      password: pass2,
      planId: "pro_10gb"
    })
  });
  const regData2 = await regRes2.json();
  if (!regData2.success) {
    throw new Error(`User 2 registration failed: ${JSON.stringify(regData2)}`);
  }
  console.log(`  ✅ ${user2}@dgt.llc successfully created!`);

  // 3. Authenticate User 1
  console.log(`\n[3/8] Authenticating ${user1}@dgt.llc via /api/mail/login...`);
  const loginRes1 = await fetch(`${BASE_URL}/api/mail/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user1, password: pass1 })
  });
  const loginData1 = await loginRes1.json();
  if (!loginData1.success) {
    throw new Error(`User 1 login failed: ${JSON.stringify(loginData1)}`);
  }
  const cookie1 = loginRes1.headers.get("set-cookie")?.split(";")[0] || "";
  console.log(`  ✅ ${user1}@dgt.llc authenticated! Session active.`);

  // 4. Authenticate User 2
  console.log(`\n[4/8] Authenticating ${user2}@dgt.llc via /api/mail/login...`);
  const loginRes2 = await fetch(`${BASE_URL}/api/mail/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user2, password: pass2 })
  });
  const loginData2 = await loginRes2.json();
  if (!loginData2.success) {
    throw new Error(`User 2 login failed: ${JSON.stringify(loginData2)}`);
  }
  const cookie2 = loginRes2.headers.get("set-cookie")?.split(";")[0] || "";
  console.log(`  ✅ ${user2}@dgt.llc authenticated! Session active.`);

  // 5. Send Email from User 1 to User 2
  console.log(`\n[5/8] Sending email: ${user1}@dgt.llc ➔ ${user2}@dgt.llc...`);
  const sendRes1 = await fetch(`${BASE_URL}/api/mail/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie1
    },
    body: JSON.stringify({
      action: "send",
      to: `${user2}@dgt.llc`,
      subject: "Official Invitation to DGT Mail Platform",
      body: "Assalam o Alaikum Beta,\n\nWelcome to DGT Mail! This is a real live message sent from Alpha user.",
      attachments: [{ name: "welcome-guide.pdf", size: 54200, type: "application/pdf" }]
    })
  });
  const sendData1 = await sendRes1.json();
  if (!sendData1.success) {
    throw new Error(`Email sending failed: ${JSON.stringify(sendData1)}`);
  }
  console.log(`  ✅ Email sent! Message ID: ${sendData1.messageId}`);

  // 6. User 2 checks Inbox
  console.log(`\n[6/8] Fetching Inbox for ${user2}@dgt.llc...`);
  const inboxRes2 = await fetch(`${BASE_URL}/api/mail/messages?folder=inbox`, {
    headers: { Cookie: cookie2 }
  });
  const inboxData2 = await inboxRes2.json();
  const receivedMsg = (inboxData2.messages || []).find(m => m.subject.includes("Official Invitation"));
  if (!receivedMsg) {
    throw new Error(`Message not found in ${user2} inbox! Got: ${JSON.stringify(inboxData2)}`);
  }
  console.log(`  ✅ EMAIL DELIVERED TO INBOX!`);
  console.log(`     From: ${receivedMsg.sender_name} <${receivedMsg.sender_email}>`);
  console.log(`     Subject: ${receivedMsg.subject}`);
  console.log(`     Snippet: "${receivedMsg.snippet}"`);
  console.log(`     Received At: ${receivedMsg.created_at}`);

  // 7. User 2 replies to User 1
  console.log(`\n[7/8] Replying: ${user2}@dgt.llc ➔ ${user1}@dgt.llc...`);
  const replyRes2 = await fetch(`${BASE_URL}/api/mail/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie2
    },
    body: JSON.stringify({
      action: "send",
      to: `${user1}@dgt.llc`,
      subject: `Re: ${receivedMsg.subject}`,
      body: "Walaikum Assalam Alpha,\n\nI have received your email in my Inbox! Everything is working perfectly.",
    })
  });
  const replyData2 = await replyRes2.json();
  if (!replyData2.success) {
    throw new Error(`Reply failed: ${JSON.stringify(replyData2)}`);
  }
  console.log(`  ✅ Reply sent! Message ID: ${replyData2.messageId}`);

  // 8. User 1 checks Inbox for reply
  console.log(`\n[8/8] Fetching Inbox for ${user1}@dgt.llc to confirm reply...`);
  const inboxRes1 = await fetch(`${BASE_URL}/api/mail/messages?folder=inbox`, {
    headers: { Cookie: cookie1 }
  });
  const inboxData1 = await inboxRes1.json();
  const replyMsg = (inboxData1.messages || []).find(m => m.subject.startsWith("Re:"));
  if (!replyMsg) {
    throw new Error(`Reply not found in ${user1} inbox! Got: ${JSON.stringify(inboxData1)}`);
  }
  console.log(`  ✅ BIDIRECTIONAL REPLY RECEIVED IN INBOX!`);
  console.log(`     From: ${replyMsg.sender_name} <${replyMsg.sender_email}>`);
  console.log(`     Subject: ${replyMsg.subject}`);
  console.log(`     Body: "${replyMsg.body_text}"`);

  console.log("\n=================================================");
  console.log("   🎉 ALL LIVE LIVE EMAIL TESTS PASSED 100%!");
  console.log(`   User A: ${user1}@dgt.llc`);
  console.log(`   User B: ${user2}@dgt.llc`);
  console.log("   Email Delivery: INSTANT & VERIFIED");
  console.log("   Reply Sync: INSTANT & VERIFIED");
  console.log("=================================================");
}

main().catch(err => {
  console.error("❌ TEST FAILED:", err.message);
  process.exit(1);
});
