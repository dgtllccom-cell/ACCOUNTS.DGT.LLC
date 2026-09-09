import { NextRequest, NextResponse } from "next/server";
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
    const { id } = await params;
    const body = await request.json();
    const parsed = updateCategorySchema.parse(body);

    const updated = await withLocalPg(async (sql) => {
      const existing = await sql`
        select id, name, code, is_system
        from public.account_categories
        where id = ${id}::uuid and deleted_at is null
        limit 1
      `;
      if (existing.length === 0) {
        throw new ApiClientError("Category not found", { status: 404 });
      }

      const rows = await sql`
        update public.account_categories
        set
          name = coalesce(${parsed.name ?? null}, name),
          code = coalesce(${parsed.code ?? null}, code),
          description = coalesce(${parsed.description ?? null}, description),
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
          name: parsed.name,
          description: parsed.description ?? updated.description
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
    await requireErpSession();
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
