"use client";
import { useState, useEffect, useMemo } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Trash2, Eye, Printer, X, Check, Landmark } from "lucide-react";
import { Th } from "@/components/ui/translated-th";
import { UniversalReportModal } from "@/components/ui/universal-report-modal";
import { SearchSelect } from "@/components/ui/search-select";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";

type AccountRecord = {
  id: string;
  code: string;
  name: string;
  account_type_id?: string;
  kind?: string;
  currency?: string;
  country_id?: string;
  is_active: boolean;
  created_at: string;
  country?: { name: string };
  links?: { companies: number; banks: number; warehouses: number };
};

export function AccountRegistry() {
  const lang = useActiveLanguage();
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [showReport, setShowReport] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);
  const [formData, setFormData] = useState({
    code: "AUTO",
    name: "",
    kind: "asset",
    currency: "USD",
    countryId: "",
    scope: "super_admin",
    isControlAccount: false
  });

  async function loadCountries() {
    try {
      const res = await apiGet<{ countries: { id: string; name: string }[] }>("/api/erp/locations/countries");
      const list = (res.countries || []).filter(c => !c.name.startsWith("QA ") && !c.name.includes("DEVTEST"));
      setCountries(list);
    } catch (err) {
      console.error("Failed to load countries:", err);
    }
  }

  async function loadAccounts() {
    setLoading(true);
    try {
      const res = await apiGet<{ accounts: AccountRecord[]; summary: typeof summary }>(
        `/api/erp/accounting/accounts?limit=500`
      );
      const list = res.accounts || [];
      const active = list.filter((a: any) => a.status === "active" || a.is_active).length;
      setAccounts(list);
      setSummary({ total: list.length, active, inactive: list.length - active });
    } catch (err) {
      console.error("Failed to load accounts:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
    loadCountries();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => (a.name || "").toLowerCase().includes(q) || (a.code || "").toLowerCase().includes(q));
  }, [searchQuery, accounts]);

  async function handleDelete(id: string) {
    if (!window.confirm(t(lang, "acct.areg_delete_confirm", "Delete this account? This will remove all linked associations."))) return;
    try {
      await apiDelete(`/api/erp/accounting/accounts/${id}`);
      loadAccounts();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name) {
      alert(t(lang, "acct.areg_fill_account_name", "Please fill in Account Name."));
      return;
    }
    setSaving(true);
    try {
      await apiPost("/api/erp/accounting/accounts", formData);
      setIsModalOpen(false);
      setFormData({
        code: "AUTO",
        name: "",
        kind: "asset",
        currency: "USD",
        countryId: "",
        scope: "super_admin",
        isControlAccount: false
      });
      loadAccounts();
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">{t(lang, "acct.areg_title", "Chart of Accounts")}</CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t(lang, "acct.areg_subtitle", "Manage master ledger accounts, control accounts and currency mappings")}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowReport(true)} variant="outline" size="sm" className="flex items-center gap-1.5">
            <Printer className="w-4 h-4" /> {t(lang, "wh.print_report", "Print / Report")}
          </Button>
          <Button onClick={() => setIsModalOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="w-4 h-4 mr-1" /> {t(lang, "acct.areg_new_account", "+ New Account")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex gap-2">
          <Input placeholder={t(lang, "acct.areg_search_placeholder", "Search accounts by code or name...")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="max-w-md" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="px-3 py-2 border rounded-md bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm">
            <option value="all">{t(lang, "acct.status_all", "All Status")}</option>
            <option value="Active">{t(lang, "acct.active_only", "Active Only")}</option>
            <option value="Inactive">{t(lang, "acct.inactive_only", "Inactive Only")}</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 p-3 rounded-lg">
            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t(lang, "creg.crtr_total_word", "TOTAL")}</div>
            <div className="text-2xl font-bold text-blue-950 dark:text-blue-200 mt-1">{summary.total}</div>
          </div>
          <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 p-3 rounded-lg">
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{t(lang, "status.active", "ACTIVE")}</div>
            <div className="text-2xl font-bold text-emerald-950 dark:text-emerald-200 mt-1">{summary.active}</div>
          </div>
          <div className="bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 p-3 rounded-lg">
            <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">{t(lang, "creg.crtr_inactive_word", "INACTIVE")}</div>
            <div className="text-2xl font-bold text-rose-950 dark:text-rose-200 mt-1">{summary.inactive}</div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          </div>
        ) : (
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                  <Th className="p-3">#</Th>
                  <Th className="p-3 text-left">Code</Th>
                  <Th className="p-3 text-left">Name</Th>
                  <Th className="p-3 text-left">Kind</Th>
                  <Th className="p-3 text-left">Currency</Th>
                  <Th className="p-3 text-center">Status</Th>
                  <Th className="p-3 text-center">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">{t(lang, "acct.areg_no_accounts_found", "No accounts found")}</td>
                  </tr>
                ) : (
                  filtered.map((acc, idx) => (
                    <tr key={acc.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3 text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100">{acc.code}</td>
                      <td className="p-3 font-medium text-slate-900 dark:text-slate-200">{acc.name}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400 uppercase text-xs font-semibold">{acc.kind || t(lang, "sales.asset_word", "Asset")}</td>
                      <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{acc.currency || "USD"}</td>
                      <td className="p-3 text-center">
                        <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold", (acc.is_active ?? true) ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300" : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300")}>
                          {(acc.is_active ?? true) ? t(lang, "god.active", "Active") : t(lang, "god.inactive", "Inactive")}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => handleDelete(acc.id)} className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 rounded transition-colors" title={t(lang, "acct.areg_delete_account", "Delete Account")}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>

    <UniversalReportModal
      isOpen={showReport}
      onClose={() => setShowReport(false)}
      title={t(lang, "acct.areg_registry_report_title", "Chart of Accounts Registry")}
      data={accounts}
      columns={[
        { key: "code", label: t(lang, "purchase.f_account_code", "Account Code") },
        { key: "name", label: t(lang, "purchase.f_account_name", "Account Name") },
        { key: "kind", label: t(lang, "purchase.card_kind_label", "Kind") },
        { key: "currency", label: t(lang, "hr.f_currency", "Currency") }
      ]}
    />
    </>
  );
}
