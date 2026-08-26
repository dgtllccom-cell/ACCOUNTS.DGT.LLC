import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withLocalPg } from "@/lib/db/local-postgres";

/**
 * Enterprise 4-Level Serial Allocator for every ERP form/module.
 * Each form passes a UNIQUE entityType so its counters never mix with others.
 * Returns four independent running numbers:
 *   - superAdminSerial : global across the whole ERP for this form (e.g. ACC-SA-00000001)
 *   - countrySerial    : per-country running serial for this form (e.g. AE-ACC-00000001)
 *   - branchSerial     : per-branch running serial for this form (e.g. DXB-ACC-00000001)
 *   - entrySerial      : business module sequence (e.g. ACC/DXB/00000001)
 * Backed by the database allocate_4level_serials() function.
 * Atomic, concurrency-safe, zero-reuse on deletions.
 */
export type FormSerials = {
  superAdminSerial: string | null;
  countrySerial: string | null;
  branchSerial: string | null;
  entrySerial: string | null;
  countryCode?: string | null;
  branchCode?: string | null;
  super_admin_serial?: string | null;
  country_serial?: string | null;
  branch_serial?: string | null;
  entry_serial?: string | null;
};

export async function allocateFormSerials(
  entityType: string,
  opts: { countryId?: string | null; branchKey?: string | null; prefix?: string } = {}
): Promise<FormSerials> {
  const p = (opts.prefix ?? entityType.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4)) || "DOC";
  const countryId = opts.countryId || "GLOBAL";
  const branchKey = opts.branchKey || "GLOBAL";

  // Try direct Postgres connection first (withLocalPg)
  const viaPg = await withLocalPg(async (sql) => {
    const [row] = await sql`
      SELECT allocate_4level_serials(
        ${entityType},
        ${countryId},
        ${branchKey},
        ${p}
      ) as res;
    `;
    const res = row?.res;
    if (!res) return null;
    return {
      superAdminSerial: res.super_admin_serial ?? null,
      countrySerial: res.country_serial ?? null,
      branchSerial: res.branch_serial ?? null,
      entrySerial: res.entry_serial ?? null,
      countryCode: res.country_code ?? null,
      branchCode: res.branch_code ?? null,
      super_admin_serial: res.super_admin_serial ?? null,
      country_serial: res.country_serial ?? null,
      branch_serial: res.branch_serial ?? null,
      entry_serial: res.entry_serial ?? null
    };
  });

  if (viaPg) return viaPg;

  // Supabase RPC fallback
  try {
    const admin = createSupabaseAdminClient() as any;
    const { data, error } = await admin.rpc("allocate_4level_serials", {
      p_entity_type: entityType,
      p_country_id: countryId,
      p_branch_id: branchKey,
      p_custom_prefix: p
    });

    if (!error && data) {
      return {
        superAdminSerial: data.super_admin_serial ?? null,
        countrySerial: data.country_serial ?? null,
        branchSerial: data.branch_serial ?? null,
        entrySerial: data.entry_serial ?? null,
        countryCode: data.country_code ?? null,
        branchCode: data.branch_code ?? null,
        super_admin_serial: data.super_admin_serial ?? null,
        country_serial: data.country_serial ?? null,
        branch_serial: data.branch_serial ?? null,
        entry_serial: data.entry_serial ?? null
      };
    }
  } catch (err) {
    console.warn("allocateFormSerials fallback warning:", err);
  }

  return {
    superAdminSerial: null,
    countrySerial: null,
    branchSerial: null,
    entrySerial: null
  };
}

