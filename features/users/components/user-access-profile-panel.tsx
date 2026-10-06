"use client";

/**
 * User Setup — RBAC v2 access fields and the Effective Access Summary.
 *
 *  AccessProfilePanel     access profile (operations / shipping line), shipping line binding, warehouse assignment,
 *                         effective dates and the field-level financial permission. The STORED role keeps deciding the
 *                         scope level (country / main branch / city branch); the profile only narrows it.
 *  EffectiveAccessSummary what the user will actually receive on the next sign-in or refresh — computed by the server with
 *                         the same resolver as login (GET /api/erp/users -> effectiveAccess) and the same menu filter as
 *                         the live sidebar (visibleMenuFor). It never re-implements a rule.
 */

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Ship, Warehouse, CalendarRange, Landmark, LayoutDashboard } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { t as centralT } from "@/lib/i18n/ui";
import { translateHeader } from "@/lib/i18n/table-headers";
import { deriveEffectiveRole, dashboardForRoles, type AccessProfile, type StoredEnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { visibleMenuFor } from "@/components/layout/digital-dock-premium-sidebar";

export type FinancialAccessMode = "role_default" | "deny" | "allow";

export type AccessProfileValue = {
  accessProfile: AccessProfile | null;
  shippingLineId: string;
  warehouseIds: string[];
  effectiveFrom: string;
  effectiveTo: string;
  financialAccess: FinancialAccessMode;
};

export const EMPTY_ACCESS_PROFILE: AccessProfileValue = {
  accessProfile: null,
  shippingLineId: "",
  warehouseIds: [],
  effectiveFrom: "",
  effectiveTo: "",
  financialAccess: "role_default",
};

/** Client-side validity (the API enforces the same rules and answers 400). */
export function accessProfileError(v: AccessProfileValue): "shipping_line_required" | "dates_invalid" | null {
  if (v.accessProfile === "shipping_line" && !v.shippingLineId) return "shipping_line_required";
  if (v.effectiveFrom && v.effectiveTo && v.effectiveTo < v.effectiveFrom) return "dates_invalid";
  return null;
}

/** The request fields for POST / PATCH /api/erp/users. */
export function accessProfilePayload(v: AccessProfileValue) {
  return {
    accessProfile: v.accessProfile,
    shippingLineId: v.accessProfile === "shipping_line" ? v.shippingLineId || null : null,
    warehouseIds: v.warehouseIds,
    effectiveFrom: v.effectiveFrom || null,
    effectiveTo: v.effectiveTo || null,
    financialAccess: v.financialAccess,
  };
}

type Option = { id: string; name: string; warehouse_name?: string; country_id?: string | null };

export function AccessProfilePanel({
  role,
  countryId,
  value,
  onChange,
  canGrantFinance,
  lang,
}: {
  role: StoredEnterpriseRole;
  countryId: string;
  value: AccessProfileValue;
  onChange: (next: AccessProfileValue) => void;
  canGrantFinance: boolean;
  lang?: string;
}) {
  const s = useErpScreen("uap", lang as never);
  const [lines, setLines] = useState<Option[]>([]);
  const [warehouses, setWarehouses] = useState<Option[]>([]);
  const effectiveRole = deriveEffectiveRole(role, value.accessProfile);
  const set = (patch: Partial<AccessProfileValue>) => onChange({ ...value, ...patch });
  const error = accessProfileError(value);

  useEffect(() => {
    if (value.accessProfile !== "shipping_line") return;
    let alive = true;
    fetch(`/api/erp/shipping-lines?limit=200&lang=${s.lang}`)
      .then((r) => r.json())
      .then((j) => { if (alive) setLines(((j?.data?.shippingLines ?? j?.shippingLines ?? []) as Option[]).filter((l) => l?.id)); })
      .catch(() => { if (alive) setLines([]); });
    return () => { alive = false; };
  }, [value.accessProfile, s.lang]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/erp/warehouses?status=Active&lang=${s.lang}`)
      .then((r) => r.json())
      .then((j) => { if (alive) setWarehouses(((j?.data?.warehouses ?? j?.warehouses ?? []) as Option[]).filter((w) => w?.id)); })
      .catch(() => { if (alive) setWarehouses([]); });
    return () => { alive = false; };
  }, [s.lang]);

  const scopedWarehouses = useMemo(
    () => warehouses.filter((w) => !countryId || !w.country_id || w.country_id === countryId),
    [warehouses, countryId]
  );

  const profiles: [AccessProfile | null, string, string][] = [
    [null, "profile_full", "Full role (as selected above)"],
    ["operations", "profile_operations", "Operations only (no finance)"],
    ["shipping_line", "profile_shipping", "Shipping Line only"],
  ];
  const finModes: [FinancialAccessMode, string, string][] = [
    ["role_default", "fin_default", "Role default"],
    ["deny", "fin_deny", "Deny amounts and balances"],
    ["allow", "fin_allow", "Allow amounts and balances"],
  ];
  const strict = value.accessProfile !== null;

  return (
    <div dir={s.dir} data-testid="access-profile-panel" className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3.5 dark:border-violet-900 dark:bg-violet-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-violet-900 dark:text-violet-200">
          <ShieldCheck className="h-3.5 w-3.5" /> {s.t("title", "Access Profile & Assignments")}
        </span>
        <span className="rounded bg-violet-100 px-2 py-0.5 text-[10.5px] font-bold text-violet-800 dark:bg-violet-900 dark:text-violet-200" data-testid="effective-role">
          {s.t("effective_role", "Effective role")}: {centralT(s.lang, `role.${effectiveRole}` as never, effectiveRole)}
        </span>
      </div>

      <div className="space-y-1">
        <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">{s.t("profile", "Access profile")}</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {profiles.map(([v, key, fb]) => (
            <button
              key={key}
              type="button"
              onClick={() => set({ accessProfile: v, shippingLineId: v === "shipping_line" ? value.shippingLineId : "" })}
              className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${s.textStart} ${
                value.accessProfile === v
                  ? "border-violet-500 bg-violet-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              {s.t(key, fb)}
            </button>
          ))}
        </div>
        <p className="text-[10.5px] text-violet-800/80 dark:text-violet-300/80">
          {s.t("profile_hint", "The selected role decides the country / branch level; the access profile narrows it to operational or shipping-line modules.")}
        </p>
      </div>

      {value.accessProfile === "shipping_line" && (
        <label className="block space-y-1">
          <span className="flex items-center gap-1 text-[11px] font-bold text-slate-800 dark:text-slate-200">
            <Ship className="h-3.5 w-3.5" /> {s.t("shipping_line", "Shipping Line assignment")} *
          </span>
          <select
            value={value.shippingLineId}
            onChange={(e) => set({ shippingLineId: e.target.value })}
            data-testid="shipping-line-select"
            className="flex h-8 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">{s.t("select_shipping_line", "Select shipping line")}</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>
      )}

      <div className="space-y-1">
        <span className="flex items-center gap-1 text-[11px] font-bold text-slate-800 dark:text-slate-200">
          <Warehouse className="h-3.5 w-3.5" /> {s.t("warehouses", "Warehouse assignment")}
        </span>
        {scopedWarehouses.length === 0 ? (
          <p className="text-[10.5px] text-slate-500">{s.t("no_warehouses", "No warehouses in this country.")}</p>
        ) : (
          <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            {scopedWarehouses.map((w) => {
              const on = value.warehouseIds.includes(w.id);
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => set({ warehouseIds: on ? value.warehouseIds.filter((x) => x !== w.id) : [...value.warehouseIds, w.id] })}
                  className={`rounded-md border px-2 py-1 text-[10.5px] font-bold ${
                    on ? "border-violet-500 bg-violet-600 text-white" : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  {w.warehouse_name || w.name}
                </button>
              );
            })}
          </div>
        )}
        <p className="text-[10.5px] text-slate-500">{s.t("warehouses_hint", "Optional. Leave empty for every warehouse in the assigned scope.")}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="flex items-center gap-1 text-[11px] font-bold text-slate-800 dark:text-slate-200">
            <CalendarRange className="h-3.5 w-3.5" /> {s.t("effective_from", "Effective from")}
          </span>
          <input type="date" value={value.effectiveFrom} onChange={(e) => set({ effectiveFrom: e.target.value })}
            className="flex h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900" />
        </label>
        <label className="block space-y-1">
          <span className="flex items-center gap-1 text-[11px] font-bold text-slate-800 dark:text-slate-200">
            <CalendarRange className="h-3.5 w-3.5" /> {s.t("effective_to", "Effective to")}
          </span>
          <input type="date" value={value.effectiveTo} onChange={(e) => set({ effectiveTo: e.target.value })}
            className="flex h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900" />
        </label>
        <p className="text-[10.5px] text-slate-500 sm:col-span-2">{s.t("dates_hint", "Outside these dates the assignment grants nothing.")}</p>
      </div>

      <div className="space-y-1">
        <span className="flex items-center gap-1 text-[11px] font-bold text-slate-800 dark:text-slate-200">
          <Landmark className="h-3.5 w-3.5" /> {s.t("financial", "Field-level financial access")}
        </span>
        <div className="grid gap-2 sm:grid-cols-3">
          {finModes.map(([v, key, fb]) => {
            const locked = v === "allow" && (!canGrantFinance || strict);
            return (
              <button
                key={v}
                type="button"
                disabled={locked}
                title={locked ? s.t("fin_allow_locked", "You cannot grant financial access you do not hold.") : undefined}
                onClick={() => set({ financialAccess: v })}
                className={`rounded-lg border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${s.textStart} ${
                  value.financialAccess === v
                    ? "border-violet-500 bg-violet-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                {s.t(key, fb)}
              </button>
            );
          })}
        </div>
        <p className="text-[10.5px] text-slate-500">{s.t("fin_hint", "Operations and Shipping Line profiles never see financial data, whatever is selected here.")}</p>
      </div>

      {error && (
        <p className="rounded-md bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" data-testid="access-profile-error">
          {error === "shipping_line_required"
            ? s.t("shipping_line_required", "A Shipping Line login must be bound to a shipping line.")
            : s.t("dates_invalid", "Effective-to date must be on or after the effective-from date.")}
        </p>
      )}
    </div>
  );
}

export type EffectiveAccess = {
  roles: string[];
  isSuperAdmin: boolean;
  isGlobalScope: boolean;
  countryIds: string[];
  countryBranchIds: string[];
  cityBranchIds: string[];
  shippingLineIds: string[];
  clearingAgentIds: string[];
  isShippingScoped: boolean;
  operationalDomains: ("business" | "shipping" | "both")[];
  canViewFinancials: boolean;
  permissions: string[];
  combinedAssignments: number;
};

export function EffectiveAccessSummary({ access, lang }: { access: EffectiveAccess | null | undefined; lang?: string }) {
  const s = useErpScreen("eas", lang as never);
  const menu = useMemo(
    () => (access ? visibleMenuFor(access.roles, access.permissions, { isShippingScoped: access.isShippingScoped, operationalDomains: access.operationalDomains, canViewFinancials: access.canViewFinancials }) : []),
    [access]
  );
  if (!access) {
    return (
      <div dir={s.dir} data-testid="effective-access-summary" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        {s.t("none", "This user has no effective access (inactive, expired, or no assignment).")}
      </div>
    );
  }
  const landing = dashboardForRoles(access.roles, { isSuperAdmin: access.isSuperAdmin, isShippingScoped: access.isShippingScoped });
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 py-1 last:border-0 dark:border-slate-800">
      <span className="text-slate-500">{label}</span>
      <strong className="text-slate-900 dark:text-slate-100">{value}</strong>
    </div>
  );
  return (
    <div dir={s.dir} data-testid="effective-access-summary" className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 text-[11px] dark:border-emerald-900 dark:bg-emerald-950/20">
      <div>
        <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
          <LayoutDashboard className="h-3.5 w-3.5" /> {s.t("title", "Effective Access Summary")}
        </div>
        <p className="text-[10.5px] text-emerald-800/80 dark:text-emerald-300/80">{s.t("subtitle", "What this user will see after their next sign-in or page refresh.")}</p>
      </div>
      <div>
        {row(s.t("roles", "Effective roles"), access.roles.map((r) => centralT(s.lang, `role.${r}` as never, r)).join(" + "))}
        {row(s.t("landing", "Landing dashboard"), <span className="font-mono" dir="ltr">{landing}</span>)}
        {row(
          s.t("scope", "Data scope"),
          access.isGlobalScope
            ? s.t("scope_global", "Global (all countries and branches)")
            : `${s.t("countries", "Countries")}: ${access.countryIds.length} · ${s.t("main_branches", "Main branches")}: ${access.countryBranchIds.length} · ${s.t("city_branches", "City branches")}: ${access.cityBranchIds.length}`
        )}
        {access.shippingLineIds.length > 0 && row(s.t("shipping_lines", "Shipping lines"), access.shippingLineIds.length)}
        {access.clearingAgentIds.length > 0 && row(s.t("clearing_agents", "Clearing agents"), access.clearingAgentIds.length)}
        {row(s.t("assigned_only", "Assigned records only"), access.isShippingScoped ? s.t("yes", "Yes") : s.t("no", "No"))}
        {row(
          s.t("financial", "Financial data"),
          <span className={access.canViewFinancials ? "text-emerald-700" : "text-rose-700"} data-testid="eas-financial">
            {access.canViewFinancials ? s.t("fin_allowed", "Visible") : s.t("fin_denied", "Hidden")}
          </span>
        )}
        {access.combinedAssignments > 1 && row(s.t("combined", "Separately computed assignments"), access.combinedAssignments)}
      </div>
      <div>
        <div className="mb-1 font-bold text-slate-700 dark:text-slate-300">{s.t("menu", "Menu sections")}</div>
        <div className="flex flex-wrap gap-1" data-testid="eas-menu">
          {menu.map((m) => (
            <span key={m.key} className="rounded bg-white px-1.5 py-0.5 font-bold text-slate-700 shadow-2xs dark:bg-slate-900 dark:text-slate-300">
              {translateHeader(s.lang as never, m.label)}{m.items ? ` (${m.items})` : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Self-loading variant for the User Profile: asks the server for the user's effective access (403 outside the caller's scope). */
export function EffectiveAccessForUser({ userId, lang }: { userId: string | null | undefined; lang?: string }) {
  const [access, setAccess] = useState<EffectiveAccess | null | undefined>(undefined);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    fetch(`/api/erp/users?userId=${encodeURIComponent(userId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive) setAccess(j?.data?.effectiveAccess ?? null); })
      .catch(() => { if (alive) setAccess(null); });
    return () => { alive = false; };
  }, [userId]);
  if (!userId || access === undefined) return null;
  return <EffectiveAccessSummary access={access} lang={lang} />;
}
