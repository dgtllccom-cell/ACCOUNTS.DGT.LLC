"use client";

/**
 * Company Setup — the ONE Company Master home (route /dashboard/settings/company-setup):
 *   ?                      → Company Registry
 *   ?action=new            → New company (Manual or Scan/Upload via Document Intelligence)
 *   ?companyId=<id>        → Edit company
 *   ?view=360&companyId=   → Company 360
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { ArrowLeft, Building2, Plus, Table2 } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { CompanyRegistry } from "@/features/companies/components/company-registry";
import { CompanyIncorporationForm } from "@/features/companies/components/company-incorporation-form";
import { Company360Panel } from "@/features/companies/components/company-360-panel";
import { EntryMethodSelector } from "@/features/document-intelligence/components/entry-method-selector";
import { cn } from "@/lib/utils";

interface CompanySetupManagerProps {
  initialCompanyId?: string;
  initialAction?: string;
  lang?: string;
}

type View = "table" | "form" | "360";

export function CompanySetupManager({ initialCompanyId, initialAction, lang: initialLang }: CompanySetupManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const s = useErpScreen("csm", initialLang);

  const queryAction = searchParams?.get("action") || initialAction;
  const queryCompanyId = searchParams?.get("companyId") || initialCompanyId;
  const queryView = searchParams?.get("view");

  const initialView: View = queryView === "360" && queryCompanyId ? "360" : queryAction === "new" || queryCompanyId ? "form" : "table";
  const [view, setView] = useState<View>(initialView);
  const [companyId, setCompanyId] = useState<string | undefined>(queryCompanyId || undefined);
  const [ownerId, setOwnerId] = useState<string | undefined>(undefined);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (queryView === "360" && queryCompanyId) {
      setCompanyId(queryCompanyId);
      setView("360");
    } else if (queryCompanyId) {
      setCompanyId(queryCompanyId);
      setView("form");
    } else if (queryAction === "new") {
      setCompanyId(undefined);
      setView("form");
    }
  }, [queryCompanyId, queryAction, queryView]);

  const go = (qs: string) => router.replace(`/dashboard/settings/company-setup${qs}` as Route);
  const toTable = () => {
    setCompanyId(undefined);
    setOwnerId(undefined);
    setView("table");
    go("");
  };
  const toNew = (owner?: string) => {
    setCompanyId(undefined);
    setOwnerId(owner);
    setFormKey((k) => k + 1);
    setView("form");
  };
  const toEdit = (id: string) => {
    setCompanyId(id);
    setOwnerId(undefined);
    setFormKey((k) => k + 1);
    setView("form");
    go(`?companyId=${id}`);
  };
  const to360 = (id: string) => {
    setCompanyId(id);
    setView("360");
    go(`?view=360&companyId=${id}`);
  };

  return (
    <div dir={s.dir} className="w-full space-y-4 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">{s.t("title", "Company Setup")}</h1>
            <p className="text-xs text-slate-500">{s.t("subtitle", "Company Master — legal companies of customers and our own registered entities.")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="csm-directory"
            onClick={toTable}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold",
              view === "table" ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300" : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            )}
          >
            <Table2 className="h-4 w-4 text-blue-600" /> {s.t("directory", "Registered Companies Directory")}
          </button>
          <button type="button" data-testid="csm-new" onClick={() => toNew()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> {s.t("register_new", "Register New Company")}
          </button>
          <button type="button" onClick={() => router.push("/dashboard" as Route)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            <ArrowLeft className={cn("h-3.5 w-3.5", s.isRtl && "rotate-180")} /> {s.t("back", "Back to Dashboard")}
          </button>
        </div>
      </div>

      {view === "table" && <CompanyRegistry onRegisterNew={toNew} onEditCompany={toEdit} onOpen360={to360} />}

      {view === "360" && companyId && <Company360Panel key={companyId} companyId={companyId} onEdit={toEdit} onAddSister={toNew} onClose={toTable} />}

      {view === "form" && (
        <EntryMethodSelector targetModule="companies" domain="business" lang={s.lang} skipGate={Boolean(companyId)}>
          <CompanyIncorporationForm
            key={formKey}
            mode="embedded"
            initialCompanyId={companyId}
            initialOwnerPersonId={ownerId}
            onClose={toTable}
            onSave={(d) => {
              if (d.id) to360(d.id);
            }}
          />
        </EntryMethodSelector>
      )}
    </div>
  );
}
