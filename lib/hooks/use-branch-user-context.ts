"use client";

import { useEffect, useState } from "react";

/**
 * Normalized, session-scoped "Branch & User" context for the universal summary header.
 *
 * The values come straight from the server session (`/api/erp/auth/session`), which is
 * RBAC-resolved on the backend (a user only ever gets their own country/branch scope).
 * This is the single source for the MANDATORY Branch Name + User Name shown on every
 * important ERP page — no client-side "SUPER ADMIN"/"SA001"/"Main Branch" fallbacks.
 */
export type BranchUserContext = {
  isSuperAdmin: boolean;
  /** global | country | main_branch | city_branch | agent | ... */
  level: string;
  scopeLabel: string | null;
  country: string | null;
  /** City branch → Country branch → Country (whatever the user's scope resolves to). */
  branchName: string | null;
  branchId: string | null;
  companyName: string | null;
  userId: string | null;
  userName: string | null;
  /** Raw primary role key, e.g. "super_admin", "country_admin", "clearing_agent". */
  role: string | null;
  roles: string[];
  status: string;
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  country_admin: "Country Admin",
  country_user: "Country User",
  main_branch_admin: "Main Branch Admin",
  city_branch_admin: "City Branch Admin",
  city_branch_user: "City Branch User",
  clearing_agent: "Clearing Agent",
  agent: "Agent",
  operator: "Operator"
};

/** Human-readable label for a raw role key (falls back to a title-cased version). */
export function roleLabel(role: string | null | undefined): string {
  if (!role) return "-";
  return (
    ROLE_LABELS[role] ||
    role.split(/[_\s]+/).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ")
  );
}

export function useBranchUserContext(): { context: BranchUserContext | null; loading: boolean; error: string | null } {
  const [context, setContext] = useState<BranchUserContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/erp/auth/session", { credentials: "include", cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          setError(json?.error?.message || `Session request failed (${res.status})`);
          setContext(null);
          return;
        }
        // apiOk wraps payload in { data } — tolerate both shapes.
        const payload = json?.data ?? json;
        const summary = payload?.scopes?.summary ?? {};
        setContext({
          isSuperAdmin: Boolean(payload?.scopes?.isSuperAdmin),
          level: summary?.level ?? "global",
          scopeLabel: summary?.scopeLabel ?? null,
          country: summary?.countryName ?? null,
          branchName: summary?.branchDisplayName ?? summary?.cityBranchName ?? summary?.countryBranchName ?? summary?.countryName ?? null,
          branchId: summary?.cityBranchId ?? summary?.countryBranchId ?? summary?.countryId ?? null,
          companyName: payload?.company?.name ?? null,
          userId: payload?.user?.id ?? null,
          userName: payload?.user?.fullName ?? payload?.user?.email ?? null,
          role: payload?.roles?.[0] ?? null,
          roles: Array.isArray(payload?.roles) ? payload.roles : [],
          status: "Active"
        });
        setError(null);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load session context");
          setContext(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return { context, loading, error };
}
