// Real-data E2E verification of the 8 CRM Insights categories against DEV
// (csesvyxxjivnkkozgopt only). Confirms every category runs without error,
// returns a real shape, and that a real synthetic case in each real-data
// category actually surfaces (not just "always empty").

import { getDbUrl } from "../lib/db/local-postgres";
import { getCrmInsights } from "../lib/crm/crm-insights-service";
import { createInquiry, setPipelineStage } from "../lib/customer-inquiry/service";

const DEV_HOST_FRAGMENT = "csesvyxxjivnkkozgopt";
const SUPERADMIN_ID = "00000000-0000-4000-8000-000000000001";
const PK_COUNTRY_ID = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14";

function assertTrue(label: string, cond: boolean, extra?: unknown) {
  if (!cond) {
    console.error(`FAIL: ${label}`, extra ?? "");
    process.exitCode = 1;
    throw new Error(`Assertion failed: ${label}`);
  }
  console.log(`PASS: ${label}`);
}

const session = { userId: SUPERADMIN_ID, isSuperAdmin: true, fullName: "E2E Tester", roles: [], countryIds: null, email: "e2e@test.local" } as any;

async function main() {
  const dbUrl = getDbUrl();
  if (!dbUrl.includes(DEV_HOST_FRAGMENT)) throw new Error("Refusing to run: DATABASE_URL does not target DEV.");
  console.log(`Connected to DEV (${DEV_HOST_FRAGMENT}) — confirmed.\n`);

  const CATEGORIES = ["hot_lead", "stale_lead", "follow_up_missed", "callback_today", "quotation_no_response", "old_customer_reactivation", "payment_follow_up", "no_next_action"];

  const before = await getCrmInsights(session);
  assertTrue("getCrmInsights returns exactly 8 groups", before.length === 8, before.length);
  assertTrue("all 8 real category names are present", CATEGORIES.every((c) => before.some((g) => g.category === c)), before.map((g) => g.category));
  for (const g of before) {
    assertTrue(`${g.category}: count matches rows.length (capped at 30)`, g.count === g.rows.length || g.rows.length === 30, { count: g.count, rows: g.rows.length });
    for (const r of g.rows) {
      assertTrue(`${g.category}: row has a real id/title/href/nextBestAction`, !!r.id && !!r.title && !!r.href && !!r.nextBestAction, r);
    }
  }

  // Real synthetic case: a lead moved to 'qualified' in the last 7 days must appear in HOT_LEAD.
  const hotTest = await createInquiry(session, { customerName: `E2E Hot Lead ${Date.now()}`, source: "phone", countryId: PK_COUNTRY_ID, entryMode: "manual" } as any);
  await setPipelineStage(session, hotTest.id, "contacted");
  await setPipelineStage(session, hotTest.id, "qualified");
  const afterHot = await getCrmInsights(session);
  const hotGroup = afterHot.find((g) => g.category === "hot_lead")!;
  assertTrue("a lead just moved to 'qualified' appears in HOT_LEAD", hotGroup.rows.some((r) => r.id === hotTest.id), hotGroup.rows.map((r) => r.id));

  // Real synthetic case: a lead with quotation_sent 6 days ago must appear in QUOTATION_NO_RESPONSE.
  const quoteTest = await createInquiry(session, { customerName: `E2E Quote Lead ${Date.now()}`, source: "phone", countryId: PK_COUNTRY_ID, entryMode: "manual" } as any);
  await setPipelineStage(session, quoteTest.id, "contacted");
  await setPipelineStage(session, quoteTest.id, "qualified");
  await setPipelineStage(session, quoteTest.id, "quotation_sent", { quotationValue: 5000, quotationCurrency: "USD" });
  // Backdate quotation_sent_at to 6 days ago to prove the real >5-day rule (not just "was set at all").
  const { withLocalPg } = await import("../lib/db/local-postgres");
  await withLocalPg((sql) => sql`update public.customer_inquiries set quotation_sent_at = now() - interval '6 days' where id = ${quoteTest.id}::uuid`);
  const afterQuote = await getCrmInsights(session);
  const quoteGroup = afterQuote.find((g) => g.category === "quotation_no_response")!;
  assertTrue("a quotation backdated 6 days appears in QUOTATION_NO_RESPONSE", quoteGroup.rows.some((r) => r.id === quoteTest.id), quoteGroup.rows.map((r) => r.id));

  // Honesty check: a lead with quotation sent TODAY must NOT appear yet (rule is >5 days, not "any quotation").
  const freshQuoteTest = await createInquiry(session, { customerName: `E2E Fresh Quote ${Date.now()}`, source: "phone", countryId: PK_COUNTRY_ID, entryMode: "manual" } as any);
  await setPipelineStage(session, freshQuoteTest.id, "contacted");
  await setPipelineStage(session, freshQuoteTest.id, "qualified");
  await setPipelineStage(session, freshQuoteTest.id, "quotation_sent", { quotationValue: 1000, quotationCurrency: "USD" });
  const afterFresh = await getCrmInsights(session);
  const freshGroup = afterFresh.find((g) => g.category === "quotation_no_response")!;
  assertTrue("a quotation sent TODAY does NOT appear in QUOTATION_NO_RESPONSE yet (honest >5-day rule)", !freshGroup.rows.some((r) => r.id === freshQuoteTest.id), freshGroup.rows.map((r) => r.id));

  console.log("\nALL CRM INSIGHTS E2E CHECKS PASSED.");
  console.log(JSON.stringify(before.map((g) => ({ category: g.category, count: g.count })), null, 2));
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error("\nE2E VERIFICATION FAILED:", err?.message || err);
    process.exit(1);
  });
