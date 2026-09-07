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
      {/* ── TOP LEVEL VIEW NAVIGATOR / TABS ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 sm:p-3 rounded-2xl shadow-xs">
        {/* Left: View Mode Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700">
          <button
            type="button"
            onClick={handleSwitchToTable}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              viewMode === "table"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/80 dark:border-slate-700"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            )}
          >
            <Table2 className="h-3.5 w-3.5" />
            <span>
              {activeLang === "ur"
                ? "رجسٹرڈ کمپنیوں کی فہرست"
                : activeLang === "ar"
                ? "دليل الشركات المسجلة"
                : "Registered Companies Directory"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleSwitchToNew}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              viewMode === "form" && !activeCompanyId
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/80 dark:border-slate-700"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>
              {activeLang === "ur"
                ? "نئی کمپنی کا اندراج"
                : activeLang === "ar"
                ? "تسجيل شركة جديدة"
                : "Register New Company"}
            </span>
          </button>
        </div>

        {/* Right: Contextual status or back action */}
        {viewMode === "form" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSwitchToTable}
            className="h-8.5 px-3 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold gap-1.5 text-slate-700 dark:text-slate-200 cursor-pointer shadow-2xs"
          >
            <ArrowLeft className={cn("h-3.5 w-3.5", isRtl && "rotate-180")} />
            <span>
              {activeLang === "ur"
                ? "کمپنیوں کے ٹیبل پر واپس جائیں"
                : activeLang === "ar"
                ? "العودة إلى جدول الشركات"
                : "Back to Companies Table"}
            </span>
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handleSwitchToNew}
              className="h-8.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>
                {activeLang === "ur"
                  ? "+ نئی کمپنی رجسٹر کریں"
                  : activeLang === "ar"
                  ? "+ تسجيل شركة جديدة"
                  : "+ Register New Company"}
              </span>
            </Button>
          </div>
        )}
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
