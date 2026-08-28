import fs from "node:fs";
import { withLocalPg } from "../lib/db/local-postgres.ts";
const t = fs.readFileSync("supabase/migrations/20260930_hr_leave_attendance_reconciliation.sql","utf8");
await withLocalPg(async (sql) => {
  await sql.unsafe(t);
  const chk = await sql`SELECT
    (SELECT count(*)::int FROM information_schema.columns WHERE table_name='office_leave_requests' AND column_name='balance_effect') has_be,
    (SELECT count(*)::int FROM information_schema.columns WHERE table_name='office_attendance' AND column_name='expected_hours') has_eh,
    (SELECT count(*)::int FROM information_schema.columns WHERE table_name='employees' AND column_name='user_id') has_uid,
    to_regclass('public.hr_payroll_reconciliation_v') recon_v,
    (SELECT count(*)::int FROM public.hr_shifts WHERE deleted_at IS NULL) shifts`;
  console.log(JSON.stringify(chk[0]));
});
process.exit(0);
