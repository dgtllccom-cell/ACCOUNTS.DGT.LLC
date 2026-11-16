import { NextRequest, NextResponse } from "next/server";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";

const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  code: z.string().trim().max(50).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional()
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    // Editing categories is limited to super admins (the settings page and the form's edit control both call this).
    if (!session.isSuperAdmin && !session.roles?.includes("super_admin")) {
      throw new ApiClientError("Only super admins can edit account categories.", { status: 403, code: "FORBIDDEN" });
    }
    authorizeApiScope(session, { resource: "accounts", action: "update" });
    const { id } = await params;
    const body = await request.json();
    const parsed = updateCategorySchema.parse(body);
    // An explicit description (even null/empty) replaces the stored one; a missing key leaves it unchanged.
    const hasDescription = Object.prototype.hasOwnProperty.call(body ?? {}, "description");

    const updated = await withLocalPg(async (sql) => {
      const existing = await sql`
        select id, name, code, is_system, operational_domain
        from public.account_categories
        where id = ${id}::uuid and deleted_at is null
        limit 1
      `;
      if (existing.length === 0) {
        throw new ApiClientError("Category not found", { status: 404 });
      }

      if (parsed.name) {
        const duplicate = await sql`
          select id
          from public.account_categories
          where lower(trim(name)) = lower(trim(${parsed.name}))
            and operational_domain = ${existing[0].operational_domain}
            and id <> ${id}::uuid
            and deleted_at is null
          limit 1
        `;
        if (duplicate.length > 0) {
          throw new ApiClientError(`Category "${parsed.name}" already exists in this domain.`, { status: 409, code: "DUPLICATE" });
        }
      }

      const rows = await sql`
        update public.account_categories
        set
          name = coalesce(${parsed.name ?? null}, name),
          code = coalesce(${parsed.code ?? null}, code),
          description = case when ${hasDescription}::boolean then ${parsed.description || null} else description end,
          sort_order = coalesce(${parsed.sortOrder ?? null}, sort_order),
          is_active = coalesce(${parsed.isActive ?? null}, is_active),
          updated_at = now()
        where id = ${id}::uuid and deleted_at is null
        returning id, code, name, operational_domain, description, is_system, is_active, sort_order, created_at, updated_at
      `;
      return rows[0];
    });

    if (updated?.id && parsed.name) {
      void syncRecordTranslations({
        table: "account_categories",
        recordId: updated.id,
        record: {
          name: updated.name,
          description: updated.description ?? null
        },
        originalLanguage: session.preferredLanguage || "en",
        actorId: session.userId
      }).catch((err) => console.error("Category update translation sync error:", err));
    }

    return apiOk({ category: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "accounts", action: "delete" });
    const { id } = await params;

    await withLocalPg(async (sql) => {
      const existing = await sql`
        select id, is_system
        from public.account_categories
        where id = ${id}::uuid and deleted_at is null
        limit 1
      `;
      if (existing.length === 0) {
        throw new ApiClientError("Category not found", { status: 404 });
      }
      if (existing[0].is_system) {
        throw new ApiClientError("System default categories cannot be deleted", { status: 400 });
      }

      await sql`
        update public.account_categories
        set deleted_at = now()
        where id = ${id}::uuid
      `;
    });

    return apiOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
