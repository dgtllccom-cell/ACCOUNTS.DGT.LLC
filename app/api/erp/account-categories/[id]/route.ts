import { NextRequest, NextResponse } from "next/server";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import {
  accountCategoryDeleteRefusal,
  accountCategoryStatus,
  canChangeAccountCategoryStatus,
  canManageAccountCategories
} from "@/lib/accounts/account-category-rules";

const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  code: z.string().trim().max(50).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional()
});

/** Editing and deleting categories is limited to super admins (see canManageAccountCategories). */
function requireAccountCategoryAdmin(session: Parameters<typeof canManageAccountCategories>[0]) {
  if (!canManageAccountCategories(session)) {
    throw new ApiClientError("Only super admins can add, edit or delete account categories.", { status: 403, code: "FORBIDDEN" });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    requireAccountCategoryAdmin(session);
    authorizeApiScope(session, { resource: "accounts", action: "update" });
    const { id } = await params;
    const body = await request.json();
    const parsed = updateCategorySchema.parse(body);
    // An explicit description (even null/empty) replaces the stored one; a missing key leaves it unchanged.
    const hasDescription = Object.prototype.hasOwnProperty.call(body ?? {}, "description");

    const result = await withLocalPg(async (sql) => {
      const existing = await sql`
        select id, name, code, description, is_active, is_system, operational_domain
        from public.account_categories
        where id = ${id}::uuid and deleted_at is null
        limit 1
      `;
      if (existing.length === 0) {
        throw new ApiClientError("Category not found", { status: 404, code: "NOT_FOUND" });
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

      // A code change would orphan accounts that store the old code (enterprise_accounts.category).
      // Name and description stay editable; the code can change only while no live account uses it.
      const newCode = parsed.code ? String(parsed.code).trim().toUpperCase() : null;
      if (newCode && newCode !== String(existing[0].code ?? "").toUpperCase()) {
        const used = await sql`
          select count(*)::int as n
          from public.enterprise_accounts
          where category = ${existing[0].code} and deleted_at is null
        `;
        if (Number(used[0]?.n ?? 0) > 0) {
          throw new ApiClientError(
            `Code ${existing[0].code} is used by ${used[0].n} account(s). Change the name or description; the code cannot change while accounts use it.`,
            { status: 409, code: "CODE_IN_USE" }
          );
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
      return { updated: rows[0], before: existing[0] };
    });
    const updated = result?.updated;

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

    if (updated?.id) {
      await auditApiAction(request, {
        action: "account_category.update.api",
        entityTable: "account_categories",
        entityId: updated.id,
        before: {
          code: result?.before?.code ?? null,
          name: result?.before?.name ?? null,
          description: result?.before?.description ?? null,
          is_active: result?.before?.is_active ?? null
        },
        after: {
          code: updated.code,
          name: updated.name,
          description: updated.description ?? null,
          is_active: updated.is_active
        }
      });
    }

    return apiOk({ category: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Soft delete only: sets deleted_at, never removes the row. Refused (409) when the category is a
 * system default or when live accounts reference it (enterprise_accounts.category_id, or the stored
 * code in enterprise_accounts.category). The row is locked while the checks run, so a concurrent
 * delete cannot slip past them.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    requireAccountCategoryAdmin(session);
    authorizeApiScope(session, { resource: "accounts", action: "delete" });
    const { id } = await params;

    const removed = await withLocalPg(async (sql) =>
      sql.begin(async (tx) => {
        const existing = await tx`
          select id, code, name, operational_domain, is_active, is_system, deleted_at
          from public.account_categories
          where id = ${id}::uuid and deleted_at is null
          limit 1
          for update
        `;
        if (existing.length === 0) {
          throw new ApiClientError("Category not found", { status: 404, code: "NOT_FOUND" });
        }
        const row = existing[0];
        if (!canChangeAccountCategoryStatus(accountCategoryStatus(row), "deleted")) {
          throw new ApiClientError("Category is already deleted", { status: 409, code: "ALREADY_DELETED" });
        }

        // Live accounts that reference this category, by id or by the stored code (same rule as accountUsesCategory).
        const usage = await tx`
          select count(*)::int as n
          from public.enterprise_accounts
          where deleted_at is null
            and (category_id = ${id}::uuid or upper(category) = upper(${row.code ?? null}::text))
        `;
        const refusal = accountCategoryDeleteRefusal({
          isSystem: row.is_system === true,
          liveAccountCount: Number(usage[0]?.n ?? 0)
        });
        if (refusal) {
          throw new ApiClientError(refusal.message, { status: 409, code: refusal.code });
        }

        await tx`
          update public.account_categories
          set deleted_at = now(), updated_at = now()
          where id = ${id}::uuid and deleted_at is null
        `;
        return row;
      })
    );
    if (!removed) {
      throw new Error("Database connection is not configured for account categories.");
    }

    await auditApiAction(request, {
      action: "account_category.delete.api",
      entityTable: "account_categories",
      entityId: id,
      before: {
        code: removed.code,
        name: removed.name,
        operational_domain: removed.operational_domain,
        is_active: removed.is_active
      },
      after: { deleted: true }
    });

    return apiOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
