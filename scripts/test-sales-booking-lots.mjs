const BASE = "http://localhost:3000";

async function run() {
  const sessionRes = await fetch(`${BASE}/api/erp/auth/dev-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "super_admin" }),
  });
  const cookieHeader = (sessionRes.headers.get("set-cookie") || "").split(";")[0];
  const headers = { Cookie: cookieHeader, "Content-Type": "application/json" };

  for (const src of ["stock", "local", "warehouse", "in_transit", "booking", "endorse"]) {
    const res = await fetch(`${BASE}/api/erp/sales/available-lots?source=${src}`, { headers });
    const json = await res.json();
    console.log(`Source [${src}]:`, json.ok ? (json.data?.lots?.length ?? 0) : json.error);
    if (json.data?.lots?.length) {
      console.log(`  Sample:`, json.data.lots[0]);
    }
  }

  const walnutRes = await fetch(`${BASE}/api/erp/sales/available-lots?source=stock&goodsName=Walnut`, { headers });
  const walnutJson = await walnutRes.json();
  console.log(`\nFiltered by Walnut:`, walnutJson.data?.lots?.length, walnutJson.data?.lots);
}

run().catch(console.error);
