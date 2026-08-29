import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  // All 11 null-country active employees — which are they?
  const nulls = await sql`SELECT id, employee_code, designation, department, working_shift FROM public.employees WHERE deleted_at IS NULL AND status='Active' AND country_id IS NULL ORDER BY employee_code`;
  console.log("null-country active employees:");
  for (const n of nulls) console.log("  " + n.employee_code + " design=" + n.designation + " dept=" + n.department);

  // The DEV-AE-TEST-DUBAI ones: restore UAE scope + reconstruct design/dept from the code
  for (const n of nulls) {
    const m = n.employee_code.match(/DUBAI-001-EMP-(\d+)/);
    if (!m) { console.log("  SKIP (not a Dubai test emp):", n.employee_code); continue; }
    const nn = m[1];
    await sql`UPDATE public.employees SET
      country_id = '935dd0b9-8228-43b3-b53d-c06e9ae2882f'::uuid,
      country_branch_id = '87c2e253-b6c1-482d-a808-272337f3ffda'::uuid,
      city_branch_id = '6867d9b1-d6c0-4aed-aff9-e924d04ef202'::uuid,
      designation = COALESCE(designation, ${'DEV TEST DEV TEST Dubai City Branch Designation ' + nn}),
      department = COALESCE(department, ${'DEV TEST DEV TEST Dubai City Branch Department ' + nn}),
      updated_at = now()
      WHERE id = ${n.id}`;
    console.log("  restored " + n.employee_code);
  }
  const after = await sql`SELECT count(*)::int n FROM public.employees WHERE deleted_at IS NULL AND status='Active' AND country_id IS NULL`;
  console.log("\nremaining null-country:", after[0].n, "(Bilal Ahmed EMP-0003 was always null — created without a branch)");
});
process.exit(0);
