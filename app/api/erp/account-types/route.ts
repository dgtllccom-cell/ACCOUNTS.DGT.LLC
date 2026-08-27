import { NextRequest } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "account_types", action: "read" });

    const db = createSupabaseAdminClient();
    const { data, error, count } = await (db.from("account_types" as any) as any)
      .select(`id, code, name, ledger_group, description, is_active, created_at`)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;
    if (!data || data.length === 0) {
      return apiOk({ accountTypes: [], summary: { total: 0, active: 0, inactive: 0 } });
    }

    const active = data.filter((d: any) => d.is_active).length;
    return apiOk({ accountTypes: data, summary: { total: data.length, active, inactive: data.length - active } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "account_types", action: "create" });

    const body = await request.json();
    const { name, code, ledgerGroup, description, isActive } = body;

    if (!name || !code) {
      return new Response(JSON.stringify({ error: "name and code required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const db = createSupabaseAdminClient();
    const { data, error } = await (db.from("account_types" as any) as any)
      .insert([{ name, code, ledger_group: ledgerGroup || null, description: description || null, is_active: isActive !== false, created_at: new Date().toISOString() }])
      .select();

    if (error) throw error;
    return apiOk({ accountType: data?.[0] }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
