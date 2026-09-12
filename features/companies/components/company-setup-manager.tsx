"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { Building2, Plus, Table2, ArrowLeft, Layers, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { CompanyRegistry } from "@/features/companies/components/company-registry";
import { CompanyIncorporationForm } from "@/features/companies/components/company-incorporation-form";
import { EntryMethodSelector } from "@/features/document-intelligence/components/entry-method-selector";

interface CompanySetupManagerProps {
  initialCompanyId?: string;
  initialAction?: string;
  lang?: string;
}

export function CompanySetupManager({
  initialCompanyId,
  initialAction,
  lang: initialLang
}: CompanySetupManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeLang = useActiveLanguage() || initialLang || "en";
  const isRtl = ["ur", "ar", "fa", "ps"].includes(activeLang);

  const queryAction = searchParams?.get("action") || initialAction;
  const queryCompanyId = searchParams?.get("companyId") || initialCompanyId;

  // View state: default to 'table' unless specifically asked for 'new' or editing an existing company
  const [viewMode, setViewMode] = useState<"table" | "form">(
    queryAction === "new" || Boolean(queryCompanyId) ? "form" : "table"
  );
  const [activeCompanyId, setActiveCompanyId] = useState<string | undefined>(queryCompanyId || undefined);
  const [activeOwnerPersonId, setActiveOwnerPersonId] = useState<string | undefined>(undefined);

  // Sync state if URL query params change
  useEffect(() => {
    if (queryCompanyId) {
      setActiveCompanyId(queryCompanyId);
      setViewMode("form");
    } else if (queryAction === "new") {
      setActiveCompanyId(undefined);
      setViewMode("form");
    }
  }, [queryCompanyId, queryAction]);

  const handleSwitchToNew = (ownerPersonId?: string) => {
    setActiveCompanyId(undefined);
    setActiveOwnerPersonId(ownerPersonId);
    setViewMode("form");
  };

  const handleSwitchToEdit = (companyId: string) => {
    setActiveCompanyId(companyId);
    setActiveOwnerPersonId(undefined);
    setViewMode("form");
  };

  const handleSwitchToTable = () => {
    setActiveCompanyId(undefined);
    setActiveOwnerPersonId(undefined);
    setViewMode("table");
    router.replace("/dashboard/settings/company-setup" as Route);
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="w-full space-y-4 font-sans">
      {/* ── TOP BREADCRUMB & HEADER BANNER ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <span className="hover:text-blue-600 cursor-pointer" onClick={() => router.push("/dashboard" as Route)}>Dashboard</span>
          <span>&gt;</span>
          <span className="hover:text-blue-600 cursor-pointer" onClick={() => router.push("/dashboard/settings" as Route)}>Settings</span>
          <span>&gt;</span>
          <span className="text-slate-800 dark:text-slate-200 font-bold">Company Setup</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 rounded-2xl shadow-xs">
          {/* Left: Title & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Company Setup
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Register and manage companies, owners, contacts and contracts.
              </p>
            </div>
          </div>

          {/* Right: Actions & Skyline Graphic */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleSwitchToTable}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                viewMode === "table"
                  ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              )}
            >
              <Table2 className="h-4 w-4 text-blue-600" />
              <span>Registered Companies Directory</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchToNew()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs",
                viewMode === "form" && !activeCompanyId
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              )}
            >
              <Plus className="h-4 w-4" />
              <span>+ Register New Company</span>
            </button>

            {/* Skyline Graphic Banner: "Build Today for a Bigger Tomorrow" */}
            <div className="hidden xl:flex items-center gap-3 px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-sky-50/90 dark:from-slate-800 dark:via-blue-950/40 dark:to-slate-800 border border-blue-100 dark:border-slate-700 relative overflow-hidden">
              <svg className="absolute right-0 bottom-0 h-10 w-28 text-blue-200/50 dark:text-blue-900/30 -mb-1 opacity-80 pointer-events-none" viewBox="0 0 120 40" fill="currentColor">
                <rect x="5" y="15" width="10" height="25" rx="1" />
                <rect x="18" y="8" width="14" height="32" rx="1" />
                <polygon points="25,2 18,8 32,8" />
                <rect x="35" y="18" width="12" height="22" rx="1" />
                <rect x="50" y="5" width="16" height="35" rx="1" />
                <rect x="69" y="12" width="10" height="28" rx="1" />
                <rect x="82" y="20" width="15" height="20" rx="1" />
                <rect x="100" y="10" width="12" height="30" rx="1" />
              </svg>
              <div className="z-10 text-right pr-6">
                <span className="text-[11px] font-extrabold text-blue-900 dark:text-blue-200 block leading-tight">Build Today</span>
                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 block leading-tight">for a Bigger Tomorrow</span>
              </div>
            </div>

            {/* Back to Dashboard Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/dashboard" as Route)}
              className="h-9 px-3.5 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold gap-1.5 text-slate-700 dark:text-slate-200 cursor-pointer shadow-2xs"
            >
              <ArrowLeft className={cn("h-3.5 w-3.5", isRtl && "rotate-180")} />
              <span>Back to Dashboard</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── CONDITIONAL VIEW CONTENT ── */}
      {viewMode === "table" ? (
        <CompanyRegistry
          onRegisterNew={handleSwitchToNew}
          onEditCompany={handleSwitchToEdit}
        />
      ) : (
        <div className="space-y-4">
          <EntryMethodSelector
            targetModule="companies"
            domain="business"
            lang={activeLang}
            skipGate={Boolean(activeCompanyId)}
          >
            <CompanyIncorporationForm
              initialCompanyId={activeCompanyId}
              initialOwnerPersonId={activeOwnerPersonId}
              onClose={handleSwitchToTable}
              onSave={() => {
                handleSwitchToTable();
              }}
            />
          </EntryMethodSelector>
        </div>
      )}
    </div>
  );
}
