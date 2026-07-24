import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCentralMasterDefinition } from "@/lib/master-data/central-master-tables";
import { getMasterLanguage, resolveMultilingualField } from "@/lib/master-data/multilingual";

function clean(value: string | null | undefined) {
  return (value ?? "").trim();
}

function includesQuery(row: Record<string, unknown>, query: string, keys: string[]) {
  if (!query) return true;
  const q = query.toLowerCase();
  return keys.some((key) => String(row[key] ?? "").toLowerCase().includes(q));
}

function applyScope(row: Record<string, unknown>, session: Awaited<ReturnType<typeof requireErpSession>>) {
  if (session.isSuperAdmin) return true;

  const countryId = String(row.country_id ?? row.origin_country_id ?? "");
  if (countryId && session.countryIds.length > 0 && !session.countryIds.includes(countryId)) return false;

  const cityBranchId = String(row.city_branch_id ?? row.branch_id ?? "");
  if (cityBranchId && session.cityBranchIds.length > 0 && !session.cityBranchIds.includes(cityBranchId)) return false;

  return true;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const entity = clean(request.nextUrl.searchParams.get("entity"));
    const definition = getCentralMasterDefinition(entity);
    if (!definition) {
      throw new Error(`Unsupported master-data entity: ${entity || "missing"}`);
    }

    const language = getMasterLanguage(
      request.nextUrl.searchParams.get("lang") ||
        request.headers.get("x-erp-language") ||
        request.cookies.get("erp_lang")?.value
    );
    const q = clean(request.nextUrl.searchParams.get("q"));
    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") || 50), 1), 250);

    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase.from(definition.table).select("*").limit(Math.max(limit * 4, limit));
    if (error) throw new Error(error.message);

    const searchKeys = [
      ...definition.legacyNameColumns,
      ...definition.codeColumns,
      "name_en",
      "name_ur",
      "name_ar",
      "name_fa",
      "name_ps"
    ];

    const records = (Array.isArray(data) ? data : [])
      .filter((row: Record<string, unknown>) => row.deleted_at === undefined || row.deleted_at === null)
      .filter((row: Record<string, unknown>) => applyScope(row, session))
      .filter((row: Record<string, unknown>) => includesQuery(row, q, searchKeys))
      .slice(0, limit)
      .map((row: Record<string, unknown>) => {
        const label = resolveMultilingualField(row, definition.labelBase, language, definition.legacyNameColumns);
        const code = definition.codeColumns.map((key) => clean(String(row[key] ?? ""))).find(Boolean) ?? "";
        return {
          id: row.id,
          entity: definition.key,
          table: definition.table,
          label,
          code,
          language,
          raw: row
        };
      });

    return apiOk({ entity: definition.key, table: definition.table, language, records, limit });
  } catch (error) {
    return handleApiError(error);
  }
}
