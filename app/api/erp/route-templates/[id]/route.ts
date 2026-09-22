import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, ApiClientError, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields, wantsRawRecord } from "@/lib/i18n/localize-records";

async function loadTemplate(db: any, id: string) {
  const { data, error } = await db.from("route_templates").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  return data;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "route_templates", action: "read" });
    const { id } = await params;

    const db = createSupabaseAdminClient() as any;
    let template = await loadTemplate(db, id);
    if (!template) throw new ApiClientError("Route template not found", { status: 404, code: "NOT_FOUND" });

    if (!wantsRawRecord(request)) {
      const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
      [template] = await localizeRecordFields<any>([template], "route_templates", ["name", "description"], lang);
    }

    return apiOk({ template });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "route_templates", action: "update" });
    const { id } = await params;

    const db = createSupabaseAdminClient() as any;
    const existing = await loadTemplate(db, id);
    if (!existing) throw new ApiClientError("Route template not found", { status: 404, code: "NOT_FOUND" });

    const body = await request.json();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body?.name !== undefined) patch.name = String(body.name).trim();
    if (body?.description !== undefined) patch.description = body.description ? String(body.description) : null;
    if (body?.status !== undefined) {
      if (!["active", "inactive"].includes(body.status)) throw new ApiClientError("status must be active or inactive");
      patch.status = body.status;
    }
    if (body?.legs !== undefined) {
      if (!Array.isArray(body.legs) || body.legs.length === 0) throw new ApiClientError("legs must be a non-empty ordered array");
      patch.legs = body.legs;
    }

    const { data, error } = await db.from("route_templates").update(patch).eq("id", id).select().single();
    if (error) throw error;

    await auditApiAction(request, {
      action: "route_template.update",
      entityTable: "route_templates",
      entityId: id,
      before: existing,
      after: data
    });

    return apiOk({ template: data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "route_templates", action: "delete" });
    const { id } = await params;

    const db = createSupabaseAdminClient() as any;
    const existing = await loadTemplate(db, id);
    if (!existing) throw new ApiClientError("Route template not found", { status: 404, code: "NOT_FOUND" });

    const { data, error } = await db
      .from("route_templates")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    await auditApiAction(request, {
      action: "route_template.delete",
      entityTable: "route_templates",
      entityId: id,
      before: existing,
      after: data
    });

    return apiOk({ template: data });
  } catch (error) {
    return handleApiError(error);
  }
}
