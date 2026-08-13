import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await params;
    authorizeApiScope(session, { resource: "contact_types", action: "read" });

    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from("contact_types")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) throw new Error("Contact type not found");
    return apiOk({ contactType: data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await params;
    const body = await request.json();
    authorizeApiScope(session, { resource: "contact_types", action: "update" });

    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from("contact_types")
      .update({
        name: body.name,
        code: body.code,
        category: body.category,
        description: body.description || null,
        is_active: body.isActive !== false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return apiOk({ contactType: data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await params;
    authorizeApiScope(session, { resource: "contact_types", action: "delete" });

    const db = createSupabaseAdminClient();
    await db.from("contact_types").delete().eq("id", id);
    return apiOk({ message: "Deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}
