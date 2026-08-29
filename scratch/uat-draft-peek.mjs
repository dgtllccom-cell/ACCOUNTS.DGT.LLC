import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  const d = (await sql`SELECT draft_no, target_module, link_mode, currency, draft_payload, line_items, field_provenance, linked_source_module, linked_source_id, status FROM public.document_intake_drafts WHERE id='f9887913-9eb2-436f-81e8-378d036ac0f0'`)[0];
  console.log("draft:", d.draft_no, "| target:", d.target_module, "| linkMode:", d.link_mode, "| currency:", d.currency, "| status:", d.status);
  console.log("\nPURCHASE PREFILL PAYLOAD:");
  console.log(JSON.stringify(d.draft_payload, null, 1));
  console.log("\nLINE ITEMS:", JSON.stringify(d.line_items));
  console.log("\nPROVENANCE:", JSON.stringify(d.field_provenance, null, 1));
});
