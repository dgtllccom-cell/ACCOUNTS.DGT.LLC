import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RoleLevel = "operator" | "branch" | "country" | "super_admin";

export type HierarchicalSerials = {
  globalSerial: string | null;
  countrySerial: string | null;
  branchSerial: string | null;
  entrySerial: string | null;
  debitSerial?: string | null;
  creditSerial?: string | null;
};

export type SerialAllocationOptions = {
  countryId?: string | null;
  countryIso?: string | null;
  branchId?: string | null;
  branchCode?: string | null;
  entryType?: "debit" | "credit" | "bill_purchase" | "bill_sales" | "bill_expense" | "payment" | "roznamcha";
  customPrefix?: string | null;
};

/**
 * Call DB function next_entity_serial atomically.
 */
async function allocDbSerial(
  admin: any,
  scopeType: string,
  scopeKey: string,
  entityType: string,
  prefix: string
): Promise<string | null> {
  try {
    const { data, error } = await admin.rpc("next_entity_serial", {
      p_scope_type: scopeType,
      p_scope_key: scopeKey || "global",
      p_entity_type: entityType,
      p_prefix: prefix,
    });
    if (error) {
      console.warn(`[serial-service] next_entity_serial RPC error (${scopeType}/${scopeKey}/${entityType}):`, error.message);
      return null;
    }
    return typeof data === "string" ? data : (data ? String(data) : null);
  } catch (err: any) {
    console.warn(`[serial-service] DB allocation threw:`, err?.message);
    return null;
  }
}

/**
 * Centralized ERP-wide Serial Number Allocator.
 * Generates 4-level database-backed serial numbers atomically:
 * 1. Global / Super Admin Serial (e.g. ERP-000125)
 * 2. Country Serial (e.g. PK-000087, UAE-000087)
 * 3. Branch Serial (e.g. DXB-000041, KHI-000041)
 * 4. Entry Serial (e.g. DR-000018 for Debit, CR-000019 for Credit, PB-000020 for Purchase Bill)
 */
export async function allocateHierarchicalSerials(
  moduleName: string,
  options: SerialAllocationOptions = {}
): Promise<HierarchicalSerials> {
  const admin = createSupabaseAdminClient() as any;

  const countryPrefix = (options.countryIso || "CNT").toUpperCase().slice(0, 4);
  const branchPrefix = (options.branchCode || "BRN").toUpperCase().slice(0, 5);

  let entryPrefix = "ENT";
  let entryEntity = `${moduleName}_entry`;

  if (options.entryType === "debit") {
    entryPrefix = "DR";
    entryEntity = "roznamcha_debit";
  } else if (options.entryType === "credit") {
    entryPrefix = "CR";
    entryEntity = "roznamcha_credit";
  } else if (options.entryType === "bill_purchase") {
    entryPrefix = "PB";
    entryEntity = "bill_purchase";
  } else if (options.entryType === "bill_sales") {
    entryPrefix = "SB";
    entryEntity = "bill_sales";
  } else if (options.entryType === "bill_expense") {
    entryPrefix = "EXP";
    entryEntity = "bill_expense";
  } else if (options.entryType === "payment") {
    entryPrefix = "PMT";
    entryEntity = "voucher_payment";
  }

  const [globalSerial, countrySerial, branchSerial, entrySerial] = await Promise.all([
    allocDbSerial(admin, "global", "GLOBAL", moduleName, "ERP"),
    allocDbSerial(admin, "country", options.countryId || "GLOBAL", moduleName, countryPrefix),
    allocDbSerial(admin, "branch", options.branchId || "GLOBAL", moduleName, branchPrefix),
    allocDbSerial(admin, "global", "ENTRY", entryEntity, entryPrefix),
  ]);

  return {
    globalSerial: globalSerial || `ERP-${Date.now().toString(36).toUpperCase()}`,
    countrySerial: options.countryId ? (countrySerial || `${countryPrefix}-${Date.now().toString(36).toUpperCase()}`) : null,
    branchSerial: options.branchId ? (branchSerial || `${branchPrefix}-${Date.now().toString(36).toUpperCase()}`) : null,
    entrySerial: entrySerial || `${entryPrefix}-${Date.now().toString(36).toUpperCase()}`,
    debitSerial: options.entryType === "debit" ? (entrySerial || `DR-${Date.now().toString(36).toUpperCase()}`) : null,
    creditSerial: options.entryType === "credit" ? (entrySerial || `CR-${Date.now().toString(36).toUpperCase()}`) : null,
  };
}

/**
 * Filter visible serials based on logged-in user's organizational permission level.
 */
export function getRoleVisibleSerials(
  serials: {
    superAdminSerial?: string | null;
    countrySerial?: string | null;
    branchSerial?: string | null;
    entrySerial?: string | null;
    debitSerial?: string | null;
    creditSerial?: string | null;
  },
  roleLevel: RoleLevel
) {
  const entry = serials.entrySerial || serials.debitSerial || serials.creditSerial || "-";
  const branch = serials.branchSerial || "-";
  const country = serials.countrySerial || "-";
  const global = serials.superAdminSerial || "-";

  switch (roleLevel) {
    case "operator":
      return {
        showGlobal: false,
        showCountry: false,
        showBranch: false,
        showEntry: true,
        entrySerial: entry,
      };
    case "branch":
      return {
        showGlobal: false,
        showCountry: false,
        showBranch: true,
        showEntry: true,
        branchSerial: branch,
        entrySerial: entry,
      };
    case "country":
      return {
        showGlobal: false,
        showCountry: true,
        showBranch: true,
        showEntry: true,
        countrySerial: country,
        branchSerial: branch,
        entrySerial: entry,
      };
    case "super_admin":
    default:
      return {
        showGlobal: true,
        showCountry: true,
        showBranch: true,
        showEntry: true,
        globalSerial: global,
        countrySerial: country,
        branchSerial: branch,
        entrySerial: entry,
      };
  }
}
