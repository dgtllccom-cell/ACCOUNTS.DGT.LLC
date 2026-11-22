"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { isRtlLanguage } from "@/lib/i18n/use-erp-screen";
import { useErpScope } from "@/lib/hooks/use-erp-scope";

type CategoryRow = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  base_name: string;
  base_description: string | null;
  operational_domain: "business" | "shipping";
  is_active: boolean;
};

type CategoryForm = {
  /** null = adding a new category */
  id: string | null;
  name: string;
  code: string;
  domain: "business" | "shipping";
  description: string;
  isActive: boolean;
};

const EMPTY_FORM: CategoryForm = { id: null, name: "", code: "", domain: "business", description: "", isActive: true };

/** POST/PATCH/DELETE through fetch (not apiFetch) so the HTTP status and error code (409 duplicate or in use, 403 forbidden) are visible. */
async function sendJson(method: "POST" | "PATCH" | "DELETE", url: string, payload?: unknown) {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: payload === undefined ? undefined : { "content-type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });
  const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: { message?: string; code?: string } } | null;
  return {
    ok: res.ok && body?.ok === true,
    status: res.status,
    message: body?.error?.message ?? "",
    code: body?.error?.code ?? ""
  };
}

export function AccountCategoriesSettings() {
  const lang = useActiveLanguage();
  const tt = (key: string, fallback: string) => t(lang, key, fallback);
  const isRtl = isRtlLanguage(lang);
  const scope = useErpScope();
  // Adding, editing and deleting are super-admin only (the API enforces the same rule). Everyone else gets a read-only list.
  const canEdit = !scope.loading && scope.isSuperAdmin;

  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<CategoryForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<CategoryRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function loadRows() {
    setLoading(true);
    setLoadError("");
    try {
      const res = await apiGet<{ categories: CategoryRow[] }>(
        `/api/erp/account-categories?includeInactive=true&language=${encodeURIComponent(lang)}`
      );
      setRows(res?.categories ?? []);
    } catch (err) {
      console.error("Failed to load account categories:", err);
      setLoadError(tt("acctcat.load_failed", "Could not load account categories."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  function domainLabel(domain: string) {
    return domain === "shipping"
      ? tt("acctcat.domain_shipping", "Shipping Line & Clearing Agent")
      : tt("acctcat.domain_business", "Business");
  }

  function openAdd() {
    setNotice("");
    setFormError("");
    setForm({ ...EMPTY_FORM });
  }

  function openEdit(row: CategoryRow) {
    setNotice("");
    setFormError("");
    // Edit the stored values (base_*), never the localized display text.
    setForm({
      id: row.id,
      name: row.base_name,
      code: row.code ?? "",
      domain: row.operational_domain,
      description: row.base_description ?? "",
      isActive: row.is_active
    });
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    const name = form.name.trim();
    const code = form.code.trim().toUpperCase();
    if (!name || (form.id === null && !code)) {
      setFormError(tt("acctcat.name_required", "Category name and code are required."));
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const description = form.description.trim() || null;
      const res = form.id
        ? await sendJson("PATCH", `/api/erp/account-categories/${form.id}`, { name, description, isActive: form.isActive })
        : await sendJson("POST", "/api/erp/account-categories", { name, code, operationalDomain: form.domain, description });
      if (!res.ok) {
        const duplicate = res.status === 409 || /already exists/i.test(res.message);
        setFormError(duplicate ? tt("acctcat.duplicate", "A category with this name already exists in this domain.") : tt("acctcat.save_failed", "Could not save the category."));
        return;
      }
      setForm(null);
      setNotice(tt("acctcat.saved", "Category saved."));
      await loadRows();
    } catch (err) {
      console.error("Failed to save account category:", err);
      setFormError(tt("acctcat.save_failed", "Could not save the category."));
    } finally {
      setSaving(false);
    }
  }

  function openDelete(row: CategoryRow) {
    setNotice("");
    setFormError("");
    setDeleteError("");
    setPendingDelete(row);
  }

  /** Every refusal the server can return is shown to the user; nothing is dropped silently. */
  function deleteErrorText(code: string, status: number) {
    if (code === "CATEGORY_IN_USE") {
      return tt("acctcat.delete_in_use", "This category is used by existing accounts, so it cannot be deleted. Keep the category.");
    }
    if (code === "SYSTEM_CATEGORY") {
      return tt("acctcat.delete_system", "System default categories cannot be deleted.");
    }
    if (status === 403) {
      return tt("acctcat.delete_forbidden", "Only super admins can delete categories.");
    }
    return tt("acctcat.delete_failed", "Could not delete the category.");
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await sendJson("DELETE", `/api/erp/account-categories/${pendingDelete.id}`);
      if (!res.ok) {
        setDeleteError(deleteErrorText(res.code, res.status));
        return;
      }
      setPendingDelete(null);
      setNotice(tt("acctcat.deleted", "Category deleted."));
      await loadRows();
    } catch (err) {
      console.error("Failed to delete account category:", err);
      setDeleteError(tt("acctcat.delete_failed", "Could not delete the category."));
    } finally {
      setDeleting(false);
    }
  }

  const inputClass = "h-9";
  const labelClass = "block space-y-1 text-sm font-semibold text-slate-700 dark:text-slate-300";

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="mx-auto w-full max-w-5xl space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{tt("acctcat.title", "Account Categories")}</CardTitle>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {tt("acctcat.subtitle", "Categories offered in the New Account form. You can rename a category, change its description, or turn it active or inactive. The code and domain stay fixed.")}
            </p>
          </div>
          {canEdit && (
            <Button type="button" onClick={openAdd} className="shrink-0">
              <Plus className="h-4 w-4" />
              {tt("acctcat.add", "Add Category")}
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-3">
          {!scope.loading && !scope.isSuperAdmin && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {tt("acctcat.read_only_note", "Only super admins can add or edit categories. You can view them here.")}
            </div>
          )}
          {notice && (
            <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              {notice}
            </div>
          )}
          {loadError && (
            <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
              {loadError}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">{tt("acctcat.empty", "No categories found.")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400">
                    <th scope="col" className="px-3 py-2 text-start font-bold">{tt("common.name", "Name")}</th>
                    <th scope="col" className="px-3 py-2 text-start font-bold">{tt("common.code", "Code")}</th>
                    <th scope="col" className="px-3 py-2 text-start font-bold">{tt("acctcat.col_domain", "Domain")}</th>
                    <th scope="col" className="px-3 py-2 text-start font-bold">{tt("common.status", "Status")}</th>
                    <th scope="col" className="px-3 py-2 text-end font-bold">{canEdit ? tt("common.actions", "Actions") : ""}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-slate-100 dark:border-slate-800",
                        // The business S category is flagged in red: its name is awaiting the owner's correction.
                        row.code === "S" && row.operational_domain === "business" && "bg-red-50 dark:bg-red-950/40"
                      )}
                    >
                      <td className="px-3 py-2">
                        <div className={cn(
                          "font-semibold text-slate-900 dark:text-slate-100",
                          row.code === "S" && row.operational_domain === "business" && "text-red-600 dark:text-red-400"
                        )}>{row.name}</div>
                        {row.description && <div className="text-xs text-slate-500 dark:text-slate-400">{row.description}</div>}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{row.code ?? "-"}</td>
                      <td className="px-3 py-2">{domainLabel(row.operational_domain)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-bold",
                            row.is_active
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                              : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                          )}
                        >
                          {row.is_active ? tt("common.active", "Active") : tt("common.inactive", "Inactive")}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-end">
                        {canEdit && (
                          <div className="inline-flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => openEdit(row)}
                              aria-label={`${tt("common.edit", "Edit")}: ${row.name}`}
                              className={cn(
                                "h-8 px-3 text-xs",
                                row.code === "S" && row.operational_domain === "business"
                                  ? "border-red-600 bg-red-600 text-white hover:bg-red-700 hover:text-white"
                                  : "text-slate-700 dark:text-slate-200"
                              )}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              {tt("common.edit", "Edit")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => openDelete(row)}
                              aria-label={`${tt("common.delete", "Delete")}: ${row.name}`}
                              className="h-8 border-rose-300 px-3 text-xs text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {tt("common.delete", "Delete")}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {form && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleSave} className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {form.id ? tt("acctcat.edit_title", "Edit Category") : tt("acctcat.add", "Add Category")}
              </h2>
              <button
                type="button"
                onClick={() => setForm(null)}
                aria-label={tt("common.close", "Close")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className={labelClass}>
              {tt("common.name", "Name")} *
              <Input
                className={inputClass}
                value={form.name}
                maxLength={200}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
            </label>

            <label className={labelClass}>
              {tt("common.code", "Code")} *
              <Input
                className={inputClass}
                value={form.code}
                disabled={form.id !== null}
                maxLength={50}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
              {form.id !== null && (
                <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                  {tt("acctcat.code_fixed", "The code and domain cannot be changed, because existing accounts use them.")}
                </span>
              )}
            </label>

            <label className={labelClass}>
              {tt("acctcat.col_domain", "Domain")} *
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.domain}
                disabled={form.id !== null}
                onChange={(e) => setForm({ ...form, domain: e.target.value === "shipping" ? "shipping" : "business" })}
              >
                <option value="business">{tt("acctcat.domain_business", "Business")}</option>
                <option value="shipping">{tt("acctcat.domain_shipping", "Shipping Line & Clearing Agent")}</option>
              </select>
            </label>

            <label className={labelClass}>
              {tt("common.description", "Description")}
              <Input
                className={inputClass}
                value={form.description}
                maxLength={500}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>

            {form.id !== null && (
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                {tt("acctcat.active_label", "Active (shown in the New Account form)")}
              </label>
            )}

            {formError && (
              <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
                {formError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setForm(null)} disabled={saving}>
                {tt("common.cancel", "Cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {tt("common.save", "Save")}
              </Button>
            </div>
          </form>
        </div>
      )}

      {pendingDelete && (
        <div role="dialog" aria-modal="true" aria-labelledby="acctcat-delete-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <h2 id="acctcat-delete-title" className="text-lg font-bold text-rose-700 dark:text-rose-300">
              {tt("acctcat.delete_title", "Delete category?")}
            </h2>
            <div className="space-y-1">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{pendingDelete.name}</p>
              {pendingDelete.code && <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{pendingDelete.code}</p>}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {tt("acctcat.delete_body", "This hides the category from this list and from the New Account form. Nothing is erased, and the action is recorded in the audit log.")}
            </p>
            {deleteError && (
              <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
                {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
                {tt("common.cancel", "Cancel")}
              </Button>
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {tt("common.delete", "Delete")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
