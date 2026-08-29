import fs from "node:fs"; import postgres from "postgres";
const DEV = fs.readFileSync(".env.local","utf8").split(/\r?\n/).find(l=>l.startsWith("DATABASE_URL=")).slice(13).replace(/^"|"$/g,"");
const d = postgres(DEV,{max:1,prepare:false});
const { onlyDev, differ } = JSON.parse(fs.readFileSync("scratch/fn-diff-result.json","utf8"));

// exclude: UAE tax module (deferred), and my own 20261001 functions (already correct on replica)
const EXCL = /^(uae_|trg_uae_|sync_uae_|get_uae_tax|provision_module_translation_tables)/;
const wanted = [...new Set([...differ, ...onlyDev])].filter(sig => !EXCL.test(sig));
console.log(`functions to reconcile: ${wanted.length} (excluded ${[...differ,...onlyDev].length - wanted.length} uae/deferred)`);

let out = `-- Production schema reconciliation — function layer.
-- Brings production's accounting / scope / HR-payroll / serial / translation
-- functions to the verified DEV definitions. Every statement is CREATE OR REPLACE
-- (idempotent, reversible). No data touched. UAE-tax functions are intentionally
-- excluded (they ship with the separate UAE Tax module).
--
-- Source: DEV project csesvyxxjivnkkozgopt, captured 2026-08-29.

BEGIN;

`;
let n = 0;
for (const sig of wanted.sort()) {
  const name = sig.slice(0, sig.indexOf("("));
  const args = sig.slice(sig.indexOf("(")+1, -1);
  const rows = await d`SELECT pg_get_functiondef(p.oid) def
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
    WHERE ns.nspname='public' AND p.proname=${name}
      AND pg_get_function_identity_arguments(p.oid)=${args}`;
  if (!rows[0]) { console.log("  MISSING on DEV:", sig); continue; }
  out += `-- ${sig}\n${rows[0].def};\n\n`;
  n++;
}
out += `INSERT INTO public.erp_schema_migrations (name, status)
VALUES ('20261004_prod_reconcile_functions', 'applied')
ON CONFLICT (name) DO UPDATE SET status='applied', applied_at=NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
`;
fs.writeFileSync("supabase/migrations/20261004_prod_reconcile_functions.sql", out);
console.log(`wrote 20261004_prod_reconcile_functions.sql — ${n} functions, ${out.length} bytes`);
await d.end();
