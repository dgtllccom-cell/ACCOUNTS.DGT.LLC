const base = 'http://localhost:3000';
const loginRes = await fetch(`${base}/api/erp/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'superadmin@damaan.com', password: 'Admin@123' })
});
const loginJson = await loginRes.json();
if (!loginRes.ok) {
  console.error('LOGIN_FAIL', loginRes.status, loginJson);
  process.exit(1);
}
const cookie = loginRes.headers.get('set-cookie')?.split(';')[0];
if (!cookie) {
  console.error('NO_COOKIE', loginJson);
  process.exit(1);
}
const form = new FormData();
form.set('title', 'DEV Secure Upload Test');
form.set('file_name', 'dev-secure-upload-test.txt');
form.set('module_type', 'Documents');
form.set('document_type', 'Document');
form.set('category', 'General');
form.set('created_by', 'Super Admin');
form.set('country_name', 'United Arab Emirates');
form.set('main_branch_name', 'Dubai Head Office');
form.set('company_name', 'DAMAAN Trading Company LLC');
form.set('person_account_name', 'Super Admin');
form.set('person_account_type', 'Admin');
form.set('source_module', 'documents');
form.set('source_record_no', 'DEV-DOC-SECURE-001');
form.set('metadata', JSON.stringify({ test: true, scope: 'dev', phase: 'secure-upload' }));
form.set('tags', JSON.stringify(['dev', 'secure', 'upload']));
form.set('file', new Blob(['hello secure document storage'], { type: 'text/plain' }), 'dev-secure-upload-test.txt');
const uploadRes = await fetch(`${base}/api/documents`, {
  method: 'POST',
  headers: { cookie },
  body: form
});
const text = await uploadRes.text();
console.log('STATUS', uploadRes.status);
console.log(text);
if (!uploadRes.ok) process.exit(2);
