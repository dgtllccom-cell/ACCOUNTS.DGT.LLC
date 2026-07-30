import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Centralized 4-serial allocator for every ERP form/module.
 * Each form passes a UNIQUE entityType so its counters never mix with others.
 * Returns four independent running numbers:
 *   - superAdminSerial : global across the whole ERP for this form
 *   - countrySerial    : per-country running serial for this form
 *   - branchSerial     : per-branch running serial for this form
 *   - entrySerial      : unique per individual transaction
 * Backed by the existing next_entity_serial() DB function (no duplicate logic).
 * Non-fatal: on any failure a serial is null rather than blocking the save.
 */
export type FormSerials = {
  superAdminSerial: string | null;
  countrySerial: string | null;
  branchSerial: string | null;
  entrySerial: string | null;
};

async function alloc(admin: any, scopeType: string, scopeKey: string, entityType: string, prefix: string): Promise<string | null> {
  try {
    const { data, error } = await admin.rpc("next_entity_serial", {
      p_scope_type: scopeType,
      p_scope_key: scopeKey,
      p_entity_type: entityType,
      p_prefix: prefix,
    });
    if (error) return null;
    return typeof data === "string" ? data : (data ?? null);
  } catch {
    return null;
  }
}

export async function allocateFormSerials(
  entityType: string,
  opts: { countryId?: string | null; branchKey?: string | null; prefix?: string } = {}
): Promise<FormSerials> {
  const admin = createSupabaseAdminClient() as any;
  const p = (opts.prefix ?? entityType.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4)) || "FRM";
  const [superAdminSerial, countrySerial, branchSerial, entrySerial] = await Promise.all([
    alloc(admin, "global", "GLOBAL", entityType, `${p}-SA`),
    alloc(admin, "country", opts.countryId || "GLOBAL", entityType, `${p}-C`),
    alloc(admin, "branch", opts.branchKey || "GLOBAL", entityType, `${p}-B`),
    alloc(admin, "global", "ENTRY", entityType, `${p}-E`),
  ]);
  return { superAdminSerial, countrySerial, branchSerial, entrySerial };
}
