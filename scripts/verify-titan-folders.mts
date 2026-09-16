import { ImapFlow } from "imapflow";

const mailboxes = [
  { email: "dgtllc@dgt.llc", pass: process.env.MAILBOX_DGTLLC_PASSWORD },
  { email: "dubai@dgt.llc", pass: process.env.MAILBOX_DUBAI_PASSWORD },
  { email: "chaman@dgt.llc", pass: process.env.MAILBOX_CHAMAN_PASSWORD },
  { email: "quetta@dgt.llc", pass: process.env.MAILBOX_QUETTA_PASSWORD },
  { email: "kandahar@dgt.llc", pass: process.env.MAILBOX_KANDAHAR_PASSWORD }
];

async function checkFolders(email: string, pass: string | undefined) {
  if (!pass) {
    console.log(`❌ ${email}: No password in env`);
    return;
  }

  const client = new ImapFlow({
    host: "imap.titan.email",
    port: 993,
    secure: true,
    auth: { user: email, pass }
  });

  try {
    await client.connect();
    console.log(`\n✅ ${email}: CONNECTED`);

    const list = await client.list();
    console.log(`   Actual Titan folders:`);
    for (const box of list) {
      console.log(`     ${box.name}`);
    }

    const tests = ["INBOX", "Drafts", "[Gmail]/Drafts", "Sent", "[Gmail]/Sent Mail", "Trash", "[Gmail]/Trash"];
    console.log(`   Folder test results:`);
    for (const folder of tests) {
      try {
        await client.mailboxOpen(folder);
        console.log(`     ✅ ${folder}`);
        await client.mailboxClose();
      } catch {
        console.log(`     ❌ ${folder}`);
      }
    }

    await client.logout();
  } catch (err) {
    console.log(`❌ ${email}: ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

async function main() {
  console.log("🔍 TITAN IMAP FOLDER VERIFICATION\n");
  for (const box of mailboxes) {
    await checkFolders(box.email, box.pass);
  }
}

main().catch(console.error);
