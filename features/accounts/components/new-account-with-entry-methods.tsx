"use client";

import { useState } from "react";
import { NewAccountSetup } from "./new-account-setup";
import { BulkAccountImport } from "./bulk-account-import";
import { EntryMethodSelector, type EntryDraft } from "@/features/document-intelligence/components/entry-method-selector";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";

/**
 * Wrapper that adds "Choose Entry Method" gate to New Account Setup:
 * - Manual Entry: traditional form
 * - Bulk PDF/Document Import: upload and extract multiple accounts
 * - Continue Saved Draft: pre-filled form from document intake
 */
export function NewAccountWithEntryMethods({
  lang: initialLang,
  initialAccountId
}: {
  lang: SupportedLanguage;
  initialAccountId?: string;
}) {
  const activeLang = useActiveLanguage() || initialLang;
  const [bulkImportDone, setBulkImportDone] = useState(false);

  return (
    <EntryMethodSelector
      targetModule="account_master"
      domain="business"
      lang={activeLang}
      title="New Account Setup"
      skipGate={initialAccountId ? true : false}
      onDraftChosen={(draft) => {
        // Pre-fill form from draft if needed
      }}
    >
      {/* If bulk import just completed, show success or redirect back to list */}
      {bulkImportDone ? (
        <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/20 text-center">
            <h2 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
              Bulk Account Import Complete
            </h2>
            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-200">
              The accounts have been successfully created. You can now proceed to manage them in the Accounts module.
            </p>
            <button
              onClick={() => window.location.href = "/dashboard/accounts"}
              className="mt-4 inline-block rounded-lg bg-emerald-600 px-6 py-2 font-semibold text-white hover:bg-emerald-700"
            >
              View All Accounts
            </button>
          </div>
        </div>
      ) : (
        <NewAccountSetup lang={activeLang} initialAccountId={initialAccountId} />
      )}
    </EntryMethodSelector>
  );
}
