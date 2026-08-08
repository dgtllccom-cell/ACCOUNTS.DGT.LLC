"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PurchaseBookingJournalReportView } from "@/features/purchases/components/purchase-booking-journal-report-view";
import { PurchaseOrderWizard } from "@/features/purchases/components/purchase-order-wizard.jsx";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Table, FileSpreadsheet, Sparkles } from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

function PurchaseBookingOrderPageWrapperContent({ session }: { session: any }) {
  const lang = useActiveLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const modeParam = searchParams.get("mode");
  const idParam = searchParams.get("id") || searchParams.get("editId");

  const [isFormMode, setIsFormMode] = useState<boolean>(() => {
    return modeParam === "new" || Boolean(idParam);
  });

  useEffect(() => {
    if (modeParam === "new" || idParam) {
      setIsFormMode(true);
    } else if (modeParam === "table" || modeParam === "journal") {
      setIsFormMode(false);
    }
  }, [modeParam, idParam]);

  const handleOpenNewWizard = () => {
    setIsFormMode(true);
    const params = new URLSearchParams(window.location.search);
    params.set("mode", "new");
    params.delete("id");
    params.delete("editId");
    router.push(`/dashboard/purchase/new-purchase-booking-order?${params.toString()}`);
  };

  const handleBackToJournal = () => {
    setIsFormMode(false);
    router.push(`/dashboard/purchase/new-purchase-booking-order`);
  };

  if (isFormMode) {
    return (
      <div className="w-full space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBackToJournal}
              className="gap-2 font-black text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 shadow-sm dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> {t(lang, "purchase.pbo_back_to_register", "Back to Booking Journal Register")}
            </Button>
            <span className="hidden sm:inline-block h-4 w-px bg-slate-300 dark:bg-slate-700" />
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              {idParam ? `${t(lang, "purchase.pbo_editing_prefix", "Editing Booking Order")} (${idParam})` : t(lang, "purchase.pbo_new_entry_title", "New Purchase Booking Order Entry")}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBackToJournal}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            >
              <Table className="h-4 w-4 mr-1 text-slate-500" /> {t(lang, "purchase.pbo_view_register_table", "View Register Table")}
            </Button>
          </div>
        </div>

        <PurchaseOrderWizard session={session} />
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Header bar with + New Purchase Booking button */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
              {t(lang, "purchase.pbo_register_title", "Purchase Booking Order Register")}
            </h1>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {t(lang, "purchase.pbo_overview", "Overview of all booked purchase bills, payment terms, and status")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleOpenNewWizard}
            className="gap-2 font-black text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all uppercase tracking-wider px-4 h-9"
          >
            <Plus className="h-4 w-4 stroke-[3]" /> {t(lang, "purchase.pbo_new_booking", "New Purchase Booking")}
          </Button>
        </div>
      </div>

      {/* Main Journal Register Table */}
      <PurchaseBookingJournalReportView lang={lang} />
    </div>
  );
}

export function PurchaseBookingOrderPageWrapper(props: { session: any }) {
  const lang = useActiveLanguage();
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm font-semibold text-slate-500">{t(lang, "purchase.pbo_loading", "Loading Purchase Booking Order...")}</div>}>
      <PurchaseBookingOrderPageWrapperContent {...props} />
    </Suspense>
  );
}
