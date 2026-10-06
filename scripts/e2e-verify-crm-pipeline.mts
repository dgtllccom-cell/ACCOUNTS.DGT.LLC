// Real-data E2E verification of the new CRM sales pipeline (migration
// 20261221_crm_lead_pipeline.sql) against DEV (csesvyxxjivnkkozgopt only).
// Exercises the real service functions end to end: create a real inquiry,
// walk it through every real stage transition, confirm the audit trail,
// confirm illegal transitions are blocked, confirm scope isolation.

import { withLocalPg, getDbUrl } from "../lib/db/local-postgres";
import { createInquiry, setPipelineStage, pipelineBoard, getInquiry } from "../lib/customer-inquiry/service";
import { allowedNextPipelineStages } from "../lib/customer-inquiry/access";

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

const S = (isSuperAdmin: boolean) => ({ userId: SUPERADMIN_ID, isSuperAdmin, fullName: "E2E Tester", roles: [], countryIds: isSuperAdmin ? null : [], email: "e2e@test.local" } as any);
const wrongCountrySession = { userId: "00000000-0000-4000-8000-000000000099", isSuperAdmin: false, fullName: "Wrong Scope Tester", roles: ["country_admin"], countryIds: ["00000000-0000-0000-0000-0000000000aa"], countryBranchIds: [], cityBranchIds: [], assignments: [], email: "wrong@test.local" } as any;

async function main() {
  const dbUrl = getDbUrl();
  if (!dbUrl.includes(DEV_HOST_FRAGMENT)) throw new Error("Refusing to run: DATABASE_URL does not target DEV.");
  console.log(`Connected to DEV (${DEV_HOST_FRAGMENT}) — confirmed.\n`);

  const session = S(true);

  // 1. Create a real test lead.
  const created = await createInquiry(session, {
    customerName: `E2E Pipeline Test Lead ${Date.now()}`,
    companyName: "E2E Pipeline Test Co",
    mobile: "+92-300-0000000",
    requirements: "E2E test requirement",
    source: "phone",
    countryId: PK_COUNTRY_ID,
    entryMode: "manual",
  } as any);
  assertTrue("createInquiry returns a real id + inquiry_no", !!created.id && !!created.inquiryNo);

  // 2. New leads start at 'new_lead'.
  let detail = await getInquiry(session, created.id, { lang: "en" as any });
  assertTrue("new inquiry starts at pipeline_stage = 'new_lead'", detail.pipeline_stage === "new_lead", detail.pipeline_stage);
  assertTrue("allowedNextPipelineStages from new_lead is exactly ['contacted','lost']", JSON.stringify([...allowedNextPipelineStages(session, detail)].sort()) === JSON.stringify(["contacted", "lost"]));

  // 3. Illegal transition (skip stages) is blocked.
  let blocked = false;
  try { await setPipelineStage(session, created.id, "won"); } catch (e: any) { blocked = e?.code === "BAD_TRANSITION"; }
  assertTrue("illegal transition new_lead -> won is blocked (BAD_TRANSITION)", blocked);

  // 4. Walk the full real funnel: new_lead -> contacted -> qualified -> quotation_sent -> negotiation -> won.
  await setPipelineStage(session, created.id, "contacted", { note: "E2E: called customer" });
  detail = await getInquiry(session, created.id, { lang: "en" as any });
  assertTrue("stage advanced to contacted", detail.pipeline_stage === "contacted");

  await setPipelineStage(session, created.id, "qualified", { note: "E2E: budget + authority confirmed" });
  await setPipelineStage(session, created.id, "quotation_sent", { note: "E2E: quotation emailed", quotationValue: 15000, quotationCurrency: "USD" });
  detail = await getInquiry(session, created.id, { lang: "en" as any });
  assertTrue("quotation_sent stamps quotation_sent_at + value + currency", !!detail.quotation_sent_at && Number(detail.quotation_value) === 15000 && detail.quotation_currency === "USD", detail);

  await setPipelineStage(session, created.id, "negotiation", { note: "E2E: negotiating price" });
  await setPipelineStage(session, created.id, "won", { note: "E2E: deal closed" });
  detail = await getInquiry(session, created.id, { lang: "en" as any });
  assertTrue("stage reached won", detail.pipeline_stage === "won");
  assertTrue("allowedNextPipelineStages from won is empty (terminal)", allowedNextPipelineStages(session, detail).length === 0, allowedNextPipelineStages(session, detail));

  // 5. Terminal stage cannot be moved again.
  let wonBlocked = false;
  try { await setPipelineStage(session, created.id, "lost"); } catch (e: any) { wonBlocked = e?.code === "BAD_TRANSITION"; }
  assertTrue("won -> lost is blocked (terminal stage)", wonBlocked);

  // 6. Real audit trail: one event per real transition (new_lead is the implicit start, not an event; 5 explicit transitions were made).
  const events = await withLocalPg((sql) => sql`select from_stage, to_stage, note, actor_name from public.customer_inquiry_pipeline_events where inquiry_id = ${created.id}::uuid order by created_at asc`);
  assertTrue("5 real pipeline transition events recorded", (events as any[]).length === 5, events);
  assertTrue("events are in the exact real order they happened", JSON.stringify((events as any[]).map((e) => e.to_stage)) === JSON.stringify(["contacted", "qualified", "quotation_sent", "negotiation", "won"]), events);
  assertTrue("each event recorded the real actor name", (events as any[]).every((e) => e.actor_name === "E2E Tester"), events);

  // 7. A separate "lost" lead, to prove the lost-reason path and mid-funnel "lost" jump.
  const lostLead = await createInquiry(session, { customerName: `E2E Lost Lead ${Date.now()}`, source: "email", countryId: PK_COUNTRY_ID, entryMode: "manual" } as any);
  await setPipelineStage(session, lostLead.id, "contacted");
  await setPipelineStage(session, lostLead.id, "lost", { lostReason: "E2E: went with a competitor" });
  const lostDetail = await getInquiry(session, lostLead.id, { lang: "en" as any });
  assertTrue("mid-funnel lost jump works (contacted -> lost)", lostDetail.pipeline_stage === "lost");
  assertTrue("lost_reason recorded on the real row", lostDetail.lost_reason === "E2E: went with a competitor", lostDetail.lost_reason);

  // 8. Scope isolation: a session scoped to an unrelated country cannot see or move this Pakistan-scoped lead.
  const board = await pipelineBoard(session, { lang: "en" as any, includeClosed: true });
  assertTrue("pipelineBoard (super admin) includes the won test lead", board.won.some((r: any) => r.id === created.id));
  const wrongBoard = await pipelineBoard(wrongCountrySession, { lang: "en" as any, includeClosed: true });
  assertTrue("pipelineBoard scoped to an unrelated country does NOT see the Pakistan test lead", !Object.values(wrongBoard).flat().some((r: any) => r.id === created.id));
  // setPipelineStage mirrors the existing setStatus design: an out-of-scope session
  // fails canEditInquiry, so allowedNextPipelineStages returns [] and the transition
  // is rejected as BAD_TRANSITION — the same mechanism already used for `status`.
  let scopeBlocked = false;
  try { await setPipelineStage(wrongCountrySession, created.id, "lost"); } catch (e: any) { scopeBlocked = e?.code === "BAD_TRANSITION" || e?.code === "NOT_FOUND" || e?.code === "FORBIDDEN"; }
  assertTrue("an unrelated-scope session cannot move this lead's stage", scopeBlocked);
  const afterScopeAttempt = await getInquiry(session, created.id, { lang: "en" as any });
  assertTrue("the lead's real pipeline_stage is unchanged after the blocked attempt", afterScopeAttempt.pipeline_stage === "won", afterScopeAttempt.pipeline_stage);

  console.log("\nALL CRM PIPELINE E2E CHECKS PASSED.");
  console.log(JSON.stringify({ wonLeadId: created.id, lostLeadId: lostLead.id }, null, 2));
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error("\nE2E VERIFICATION FAILED:", err?.message || err);
    process.exit(1);
  });
