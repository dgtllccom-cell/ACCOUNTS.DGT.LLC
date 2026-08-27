import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "accounts", action: "update" });

    const body = await request.json();
    const { type, linkedId, action } = body;

    if (!["companies", "banks", "warehouses", "customers"].includes(type)) {
      return new Response(JSON.stringify({ error: "Invalid link type" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!["add", "remove"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const db = createSupabaseAdminClient() as any;

    if (action === "add") {
      const tableMap: Record<string, string> = {
        companies: "account_companies",
        banks: "account_banks",
        warehouses: "account_warehouses",
        customers: "account_customer_owners"
      };
      const columnMap: Record<string, string> = {
        companies: "company_id",
        banks: "bank_id",
        warehouses: "warehouse_id",
        customers: "customer_id"
      };

      const tableName = tableMap[type];
      const columnName = columnMap[type];

      // Check if already linked
      const { data: existing, error: checkError } = await db
        .from(tableName)
        .select("id")
        .eq("account_id", (await params).id)
        .eq(columnName, linkedId)
        .single();

      if (!checkError && existing) {
        return new Response(JSON.stringify({ error: "Already linked" }), {
          status: 409,
          headers: { "Content-Type": "application/json" }
        });
      }

      const insertData: Record<string, any> = {
        account_id: (await params).id,
        [columnName]: linkedId,
        created_at: new Date().toISOString()
      };

      const { error } = await db
        .from(tableName)
        .insert([insertData]);

      if (error) throw error;
      return apiOk({ success: true, message: `${type} linked` });
    } else {
      // Remove link
      const tableMap: Record<string, string> = {
        companies: "account_companies",
        banks: "account_banks",
        warehouses: "account_warehouses",
        customers: "account_customer_owners"
      };
      const columnMap: Record<string, string> = {
        companies: "company_id",
        banks: "bank_id",
        warehouses: "warehouse_id",
        customers: "customer_id"
      };

      const tableName = tableMap[type];
      const columnName = columnMap[type];

      const { error } = await db
        .from(tableName)
        .delete()
        .eq("account_id", (await params).id)
        .eq(columnName, linkedId);

      if (error) throw error;
      return apiOk({ success: true, message: `${type} unlinked` });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
