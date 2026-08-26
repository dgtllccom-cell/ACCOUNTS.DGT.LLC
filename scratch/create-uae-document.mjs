import fs from 'node:fs';

const APP_BASE = 'http://localhost:3000';

async function loginCookie() {
  const res = await fetch(`${APP_BASE}/api/erp/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ identifier: 'superadmin', password: 'Admin@123' })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`login failed ${res.status}: ${text}`);
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/erp_session=([^;]+)/);
  if (!match) throw new Error(`erp_session cookie not found: ${setCookie}`);
  return { cookie: `erp_session=${match[1]}`, body: text };
}

function makeForm(fields, fileName, fileText) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) || typeof value === 'object') form.append(key, JSON.stringify(value));
    else form.append(key, String(value));
  }
  form.append('file', new File([fileText], fileName, { type: 'text/plain' }));
  return form;
}

const login = await loginCookie();
const fields = {
  title: 'DEV TEST Document Management Phase 1 UAE',
  file_name: 'dev-test-document-uae.txt',
  file_type: 'text/plain',
  file_size: 80,
  country_id: '935dd0b9-8228-43b3-b53d-c06e9ae2882f',
  country_name: 'United Arab Emirates',
  country_branch_id: '87c2e253-b6c1-482d-a808-272337f3ffda',
  main_branch_name: 'United Arab Emirates Main Branch',
  city_branch_id: '79b31aba-45f1-4aba-9068-fb3eb2102a81',
  city_branch_name: 'DEV Demo Dubai City Branch',
  company_id: 'e191c085-7ded-4ee9-a488-8407b2b9c09e',
  company_code: 'COMP-000046',
  company_name: 'DEV-DEMO-AE-COMPANY-01',
  account_id: 'b81959d5-ab3e-4ec3-a199-16a0c3cfaaae',
  account_code: 'DEV-AE-ACC-01',
  account_name: 'DEV Demo United Arab Emirates Account 01',
  person_account_id: '11fba42f-1404-459b-ba39-9baeaddac7e7',
  person_account_code: 'DEVTEST-20260813-CSESVYXX-DEV-AE-TEST-DUBAI-001-EMP-01',
  person_account_name: 'DEV TEST DEV TEST Dubai City Branch Designation 01',
  person_account_type: 'employee',
  module_type: 'Documents',
  document_type: 'KYC Document',
  source_module: 'general-office',
  source_record_id: '11fba42f-1404-459b-ba39-9baeaddac7e7',
  source_record_no: 'DEVTEST-20260813-CSESVYXX-DEV-AE-TEST-DUBAI-001-EMP-01',
  category: 'DEV TEST',
  tags: ['DEV TEST', 'uae', 'document-management'],
  metadata: { source: 'phase1', language: 'en', scanMode: 'upload' },
  created_by: 'Super Admin',
  scanner_device_name: 'DEV Scanner Bridge',
  scanner_bridge: 'simulated'
};
const fileName = 'dev-test-document-uae.txt';
const form = makeForm(fields, fileName, `DEV TEST UAE document upload verification at ${new Date().toISOString()}`);
const res = await fetch(`${APP_BASE}/api/documents`, {
  method: 'POST',
  headers: { cookie: login.cookie, accept: 'application/json' },
  body: form
});
const text = await res.text();
if (!res.ok) throw new Error(`upload failed ${res.status}: ${text}`);
console.log(text);
