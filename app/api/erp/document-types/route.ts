import { NextRequest } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const querySchema = z.object({
  limit: z.coerce.number().default(100),
  offset: z.coerce.number().default(0),
  search: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "document_types", action: "read" });

    const query = querySchema.parse({
      limit: request.nextUrl.searchParams.get("limit"),
      offset: request.nextUrl.searchParams.get("offset"),
      search: request.nextUrl.searchParams.get("search"),
      status: request.nextUrl.searchParams.get("status"),
    });

    const db = createSupabaseAdminClient();
    let qb = db.from("document_types").select(`id, code, name, category, description, is_active, created_at`);

    if (query.status) {
      qb = qb.eq("is_active", query.status === "Active");
    }

    if (query.search) {
      const searchLower = query.search.toLowerCase();
      qb = qb.or(`name.ilike.%${searchLower}%,code.ilike.%${searchLower}%`);
    }

    const { data, error, count } = await qb
      .order("created_at", { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);

    if (error) throw error;
    if (!data || data.length === 0) {
      return apiOk({ documentTypes: [], summary: { total: 0, active: 0, inactive: 0 } });
    }

    const active = data.filter((d: any) => d.is_active).length;
    return apiOk({ documentTypes: data, summary: { total: count || 0, active, inactive: data.length - active } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "document_types", action: "create" });

    const body = await request.json();
    const { name, code, category, description, isActive } = body;

    if (!name || !code) {
      return new Response(JSON.stringify({ error: "name and code required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from("document_types")
      .insert([{
        name, code, category: category || "General",
        description: description || null,
        is_active: isActive !== false,
        created_at: new Date().toISOString(),
      }])
      .select();

    if (error) throw error;
    return apiOk({ documentType: data?.[0] }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
