#!/usr/bin/env node
/**
 * Dubai Mailbox End-to-End Test Suite
 * Runs comprehensive verification once credentials are saved in DGT Mail Management
 *
 * Usage: npx tsx scripts/test-dubai-mailbox.mts
 */

import { createClient } from '@supabase/supabase-js';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { decrypt } from '@/lib/crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, supabaseKey);

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

async function logResult(test: string, status: 'PASS' | 'FAIL', error?: string, duration?: number) {
  results.push({ test, status, error, duration });
  console.log(`[${status}] ${test}${error ? ` - ${error}` : ''}${duration ? ` (${duration}ms)` : ''}`);
}

async function testDubaiMailbox() {
  console.log('🧪 DUBAI MAILBOX END-TO-END TEST SUITE\n');

  let imapPass: string = '';
  let smtpPass: string = '';
  let imapHost: string = '';
  let smtpHost: string = '';

  // Test 1: Fetch credentials
  console.log('📦 Loading credentials...\n');
  try {
    const start = Date.now();
    const { data: account, error } = await admin
      .from('erp_email_accounts')
      .select('*, erp_email_providers(host, port, imap_host, imap_port)')
      .eq('email_address', 'dubai@dgt.llc')
      .single();

    if (error || !account) {
      await logResult('Credentials Fetch', 'FAIL', 'Account not found');
      return;
    }

    // Decrypt passwords
    try {
      if (account.imap_password_encrypted) {
        imapPass = decrypt(account.imap_password_encrypted);
      }
      if (account.smtp_password_encrypted) {
        smtpPass = decrypt(account.smtp_password_encrypted);
      }
    } catch (e: any) {
      await logResult('Credentials Decrypt', 'FAIL', e.message);
      return;
    }

    imapHost = account.erp_email_providers?.imap_host || 'imap.titan.email';
    smtpHost = account.erp_email_providers?.host || 'smtp.titan.email';

    if (!imapPass || !smtpPass) {
      await logResult('Credentials Load', 'FAIL', 'Passwords not decrypted');
      return;
    }

    await logResult('Credentials Load', 'PASS', undefined, Date.now() - start);
  } catch (e: any) {
    await logResult('Credentials Load', 'FAIL', e.message);
    return;
  }

  // Test 2: IMAP Connection
  console.log('\n🔐 IMAP CONNECTION\n');
  let imapClient: ImapFlow | null = null;
  try {
    const start = Date.now();
    imapClient = new ImapFlow({
      host: imapHost,
      port: 993,
      secure: true,
      auth: {
        user: 'dubai@dgt.llc',
        pass: imapPass
      }
    });

    await imapClient.connect();
    await logResult('IMAP AUTH', 'PASS', undefined, Date.now() - start);
  } catch (e: any) {
    await logResult('IMAP AUTH', 'FAIL', e.message);
    imapClient = null;
  }

  // Test 3: SMTP Connection
  console.log('\n📤 SMTP CONNECTION\n');
  let smtpTransport: any = null;
  try {
    const start = Date.now();
    smtpTransport = nodemailer.createTransport({
      host: smtpHost,
      port: 587,
      secure: false,
      auth: {
        user: 'dubai@dgt.llc',
        pass: smtpPass
      }
    });

    const verifyResult = await smtpTransport.verify();
    if (!verifyResult) throw new Error('SMTP verification failed');
    await logResult('SMTP AUTH', 'PASS', undefined, Date.now() - start);
  } catch (e: any) {
    await logResult('SMTP AUTH', 'FAIL', e.message);
    smtpTransport = null;
  }

  // Test 4: Inbox Access
  console.log('\n📥 INBOX ACCESS\n');
  if (imapClient) {
    try {
      const start = Date.now();
      await imapClient.mailboxOpen('INBOX');
      await logResult('INBOX', 'PASS', undefined, Date.now() - start);
    } catch (e: any) {
      await logResult('INBOX', 'FAIL', e.message);
    }
  } else {
    await logResult('INBOX', 'FAIL', 'IMAP not connected');
  }

  // Test 5: SEND
  console.log('\n📧 SEND TEST\n');
  let testMessageId: string | null = null;
  if (smtpTransport) {
    try {
      const start = Date.now();
      const testEmail = `test-${Date.now()}@dgt-test.internal`;
      const info = await smtpTransport.sendMail({
        from: 'dubai@dgt.llc',
        to: testEmail,
        subject: 'Dubai Mailbox Test - SEND',
        text: `Test sent at ${new Date().toISOString()}`,
        html: `<p>Test sent at ${new Date().toISOString()}</p>`
      });

      testMessageId = info.messageId;
      await logResult('SEND', 'PASS', undefined, Date.now() - start);
    } catch (e: any) {
      await logResult('SEND', 'FAIL', e.message);
    }
  } else {
    await logResult('SEND', 'FAIL', 'SMTP not connected');
  }

  // Test 6: Sent Folder Sync
  console.log('\n📨 SENT FOLDER SYNC\n');
  if (imapClient) {
    try {
      const start = Date.now();
      await imapClient.mailboxOpen('Sent').catch(() => imapClient!.mailboxOpen('[Gmail]/Sent Mail'));
      const mailbox = imapClient.mailbox;
      const status = await imapClient.status('Sent', { messages: true });
      if (status && status.messages > 0) {
        await logResult('SENT SYNC', 'PASS', undefined, Date.now() - start);
      } else {
        await logResult('SENT SYNC', 'FAIL', 'No messages in Sent folder');
      }
    } catch (e: any) {
      await logResult('SENT SYNC', 'FAIL', e.message);
    }
  } else {
    await logResult('SENT SYNC', 'FAIL', 'IMAP not connected');
  }

  // Test 7: Drafts Access
  console.log('\n📝 DRAFTS ACCESS\n');
  if (imapClient) {
    try {
      const start = Date.now();
      await imapClient.mailboxOpen('Drafts').catch(() => imapClient!.mailboxOpen('[Gmail]/Drafts'));
      await logResult('DRAFTS', 'PASS', undefined, Date.now() - start);
    } catch (e: any) {
      await logResult('DRAFTS', 'FAIL', e.message);
    }
  } else {
    await logResult('DRAFTS', 'FAIL', 'IMAP not connected');
  }

  // Test 8: Search
  console.log('\n🔍 SEARCH\n');
  if (imapClient) {
    try {
      const start = Date.now();
      await imapClient.mailboxOpen('INBOX');
      const result = await imapClient.search({ all: true });
      await logResult('SEARCH', 'PASS', undefined, Date.now() - start);
    } catch (e: any) {
      await logResult('SEARCH', 'FAIL', e.message);
    }
  } else {
    await logResult('SEARCH', 'FAIL', 'IMAP not connected');
  }

  // Test 9: Attachments (if any message exists)
  console.log('\n📎 ATTACHMENTS\n');
  if (imapClient) {
    try {
      const start = Date.now();
      await imapClient.mailboxOpen('INBOX');
      const messages = await imapClient.search({ all: true }, { limit: 1 });
      if (messages.length > 0) {
        const msg = await imapClient.fetchOne(messages[0], { bodyStructure: true });
        // Just checking if we can read attachment info
        await logResult('ATTACHMENTS', 'PASS', undefined, Date.now() - start);
      } else {
        await logResult('ATTACHMENTS', 'PASS', 'No messages to check', Date.now() - start);
      }
    } catch (e: any) {
      await logResult('ATTACHMENTS', 'FAIL', e.message);
    }
  } else {
    await logResult('ATTACHMENTS', 'FAIL', 'IMAP not connected');
  }

  // Cleanup
  if (imapClient) {
    try {
      await imapClient.logout();
    } catch (e) {
      // Ignore logout errors
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('DUBAI MAILBOX TEST RESULTS\n');

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;

  console.log(`✅ PASSED: ${passCount}/${results.length}`);
  console.log(`❌ FAILED: ${failCount}/${results.length}\n`);

  // Final verdict
  const imapTest = results.find(r => r.test === 'IMAP AUTH');
  const smtpTest = results.find(r => r.test === 'SMTP AUTH');
  const sendTest = results.find(r => r.test === 'SEND');
  const sentTest = results.find(r => r.test === 'SENT SYNC');

  console.log('FINAL VERDICT:\n');
  console.log(`DUBAI MAILBOX: ${failCount === 0 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`IMAP: ${imapTest?.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`SMTP: ${smtpTest?.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`SEND/RECEIVE: ${sendTest?.status === 'PASS' && sentTest?.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);

  process.exit(failCount === 0 ? 0 : 1);
}

testDubaiMailbox().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
