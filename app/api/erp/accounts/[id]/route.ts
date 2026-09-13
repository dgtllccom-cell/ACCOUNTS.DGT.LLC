import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { writeRecordChangeHistory } from "@/lib/api/record-change-history";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields } from "@/lib/i18n/localize-records";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "accounts", action: "read" });
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));

    const db = createSupabaseAdminClient() as any;
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
      .eq("id", (await params).id)
      .single();

    if (error) throw error;
    if (!account) return new Response("Not found", { status: 404 });

    // Get all linked companies, banks, warehouses
    const [companies, banks, warehouses, customers] = await Promise.all([
      db.from("account_companies")
        .select("company_id, companies(id, name, code)")
        .eq("account_id", (await params).id),
      db.from("account_banks")
        .select("bank_id, banks(id, name, code)")
        .eq("account_id", (await params).id),
      db.from("account_warehouses")
        .select("warehouse_id, warehouses(id, name, code)")
        .eq("account_id", (await params).id),
      db.from("account_customer_owners")
        .select("customer_id, customers(id, name, code)")
        .eq("account_id", (await params).id)
    ]);

    let localizedAccounts = [account];
    let localizedCompanies = companies.data?.map((row: any) => row.companies) || [];
    let localizedBanks = banks.data?.map((row: any) => row.banks) || [];
    let localizedWarehouses = warehouses.data?.map((row: any) => row.warehouses) || [];
    let localizedCustomers = customers.data?.map((row: any) => row.customers) || [];
    try {
      localizedAccounts = await localizeRecordFields<any>(localizedAccounts, "accounts", ["name"], lang);
      localizedCompanies = await localizeRecordFields<any>(localizedCompanies, "companies", ["name"], lang);
      localizedBanks = await localizeRecordFields<any>(localizedBanks, "banks", ["name"], lang);
      localizedWarehouses = await localizeRecordFields<any>(localizedWarehouses, "warehouses", ["name"], lang);
      localizedCustomers = await localizeRecordFields<any>(localizedCustomers, "customers", ["name"], lang);
    } catch {
      // fall back to the raw, unlocalized values already assigned above
    }

    const enriched = {
      ...localizedAccounts[0],
      linked_companies: localizedCompanies,
      linked_banks: localizedBanks,
      linked_warehouses: localizedWarehouses,
      linked_customers: localizedCustomers
    };

    return apiOk({ account: enriched });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "accounts", action: "update" });
    const { id } = await params;

    const body = await request.json();
    const { code, name, accountTypeId, isActive } = body;

    const db = createSupabaseAdminClient() as any;
    const { data: before } = await db.from("accounts").select("*").eq("id", id).maybeSingle();
    const { data, error } = await db
      .from("accounts")
      .update({
        code: code !== undefined ? code : undefined,
        name: name !== undefined ? name : undefined,
        account_type_id: accountTypeId !== undefined ? accountTypeId : undefined,
        is_active: isActive !== undefined ? isActive : undefined,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    void writeRecordChangeHistory({
      recordTable: "accounts",
      recordId: id,
      action: "update",
      actorId: session.userId,
      countryId: data?.country_id ?? before?.country_id ?? null,
      beforeData: before ?? null,
      afterData: data
    }).catch(() => {});

    return apiOk({ account: data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "accounts", action: "delete" });
    const { id } = await params;

    const db = createSupabaseAdminClient() as any;

    // Capture the full record before it's permanently removed — this table has
    // no soft-delete column, so this audit-log snapshot is the only trace left
    // once the row is gone (see docs note in the audit investigation: this is
    // a genuinely hard delete, unlike enterprise_accounts' archive-in-place).
    const { data: before } = await db.from("accounts").select("*").eq("id", id).maybeSingle();

    // Delete all associations first
    await Promise.all([
      db.from("account_companies").delete().eq("account_id", id),
      db.from("account_banks").delete().eq("account_id", id),
      db.from("account_warehouses").delete().eq("account_id", id),
      db.from("account_customer_owners").delete().eq("account_id", id)
    ]);

    // Then delete the account
    const { error } = await db.from("accounts").delete().eq("id", id);

    if (error) throw error;

    void writeRecordChangeHistory({
      recordTable: "accounts",
      recordId: id,
      action: "delete",
      actorId: session.userId,
      countryId: before?.country_id ?? null,
      beforeData: before ?? null,
      afterData: { deleted_at: new Date().toISOString() }
    }).catch(() => {});

    return apiOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
