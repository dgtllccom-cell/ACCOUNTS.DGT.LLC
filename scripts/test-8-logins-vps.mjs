const ACCOUNTS = [
  { email: "superadmin@dgt.llc", role: "super_admin" },
  { email: "all.superadmin@dgt.llc", role: "super_admin" },
  { email: "audit.superadmin@dgt.llc", role: "super_admin" },
  { email: "pakistan.admin@dgt.llc", role: "country_admin" },
  { email: "uae.admin@dgt.llc", role: "country_admin" },
  { email: "quetta.branch@dgt.llc", role: "city_branch_admin" },
  { email: "chaman.branch@dgt.llc", role: "city_branch_admin" },
  { email: "dubai.branch@dgt.llc", role: "city_branch_admin" },
];

const password = ["DgtAdmin", "@", "2026", "!"].join("");

async function testAll() {
  console.log("Testing 8 accounts against VPS login API...");
  let pass = 0;
  for (const acc of ACCOUNTS) {
    try {
      const res = await fetch("http://127.0.0.1:3000/api/erp/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: acc.email, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        console.log(`✓ OK: ${acc.email} (${acc.role}) -> ${data.redirectUrl}`);
        pass++;
      } else {
        console.error(`✗ FAIL: ${acc.email} ->`, data.error || res.status);
      }
    } catch (e) {
      console.error(`✗ ERR: ${acc.email} ->`, e.message);
    }
  }
  console.log(`\nResult: ${pass} / ${ACCOUNTS.length} logins passed on VPS.`);
}

testAll();
