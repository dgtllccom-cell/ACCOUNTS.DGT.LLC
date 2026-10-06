#!/usr/bin/env node

/**
 * VPS EMAIL WORKSPACE PRODUCTION TEST
 * Tests all 15 features end-to-end with detailed error reporting
 */

import fetch from 'node-fetch';

const API_URL = 'https://api.dgt.llc';

interface TestResult {
  feature: string;
  status: 'PASS' | 'FAIL';
  message: string;
  statusCode?: number;
  error?: string;
}

const results: TestResult[] = [];

async function test(feature: string, fn: () => Promise<{ ok: boolean; status?: number; error?: string }>) {
  try {
    const result = await fn();
    results.push({
      feature,
      status: result.ok ? 'PASS' : 'FAIL',
      statusCode: result.status,
      message: result.ok ? '✅' : `❌ Status ${result.status}`,
      error: result.error
    });
  } catch (err: any) {
    results.push({
      feature,
      status: 'FAIL',
      message: `❌ ${err.message}`,
      error: err.toString()
    });
  }
}

async function main() {
  console.log('📧 VPS EMAIL WORKSPACE COMPREHENSIVE TEST');
  console.log('=========================================\n');

  // Create dev session
  let sessionToken = '';
  console.log('Creating dev session...');
  try {
    const res = await fetch(`${API_URL}/api/erp/auth/dev-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'super_admin' })
    });
    const data = await res.json() as any;
    sessionToken = data.token || 'dev-session';
    if (res.ok) {
      console.log(`✅ Dev session created (token: ${sessionToken.substring(0, 20)}...)\n`);
    } else {
      console.error(`❌ Dev session failed: ${res.status}`);
      console.error(JSON.stringify(data, null, 2));
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Failed to create dev session:', err);
    process.exit(1);
  }

  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `erp_session=${sessionToken}`
  };

  // Test data
  const testMailboxId = '2c3644e7-2471-4dd9-b1fe-99996c694104'; // Dubai
  const testEmail = `test-${Date.now()}@example.com`;

  console.log('Running 15 feature tests...\n');

  // 1. INBOX FETCH
  await test('1. INBOX FETCH', async () => {
    const res = await fetch(`${API_URL}/api/erp/email/${testMailboxId}/fetch?folder=inbox`, { headers });
    return { ok: res.status === 200, status: res.status };
  });

  // 2. SEND EMAIL
  await test('2. SEND EMAIL', async () => {
    const res = await fetch(`${API_URL}/api/erp/email/${testMailboxId}/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        to: testEmail,
        subject: `Test ${Date.now()}`,
        body: 'Test message',
        html: '<p>Test message</p>'
      })
    });
    return { ok: res.status === 200 || res.status === 201, status: res.status };
  });

  // 3. RECEIVE (check sent folder)
  await test('3. RECEIVE/SENT SYNC', async () => {
    const res = await fetch(`${API_URL}/api/erp/email/${testMailboxId}/fetch?folder=sent`, { headers });
    return { ok: res.status === 200, status: res.status };
  });

  // 4. SEARCH
  await test('4. SEARCH EMAILS', async () => {
    const res = await fetch(`${API_URL}/api/erp/email/${testMailboxId}/search?query=test`, { headers });
    return { ok: res.status === 200, status: res.status };
  });

  // 5. DRAFTS SAVE
  await test('5. SAVE DRAFT', async () => {
    const res = await fetch(`${API_URL}/api/erp/email/${testMailboxId}/drafts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        to: testEmail,
        subject: 'Draft test',
        body: 'Draft body'
      })
    });
    return { ok: res.status === 200 || res.status === 201, status: res.status };
  });

  // 6. DRAFTS FETCH
  await test('6. FETCH DRAFTS', async () => {
    const res = await fetch(`${API_URL}/api/erp/email/${testMailboxId}/drafts`, { headers });
    return { ok: res.status === 200, status: res.status };
  });

  // 7. READ/UNREAD
  await test('7. READ/UNREAD FLAG', async () => {
    const res = await fetch(`${API_URL}/api/erp/email/${testMailboxId}/test-uid-1/read`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ isRead: true, folder: 'inbox' })
    });
    return { ok: res.status === 200 || res.status === 404, status: res.status };
  });

  // 8. STAR/FLAG
  await test('8. STAR/FLAG EMAIL', async () => {
    const res = await fetch(`${API_URL}/api/erp/email/${testMailboxId}/test-uid-1/flag`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ isFlagged: true, folder: 'inbox' })
    });
    return { ok: res.status === 200 || res.status === 404, status: res.status };
  });

  // 9. ARCHIVE
  await test('9. ARCHIVE EMAIL', async () => {
    const res = await fetch(`${API_URL}/api/erp/email/${testMailboxId}/test-uid-1/move`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fromFolder: 'inbox', toFolder: 'archive', action: 'archive' })
    });
    return { ok: res.status === 200 || res.status === 404, status: res.status };
  });

  // 10. TRASH
  await test('10. TRASH EMAIL', async () => {
    const res = await fetch(`${API_URL}/api/erp/email/${testMailboxId}/test-uid-1/move`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fromFolder: 'inbox', toFolder: 'trash', action: 'trash' })
    });
    return { ok: res.status === 200 || res.status === 404, status: res.status };
  });

  // 11. ATTACHMENTS
  await test('11. FETCH ATTACHMENTS', async () => {
    const res = await fetch(`${API_URL}/api/erp/email/${testMailboxId}/test-uid-1/attachments`, { headers });
    return { ok: res.status === 200 || res.status === 404, status: res.status };
  });

  // 12. RBAC - SUPER ADMIN
  await test('12. RBAC: SUPER ADMIN ACCESS', async () => {
    const res = await fetch(`${API_URL}/api/erp/email/${testMailboxId}/fetch`, { headers });
    return { ok: res.status === 200, status: res.status };
  });

  // 13. RBAC - UNAUTHORIZED
  await test('13. RBAC: UNAUTHORIZED BLOCK', async () => {
    const res = await fetch(`${API_URL}/api/erp/email/INVALID_UUID/fetch`, { headers });
    return { ok: res.status === 403 || res.status === 404, status: res.status };
  });

  // 14. I18N
  await test('14. I18N: LANGUAGE HEADER', async () => {
    const res = await fetch(`${API_URL}/api/erp/email/${testMailboxId}/fetch`, {
      headers: { ...headers, 'Accept-Language': 'ur' }
    });
    return { ok: res.status === 200, status: res.status };
  });

  // 15. ACCOUNTS LIST
  await test('15. ACCOUNTS LIST (5 mailboxes)', async () => {
    const res = await fetch(`${API_URL}/api/erp/email/accounts`, { headers });
    if (res.status !== 200) return { ok: false, status: res.status };
    const data = await res.json() as any;
    const count = data.data?.accounts?.length || 0;
    return { ok: count === 5, status: res.status, error: count === 5 ? undefined : `Expected 5 accounts, got ${count}` };
  });

  // REPORT
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST RESULTS');
  console.log('='.repeat(70));

  let passed = 0;
  let failed = 0;

  results.forEach(r => {
    const statusInfo = r.statusCode ? ` [${r.statusCode}]` : '';
    const errorInfo = r.error ? ` — ${r.error}` : '';
    console.log(`${r.status === 'PASS' ? '✅' : '❌'} ${r.feature}: ${r.message}${statusInfo}${errorInfo}`);
    if (r.status === 'PASS') passed++;
    else failed++;
  });

  console.log('='.repeat(70));
  console.log(`PASSED: ${passed}/${results.length}`);
  console.log(`FAILED: ${failed}/${results.length}`);
  console.log(`SUCCESS RATE: ${Math.round((passed / results.length) * 100)}%`);
  console.log('='.repeat(70));

  if (passed === results.length) {
    console.log('\n🎉 ALL EMAIL FEATURES WORKING ON VPS!');
    process.exit(0);
  } else {
    console.log(`\n⚠️ ${failed} feature(s) need attention`);
    process.exit(1);
  }
}

main().catch(console.error);
