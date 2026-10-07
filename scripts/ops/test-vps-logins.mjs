const BASE = "http://72.60.209.121";

const TEST_ACCOUNTS = [
  { id: "superadmin@dgt.llc", pass: "Chaman@9090" },
  { id: "SUPERADMIN", pass: "Chaman@9090" },
  { id: "pakistan.admin@dgt.llc", pass: "Chaman@9090" },
  { id: "PAKISTAN.ADMIN", pass: "Chaman@9090" },
  { id: "uae.admin@dgt.llc", pass: "Chaman@9090" },
  { id: "UAE.ADMIN", pass: "Chaman@9090" },
  { id: "quetta.branch@dgt.llc", pass: "Chaman@9090" },
  { id: "QUETTA.BRANCH", pass: "Chaman@9090" },
  { id: "business.superadmin@dgt.llc", pass: "Chaman@9090" },
  { id: "shipping.superadmin@dgt.llc", pass: "Chaman@9090" },
  { id: "chaman.shipping@dgt.llc", pass: "Chaman@9090" },
  { id: "alras.shipping@dgt.llc", pass: "Chaman@9090" },
  { id: "ALRAS.SHIPPING@dgt.llc", pass: "Chaman@9090" },
];

async function testLogin(account) {
  try {
    const res = await fetch(`${BASE}/api/erp/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: account.id, password: account.pass })
    });
    const json = await res.json();
    return { status: res.status, ok: res.ok, data: json };
  } catch (err) {
    return { status: "ERR", error: err.message };
  }
}

async function main() {
  console.log(`Testing logins on VPS (${BASE})...\n`);
  for (const acc of TEST_ACCOUNTS) {
    const r = await testLogin(acc);
    console.log(`[${acc.id}] (pass: ${acc.pass}) => Status: ${r.status} | OK: ${r.ok} | Redirect: ${r.data?.redirectUrl || r.data?.error}`);
  }
}

main();
