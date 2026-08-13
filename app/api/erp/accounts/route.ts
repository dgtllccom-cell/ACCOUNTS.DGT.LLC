import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "accounts", action: "read" });

    const db = createSupabaseAdminClient();

    // Get accounts with associated data
    const { data: accounts, error } = await db
      .from("accounts")
      .select(`
        id,
        code,
        name,
        account_type_id,
        country_id,
        is_active,
        created_at,
        country:countries(name)
      `)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    // Get link counts for each account
    const accountIds = accounts?.map((a: any) => a.id) || [];
    if (accountIds.length === 0) {
      return apiOk({
        accounts: [],
        summary: { total: 0, active: 0, inactive: 0 }
      });
    }

    const [companiesRes, banksRes, warehousesRes] = await Promise.all([
      db.from("account_companies").select("account_id").in("account_id", accountIds),
      db.from("account_banks").select("account_id").in("account_id", accountIds),
      db.from("account_warehouses").select("account_id").in("account_id", accountIds)
    ]);

    const linkCounts = new Map<string, { companies: number; banks: number; warehouses: number }>();
    accountIds.forEach((id: string) => {
      linkCounts.set(id, { companies: 0, banks: 0, warehouses: 0 });
    });

    companiesRes.data?.forEach((row: any) => {
      const current = linkCounts.get(row.account_id) || { companies: 0, banks: 0, warehouses: 0 };
      current.companies++;
      linkCounts.set(row.account_id, current);
    });

    banksRes.data?.forEach((row: any) => {
      const current = linkCounts.get(row.account_id) || { companies: 0, banks: 0, warehouses: 0 };
      current.banks++;
      linkCounts.set(row.account_id, current);
    });

    warehousesRes.data?.forEach((row: any) => {
      const current = linkCounts.get(row.account_id) || { companies: 0, banks: 0, warehouses: 0 };
      current.warehouses++;
      linkCounts.set(row.account_id, current);
    });

    const enrichedAccounts = accounts?.map((a: any) => ({
      ...a,
      links: linkCounts.get(a.id) || { companies: 0, banks: 0, warehouses: 0 }
    }));

    const active = enrichedAccounts?.filter((a: any) => a.is_active).length || 0;
    return apiOk({
      accounts: enrichedAccounts || [],
      summary: {
        total: enrichedAccounts?.length || 0,
        active,
        inactive: (enrichedAccounts?.length || 0) - active
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "accounts", action: "create" });

    const body = await request.json();
    const { code, name, accountTypeId, countryId, isActive } = body;

    if (!code || !name || !countryId) {
      return new Response(JSON.stringify({ error: "code, name, countryId required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from("accounts")
      .insert([{
        code,
        name,
        account_type_id: accountTypeId || null,
        country_id: countryId,
        is_active: isActive !== false,
        created_at: new Date().toISOString()
      }])
      .select();

    if (error) throw error;
    return apiOk({ account: data?.[0] }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
