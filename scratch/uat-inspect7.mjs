import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  console.log("=== document intake registry / doc types ===");
  const t = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%doc%type%' OR table_name ILIKE '%document_intake%' ORDER BY 1`;
  console.log(t.map(x=>x.table_name).join("\n"));
  // find registry table
  for (const cand of ['document_intake_doc_types','document_type_registry','document_intake_registry','document_types']) {
    const ex = await sql`SELECT to_regclass(${'public.'+cand}) r`;
    if (ex[0].r) {
      console.log(`\n--- ${cand} rows ---`);
      const rows = await sql.unsafe(`SELECT * FROM public.${cand} ORDER BY 1 LIMIT 60`);
      for (const r of rows) console.log(JSON.stringify(r));
    }
  }
});
