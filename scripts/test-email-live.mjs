#!/usr/bin/env node
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';

const MAILBOXES = [
  { email: 'dgtllc@dgt.llc', password: process.env.MAILBOX_DGTLLC_PASSWORD },
  { email: 'dubai@dgt.llc', password: process.env.MAILBOX_DUBAI_PASSWORD },
  { email: 'chaman@dgt.llc', password: process.env.MAILBOX_CHAMAN_PASSWORD },
  { email: 'quetta@dgt.llc', password: process.env.MAILBOX_QUETTA_PASSWORD },
  { email: 'kandahar@dgt.llc', password: process.env.MAILBOX_KANDAHAR_PASSWORD }
];

const IMAP_HOST = 'imap.titan.email';
const IMAP_PORT = 993;
const SMTP_HOST = 'smtp.titan.email';
const SMTP_PORT = 587;

async function testImapAuth(email, password) {
  try {
    const client = new ImapFlow({
      host: IMAP_HOST,
      port: IMAP_PORT,
      secure: true,
      auth: { user: email, pass: password }
    });

    await client.connect();
    const mailboxes = await client.list();
    await client.logout();

    return {
      email,
      imap: 'PASS',
      folderCount: mailboxes.length,
      folders: mailboxes.map(m => m.name).slice(0, 5)
    };
  } catch (err) {
    return { email, imap: 'FAIL', error: err.message };
  }
}

async function testSmtpAuth(email, password) {
  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      auth: { user: email, pass: password }
    });

    await transporter.verify();
    return { email, smtp: 'PASS' };
  } catch (err) {
    return { email, smtp: 'FAIL', error: err.message };
  }
}

async function main() {
  console.log('=== TESTING REAL EMAIL CREDENTIALS ===\n');

  for (const { email, password } of MAILBOXES) {
    if (!password) {
      console.log(`${email}: SKIP (no password in env)`);
      continue;
    }

    const imapResult = await testImapAuth(email, password);
    const smtpResult = await testSmtpAuth(email, password);

    console.log(`${email}:`);
    console.log(`  IMAP: ${imapResult.imap}${imapResult.folderCount ? ` (${imapResult.folderCount} folders)` : ''}${imapResult.error ? ` - ${imapResult.error}` : ''}`);
    console.log(`  SMTP: ${smtpResult.smtp}${smtpResult.error ? ` - ${smtpResult.error}` : ''}`);
    console.log();
  }
}

main().catch(console.error);
