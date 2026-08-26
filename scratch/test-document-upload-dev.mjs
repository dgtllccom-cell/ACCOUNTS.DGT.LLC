import fs from 'node:fs';
import postgres from 'postgres';

const APP_BASE = 'http://localhost:3000';

function readDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  for (const f of ['.env.local', '.env']) {
    if (fs.existsSync(f)) {
      const c = fs.readFileSync(f, 'utf8');
      const m = c.match(/^DATABASE_URL\s*=\s*(.+)$/m);
      if (m) return m[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  throw new Error('DATABASE_URL not found');
}

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
    if (value === undefined) continue;
    if (value === null) continue;
    if (Array.isArray(value) || typeof value === 'object') {
      form.append(key, JSON.stringify(value));
    } else {
      form.append(key, String(value));
    }
  }
  form.append('file', new File([fileText], fileName, { type: 'text/plain' }));
  return form;
}

const sql = postgres(readDbUrl(), { max: 1, prepare: false });
try {
  const [company, account, customer, employee, country, mainBranch, cityBranch] = await Promise.all([
    sql`select id, company_code, name, country_id, country_branch_id, city_branch_id from public.companies where deleted_at is null order by created_at asc limit 1`,
    sql`select id, account_number, code, name, country_id, country_branch_id, city_branch_id from public.enterprise_accounts where deleted_at is null order by created_at asc limit 1`,
    sql`select id, person_code, customer_name, first_name, last_name, country_id, district_id, city_id from public.customers where deleted_at is null order by created_at asc limit 1`,
    sql`select id, employee_code, category, designation, department, country_id, country_branch_id, city_branch_id from public.employees where deleted_at is null order by created_at asc limit 1`,
    sql`select id, name, code from public.countries where deleted_at is null order by created_at asc limit 1`,
    sql`select id, name, code from public.country_branches where deleted_at is null order by created_at asc limit 1`,
    sql`select id, city_name, name, code from public.city_branches where deleted_at is null order by created_at asc limit 1`
  ]);

  const chosenCompany = company[0];
  const chosenAccount = account[0];
  const chosenCustomer = customer[0];
  const chosenEmployee = employee[0];
  const chosenCountry = country[0];
  const chosenMainBranch = mainBranch[0];
  const chosenCityBranch = cityBranch[0];

  const before = await sql`select count(*)::int as count from public.office_documents`;
  const { cookie, body: loginBody } = await loginCookie();

  const title = `DEV TEST Document ${Date.now()}`;
  const fileName = `dev-test-document-${Date.now()}.txt`;
  const payload = makeForm({
    title,
    file_name: fileName,
    file_type: 'text/plain',
    file_size: 123,
    country_id: chosenCountry.id,
    country_name: chosenCountry.name,
    country_branch_id: chosenMainBranch.id,
    main_branch_name: chosenMainBranch.name,
    city_branch_id: chosenCityBranch.id,
    city_branch_name: chosenCityBranch.name,
    company_id: chosenCompany.id,
    company_code: chosenCompany.company_code,
    company_name: chosenCompany.name,
    account_id: chosenAccount.id,
    account_code: chosenAccount.code,
    account_name: chosenAccount.name,
    person_account_id: chosenEmployee.id,
    person_account_code: chosenEmployee.employee_code,
    person_account_name: chosenEmployee.designation || chosenEmployee.department || 'DEV TEST Employee',
    person_account_type: 'employee',
    module_type: 'Document Management',
    document_type: 'DEV TEST Upload',
    source_module: 'general-office/documents',
    source_record_id: chosenEmployee.id,
    source_record_no: chosenEmployee.employee_code,
    category: 'KYC',
    tags: ['dev-test', 'document-management'],
    metadata: { source: 'DEV TEST', customerId: chosenCustomer.id, companyId: chosenCompany.id, accountId: chosenAccount.id, employeeId: chosenEmployee.id },
    created_by: 'Super Admin',
    scanner_device_name: 'DEV Scanner Bridge',
    scanner_bridge: 'simulated'
  }, fileName, `DEV TEST document upload verification at ${new Date().toISOString()}`);

  const postRes = await fetch(`${APP_BASE}/api/documents`, {
    method: 'POST',
    headers: { cookie, accept: 'application/json' },
    body: payload
  });
  const postText = await postRes.text();
  if (!postRes.ok) throw new Error(`POST failed ${postRes.status}: ${postText}`);
  const postJson = JSON.parse(postText);
  const created = postJson.document;
  if (!created?.id) throw new Error(`No document id returned: ${postText}`);

  const getRes = await fetch(`${APP_BASE}/api/documents?search=${encodeURIComponent(title)}`, {
    headers: { cookie, accept: 'application/json' }
  });
  const getText = await getRes.text();
  if (!getRes.ok) throw new Error(`GET failed ${getRes.status}: ${getText}`);
  const getJson = JSON.parse(getText);
  const listed = (getJson.documents ?? []).find((row) => row.id === created.id);
  if (!listed) throw new Error(`Created document not returned by GET: ${getText}`);

  const patchRes = await fetch(`${APP_BASE}/api/documents`, {
    method: 'PATCH',
    headers: { cookie, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ id: created.id, title: `${title} Updated`, category: 'Legal', tags: ['dev-test', 'updated'] })
  });
  const patchText = await patchRes.text();
  if (!patchRes.ok) throw new Error(`PATCH failed ${patchRes.status}: ${patchText}`);
  const patchJson = JSON.parse(patchText);
  if (patchJson.document?.title !== `${title} Updated`) throw new Error(`PATCH did not update title: ${patchText}`);

  const deleteRes = await fetch(`${APP_BASE}/api/documents?id=${encodeURIComponent(created.id)}`, {
    method: 'DELETE',
    headers: { cookie, accept: 'application/json' }
  });
  const deleteText = await deleteRes.text();
  if (!deleteRes.ok) throw new Error(`DELETE failed ${deleteRes.status}: ${deleteText}`);

  const after = await sql`select id, title, file_name, file_url, file_type, file_size, country_id, country_name, country_branch_id, main_branch_name, city_branch_id, city_branch_name, company_id, company_code, company_name, account_id, account_code, account_name, person_account_id, person_account_code, person_account_name, person_account_type, module_type, document_type, source_module, source_record_id, source_record_no, document_path, storage_key, category, tags, metadata, scanned_at, created_by, deleted_at, scanner_device_name, scanner_bridge from public.office_documents where id = ${created.id}::uuid`;

  console.log(JSON.stringify({
    login: JSON.parse(loginBody),
    beforeCount: before[0]?.count ?? null,
    created: created,
    getCount: getJson.documents?.length ?? null,
    updatedTitle: patchJson.document?.title ?? null,
    deleteResult: JSON.parse(deleteText),
    finalRow: after[0] ?? null
  }, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
