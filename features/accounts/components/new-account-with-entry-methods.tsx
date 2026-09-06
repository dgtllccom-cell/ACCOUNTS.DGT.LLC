"use client";

import { useState, useEffect, useMemo } from "react";
import { NewAccountSetup } from "./new-account-setup";
import { BulkAccountImport } from "./bulk-account-import";
import { AccountSetupReport } from "./account-setup-report";
import { AccountsHeaderScopeBar, type ScopeLevel, type BranchKind, type BranchOption, type CountryOption } from "./accounts-header-scope-bar";
import { EntryMethodSelector } from "@/features/document-intelligence/components/entry-method-selector";
import { LocationBackdrop } from "@/components/location-backdrop";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { listCountries, type LocationCountry } from "@/features/locations/location-api";
import { ArrowLeft, LayoutList, Plus, FileText } from "lucide-react";

/**
 * Unified Account Management & Setup Hub:
 * 1. Default View: Role-scoped Account Master Table (Super Admin, Country Admin, Branch Admin).
 * 2. Header Action Bar: Scope, Country, Branch Type, Branch dropdowns neatly embedded in top "patti".
 * 3. Fast Action Switches:
 *    - "+ New Account Entry" opens manual form or entry method selector.
 *    - "Bulk Import" opens AI document scan/upload for bulk creation.
 *    - "← Accounts List" returns to the scoped table view.
 */
export function NewAccountWithEntryMethods({
  lang: initialLang,
  initialAccountId,
}: {
  lang: SupportedLanguage;
  initialAccountId?: string;
}) {
  const activeLang = (useActiveLanguage() || initialLang) as SupportedLanguage;
  const s = useErpScreen("acctimp", activeLang);

  const [view, setView] = useState<"table" | "form" | "bulk" | "bulk_done">(
    initialAccountId ? "form" : "table"
  );
  const [currentAccountId, setCurrentAccountId] = useState<string | undefined>(initialAccountId);
  const [createdCount, setCreatedCount] = useState(0);

  // Scoping state
  const [scopeLevel, setScopeLevel] = useState<ScopeLevel>("city_branch");
  const [countryId, setCountryId] = useState("");
  const [branchKind, setBranchKind] = useState<BranchKind>("business");
  const [branchId, setBranchId] = useState<string>("");
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [mainBranches, setMainBranches] = useState<BranchOption[]>([]);
  const [cityBranches, setCityBranches] = useState<BranchOption[]>([]);
  const [loadingBranches, setLoadingBranches] = useState<boolean>(false);

  // Load countries
  useEffect(() => {
    let cancelled = false;
    listCountries()
      .then((rows: LocationCountry[]) => {
        if (!cancelled) setCountries(rows as CountryOption[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Load branches when country or branchKind (business vs clearing agent) changes
  useEffect(() => {
    if (!countryId) {
      setMainBranches([]);
      setCityBranches([]);
      setBranchId("");
      return;
    }

    let cancelled = false;
    setLoadingBranches(true);

    const loadMain = fetch(`/api/erp/locations/branches/main?countryId=${encodeURIComponent(countryId)}&scope=${branchKind}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) {
          const list = j?.data?.branches || j?.branches || j?.countryBranches || [];
          setMainBranches(Array.isArray(list) ? list : []);
        }
      })
      .catch(() => {});

    const loadCity = fetch(`/api/erp/locations/branches/city?countryId=${encodeURIComponent(countryId)}&scope=${branchKind}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) {
          const list = j?.data?.cityBranches || j?.data?.branches || j?.cityBranches || [];
          setCityBranches(Array.isArray(list) ? list : []);
        }
      })
      .catch(() => {});

    Promise.all([loadMain, loadCity]).finally(() => {
      if (!cancelled) setLoadingBranches(false);
    });

    return () => {
      cancelled = true;
    };
  }, [countryId, branchKind]);

  // Auto-select branch when branch options load
  useEffect(() => {
    const list = cityBranches.length > 0 ? cityBranches : mainBranches;
    if (list.length > 0 && (!branchId || !list.some((b) => b.id === branchId))) {
      setBranchId(list[0].id);
    }
  }, [cityBranches, mainBranches, branchId]);

  const selectedCountryName = useMemo(() => {
    if (!countryId) return "all";
    return countries.find((c) => c.id === countryId)?.name || "all";
  }, [countries, countryId]);

  const selectedBranchName = useMemo(() => {
    if (!branchId) return "all";
    const list = cityBranches.length > 0 ? cityBranches : mainBranches;
    return list.find((b) => b.id === branchId)?.name || "all";
  }, [cityBranches, mainBranches, branchId]);

  const handleScopeLevelChange = (lvl: ScopeLevel) => {
    setScopeLevel(lvl);
  };

  const handleCountryChange = (cid: string) => {
    setCountryId(cid);
    setBranchId("");
  };

  const handleBranchKindChange = (kind: BranchKind) => {
    setBranchKind(kind);
    setBranchId("");
  };

  return (
    <div className="space-y-3" dir={s.dir}>
      {/* When in Form or Bulk view, render the scope bar with back-to-table navigation */}
      {view !== "table" && (
        <AccountsHeaderScopeBar
          lang={activeLang}
          scopeLevel={scopeLevel}
          onScopeLevelChange={handleScopeLevelChange}
          countryId={countryId}
          onCountryChange={handleCountryChange}
          branchKind={branchKind}
          onBranchKindChange={handleBranchKindChange}
          branchId={branchId}
          onBranchChange={setBranchId}
          countries={countries}
          mainBranches={mainBranches}
          cityBranches={cityBranches}
          loadingBranches={loadingBranches}
          view={view}
          onNewAccount={() => {
            setCurrentAccountId(undefined);
            setView("form");
          }}
          onBulkImport={() => setView("bulk")}
          onBackToTable={() => setView("table")}
        />
      )}

      {/* ── View 1: Scoped Accounts Table (Default View) ── */}
      {view === "table" && (
        <div className="space-y-3">
          <AccountSetupReport
            lang={activeLang}
            onNewAccount={() => {
              setCurrentAccountId(undefined);
              setView("form");
            }}
            onBulkImport={() => setView("bulk")}
            onEditAccount={(id) => {
              setCurrentAccountId(id);
              setView("form");
            }}
            selectedCountry={selectedCountryName}
            selectedBranch={selectedBranchName}
          />
        </div>
      )}

      {/* ── View 2: Bulk Document Import ── */}
      {view === "bulk" && (
        <div className="mx-auto max-w-5xl space-y-4 p-2 sm:p-4" dir={s.dir}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setView("table")}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{s.t("back_to_table", "Back to Accounts Table")}</span>
            </button>
            <button
              type="button"
              onClick={() => setView("form")}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
            >
              {s.t("switch_to_manual", "Switch to manual single entry")} →
            </button>
          </div>

          <BulkAccountImport
            lang={activeLang}
            onComplete={(n) => {
              setCreatedCount(n);
              setView("bulk_done");
            }}
            onBackToTable={() => setView("table")}
            externalScope={{
              scopeLevel,
              countryId,
              branchKind,
              branchId,
            }}
            onScopeChange={(scope) => {
              setScopeLevel(scope.scopeLevel);
              setCountryId(scope.countryId);
              setBranchKind(scope.branchKind as BranchKind);
              setBranchId(scope.branchId);
            }}
          />
        </div>
      )}

      {/* ── View 3: Single Entry / Form Wizard ── */}
      {view === "form" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setView("table")}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{s.t("back_to_table", "Back to Accounts Table")}</span>
            </button>
          </div>

          <EntryMethodSelector
            targetModule="account_master"
            domain="business"
            lang={activeLang}
            title="New Account Setup"
            skipGate={!!currentAccountId}
            onScanClick={() => setView("bulk")}
          >
            <NewAccountSetup
              lang={activeLang}
              initialAccountId={currentAccountId}
              initialCountryId={countryId || undefined}
              initialBranchType="City"
              initialBranchId={branchId || undefined}
            />
          </EntryMethodSelector>
        </div>
      )}

      {/* ── View 4: Import Complete ── */}
      {view === "bulk_done" && (
        <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6" dir={s.dir}>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center shadow-sm dark:border-emerald-900 dark:bg-emerald-950/20">
            <h2 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
              {s.t("done_title", "Import complete")}
            </h2>
            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-200">
              {s.t("done_created", "{n} account(s) created").replace("{n}", String(createdCount))}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setView("table")}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
              >
                <LayoutList className="h-4 w-4" />
                <span>{s.t("view_accounts_table", "View Accounts Table")}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreatedCount(0);
                  setView("bulk");
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-5 py-2 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-200 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>{s.t("import_more", "Import More Accounts")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
