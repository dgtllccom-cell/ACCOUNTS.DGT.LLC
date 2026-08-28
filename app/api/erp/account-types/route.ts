import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * `account_types` master. The physical table (see supabase/production-schema.sql)
 * carries `code`, `name`, `account_kind` (asset|liability|equity|income|expense)
 * and `is_system`. The Account Type Registry UI models a row as
 * `{ code, name, ledger_group, description, is_active }`, so this route adapts:
 *   ledger_group  <- account_kind   (the accounting group)
 *   is_active     <- NOT is_system? no — there is no active flag; a non-deleted
 *                    row is active.
 *   description   <- not stored; always null.
 */
type AccountKind = "asset" | "liability" | "equity" | "income" | "expense";

const KIND_TO_GROUP: Record<AccountKind, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  income: "Income",
  expense: "Expenses",
};
const GROUP_TO_KIND: Record<string, AccountKind> = {
  assets: "asset",
  asset: "asset",
  liabilities: "liability",
  liability: "liability",
  equity: "equity",
  income: "income",
  revenue: "income",
  expenses: "expense",
  expense: "expense",
};

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "account_types", action: "read" });

    const db = createSupabaseAdminClient() as any;
    const { data, error } = await db
      .from("account_types")
      .select("id, code, name, account_kind, is_system, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    const rows = (data ?? []).map((d: any) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      ledger_group: KIND_TO_GROUP[d.account_kind as AccountKind] ?? d.account_kind ?? "-",
      description: null as string | null,
      is_active: true,
      is_system: !!d.is_system,
      created_at: d.created_at,
    }));

    return apiOk({
      accountTypes: rows,
      summary: { total: rows.length, active: rows.length, inactive: 0 },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "account_types", action: "create" });

    const body = await request.json();
    const { name, code, ledgerGroup } = body ?? {};

    if (!name || !code) {
      return new Response(JSON.stringify({ error: "name and code required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const kind = GROUP_TO_KIND[String(ledgerGroup || "").trim().toLowerCase()] ?? "asset";

    const db = createSupabaseAdminClient() as any;
    const { data, error } = await db
      .from("account_types")
      .insert([{ name, code, account_kind: kind, is_system: false }])
      .select("id, code, name, account_kind, is_system, created_at");

    if (error) throw error;
    const d = data?.[0];
    return apiOk(
      {
        accountType: d
          ? {
              id: d.id,
              code: d.code,
              name: d.name,
              ledger_group: KIND_TO_GROUP[d.account_kind as AccountKind] ?? d.account_kind,
              description: null,
              is_active: true,
              is_system: !!d.is_system,
              created_at: d.created_at,
            }
          : null,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
