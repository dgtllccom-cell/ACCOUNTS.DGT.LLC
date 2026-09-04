"use client";

import { useEffect, useState, useTransition } from "react";
import { Search, Plus, Download, Upload, Filter, Globe2, CheckCircle2, AlertCircle, RefreshCw, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

type TranslationItem = {
  id?: string;
  translationKey: string;
  recordTable: string;
  recordId: string;
  fieldName: string;
  originalText: string;
  originalLanguageCode: string;
  englishText: string;
  urduText: string;
  pashtoText: string;
  persianText: string;
  arabicText: string;
  source?: string;
  updatedAt?: string;
};

const MODULE_OPTIONS = [
  { en: "All Modules", key: "trm.mod_all", value: "" },
  { en: "System & UI Dictionary", key: "trm.mod_system", value: "system_dictionary" },
  { en: "Roznamcha & Cash Entry", key: "trm.mod_roznamcha", value: "roznamcha_entries" },
  { en: "Expenses Bills & Remarks", key: "trm.mod_expenses", value: "expenses" },
  { en: "Purchases & Transfers", key: "trm.mod_purchases", value: "purchases" },
  { en: "Sales & Invoices", key: "trm.mod_sales", value: "sales" },
  { en: "Accounts & Ledgers", key: "trm.mod_accounts", value: "enterprise_accounts" },
  { en: "Goods & Products", key: "trm.mod_goods", value: "goods" },
  { en: "Countries & Locations", key: "trm.mod_countries", value: "countries" },
  { en: "Branches", key: "trm.mod_branches", value: "city_branches" },
  { en: "Customers & Clients", key: "trm.mod_customers", value: "customers" },
  { en: "Suppliers & Vendors", key: "trm.mod_suppliers", value: "suppliers" },
  { en: "Payment Methods", key: "trm.mod_payment_methods", value: "payment_methods" },
  { en: "Tax Codes", key: "trm.mod_tax_codes", value: "tax_codes" },
  { en: "Companies", key: "trm.mod_companies", value: "companies" }
];

export default function TranslationsManagementPage() {
  const lang = useActiveLanguage();
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const [translations, setTranslations] = useState<TranslationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit / Add Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<TranslationItem>({
    recordTable: "system_dictionary",
    recordId: "",
    fieldName: "name",
    originalText: "",
    originalLanguageCode: "en",
    englishText: "",
    urduText: "",
    pashtoText: "",
    persianText: "",
    arabicText: "",
    translationKey: ""
  });
  const [isPending, startTransition] = useTransition();

  const fetchTranslations = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      if (selectedModule) params.set("module", selectedModule);
      if (missingOnly) params.set("missingOnly", "true");

      const res = await fetch(`/api/erp/translations/management?${params.toString()}`);
      const payload = await res.json();
      if (payload.ok && payload.data?.translations) {
        setTranslations(payload.data.translations);
      } else {
        setErrorMsg(payload.error?.message || tt("trm.err_load","Failed to load local translations"));
      }
    } catch (err: any) {
      setErrorMsg(err.message || tt("trm.err_network","Network error loading translations"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTranslations();
  }, [selectedModule, missingOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTranslations();
  };

  const handleOpenAddModal = () => {
    setActiveItem({
      recordTable: "system_dictionary",
      recordId: "",
      fieldName: "name",
      originalText: "",
      originalLanguageCode: "en",
      englishText: "",
      urduText: "",
      pashtoText: "",
      persianText: "",
      arabicText: "",
      translationKey: ""
    });
    setEditModalOpen(true);
  };

  const handleOpenEditModal = (item: TranslationItem) => {
    setActiveItem({ ...item });
    setEditModalOpen(true);
  };

  const handleSaveTranslation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!activeItem.originalText.trim()) {
      setErrorMsg(tt("trm.err_original_required","Original text is required"));
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          id: activeItem.id,
          recordTable: activeItem.recordTable || "system_dictionary",
          recordId: activeItem.recordId || activeItem.translationKey || activeItem.originalText.toLowerCase().replace(/[^a-z0-9]/g, "_"),
          fieldName: activeItem.fieldName || "name",
          originalText: activeItem.originalText,
          originalLanguageCode: activeItem.originalLanguageCode || "en",
          englishText: activeItem.englishText || activeItem.originalText,
          urduText: activeItem.urduText || "",
          pashtoText: activeItem.pashtoText || "",
          persianText: activeItem.persianText || "",
          arabicText: activeItem.arabicText || ""
        };

        const res = await fetch("/api/erp/translations/management", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.ok) {
          setSuccessMsg(tt("trm.saved_ok","Local translation saved successfully"));
          setEditModalOpen(false);
          fetchTranslations();
        } else {
          setErrorMsg(data.error?.message || tt("trm.err_save","Failed to save translation"));
        }
      } catch (err: any) {
        setErrorMsg(err.message || tt("trm.err_save","Failed to save translation"));
      }
    });
  };

  // Export JSON
  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(translations, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `erp-translations-local-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = ["ID", "Module", "Key", "Original Text", "English", "Urdu", "Pashto", "Farsi/Persian", "Arabic"];
    const rows = translations.map((t) => [
      t.id || "",
      t.recordTable,
      t.translationKey,
      `"${(t.originalText || "").replace(/"/g, '""')}"`,
      `"${(t.englishText || "").replace(/"/g, '""')}"`,
      `"${(t.urduText || "").replace(/"/g, '""')}"`,
      `"${(t.pashtoText || "").replace(/"/g, '""')}"`,
      `"${(t.persianText || "").replace(/"/g, '""')}"`,
      `"${(t.arabicText || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", encodeURI(csvContent));
    downloadAnchor.setAttribute("download", `erp-translations-local-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON File
  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            const res = await fetch("/api/erp/translations/management", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(parsed)
            });
            const resData = await res.json();
            if (resData.ok) {
              setSuccessMsg(`Imported ${resData.data.imported} local translation keys successfully`);
              fetchTranslations();
            } else {
              setErrorMsg(resData.error?.message || "Import failed");
            }
          } else {
            setErrorMsg(tt("trm.err_invalid_json","Invalid format: Expected a JSON array of translations"));
          }
        } catch (err: any) {
          setErrorMsg(tt("trm.err_json_parse","JSON parse error: ") + err.message);
        }
      };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Globe2 className="h-6 w-6 text-primary" aria-hidden />
            <h1 className="text-2xl font-bold tracking-tight">{tt("trm.title", "Local Translation Management")}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {tt("trm.subtitle", "Manage 5-language dictionary translations (English, Urdu, Pashto, Farsi, Arabic) running completely offline on server & database. No external AI APIs used.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleOpenAddModal} className="flex items-center gap-2 bg-blue-600 text-white shadow-sm hover:bg-blue-700">
            <Plus className="h-4 w-4" /> {tt("trm.add_key","Add Translation Key")}
          </Button>
          <Button variant="outline" onClick={handleExportJson} className="flex items-center gap-2">
            <Download className="h-4 w-4" /> {tt("trm.export_json","Export JSON")}
          </Button>
          <Button variant="outline" onClick={handleExportCsv} className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> {tt("trm.export_csv","Export CSV")}
          </Button>
          <label className="cursor-pointer">
            <div className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
              <Upload className="h-4 w-4" /> {tt("trm.import_json","Import JSON")}
            </div>
            <input type="file" accept=".json" onChange={handleImportJsonFile} className="hidden" />
          </label>
        </div>
      </div>

      {/* Alert Notifications */}
      {errorMsg && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="flex-1">{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p className="flex-1">{successMsg}</p>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={tt("trm.search_ph","Search translation key, English, Urdu, Pashto, Farsi or Arabic text...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {MODULE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {tt(opt.key, opt.en)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setMissingOnly(!missingOnly)}
              className={`px-3 py-2 text-xs font-semibold rounded-md border transition-colors ${
                missingOnly
                  ? "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {missingOnly ? "✓ Filtered: Missing Translations Only" : "Show Missing Only"}
            </button>

            <Button type="submit" variant="secondary" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> {tt("common.filter", "Filter")}
            </Button>
          </div>
        </form>
      </div>

      {/* Translations Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="erp-table-wrap erp-sticky-col">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th className="p-3">Module / Key</Th>
                <Th className="p-3">English (en)</Th>
                <Th className="p-3">Urdu (ur)</Th>
                <Th className="p-3">Pashto (ps)</Th>
                <Th className="p-3">Farsi (fa)</Th>
                <Th className="p-3">Arabic (ar)</Th>
                <Th className="p-3 text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    {tt("trm.loading","Loading local translations from database...")}
                  </td>
                </tr>
              ) : translations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    {tt("trm.empty", "No translations found matching your search. Use \"Add Translation Key\" to add one.")}
                  </td>
                </tr>
              ) : (
                translations.map((item) => {
                  const isMissingUr = !item.urduText?.trim();
                  const isMissingPs = !item.pashtoText?.trim();
                  const isMissingFa = !item.persianText?.trim();
                  const isMissingAr = !item.arabicText?.trim();

                  return (
                    <tr key={item.id || item.translationKey} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">
                        <span className="block text-xs font-semibold text-primary">{item.recordTable}</span>
                        <span className="block text-xs text-muted-foreground">{item.translationKey || item.recordId}</span>
                      </td>
                      <td className="p-3 font-medium text-foreground">{item.englishText || item.originalText}</td>
                      <td className={`p-3 font-naskh ${isMissingUr ? "text-amber-500/80 italic text-xs" : ""}`}>
                        {item.urduText || "[Missing Urdu]"}
                      </td>
                      <td className={`p-3 font-naskh ${isMissingPs ? "text-amber-500/80 italic text-xs" : ""}`}>
                        {item.pashtoText || "[Missing Pashto]"}
                      </td>
                      <td className={`p-3 font-naskh ${isMissingFa ? "text-amber-500/80 italic text-xs" : ""}`}>
                        {item.persianText || "[Missing Farsi]"}
                      </td>
                      <td className={`p-3 font-naskh ${isMissingAr ? "text-amber-500/80 italic text-xs" : ""}`}>
                        {item.arabicText || "[Missing Arabic]"}
                      </td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEditModal(item)}>
                          {tt("common.edit", "Edit")}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Translation Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={handleSaveTranslation} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{activeItem.id ? tt("trm.edit_key","Edit Translation Key") : tt("trm.add_new_key","Add New Translation Key")}</DialogTitle>
              <DialogDescription>
                {tt("trm.dialog_desc","Save translations directly to the ERP database dictionary. All translations run 100% offline.")}
              </DialogDescription>
            </DialogHeader>

            <div className="erp-form-grid">
              <div>
                <Label htmlFor="moduleName">{tt("trm.module_table","Module / Table")}</Label>
                <select
                  id="moduleName"
                  value={activeItem.recordTable}
                  onChange={(e) => setActiveItem({ ...activeItem, recordTable: e.target.value })}
                  className="w-full h-10 mt-1.5 rounded-md border bg-background px-3 text-sm"
                >
                  {MODULE_OPTIONS.filter((m) => m.value).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {tt(opt.key, opt.en)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="translationKey">{tt("trm.key_id","Translation Key / ID")}</Label>
                <Input
                  id="translationKey"
                  placeholder={tt("trm.key_ph","e.g. nav.dashboard or custom_key")}
                  value={activeItem.recordId}
                  onChange={(e) => setActiveItem({ ...activeItem, recordId: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <div className="erp-form-full">
                <Label htmlFor="originalText">{tt("trm.original_master","Original Text (Master Value)")}</Label>
                <Input
                  id="originalText"
                  placeholder={tt("trm.original_ph","Enter original term or phrase")}
                  value={activeItem.originalText}
                  onChange={(e) => setActiveItem({ ...activeItem, originalText: e.target.value })}
                  className="mt-1.5"
                  required
                />
              </div>

              <div>
                <Label htmlFor="englishText">{tt("trm.lbl_en","English Translation (en)")}</Label>
                <Input
                  id="englishText"
                  value={activeItem.englishText}
                  onChange={(e) => setActiveItem({ ...activeItem, englishText: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="urduText">{tt("trm.lbl_ur","Urdu Translation (ur)")}</Label>
                <Input
                  id="urduText"
                  value={activeItem.urduText}
                  onChange={(e) => setActiveItem({ ...activeItem, urduText: e.target.value })}
                  className="mt-1.5 dir-rtl font-naskh"
                  dir="rtl"
                />
              </div>

              <div>
                <Label htmlFor="pashtoText">{tt("trm.lbl_ps","Pashto Translation (ps)")}</Label>
                <Input
                  id="pashtoText"
                  value={activeItem.pashtoText}
                  onChange={(e) => setActiveItem({ ...activeItem, pashtoText: e.target.value })}
                  className="mt-1.5 dir-rtl font-naskh"
                  dir="rtl"
                />
              </div>

              <div>
                <Label htmlFor="persianText">{tt("trm.lbl_fa","Farsi / Persian Translation (fa)")}</Label>
                <Input
                  id="persianText"
                  value={activeItem.persianText}
                  onChange={(e) => setActiveItem({ ...activeItem, persianText: e.target.value })}
                  className="mt-1.5 dir-rtl font-naskh"
                  dir="rtl"
                />
              </div>

              <div>
                <Label htmlFor="arabicText">{tt("trm.lbl_ar","Arabic Translation (ar)")}</Label>
                <Input
                  id="arabicText"
                  value={activeItem.arabicText}
                  onChange={(e) => setActiveItem({ ...activeItem, arabicText: e.target.value })}
                  className="mt-1.5 dir-rtl font-naskh"
                  dir="rtl"
                />
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
                {tt("common.cancel", "Cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? tt("trm.saving","Saving...") : tt("trm.save","Save Translation")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
