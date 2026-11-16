"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, X } from "lucide-react";
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

/** POST/PATCH through fetch (not apiFetch) so the HTTP status (409 duplicate, 403 forbidden) is visible. */
async function sendJson(method: "POST" | "PATCH", url: string, payload: unknown) {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null;
  return { ok: res.ok && body?.ok === true, status: res.status, message: body?.error?.message ?? "" };
}

export function AccountCategoriesSettings() {
  const lang = useActiveLanguage();
  const tt = (key: string, fallback: string) => t(lang, key, fallback);
  const isRtl = isRtlLanguage(lang);
  const scope = useErpScope();
  // Editing and adding are super-admin only. Everyone else who can open this page gets a read-only list.
  const canEdit = !scope.loading && scope.isSuperAdmin;

  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<CategoryForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

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
                    <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{row.name}</div>
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
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            aria-label={tt("acctcat.edit_title", "Edit Category")}
                            title={tt("acctcat.edit_title", "Edit Category")}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
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
    </div>
  );
}
