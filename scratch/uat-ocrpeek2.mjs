import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='document_intake_jobs' ORDER BY ordinal_position`;
  const hasOcrText = cols.some(c=>/ocr_text|full_text|raw_text|extracted_text/.test(c.column_name));
  console.log("job cols with text:", cols.filter(c=>/text|ocr|content/i.test(c.column_name)).map(c=>c.column_name).join(","));
  const j = (await sql`SELECT contract_reference, document_reference, page_count, ocr_engine, language_detected FROM public.document_intake_jobs WHERE id='56c876c0-aef5-4247-820d-e7be022aa22f'`)[0];
  console.log(JSON.stringify(j));
});
