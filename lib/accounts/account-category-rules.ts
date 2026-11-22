/**
 * Pure rules for Settings -> Account Categories (no database, no I/O), so the permission check,
 * the status transitions and the delete refusal can be unit-tested. The route handler
 * app/api/erp/account-categories/[id]/route.ts applies these rules to the rows it reads.
 */

export type AccountCategoryStatus = "active" | "inactive" | "deleted";

export type AccountCategorySessionLike = {
  isSuperAdmin?: boolean | null;
  roles?: readonly string[] | null;
};

/**
 * Only a global super admin may add, edit or delete account categories. This is the same rule
 * the settings page uses to show its buttons, the PATCH route enforces, and the
 * account_categories_write_super_admin RLS policy states.
 */
export function canManageAccountCategories(session: AccountCategorySessionLike | null | undefined): boolean {
  if (!session) return false;
  return Boolean(session.isSuperAdmin) || (session.roles ?? []).includes("super_admin");
}

/** A soft-deleted row (deleted_at set) is "deleted"; otherwise it is active or inactive. */
export function accountCategoryStatus(row: { is_active?: boolean | null; deleted_at?: unknown }): AccountCategoryStatus {
  if (row.deleted_at !== null && row.deleted_at !== undefined) return "deleted";
  return row.is_active === false ? "inactive" : "active";
}

const ALLOWED_STATUS_CHANGES: Record<AccountCategoryStatus, readonly AccountCategoryStatus[]> = {
  active: ["inactive", "deleted"],
  inactive: ["active", "deleted"],
  // Deletion is a soft delete with no restore on this page, so a deleted row is terminal.
  deleted: [],
};

/** Allowed status moves: active <-> inactive, and active or inactive -> deleted (soft delete). */
export function canChangeAccountCategoryStatus(from: AccountCategoryStatus, to: AccountCategoryStatus): boolean {
  return ALLOWED_STATUS_CHANGES[from].includes(to);
}

/**
 * Mirrors the SQL that counts references (enterprise_accounts.category_id, or the stored code in
 * enterprise_accounts.category when it is compared case-insensitively). A live account counts
 * as using the category when either the id matches or the stored code matches. The match is
 * deliberately wide: refusing a delete is safe, orphaning an account is not.
 */
export function accountUsesCategory(
  account: { category_id?: string | null; category?: string | null; deleted_at?: unknown },
  category: { id: string; code?: string | null }
): boolean {
  if (account.deleted_at !== null && account.deleted_at !== undefined) return false;
  if (account.category_id && account.category_id.toLowerCase() === category.id.toLowerCase()) return true;
  if (account.category && category.code && account.category.toUpperCase() === category.code.toUpperCase()) return true;
  return false;
}

export type AccountCategoryDeleteRefusal = {
  code: "SYSTEM_CATEGORY" | "CATEGORY_IN_USE";
  message: string;
};

/**
 * Null when the category may be soft-deleted. System default categories are never deleted, and a
 * category with live accounts that reference it is kept (the refusal is returned to the caller
 * and shown to the user; nothing is deleted silently).
 */
export function accountCategoryDeleteRefusal(input: {
  isSystem: boolean;
  liveAccountCount: number;
}): AccountCategoryDeleteRefusal | null {
  if (input.isSystem) {
    return { code: "SYSTEM_CATEGORY", message: "System default categories cannot be deleted." };
  }
  if (input.liveAccountCount > 0) {
    return {
      code: "CATEGORY_IN_USE",
      message: `This category is used by ${input.liveAccountCount} account(s) and cannot be deleted. Keep the category.`
    };
  }
  return null;
}
