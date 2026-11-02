/**
 * DEV only - verification of the three follow-up cards (Shipping-line menu link, ACC-000080 uuid errors, Order Transfer translations) plus the
 * Truck detail API, through the real routes.
 *   BASE=http://localhost:3541 TRUCK=<truck id> node scripts/dev/task-cards-verify.mjs
 */
import fs from "node:fs";
import { login, client, tally } from "./_rbac-lib.mjs";

const T = tally();
const sa = client(await login({ role: "super_admin" }));
const TRUCK = process.env.TRUCK;

// 1. the "Shipping Lines" sidebar link and the old plural URL land on a real page (no 404)
const sl = await sa.get("/dashboard/shipping-line");
T.check("/dashboard/shipping-line renders a page for an authorized login (no 404)", sl.status === 200, `${sl.status}`);
const sls = await sa.get("/dashboard/shipping-lines");
T.check("/dashboard/shipping-lines forwards to /dashboard/shipping-line", [200, 307, 308].includes(sls.status) && (sls.status === 200 || /\/dashboard\/shipping-line$/.test(sls.location)), `${sls.status} ${sls.location}`);

// 2. account numbers where ids are expected answer 400 INVALID_ID, never a uuid-cast 500
for (const path of ["/api/erp/clearing-agent/customer-order/ACC-000080/expense-transfer", "/api/erp/master-data/trucks/ACC-000080"]) {
  const r = await sa.get(path);
  T.check(`${path} -> 400 INVALID_ID (not 500)`, r.status === 400 && /INVALID_ID|not a valid ID/i.test(r.text), `${r.status} ${r.text.slice(0, 90)}`);
}
const post = await sa.req("POST", "/api/erp/clearing-agent/customer-order/ACC-000080/expense-transfer", { destination: "customs" });
T.check("POST expense-transfer with an account number -> 400 (nothing recorded)", post.status === 400, `${post.status}`);

// 2b. the Truck detail API (selected customers.cnic, a column that exists in neither database -> 500 for every truck)
if (TRUCK) {
  const t = await sa.get(`/api/erp/master-data/trucks/${TRUCK}`);
  T.check("Truck detail API answers 200 with the truck (was 500: column owner.cnic does not exist)", t.status === 200 && Boolean(t.json?.truck?.id), `${t.status} ${t.text.slice(0, 90)}`);
  T.check("Truck detail carries the owner CNIC field from the truck's own record", t.json?.truck && "owner_display_cnic" in t.json.truck);
}

// 3. every Order Transfer label resolves in all five languages (no missing key, none left in English)
const src = fs.readFileSync("features/clearing-agent/components/customer-order-transfer-view.tsx", "utf8");
const ui = fs.readFileSync("lib/i18n/ui.ts", "utf8").replace(/\r\n/g, "\n");
const keys = [...new Set([...src.matchAll(/\btt\(\s*"([^"]+)"/g)].map((m) => m[1]))];
const vals = new Map();
for (const line of ui.split("\n")) { const m = /^  "([^"]+)": (".*"),?$/.exec(line); if (m) { if (!vals.has(m[1])) vals.set(m[1], []); vals.get(m[1]).push(m[2]); } }
const missing = keys.filter((k) => (vals.get(k) || []).length < 5);
const english = keys.filter((k) => { const v = vals.get(k) || []; return v.length >= 5 && v.slice(1).some((x) => x === v[0]) && !/^"[A-Z0-9 /.-]{1,6}"$/.test(v[0]); });
T.check(`Order Transfer: all ${keys.length} labels exist in EN/UR/AR/FA/PS`, keys.length > 100 && missing.length === 0, missing.slice(0, 5).join(", "));
T.check("Order Transfer: no label left in English in UR/AR/FA/PS", english.length === 0, english.slice(0, 5).join(", "));

process.exit(T.summary() ? 0 : 1);
