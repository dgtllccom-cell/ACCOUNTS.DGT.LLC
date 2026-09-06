"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Globe, Building2, MapPin, Plus, FileText, LayoutList, Loader2, ArrowLeft } from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";

export type ScopeLevel = "super_admin" | "country" | "main_branch" | "city_branch";
export type BranchKind = "main" | "city";

export interface BranchOption {
  id: string;
  name?: string;
  code?: string;
  city_name?: string;
  cityName?: string;
  branch_name?: string;
}

export interface CountryOption {
  id: string;
  name: string;
  iso2?: string;
  iso3?: string;
  currency_code?: string;
}

interface AccountsHeaderScopeBarProps {
  lang: SupportedLanguage;
  scopeLevel: ScopeLevel;
  onScopeLevelChange: (scope: ScopeLevel) => void;
  countryId: string;
  onCountryChange: (countryId: string) => void;
  branchKind: BranchKind;
  onBranchKindChange: (kind: BranchKind) => void;
  branchId: string;
  onBranchChange: (branchId: string) => void;
  countries: CountryOption[];
  mainBranches: BranchOption[];
  cityBranches: BranchOption[];
  loadingBranches?: boolean;
  view: "table" | "form" | "bulk" | "bulk_done";
  onNewAccount?: () => void;
  onBulkImport?: () => void;
  onBackToTable?: () => void;
}

const getFlag = (countryName: string) => {
  if (!countryName) return "🌍";
  const c = countryName.toUpperCase();
  if (c.includes("PAKISTAN") || c === "PK") return "🇵🇰";
  if (c.includes("UNITED ARAB") || c === "UAE" || c.includes("EMIRATES") || c.includes("DUBAI")) return "🇦🇪";
  if (c.includes("AFGHANISTAN") || c === "AF") return "🇦🇫";
  if (c.includes("SAUDI") || c === "SA") return "🇸🇦";
  if (c.includes("UNITED STATES") || c === "USA" || c === "US") return "🇺🇸";
  if (c.includes("CHINA") || c === "CN") return "🇨🇳";
  if (c.includes("INDIA") || c === "IN") return "🇮🇳";
  if (c.includes("IRAN") || c === "IR") return "🇮🇷";
  if (c.includes("OMAN") || c === "OM") return "🇴🇲";
  if (c.includes("UNITED KINGDOM") || c === "UK" || c === "GB") return "🇬🇧";
  return "🌍";
};

export function AccountsHeaderScopeBar({
  lang,
  scopeLevel,
  onScopeLevelChange,
  countryId,
  onCountryChange,
  branchKind,
  onBranchKindChange,
  branchId,
  onBranchChange,
  countries,
  mainBranches,
  cityBranches,
  loadingBranches = false,
  view,
  onNewAccount,
  onBulkImport,
  onBackToTable,
}: AccountsHeaderScopeBarProps) {
  const s = useErpScreen("acctimp", lang);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById("erp-page-actions-slot");
    if (el) setPortalTarget(el);
    const observer = new MutationObserver(() => {
      const found = document.getElementById("erp-page-actions-slot");
      if (found && found !== portalTarget) setPortalTarget(found);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [portalTarget]);

  const activeBranches = branchKind === "main" ? mainBranches : cityBranches;

  const content = (
    <div className="flex flex-wrap items-center gap-1.5" dir={s.dir}>
      {/* 1. Mode switch buttons */}
      {view === "table" ? (
        <>
          {onNewAccount && (
            <button
              type="button"
              onClick={onNewAccount}
              className="flex h-7 items-center gap-1 rounded-lg bg-indigo-600 px-2.5 text-[10px] font-black text-white shadow-2xs transition-colors hover:bg-indigo-700 shrink-0"
              title={s.t("new_account_btn", "Create New Account Entry")}
            >
              <Plus className="h-3 w-3" />
              <span>{s.t("new_account", "New Account")}</span>
            </button>
          )}
          {onBulkImport && (
            <button
              type="button"
              onClick={onBulkImport}
              className="flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shrink-0"
              title={s.t("bulk_import_btn", "Bulk Document Scan / Upload")}
            >
              <FileText className="h-3 w-3 text-indigo-500" />
              <span>{s.t("bulk_import", "Bulk Import")}</span>
            </button>
          )}
        </>
      ) : (
        onBackToTable && (
          <button
            type="button"
            onClick={onBackToTable}
            className="flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2.5 text-[10px] font-bold text-slate-800 shadow-2xs transition-colors hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 shrink-0"
            title={s.t("back_to_table", "Back to Accounts Table")}
          >
            <LayoutList className="h-3 w-3 text-indigo-600" />
            <span>{s.t("accounts_list", "Accounts List")}</span>
          </button>
        )
      )}

      <span className="hidden sm:inline-block h-3.5 w-px bg-slate-200 dark:bg-slate-700" />

      {/* 2. Scope Level dropdown */}
      <div className="relative inline-flex items-center">
        <select
          value={scopeLevel}
          onChange={(e) => onScopeLevelChange(e.target.value as ScopeLevel)}
          className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-700 shadow-2xs outline-none hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          title={s.t("scope_level", "Scope Level")}
        >
          <option value="super_admin">{s.t("scope_super", "Global")}</option>
          <option value="country">{s.t("scope_country", "Country")}</option>
          <option value="main_branch">{s.t("scope_main", "Main Branch")}</option>
          <option value="city_branch">{s.t("scope_city", "City Branch")}</option>
        </select>
      </div>

      {/* 3. Country dropdown */}
      {scopeLevel !== "super_admin" && (
        <div className="relative inline-flex items-center">
          <select
            value={countryId}
            onChange={(e) => onCountryChange(e.target.value)}
            className="h-7 max-w-[130px] truncate rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-700 shadow-2xs outline-none hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            title={s.t("country", "Country")}
          >
            <option value="">{s.t("choose_country", "— Country —")}</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {getFlag(c.name)} {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 4. Branch Type dropdown */}
      {(scopeLevel === "main_branch" || scopeLevel === "city_branch") && (
        <div className="relative inline-flex items-center">
          <select
            value={branchKind}
            onChange={(e) => onBranchKindChange(e.target.value as BranchKind)}
            className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-700 shadow-2xs outline-none hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            title={s.t("branch_kind", "Branch Type")}
          >
            <option value="city">{s.t("city_branch", "City Branch")}</option>
            <option value="main">{s.t("main_branch", "Main Branch")}</option>
          </select>
        </div>
      )}

      {/* 5. Branch dropdown */}
      {(scopeLevel === "main_branch" || scopeLevel === "city_branch") && (
        <div className="relative inline-flex items-center">
          <select
            value={branchId}
            onChange={(e) => onBranchChange(e.target.value)}
            disabled={!countryId || loadingBranches || activeBranches.length === 0}
            className="h-7 max-w-[155px] truncate rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-700 shadow-2xs outline-none hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer disabled:opacity-40"
            title={s.t("branch", "Branch")}
          >
            {!countryId ? (
              <option value="">{s.t("choose_country_first", "— Choose Country —")}</option>
            ) : loadingBranches ? (
              <option value="">{s.t("loading_branches", "Loading branches...")}</option>
            ) : activeBranches.length === 0 ? (
              <option value="">{s.t("no_branches", "No branches found")}</option>
            ) : (
              <>
                <option value="">{s.t("choose_branch", "— Choose Branch —")}</option>
                {activeBranches.map((b) => {
                  const label = b.name || b.cityName || b.city_name || b.branch_name || b.code || b.id;
                  const codeSuffix = b.code ? ` (${b.code})` : "";
                  return (
                    <option key={b.id} value={b.id}>
                      {label}{codeSuffix}
                    </option>
                  );
                })}
              </>
            )}
          </select>
          {loadingBranches && (
            <Loader2 className="absolute right-2 h-3 w-3 animate-spin text-slate-400 pointer-events-none" />
          )}
        </div>
      )}
    </div>
  );

  if (portalTarget) {
    return createPortal(content, portalTarget);
  }

  // Fallback inline header strip if portal target is not mounted yet
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-xs dark:border-slate-800 dark:bg-slate-900/90 sm:px-3">
      {content}
    </div>
  );
}
