"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Eye, PencilLine, Trash2, Plus, Search, Loader2, Printer, FileDown, X } from "lucide-react";
import { apiPost, apiPut } from "@/lib/api/client";
import { apiGet, apiDelete } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { t } from "@/lib/i18n/ui";

import { openUniversalPrintReport } from "@/lib/reports/universal-print-engine";
import { UniversalReportModal } from "@/components/ui/universal-report-modal";

type BankRecord = {
  id: string;
  bank_code: string | null;
  bank_name: string;
  branch_name: string | null;
  country_id: string;
  account_title: string | null;
  account_number: string | null;
  iban: string | null;
  swift_code: string | null;
  currency_code: string;
  is_active: boolean;
  created_at: string;
  country?: { name: string };
  full_address?: string | null;
};

export function BankRegistry() {
  const router = useRouter();
  const lang = useActiveLanguage();
  const th = (label: string) => translateHeader(lang, label);

  const [banks, setBanks] = useState<BankRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  // Quick Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<BankRecord | null>(null);
  const [formBankName, setFormBankName] = useState("");
  const [formBankCode, setFormBankCode] = useState("");
  const [formBranchName, setFormBranchName] = useState("");
  const [formSwift, setFormSwift] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formAccountTitle, setFormAccountTitle] = useState("");
  const [formAccountNumber, setFormAccountNumber] = useState("");
  const [formIban, setFormIban] = useState("");
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formIsActive, setFormIsActive] = useState(true);
  const [savingModal, setSavingModal] = useState(false);

  const openCreateModal = () => {
    setEditingBank(null);
    setFormBankName("");
    setFormBankCode("");
    setFormBranchName("");
    setFormSwift("");
    setFormAddress("");
    setFormAccountTitle("");
    setFormAccountNumber("");
    setFormIban("");
    setFormCurrency("USD");
    setFormIsActive(true);
    setModalOpen(true);
  };

  const openEditModal = (bank: BankRecord) => {
    setEditingBank(bank);
    setFormBankName(bank.bank_name);
    setFormBankCode(bank.bank_code || "");
    setFormBranchName(bank.branch_name || "");
    setFormSwift(bank.swift_code || "");
    setFormAddress(bank.full_address || "");
    setFormAccountTitle(bank.account_title || "");
    setFormAccountNumber(bank.account_number || "");
    setFormIban(bank.iban || "");
    setFormCurrency(bank.currency_code || "USD");
    setFormIsActive(bank.is_active);
    setModalOpen(true);
  };

  const handleModalSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBankName.trim()) return;
    setSavingModal(true);
    try {
      const payload: any = {
        bankName: formBankName.trim(),
        bankCode: formBankCode.trim() || null,
        branchName: formBranchName.trim() || null,
        swiftCode: formSwift.trim() || null,
        fullAddress: formAddress.trim() || null,
        accountTitle: formAccountTitle.trim() || null,
        accountNumber: formAccountNumber.trim() || null,
        iban: formIban.trim() || null,
        currencyCode: formCurrency.trim() || "USD",
        isActive: formIsActive,
      };
      if (editingBank) {
        await apiPut(`/api/erp/banks/${editingBank.id}`, payload);
      } else {
        await apiPost("/api/erp/banks", payload);
      }
      setModalOpen(false);
      await loadBanks();
    } catch (err: any) {
      alert(`Failed to save bank: ${err.message}`);
    } finally {
      setSavingModal(false);
    }
  };

  async function loadBanks() {
    setLoading(true);
    try {
      const res = await apiGet<{ banks: BankRecord[]; summary: typeof summary }>(
        `/api/erp/banks?limit=500&status=${statusFilter === "all" ? "" : statusFilter}&lang=${lang}`
      );
      setBanks(res.banks || []);
      setSummary(res.summary || { total: 0, active: 0, inactive: 0 });
    } catch (err) {
      console.error("Failed to load banks:", err);
      setBanks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBanks();
  }, [statusFilter, lang]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return banks;
    return banks.filter(
      (bank) =>
        bank.bank_name.toLowerCase().includes(q) ||
        bank.bank_code?.toLowerCase().includes(q) ||
        bank.account_number?.toLowerCase().includes(q) ||
        bank.iban?.toLowerCase().includes(q)
    );
  }, [searchQuery, banks]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this bank record? This action cannot be undone.")) return;
    setDeleting(id);
    try {
      await apiDelete(`/api/erp/banks/${id}`);
      loadBanks();
      setPage(1);
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  }

  function handlePrint() {
    const tr = (label: string) => translateHeader(lang, label);
    openUniversalPrintReport({
      title: t(lang, "bankreg.bankreg_report_title", "Bank Registry Report"),
      subtitle: t(lang, "bankreg.bankreg_report_subtitle", "Master Financial Institution Accounts and Banking Details"),
      lang,
      orientation: "landscape",
      moduleType: "register",
      scope: {
        scopeLevel: "Bank Management Registry",
        userName: "ERP User",
      },
      kpis: [
        { label: tr("Total Banks"), value: summary.total, color: "blue" },
        { label: tr("Active Accounts"), value: summary.active, color: "emerald" },
        { label: tr("Inactive Accounts"), value: summary.inactive, color: "amber" },
        { label: tr("Filtered Count"), value: filtered.length, color: "purple" },
      ],
      filters: [
        ...(searchQuery ? [{ label: tr("Search Query"), value: searchQuery }] : []),
        ...(statusFilter !== "all" ? [{ label: tr("Status Filter"), value: statusFilter }] : []),
      ],
      columns: [
        { key: "bank_name", label: t(lang, "bank.bank_name", "Bank Name"), width: "16%" },
        { key: "bank_code", label: t(lang, "common.code", "Code"), width: "9%" },
        { key: "branch_name", label: t(lang, "report.branch", "Branch"), width: "12%" },
        { key: "country_name", label: t(lang, "report.country", "Country"), width: "11%" },
        { key: "account_title", label: t(lang, "bank.account_title_label", "Account Title"), width: "14%" },
        { key: "account_number", label: t(lang, "bank.account_number", "Account Number"), width: "14%" },
        { key: "iban", label: t(lang, "bank.iban_label", "IBAN"), width: "11%" },
        { key: "swift_code", label: t(lang, "acct.swift", "SWIFT"), width: "7%" },
        { key: "full_address", label: t(lang, "td.address", "Bank Address"), width: "12%" },
        { key: "currency_code", label: t(lang, "hr.f_currency", "Currency"), align: "center", width: "5%" },
        { key: "status", label: t(lang, "log.tbl_status", "Status"), align: "center", format: "badge", width: "5%" }
      ],
      rows: filtered.map(b => ({
        bank_name: b.bank_name,
        bank_code: b.bank_code || "-",
        branch_name: b.branch_name || "-",
        country_name: b.country?.name || "-",
        account_title: b.account_title || "-",
        account_number: b.account_number || "-",
        iban: b.iban || "-",
        swift_code: b.swift_code || "-",
        full_address: b.full_address || "-",
        currency_code: b.currency_code,
        status: b.is_active ? t(lang, "god.active", "Active") : t(lang, "god.inactive", "Inactive")
      })),
      autoPrint: false,
    });
  }

  const totalPages = Math.ceil(filtered.length / pageSize);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle>{t(lang, "nav.bank_management", "Bank Management")}</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              {th("Manage all banks and banking details")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={openCreateModal}
              className="w-full shrink-0 justify-center bg-blue-600 text-white shadow-sm hover:bg-blue-700 sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-1" /> {t(lang, "bankreg.bankreg_new_bank", "New Bank")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[250px]">
              <Input
                placeholder={t(lang, "bankreg.bankreg_search_placeholder", "Search bank name, code, account number, IBAN...")}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border rounded-md bg-white"
            >
              <option value="all">{t(lang, "acct.status_all", "All Status")}</option>
              <option value="Active">{t(lang, "acct.active_only", "Active Only")}</option>
              <option value="Inactive">{t(lang, "acct.inactive_only", "Inactive Only")}</option>
            </select>
            <Button variant="outline" onClick={handlePrint} className="gap-1.5 font-bold">
              <Printer className="w-4 h-4 text-blue-600" />
              <span>{t(lang, "common.print", "Print Report")}</span>
            </Button>
            <Button variant="outline" onClick={() => { handlePrint(); }} className="gap-1.5 font-bold">
              <FileDown className="w-4 h-4 text-emerald-600" />
              <span>{t(lang, "report.export_pdf", "PDF Export")}</span>
            </Button>
          </div>


          <div className="grid grid-cols-4 gap-2 text-sm">
            <div className="bg-blue-50 p-3 rounded">
              <div className="text-xs text-blue-600 font-semibold">{t(lang, "creg.crtr_total_word", "TOTAL")}</div>
              <div className="text-lg font-bold text-blue-900">{summary.total}</div>
            </div>
            <div className="bg-green-50 p-3 rounded">
              <div className="text-xs text-green-600 font-semibold">{t(lang, "status.active", "ACTIVE")}</div>
              <div className="text-lg font-bold text-green-900">{summary.active}</div>
            </div>
            <div className="bg-red-50 p-3 rounded">
              <div className="text-xs text-red-600 font-semibold">{t(lang, "creg.crtr_inactive_word", "INACTIVE")}</div>
              <div className="text-lg font-bold text-red-900">{summary.inactive}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded">
              <div className="text-xs text-slate-600 font-semibold">{t(lang, "bankreg.bankreg_showing_word", "SHOWING")}</div>
              <div className="text-lg font-bold text-slate-900">{paginated.length}</div>
            </div>
          </div>

          <div className="border rounded-lg overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p className="text-slate-600">{t(lang, "bankreg.bankreg_loading_banks", "Loading banks...")}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-slate-600">{t(lang, "bankreg.bankreg_no_banks_found", "No banks found")}</p>
                <Button
                  onClick={() => router.push("/dashboard/settings/bank/new")}
                  className="mt-4 bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t(lang, "bankreg.bankreg_create_first_bank", "Create First Bank")}
                </Button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <Th className="p-3 text-left font-semibold text-slate-700">#</Th>
                    <Th className="p-3 text-left font-semibold text-slate-700">Bank Name</Th>
                    <Th className="p-3 text-left font-semibold text-slate-700">Code</Th>
                    <Th className="p-3 text-left font-semibold text-slate-700">Branch</Th>
                    <Th className="p-3 text-left font-semibold text-slate-700">Country</Th>
                    <Th className="p-3 text-left font-semibold text-slate-700">SWIFT / BIC</Th>
                    <Th className="p-3 text-left font-semibold text-slate-700">Bank Address</Th>
                    <Th className="p-3 text-left font-semibold text-slate-700">Account Title</Th>
                    <Th className="p-3 text-left font-semibold text-slate-700">IBAN</Th>
                    <Th className="p-3 text-center font-semibold text-slate-700">Currency</Th>
                    <Th className="p-3 text-center font-semibold text-slate-700">Status</Th>
                    <Th className="p-3 text-center font-semibold text-slate-700">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((bank, idx) => (
                    <tr key={bank.id} className="border-b hover:bg-slate-50 transition">
                      <td className="p-3 text-slate-600">{(page - 1) * pageSize + idx + 1}</td>
                      <td className="p-3 font-semibold text-slate-900">{bank.bank_name}</td>
                      <td className="p-3 text-slate-600 font-mono">{bank.bank_code || "-"}</td>
                      <td className="p-3 text-slate-600">{bank.branch_name || "-"}</td>
                      <td className="p-3 text-slate-600">{bank.country?.name || "-"}</td>
                      <td className="p-3 text-slate-600 font-mono text-xs">{bank.swift_code || "-"}</td>
                      <td className="p-3 text-slate-600 text-xs max-w-[180px] truncate" title={bank.full_address || ""}>{bank.full_address || "-"}</td>
                      <td className="p-3 text-slate-600 text-xs">{bank.account_title || "-"}</td>
                      <td className="p-3 text-slate-600 font-mono text-xs">{bank.iban || "-"}</td>
                      <td className="p-3 text-center font-mono text-sm">{bank.currency_code}</td>
                      <td className="p-3 text-center">
                        <span
                          className={cn(
                            "px-2 py-1 rounded text-xs font-semibold",
                            bank.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          )}
                        >
                          {bank.is_active ? t(lang, "god.active", "Active") : t(lang, "god.inactive", "Inactive")}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => router.push(`/dashboard/settings/bank/${bank.id}/edit`)}
                            title={t(lang, "common.view", "View")}
                            className="p-1 hover:bg-blue-100 rounded transition"
                          >
                            <Eye className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={() => openEditModal(bank)}
                            title={t(lang, "common.edit", "Edit")}
                            className="p-1 hover:bg-amber-100 rounded transition"
                          >
                            <PencilLine className="w-4 h-4 text-amber-600" />
                          </button>
                          <button
                            onClick={() => handleDelete(bank.id)}
                            disabled={deleting === bank.id}
                            className="p-1 hover:bg-red-100 rounded transition disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">{t(lang, "report.page", "Page")} {page} {t(lang, "creg.of", "of")} {totalPages}</div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  variant="outline"
                  size="sm"
                >
                  {t(lang, "common.previous", "Previous")}
                </Button>
                <Button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  variant="outline"
                  size="sm"
                >
                  {t(lang, "common.next", "Next")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <UniversalReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        title={t(lang, "bankreg.bankreg_report_title", "Bank Registry Report")}
        subtitle={t(lang, "bankreg.bankreg_report_subtitle", "Master Financial Institution Accounts and Banking Details")}
        exportFileName="bank_registry_report"
        filters={[
          { label: t(lang, "bankreg.bankreg_status_filter", "Status Filter"), value: statusFilter },
          { label: t(lang, "bankreg.bankreg_search_query", "Search Query"), value: searchQuery || t(lang, "purchase.card_none_label", "None") }
        ]}
        columns={[
          { key: "bank_name", label: t(lang, "bank.bank_name", "Bank Name") },
          { key: "bank_code", label: t(lang, "common.code", "Code") },
          { key: "branch_name", label: t(lang, "report.branch", "Branch") },
          { key: "country_name", label: t(lang, "report.country", "Country") },
          { key: "account_title", label: t(lang, "bank.account_title_label", "Account Title") },
          { key: "account_number", label: t(lang, "bank.account_number", "Account Number") },
          { key: "iban", label: t(lang, "bank.iban_label", "IBAN") },
          { key: "swift_code", label: t(lang, "acct.swift", "SWIFT") },
          { key: "full_address", label: t(lang, "td.address", "Bank Address") },
          { key: "currency_code", label: t(lang, "hr.f_currency", "Currency") },
          { key: "status", label: t(lang, "log.tbl_status", "Status"), align: "center" }
        ]}
        data={filtered.map(b => ({
          bank_name: b.bank_name,
          bank_code: b.bank_code || "-",
          branch_name: b.branch_name || "-",
          country_name: b.country?.name || "-",
          account_title: b.account_title || "-",
          account_number: b.account_number || "-",
          iban: b.iban || "-",
          swift_code: b.swift_code || "-",
          full_address: b.full_address || "-",
          currency_code: b.currency_code,
          status: b.is_active ? t(lang, "god.active", "Active") : t(lang, "god.inactive", "Inactive")
        }))}
      />

      {/* Quick Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <PencilLine className="h-4 w-4 text-blue-600" />
                {editingBank ? t(lang, "td.edit_bank", "Edit Bank") : t(lang, "bankreg.bankreg_new_bank", "New Bank")}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleModalSave} className="p-5 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {t(lang, "bank.bank_name", "Bank Name")} *
                </label>
                <Input
                  required
                  value={formBankName}
                  onChange={(e) => setFormBankName(e.target.value)}
                  placeholder={t(lang, "td.enter_bank_name", "Enter bank name")}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {t(lang, "common.code", "Code")}
                  </label>
                  <Input
                    value={formBankCode}
                    onChange={(e) => setFormBankCode(e.target.value)}
                    placeholder="0000"
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {t(lang, "report.branch", "Branch")}
                  </label>
                  <Input
                    value={formBranchName}
                    onChange={(e) => setFormBranchName(e.target.value)}
                    placeholder={t(lang, "report.branch", "Branch")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {t(lang, "acct.swift", "SWIFT")}
                  </label>
                  <Input
                    value={formSwift}
                    onChange={(e) => setFormSwift(e.target.value)}
                    placeholder="SWIFT / BIC"
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {t(lang, "hr.f_currency", "Currency")}
                  </label>
                  <Input
                    value={formCurrency}
                    onChange={(e) => setFormCurrency(e.target.value)}
                    placeholder="USD"
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {t(lang, "td.address", "Bank Address")}
                </label>
                <Input
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder={t(lang, "td.address", "Bank Address")}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {t(lang, "bank.account_title_label", "Account Title")}
                  </label>
                  <Input
                    value={formAccountTitle}
                    onChange={(e) => setFormAccountTitle(e.target.value)}
                    placeholder={t(lang, "bank.account_title_label", "Account Title")}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {t(lang, "bank.account_number", "Account Number")}
                  </label>
                  <Input
                    value={formAccountNumber}
                    onChange={(e) => setFormAccountNumber(e.target.value)}
                    placeholder="123456789"
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {t(lang, "bank.iban_label", "IBAN")}
                </label>
                <Input
                  value={formIban}
                  onChange={(e) => setFormIban(e.target.value)}
                  placeholder="AE00000000000000000000"
                  className="font-mono text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="bank_is_active"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <label htmlFor="bank_is_active" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  {t(lang, "god.active", "Active")}
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                  {t(lang, "td.cancel", "Cancel")}
                </Button>
                <Button type="submit" disabled={savingModal} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1.5">
                  {savingModal && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{savingModal ? t(lang, "td.saving", "Saving...") : t(lang, "td.save_changes", "Save Changes")}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
