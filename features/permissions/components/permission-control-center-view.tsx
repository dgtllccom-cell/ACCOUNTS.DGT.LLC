"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, ShieldAlert, ShieldQuestion, Lock, Globe2, Building2, MapPin, User, Save, RefreshCw, Search } from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { BranchScopeDropdown, type BranchScopeCountry, type BranchScopeCountryBranch, type BranchScopeCityBranch, type BranchScopeValue } from "@/features/purchases/components/branch-scope-dropdown";
import { enterpriseRolePermissions, enterpriseRoleScopes, type EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { ERP_MODULE_DEFINITIONS } from "@/lib/permissions/rbac-matrix-builder";

type ScopeType = "country" | "country_branch" | "city_branch";

type ModuleCapability = { status: "inherited" | "custom" | "denied" | "none"; allowed: boolean };
type ModuleRow = {
  key: string;
  name: string;
  category: string;
  view: ModuleCapability;
  create: ModuleCapability;
  edit: ModuleCapability;
  delete: ModuleCapability;
  approve: ModuleCapability;
  export: ModuleCapability;
};

type BranchRulesResponse = {
  ok: boolean;
  scope: { scopeType: ScopeType; scopeId: string; scopeName: string; countryId: string | null; countryBranchId: string | null; cityBranchId: string | null };
  currentRule: { allowed_domains: string[]; permissions: string[]; denied_permissions: string[] };
  inherited: { permissions: string[]; deniedPermissions: string[] };
  customPermissions: string[];
  explicitlyDenied: string[];
  effectivePermissions: string[];
  allowedDomains: string[];
  moduleMatrix: ModuleRow[];
};

type DirectoryUser = {
  id: string;
  name: string;
  role: EnterpriseRole;
  countryName: string;
  branchName: string;
  cityName: string | null;
  permissions: string[];
  status: string;
};

const ACTIONS: Array<{ key: keyof Pick<ModuleRow, "view" | "create" | "edit" | "delete" | "approve" | "export">; labelKey: string; fallback: string }> = [
  { key: "view", labelKey: "pcc.action_view", fallback: "View" },
  { key: "create", labelKey: "pcc.action_create", fallback: "Create" },
  { key: "edit", labelKey: "pcc.action_edit", fallback: "Edit" },
  { key: "delete", labelKey: "pcc.action_delete", fallback: "Delete" },
  { key: "approve", labelKey: "pcc.action_approve", fallback: "Approve" },
  { key: "export", labelKey: "pcc.action_export", fallback: "Export" }
];

function CapabilityBadge({ cap, lang }: { cap: ModuleCapability; lang: string }) {
  if (cap.status === "denied") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wide">
        <ShieldAlert className="h-3 w-3" aria-hidden /> {t(lang, "pcc.status_denied", "Denied")}
      </span>
    );
  }
  if (cap.status === "custom") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wide">
        <ShieldCheck className="h-3 w-3" aria-hidden /> {t(lang, "pcc.status_custom", "Custom")}
      </span>
    );
  }
  if (cap.status === "inherited") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wide">
        <ShieldQuestion className="h-3 w-3" aria-hidden /> {t(lang, "pcc.status_inherited", "Inherited")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-900 dark:text-slate-500 dark:border-slate-800 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wide">
      {t(lang, "pcc.status_none", "None")}
    </span>
  );
}

// GET /api/erp/branch-rules returns a flat { ok, scope, moduleMatrix, ... } body with no
// `data` envelope — apiGet()'s { ok, data } auto-unwrap would silently resolve this to
// undefined, so this endpoint is always called with raw fetch instead.
async function fetchBranchRules(scopeType: ScopeType, scopeId: string): Promise<BranchRulesResponse> {
  const res = await fetch(`/api/erp/branch-rules?scopeType=${scopeType}&scopeId=${scopeId}`, { credentials: "include" });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) {
    throw new Error(body?.error || `Request failed: ${res.status}`);
  }
  return body as BranchRulesResponse;
}

export function PermissionControlCenterView({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const activeLang = useActiveLanguage();
  const lang = activeLang || "en";
  const isRtl = lang === "ur" || lang === "ar" || lang === "fa" || lang === "ps";

  const [countries, setCountries] = useState<BranchScopeCountry[]>([]);
  const [countryBranches, setCountryBranches] = useState<BranchScopeCountryBranch[]>([]);
  const [cityBranches, setCityBranches] = useState<BranchScopeCityBranch[]>([]);
  const [scope, setScope] = useState<BranchScopeValue>({ countryId: "", countryBranchId: "", cityBranchId: "" });

  const [rules, setRules] = useState<BranchRulesResponse | null>(null);
  const [loadingRules, setLoadingRules] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);

  const [pendingDenied, setPendingDenied] = useState<Set<string>>(new Set());
  const [pendingCustom, setPendingCustom] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<DirectoryUser | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [countriesRes, branchesRes, cityRes]: any[] = await Promise.all([
          apiGet<{ countries: any[] }>("/api/erp/locations/countries"),
          apiGet<{ data: { branches: any[] } }>("/api/erp/locations/branches/main"),
          apiGet<{ data: { cityBranches: any[] } }>("/api/erp/locations/branches/city")
        ]);
        setCountries((countriesRes?.data?.countries ?? countriesRes?.countries ?? []).map((c: any) => ({ id: c.id, name: c.name, iso2: c.iso2 })));
        setCountryBranches((branchesRes?.data?.branches ?? branchesRes?.branches ?? []).map((b: any) => ({ id: b.id, name: b.name, code: b.code, countryId: b.countryId })));
        setCityBranches((cityRes?.data?.cityBranches ?? cityRes?.cityBranches ?? []).map((c: any) => ({ id: c.id, name: c.city_name ? `${c.city_name} - ${c.name}` : c.name, code: c.code, countryBranchId: c.countryBranchId })));
      } catch {
        // hierarchy pickers stay empty; the rest of the page still degrades gracefully
      }
    })();

    apiGet<{ data: { summary: { users: DirectoryUser[] } } }>("/api/erp/users/login-management")
      .then((res: any) => setUsers(res?.data?.summary?.users ?? res?.summary?.users ?? []))
      .catch(() => setUsers([]));
  }, []);

  const currentScopeType: ScopeType | null = scope.cityBranchId ? "city_branch" : scope.countryBranchId ? "country_branch" : scope.countryId ? "country" : null;
  const currentScopeId = scope.cityBranchId || scope.countryBranchId || scope.countryId || null;

  useEffect(() => {
    setPendingDenied(new Set());
    setPendingCustom(new Set());
    setSaveMessage(null);
    if (!currentScopeType || !currentScopeId) {
      setRules(null);
      return;
    }
    setLoadingRules(true);
    setRulesError(null);
    // branch-rules returns a flat { ok, scope, moduleMatrix, ... } body (no `data` envelope),
    // unlike the { ok, data } convention apiGet()/apiPost() auto-unwrap — use raw fetch so the
    // full response reaches this component instead of silently resolving to undefined.
    fetchBranchRules(currentScopeType, currentScopeId)
      .then((res) => {
        setRules(res);
        setPendingDenied(new Set(res?.explicitlyDenied ?? []));
        setPendingCustom(new Set(res?.customPermissions ?? []));
      })
      .catch((err: any) => setRulesError(err?.message || "Failed to load rules"))
      .finally(() => setLoadingRules(false));
  }, [currentScopeType, currentScopeId]);

  const moduleDefByKey = useMemo(() => {
    const map = new Map<string, (typeof ERP_MODULE_DEFINITIONS)[number]>();
    for (const def of ERP_MODULE_DEFINITIONS) map.set(def.key, def);
    return map;
  }, []);

  const actionPermsField: Record<string, "viewPerms" | "createPerms" | "editPerms" | "deletePerms" | "approvePerms" | "exportPerms"> = {
    view: "viewPerms",
    create: "createPerms",
    edit: "editPerms",
    delete: "deletePerms",
    approve: "approvePerms",
    export: "exportPerms"
  };

  // Toggling a module action grants/denies the REAL resource:action permission strings
  // behind it (from ERP_MODULE_DEFINITIONS) — never a synthetic module-key label — so a
  // saved rule actually changes what hasRolePermission()/authorize() enforce server-side.
  function permsForAction(moduleKey: string, actionKey: string): string[] {
    const def = moduleDefByKey.get(moduleKey);
    if (!def) return [];
    const field = actionPermsField[actionKey];
    return field ? (def[field] ?? []) : [];
  }

  function toggleDenied(perms: string[]) {
    if (perms.length === 0) return;
    setPendingDenied((prev) => {
      const next = new Set(prev);
      const allDenied = perms.every((p) => next.has(p));
      perms.forEach((p) => (allDenied ? next.delete(p) : next.add(p)));
      return next;
    });
    if (!perms.every((p) => pendingDenied.has(p))) {
      setPendingCustom((prev) => {
        const next = new Set(prev);
        perms.forEach((p) => next.delete(p));
        return next;
      });
    }
  }

  function toggleCustom(perms: string[]) {
    if (perms.length === 0) return;
    setPendingCustom((prev) => {
      const next = new Set(prev);
      const allCustom = perms.every((p) => next.has(p));
      perms.forEach((p) => (allCustom ? next.delete(p) : next.add(p)));
      return next;
    });
    if (!perms.every((p) => pendingCustom.has(p))) {
      setPendingDenied((prev) => {
        const next = new Set(prev);
        perms.forEach((p) => next.delete(p));
        return next;
      });
    }
  }

  async function saveRules() {
    if (!currentScopeType || !currentScopeId || !rules) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/erp/branch-rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scopeType: currentScopeType,
          scopeId: currentScopeId,
          allowedDomains: rules.allowedDomains,
          permissions: Array.from(pendingCustom),
          deniedPermissions: Array.from(pendingDenied),
          moduleAccess: {}
        })
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || body?.error) {
        throw new Error(body?.error || `Request failed: ${res.status}`);
      }
      setSaveMessage(t(lang, "pcc.save_success", "Rules saved successfully."));
      const refreshed = await fetchBranchRules(currentScopeType, currentScopeId);
      setRules(refreshed);
      setPendingDenied(new Set(refreshed?.explicitlyDenied ?? []));
      setPendingCustom(new Set(refreshed?.customPermissions ?? []));
    } catch (err: any) {
      setSaveMessage(err?.message || t(lang, "pcc.save_error", "Failed to save rules."));
    } finally {
      setSaving(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users.slice(0, 30);
    return users.filter((u) => u.name?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q)).slice(0, 30);
  }, [users, userSearch]);

  const userRoleDefaults = selectedUser ? (enterpriseRolePermissions[selectedUser.role] ?? []) : [];
  const userHasCustomSet = selectedUser ? selectedUser.permissions.length > 0 : false;
  const userEffective = selectedUser ? (userHasCustomSet ? selectedUser.permissions : userRoleDefaults) : [];

  if (!isSuperAdmin) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-6 text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-3">
        <Lock className="h-5 w-5 shrink-0" aria-hidden />
        {t(lang, "pcc.super_admin_only", "This screen is restricted to Super Admin.")}
      </div>
    );
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="w-full space-y-4">
      <div>
        <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-600" aria-hidden />
          {t(lang, "pcc.title", "Permission Control Center")}
        </h1>
        <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">
          {t(lang, "pcc.subtitle", "Super Admin → Country → Main Branch → City Branch → User → Effective Permissions")}
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <BranchScopeDropdown lang={lang} countries={countries} countryBranches={countryBranches} cityBranches={cityBranches} value={scope} onChange={setScope} />
          {loadingRules ? <RefreshCw className="h-4 w-4 animate-spin text-slate-400" aria-hidden /> : null}
        </div>

        {!currentScopeType ? (
          <p className="text-xs text-slate-400 font-medium">{t(lang, "pcc.pick_scope", "Pick a Country, Main Branch or City Branch above to view and edit its rules.")}</p>
        ) : rulesError ? (
          <p className="text-xs text-rose-600 font-bold">{rulesError}</p>
        ) : rules ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {currentScopeType === "country" && <Globe2 className="h-3.5 w-3.5 text-blue-500" aria-hidden />}
              {currentScopeType === "country_branch" && <Building2 className="h-3.5 w-3.5 text-blue-500" aria-hidden />}
              {currentScopeType === "city_branch" && <MapPin className="h-3.5 w-3.5 text-emerald-500" aria-hidden />}
              <span>{rules.scope.scopeName}</span>
              <span className="text-slate-300">•</span>
              <span>{t(lang, "pcc.effective_count", "Effective permissions")}: {rules.effectivePermissions.length}</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[720px] text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-[9.5px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2">{t(lang, "pcc.module", "Module")}</th>
                    {ACTIONS.map((a) => (
                      <th key={a.key} className="px-3 py-2 text-center">{t(lang, a.labelKey, a.fallback)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {rules.moduleMatrix.map((row) => (
                    <tr key={row.key} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">{row.name}</td>
                      {ACTIONS.map((a) => {
                        const cap = row[a.key];
                        const perms = permsForAction(row.key, a.key);
                        const isDenied = perms.length > 0 && perms.every((p) => pendingDenied.has(p));
                        const isCustom = perms.length > 0 && perms.every((p) => pendingCustom.has(p));
                        const displayCap: ModuleCapability = isDenied
                          ? { status: "denied", allowed: false }
                          : isCustom
                            ? { status: "custom", allowed: true }
                            : cap;
                        return (
                          <td key={a.key} className="px-3 py-2 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <CapabilityBadge cap={displayCap} lang={lang} />
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  title={t(lang, "pcc.grant_custom", "Grant (custom)")}
                                  disabled={perms.length === 0}
                                  onClick={() => toggleCustom(perms)}
                                  className={`h-5 w-5 rounded-md border text-[10px] font-black transition disabled:opacity-30 ${isCustom ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-200 text-slate-400 hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-700"}`}
                                >
                                  +
                                </button>
                                <button
                                  type="button"
                                  title={t(lang, "pcc.deny", "Deny")}
                                  disabled={perms.length === 0}
                                  onClick={() => toggleDenied(perms)}
                                  className={`h-5 w-5 rounded-md border text-[10px] font-black transition disabled:opacity-30 ${isDenied ? "bg-rose-600 text-white border-rose-600" : "border-slate-200 text-slate-400 hover:border-rose-400 hover:text-rose-600 dark:border-slate-700"}`}
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-[10px] text-slate-400 font-medium">
                {t(lang, "pcc.only_super_admin_can_save", "Only Super Admin can save scope rules. Writes are rejected server-side for any other role.")}
              </p>
              <div className="flex items-center gap-3">
                {saveMessage ? <span className="text-[10px] font-bold text-slate-500">{saveMessage}</span> : null}
                <button
                  type="button"
                  onClick={saveRules}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 transition"
                >
                  <Save className="h-3.5 w-3.5" aria-hidden />
                  {saving ? t(lang, "pcc.saving", "Saving...") : t(lang, "pcc.save_rules", "Save Rules")}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 p-4 space-y-3">
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <User className="h-4 w-4 text-blue-600" aria-hidden />
          {t(lang, "pcc.user_rules_title", "User Rules & Effective Permissions")}
        </h2>

        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder={t(lang, "pcc.search_user", "Search user by name or role...")}
            className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        {userSearch && !selectedUser ? (
          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-850">
            {filteredUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelectedUser(u)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-900/50 flex items-center justify-between"
              >
                <span className="font-bold text-slate-800 dark:text-slate-200">{u.name}</span>
                <span className="text-[10px] text-slate-400 uppercase font-bold">{u.role}</span>
              </button>
            ))}
            {filteredUsers.length === 0 ? <p className="px-3 py-2 text-[10px] text-slate-400">{t(lang, "pcc.no_users_found", "No users found.")}</p> : null}
          </div>
        ) : null}

        {selectedUser ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-sm text-slate-900 dark:text-white">{selectedUser.name}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">
                  {selectedUser.role} • {enterpriseRoleScopes[selectedUser.role]} • {selectedUser.countryName}{selectedUser.cityName ? ` / ${selectedUser.cityName}` : selectedUser.branchName ? ` / ${selectedUser.branchName}` : ""}
                </p>
              </div>
              <button type="button" onClick={() => { setSelectedUser(null); setUserSearch(""); }} className="text-[10px] font-bold text-slate-400 hover:text-slate-700">
                {t(lang, "pcc.clear", "Clear")}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10px]">
              <div>
                <p className="font-black uppercase text-slate-400 mb-1">{t(lang, "pcc.role_default", "Role Default")}</p>
                <p className="font-bold text-slate-700 dark:text-slate-300">{userRoleDefaults.length} {t(lang, "pcc.permissions_count", "permissions")}</p>
              </div>
              <div>
                <p className="font-black uppercase text-slate-400 mb-1">{t(lang, "pcc.custom_override", "Custom Override")}</p>
                <p className="font-bold text-slate-700 dark:text-slate-300">
                  {userHasCustomSet ? `${selectedUser.permissions.length} ${t(lang, "pcc.permissions_count", "permissions")}` : t(lang, "pcc.none_set", "None set")}
                </p>
              </div>
              <div>
                <p className="font-black uppercase text-emerald-600 mb-1">{t(lang, "pcc.effective", "Effective")}</p>
                <p className="font-bold text-emerald-700 dark:text-emerald-400">{userEffective.length} {t(lang, "pcc.permissions_count", "permissions")}</p>
              </div>
            </div>

            <p className="text-[9.5px] text-slate-400 font-medium">
              {userHasCustomSet
                ? t(lang, "pcc.effective_note_custom", "This user has a custom permission set — it fully replaces the role default (never widened back to role defaults).")
                : t(lang, "pcc.effective_note_role", "This user has no custom override — effective permissions are the role default.")}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
