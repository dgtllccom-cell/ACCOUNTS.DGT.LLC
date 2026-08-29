"use client";

import { useEffect, useState } from "react";

/**
 * Full session scope for forms that CREATE scoped records (accounts, ledgers,
 * bookings, …). Comes straight from the RBAC-resolved server session
 * (`/api/erp/auth/session`). The backend already enforces scope on every write
 * (`authorizeApiScope`); this hook lets the UI (a) pre-select and lock the
 * country / branch the user is actually allowed to use and (b) show the
 * mandatory "Logged-in Scope" banner — so the two never disagree.
 */

export type ErpScopeMode = "super_admin" | "country" | "main_branch" | "city_branch" | "unknown";

export type ErpScope = {
  loading: boolean;
  error: string | null;

  isSuperAdmin: boolean;
  /** super_admin → free choice; country → country locked; main_branch/city_branch → branch locked too */
  mode: ErpScopeMode;

  // raw allowed sets (empty for super admin = "all")
  countryIds: string[];
  countryBranchIds: string[];
  cityBranchIds: string[];

  // the single locked value for each level, when the user's scope fixes it
  lockedCountryId: string | null;
  lockedCountryBranchId: string | null;
  lockedCityBranchId: string | null;

  // display
  countryName: string | null;
  countryBranchName: string | null;
  cityBranchName: string | null;
  branchDisplayName: string | null;
  scopeLabel: string | null;
  role: string | null;
  roles: string[];
  userId: string | null;
  userName: string | null;
};

const EMPTY: ErpScope = {
  loading: true, error: null, isSuperAdmin: false, mode: "unknown",
  countryIds: [], countryBranchIds: [], cityBranchIds: [],
  lockedCountryId: null, lockedCountryBranchId: null, lockedCityBranchId: null,
  countryName: null, countryBranchName: null, cityBranchName: null, branchDisplayName: null,
  scopeLabel: null, role: null, roles: [], userId: null, userName: null,
};

export function useErpScope(): ErpScope {
  const [scope, setScope] = useState<ErpScope>(EMPTY);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/erp/auth/session", { credentials: "include", cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          setScope({ ...EMPTY, loading: false, error: json?.error?.message || `Session failed (${res.status})` });
          return;
        }
        const p = json?.data ?? json;
        const s = p?.scopes ?? {};
        const sum = s?.summary ?? {};
        const isSuperAdmin = Boolean(s.isSuperAdmin);
        const countryIds: string[] = Array.isArray(s.countryIds) ? s.countryIds : [];
        const countryBranchIds: string[] = Array.isArray(s.countryBranchIds) ? s.countryBranchIds : [];
        const cityBranchIds: string[] = Array.isArray(s.cityBranchIds) ? s.cityBranchIds : [];

        const mode: ErpScopeMode = isSuperAdmin
          ? "super_admin"
          : cityBranchIds.length > 0
            ? "city_branch"
            : countryBranchIds.length > 0
              ? "main_branch"
              : countryIds.length > 0
                ? "country"
                : "unknown";

        setScope({
          loading: false, error: null,
          isSuperAdmin, mode,
          countryIds, countryBranchIds, cityBranchIds,
          // lock a level only when the user has EXACTLY ONE option there
          lockedCountryId: !isSuperAdmin && countryIds.length === 1 ? countryIds[0] : null,
          lockedCountryBranchId: !isSuperAdmin && countryBranchIds.length === 1 ? countryBranchIds[0] : null,
          lockedCityBranchId: !isSuperAdmin && cityBranchIds.length === 1 ? cityBranchIds[0] : null,
          countryName: sum.countryName ?? null,
          countryBranchName: sum.countryBranchName ?? null,
          cityBranchName: sum.cityBranchName ?? null,
          branchDisplayName: sum.branchDisplayName ?? sum.cityBranchName ?? sum.countryBranchName ?? sum.countryName ?? null,
          scopeLabel: sum.scopeLabel ?? null,
          role: Array.isArray(p?.roles) ? p.roles[0] ?? null : null,
          roles: Array.isArray(p?.roles) ? p.roles : [],
          userId: p?.user?.id ?? null,
          userName: p?.user?.fullName ?? p?.user?.email ?? null,
        });
      } catch (err) {
        if (active) setScope({ ...EMPTY, loading: false, error: err instanceof Error ? err.message : "Session load failed" });
      }
    })();
    return () => { active = false; };
  }, []);

  return scope;
}
