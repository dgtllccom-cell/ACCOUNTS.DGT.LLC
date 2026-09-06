"use client";

import { useState } from "react";
import { NewAccountSetup } from "./new-account-setup";
import { BulkAccountImport } from "./bulk-account-import";
import { EntryMethodSelector } from "@/features/document-intelligence/components/entry-method-selector";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";

/**
 * New Account Setup with the same entry-method gate Purchase / Sales use:
 *   Manual Entry            → the standard NewAccountSetup form
 *   Scan / Upload Document  → in-page BULK importer (one PDF/Excel → many accounts)
 *   Continue Saved Draft    → a reviewed draft from the Document Intake Center
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
  const [view, setView] = useState<"form" | "bulk" | "bulk_done">("form");
  const [createdCount, setCreatedCount] = useState(0);

  if (view === "bulk") {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6" dir={s.dir}>
        <button
          type="button"
          onClick={() => setView("form")}
          className="text-xs font-bold text-slate-500 hover:text-indigo-600"
        >
          ← {s.t("back", "Back to entry methods")}
        </button>
        <BulkAccountImport
          lang={activeLang}
          onComplete={(n) => { setCreatedCount(n); setView("bulk_done"); }}
        />
      </div>
    );
  }

  if (view === "bulk_done") {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6" dir={s.dir}>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/20">
          <h2 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
            {s.t("done_title", "Import complete")}
          </h2>
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-200">
            {s.t("done_created", "{n} account(s) created").replace("{n}", String(createdCount))}
          </p>
          <button
            onClick={() => { window.location.href = "/dashboard/accounts"; }}
            className="mt-4 inline-block rounded-lg bg-emerald-600 px-6 py-2 font-semibold text-white hover:bg-emerald-700"
          >
            {s.t("view_accounts", "View All Accounts")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <EntryMethodSelector
      targetModule="account_master"
      domain="business"
      lang={activeLang}
      title="New Account Setup"
      skipGate={!!initialAccountId}
      onScanClick={() => setView("bulk")}
    >
      <NewAccountSetup lang={activeLang} initialAccountId={initialAccountId} />
    </EntryMethodSelector>
  );
}
