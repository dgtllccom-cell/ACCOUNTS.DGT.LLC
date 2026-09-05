"use client";

import { useState } from "react";
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";

type BulkImportStatus = "idle" | "uploading" | "extracting" | "reviewing" | "confirming" | "complete" | "error";

interface ExtractedAccount {
  rowIndex: number;
  accountCode: string;
  accountName: string;
  currency: string;
  category: string;
  status: "valid" | "duplicate" | "invalid";
  message?: string;
}

export function BulkAccountImport({
  countryId,
  branchId,
  onComplete,
  lang: initialLang
}: {
  countryId: string;
  branchId: string;
  onComplete: (count: number) => void;
  lang: SupportedLanguage;
}) {
  const activeLang = useActiveLanguage() || initialLang;
  const [status, setStatus] = useState<BulkImportStatus>("idle");
  const [extractedAccounts, setExtractedAccounts] = useState<ExtractedAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setStatus("uploading");

    try {
      // Call document intake API to extract account data
      const formData = new FormData();
      formData.append("file", file);
      formData.append("targetModule", "account_master");
      formData.append("countryId", countryId);
      formData.append("branchId", branchId);

      setStatus("extracting");
      const response = await fetch("/api/erp/document-intelligence/extract", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error(t(activeLang, "account.bulk_import_failed", "Failed to extract accounts from document"));
      }

      const result = await response.json();

      // Process extracted data
      const accounts: ExtractedAccount[] = (result.extracted || []).map((item: any, idx: number) => ({
        rowIndex: idx + 1,
        accountCode: item.account_code || item.code || `ACC-${idx}`,
        accountName: item.account_name || item.name || "",
        currency: item.currency || "USD",
        category: item.category || "Asset",
        status: item.status || "valid",
        message: item.message
      }));

      setExtractedAccounts(accounts);
      setStatus("reviewing");
    } catch (err) {
      setError(err instanceof Error ? err.message : t(activeLang, "common.error_occurred", "An error occurred"));
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (extractedAccounts.length === 0) return;

    setLoading(true);
    setStatus("confirming");
    setError(null);

    try {
      // Call bulk account creation API
      const response = await fetch("/api/erp/accounting/accounts/bulk-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryId,
          branchId,
          accounts: extractedAccounts.filter(a => a.status === "valid").map(a => ({
            code: a.accountCode,
            name: a.accountName,
            currency: a.currency,
            category: a.category
          }))
        })
      });

      if (!response.ok) {
        throw new Error(t(activeLang, "account.bulk_create_failed", "Failed to create accounts"));
      }

      const result = await response.json();
      setStatus("complete");
      onComplete(result.createdCount || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : t(activeLang, "common.error_occurred", "An error occurred"));
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  if (status === "complete") {
    return (
      <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                {t(activeLang, "account.bulk_import_complete", "Bulk import complete")}
              </p>
              <p className="text-sm text-emerald-700 dark:text-emerald-200">
                {extractedAccounts.filter(a => a.status === "valid").length} {t(activeLang, "account.accounts_created", "accounts created")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t(activeLang, "account.bulk_import", "Bulk Account Import")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Upload */}
        <div className="rounded-lg border-2 border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
          <Upload className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 font-medium text-slate-700 dark:text-slate-300">
            {t(activeLang, "account.upload_pdf_excel", "Upload PDF, Excel, or Document")}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(activeLang, "account.bulk_import_desc", "Contains 10-20+ account records from another system")}
          </p>
          <input
            type="file"
            accept=".pdf,.xlsx,.xls,.csv,.doc,.docx"
            onChange={handleFileSelect}
            disabled={loading}
            className="mt-3"
          />
        </div>

        {/* Extracted Accounts Review */}
        {extractedAccounts.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold">
              {t(activeLang, "account.review_extracted", "Review Extracted Accounts")} ({extractedAccounts.length})
            </h3>
            <div className="max-h-64 overflow-y-auto rounded border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-left">Row</th>
                    <th className="px-3 py-2 text-left">{t(activeLang, "account.code", "Code")}</th>
                    <th className="px-3 py-2 text-left">{t(activeLang, "account.name", "Name")}</th>
                    <th className="px-3 py-2 text-left">{t(activeLang, "account.currency", "Currency")}</th>
                    <th className="px-3 py-2 text-left">{t(activeLang, "account.status", "Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {extractedAccounts.map(acc => (
                    <tr key={acc.rowIndex} className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="px-3 py-2">{acc.rowIndex}</td>
                      <td className="px-3 py-2 font-mono text-xs">{acc.accountCode}</td>
                      <td className="px-3 py-2">{acc.accountName}</td>
                      <td className="px-3 py-2">{acc.currency}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${acc.status === "valid" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : acc.status === "duplicate" ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" : "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300"}`}>
                          {acc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/20">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-600" />
            <div className="text-sm text-rose-700 dark:text-rose-200">{error}</div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          {status === "reviewing" && (
            <>
              <Button
                onClick={() => {
                  setStatus("idle");
                  setExtractedAccounts([]);
                }}
                variant="outline"
              >
                {t(activeLang, "common.cancel", "Cancel")}
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={loading || extractedAccounts.filter(a => a.status === "valid").length === 0}
                className="ml-auto"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t(activeLang, "account.confirm_and_create", "Confirm & Create")} ({extractedAccounts.filter(a => a.status === "valid").length})
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
