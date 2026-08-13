import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "accounts", action: "read" });

    const db = createSupabaseAdminClient();
    const { data: account, error } = await db
      .from("accounts")
      .select(`
        id,
        code,
        name,
        account_type_id,
        country_id,
        is_active,
        created_at,
        updated_at,
        country:countries(name)
      `)
      .eq("id", params.id)
      .single();

    if (error) throw error;
    if (!account) return new Response("Not found", { status: 404 });

    // Get all linked companies, banks, warehouses
    const [companies, banks, warehouses, customers] = await Promise.all([
      db.from("account_companies")
        .select("company_id, companies(id, name, code)")
        .eq("account_id", params.id),
      db.from("account_banks")
        .select("bank_id, banks(id, name, code)")
        .eq("account_id", params.id),
      db.from("account_warehouses")
        .select("warehouse_id, warehouses(id, name, code)")
        .eq("account_id", params.id),
      db.from("account_customer_owners")
        .select("customer_id, customers(id, name, code)")
        .eq("account_id", params.id)
    ]);

    const enriched = {
      ...account,
      linked_companies: companies.data?.map((row: any) => row.companies) || [],
      linked_banks: banks.data?.map((row: any) => row.banks) || [],
      linked_warehouses: warehouses.data?.map((row: any) => row.warehouses) || [],
      linked_customers: customers.data?.map((row: any) => row.customers) || []
    };

    return apiOk({ account: enriched });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "accounts", action: "update" });

    const body = await request.json();
    const { code, name, accountTypeId, isActive } = body;

    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from("accounts")
      .update({
        code: code !== undefined ? code : undefined,
        name: name !== undefined ? name : undefined,
        account_type_id: accountTypeId !== undefined ? accountTypeId : undefined,
        is_active: isActive !== undefined ? isActive : undefined,
        updated_at: new Date().toISOString()
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;
    return apiOk({ account: data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "accounts", action: "delete" });

    const db = createSupabaseAdminClient();

    // Delete all associations first
    await Promise.all([
      db.from("account_companies").delete().eq("account_id", params.id),
      db.from("account_banks").delete().eq("account_id", params.id),
      db.from("account_warehouses").delete().eq("account_id", params.id),
      db.from("account_customer_owners").delete().eq("account_id", params.id)
    ]);

    // Then delete the account
    const { error } = await db.from("accounts").delete().eq("id", params.id);

    if (error) throw error;
    return apiOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
