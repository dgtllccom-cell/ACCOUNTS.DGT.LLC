"use client";
import React, { useState, useRef } from "react";
import {
  Building2,
  Search,
  Calendar,
  ChevronRight,
  Package,
  Edit3,
  Trash2,
  Mic,
  Pin,
  Sparkles,
  Eye
} from "lucide-react";
import { t as tUi } from "@/lib/i18n/ui";
import { Button } from "@/components/ui/button";
import { SalesBookingUpperCards } from "./sales-booking-upper-cards";
import { VoiceFormFill } from "@/components/voice-form-fill";
import { AccountDetailsModal } from "./account-details-modal";
import { SearchSelect } from "@/components/ui/search-select";
import { CustomerAccountCard } from "@/components/erp/customer-account-card";

export function SalesBookingStep1({
  form,
  setForm,
  goodsEntries = [],
  setGoodsEntries,
  lang = "en",
  onNext,
  onEditItem,
  dbAccounts = [],
  dbCompanies = [],
  applyAccountMaster,
  formatAccountDisplayLabel
}) {
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [salesSearch, setSalesSearch] = useState("");
  const [salesOpen, setSalesOpen] = useState(false);
  const [viewModalAccount, setViewModalAccount] = useState(null);
  const [viewModalType, setViewModalType] = useState("customer");

  const handleOpenAccountDetails = (type) => {
    if (type === "sales") {
      const code = String(form.salesAccountNo || "").trim().toLowerCase();
      const acc = dbAccounts.find((a) => (a.accountCode || a.code || "").trim().toLowerCase() === code) || {
        accountCode: form.salesAccountNo || "SA-001",
        accountName: form.salesAccountName || "Global Trading LLC",
        cityBranchName: form.salesAccountBranch || form.branchName || "Main Branch",
        kind: form.salesAccountKind || "General Trading",
        currency: form.salesCurrency || "AED",
        companyName: form.salesCompanyName || form.salesAccountName,
        address: form.salesCompanyAddress || "Office 101, Business Bay, Dubai, UAE",
        licenseNo: form.salesLicenseNo || "TRN1234567890",
        gstTrn: form.salesGstTrn || "100123456789003",
        currentBalance: form.salesAccountCurrentBalance ?? 0,
        manualReferenceNumber: form.salesAccountManualReferenceNumber ?? ""
      };
      setViewModalAccount(acc);
      setViewModalType("sales");
    } else {
      const code = String(form.customerAccountNo || "").trim().toLowerCase();
      const acc = dbAccounts.find((a) => (a.accountCode || a.code || "").trim().toLowerCase() === code) || {
        accountCode: form.customerAccountNo || "CU-001",
        accountName: form.customerAccountName || "Al Noor Imports",
        cityBranchName: form.customerAccountBranch || form.branchName || "Main Branch",
        kind: form.customerAccountKind || "Import & Export",
        currency: form.customerAccountCurrency || form.salesCurrency || "AED",
        companyName: form.customerCompanyName || form.customerAccountName,
        address: form.customerCompanyAddress || "Warehouse 5, Jebel Ali, Dubai, UAE",
        licenseNo: form.customerLicenseNo || "TRN0987654321",
        gstTrn: form.customerGstTrn || "100987654321003",
        currentBalance: form.customerAccountCurrentBalance ?? 0,
        manualReferenceNumber: form.customerAccountManualReferenceNumber ?? ""
      };
      setViewModalAccount(acc);
      setViewModalType("customer");
    }
  };

  const accountOptions = React.useMemo(() => {
    return (dbAccounts || []).map((acc) => ({
      value: acc.accountCode || acc.code || acc.id,
      label: `${acc.accountCode || acc.code || ""} - ${acc.accountName || acc.name || ""}`,
      primaryText: acc.accountName || acc.name || "",
      code: acc.accountCode || acc.code || "",
      companyName: acc.companyName || undefined,
      category: acc.kind || acc.category || "General Ledger Account",
      phone: acc.mobile || acc.phone || undefined,
      email: acc.email || undefined,
      address: acc.address || undefined,
      city: acc.cityBranchName || acc.branchName || undefined,
      country: acc.countryName || undefined,
      status: acc.status === "inactive" ? "Inactive" : "Active",
      isAccountCard: true,
      rawAccount: acc,
    }));
  }, [dbAccounts]);

  const selectedCustomerAccObj = React.useMemo(() => {
    return dbAccounts.find((a) => (a.accountCode || a.code || a.id) === form.customerAccountNo);
  }, [dbAccounts, form.customerAccountNo]);

  const selectedSalesAccObj = React.useMemo(() => {
    return dbAccounts.find((a) => (a.accountCode || a.code || a.id) === form.salesAccountNo);
  }, [dbAccounts, form.salesAccountNo]);

  // Filter accounts
  const filteredCustomerAccounts = dbAccounts.filter((acc) => {
    if (!customerSearch.trim()) return true;
    const q = customerSearch.toLowerCase();
    return (
      (acc.accountName || "").toLowerCase().includes(q) ||
      (acc.accountCode || "").toLowerCase().includes(q) ||
      (acc.cityBranchName || "").toLowerCase().includes(q) ||
      (acc.manualReferenceNumber || "").toLowerCase().includes(q)
    );
  });

  const filteredSalesAccounts = dbAccounts.filter((acc) => {
    if (!salesSearch.trim()) return true;
    const q = salesSearch.toLowerCase();
    return (
      (acc.accountName || "").toLowerCase().includes(q) ||
      (acc.accountCode || "").toLowerCase().includes(q) ||
      (acc.cityBranchName || "").toLowerCase().includes(q) ||
      (acc.manualReferenceNumber || "").toLowerCase().includes(q)
    );
  });

  // Calculate totals
  const totalAmount = goodsEntries.reduce((sum, item) => sum + (Number(item.totalAmount || item.finalAmount || 0)), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start animate-in fade-in duration-200">
      {/* LEFT COLUMN: SALES BOOKING / BILL INFO FORM */}
      <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3.5">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            {tUi(lang, "sales.booking_bill_info_title", "SALES BOOKING / BILL INFO")}
          </h3>
        </div>

        {/* Voice Box */}
        <div className="rounded-xl bg-slate-950 text-white p-3 shadow-md border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-blue-600 text-white">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-black tracking-wide">
                {tUi(lang, "voice.speak_to_fill", "Speak to fill this form")}
              </span>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              MIC READY
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">
            {tUi(lang, "voice.speak_desc", "Speak amounts, parties, accounts, and references in 5 languages.")}
          </p>
          <VoiceFormFill
            context="sales"
            lang={lang}
            compact
            onApply={(f) =>
              setForm((prev) => ({
                ...prev,
                ...(f.customerName ? { customerAccountName: String(f.customerName) } : {}),
                ...(f.currencyCode ? { salesCurrency: String(f.currencyCode).toUpperCase().slice(0, 3) } : {})
              }))
            }
          />
        </div>

        {/* Customer Account (DR) * */}
        <div className="space-y-1">
          <label className="block text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            {tUi(lang, "sales.customer_account_dr", "Customer Account (DR)")} <span className="text-red-500">*</span>
          </label>
          <SearchSelect
            value={form.customerAccountNo}
            onValueChange={(val) => {
              const opt = accountOptions.find(o => o.value === val);
              const acc = opt?.rawAccount || dbAccounts.find(a => (a.accountCode || a.code || a.id) === val);
              if (acc) {
                if (applyAccountMaster) applyAccountMaster("purchase", acc);
                setForm((prev) => ({
                  ...prev,
                  customerAccountNo: acc.accountCode || acc.code || "",
                  customerAccountName: acc.accountName || acc.name || "",
                  customerAccountBranch: acc.cityBranchName || acc.branchName || prev.branchName || "",
                  customerAccountKind: acc.kind || acc.businessName || prev.customerAccountKind || "Asset / Accounts Receivable",
                  customerCompanyName: acc.companyName || acc.name || prev.customerCompanyName,
                  customerCompanyAddress: acc.address || prev.customerCompanyAddress,
                  customerLicenseNo: acc.licenseNo || prev.customerLicenseNo,
                  customerGstTrn: acc.gstTrn || prev.customerGstTrn,
                }));
              } else {
                setForm(prev => ({ ...prev, customerAccountNo: "", customerAccountName: "" }));
              }
            }}
            options={accountOptions}
            placeholder={tUi(lang, "sales.search_customer_ph", "Search customer name, account number, company, phone...")}
            accountCards
            clearable
          />
          {form.customerAccountNo && (
            <div className="mt-2">
              <CustomerAccountCard
                account={{
                  id: selectedCustomerAccObj?.id || form.customerAccountNo,
                  name: form.customerAccountName || selectedCustomerAccObj?.accountName || form.customerAccountNo,
                  code: form.customerAccountNo,
                  companyName: form.customerCompanyName,
                  category: form.customerAccountKind,
                  city: form.customerAccountBranch,
                  address: form.customerCompanyAddress,
                  status: "Active"
                }}
                onEdit={() => handleOpenAccountDetails("customer")}
                onClear={() => setForm(prev => ({ ...prev, customerAccountNo: "", customerAccountName: "" }))}
                selected
              />
            </div>
          )}
        </div>

        {/* Sales Account (CR) * */}
        <div className="space-y-1">
          <label className="block text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            {tUi(lang, "sales.sales_account_cr", "Sales Account (CR)")} <span className="text-red-500">*</span>
          </label>
          <SearchSelect
            value={form.salesAccountNo}
            onValueChange={(val) => {
              const opt = accountOptions.find(o => o.value === val);
              const acc = opt?.rawAccount || dbAccounts.find(a => (a.accountCode || a.code || a.id) === val);
              if (acc) {
                if (applyAccountMaster) applyAccountMaster("sales", acc);
                setForm((prev) => ({
                  ...prev,
                  salesAccountNo: acc.accountCode || acc.code || "",
                  salesAccountName: acc.accountName || acc.name || "",
                  salesAccountBranch: acc.cityBranchName || acc.branchName || prev.branchName || "",
                  salesAccountKind: acc.kind || acc.businessName || prev.salesAccountKind || "Income / Revenue",
                  salesCompanyName: acc.companyName || acc.name || prev.salesCompanyName,
                  salesCompanyAddress: acc.address || prev.salesCompanyAddress,
                  salesLicenseNo: acc.licenseNo || prev.salesLicenseNo,
                  salesGstTrn: acc.gstTrn || prev.salesGstTrn,
                }));
              } else {
                setForm(prev => ({ ...prev, salesAccountNo: "", salesAccountName: "" }));
              }
            }}
            options={accountOptions}
            placeholder={tUi(lang, "sales.search_sales_ph", "Search sales account name, account number, company...")}
            accountCards
            clearable
          />
          {form.salesAccountNo && (
            <div className="mt-2">
              <CustomerAccountCard
                account={{
                  id: selectedSalesAccObj?.id || form.salesAccountNo,
                  name: form.salesAccountName || selectedSalesAccObj?.accountName || form.salesAccountNo,
                  code: form.salesAccountNo,
                  companyName: form.salesCompanyName,
                  category: form.salesAccountKind,
                  city: form.salesAccountBranch,
                  address: form.salesCompanyAddress,
                  status: "Active"
                }}
                onEdit={() => handleOpenAccountDetails("sales")}
                onClear={() => setForm(prev => ({ ...prev, salesAccountNo: "", salesAccountName: "" }))}
                selected
              />
            </div>
          )}
        </div>

        {/* Contract No */}
        <div className="space-y-1">
          <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {tUi(lang, "sales.contract_no", "Contract No")}
          </label>
          <input
            type="text"
            value={form.salesContractNo || ""}
            onChange={(e) => setForm((p) => ({ ...p, salesContractNo: e.target.value }))}
            placeholder="e.g. SC-2026-001"
            className="w-full h-9 px-3 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
          />
        </div>

        {/* Contract / Booking Date */}
        <div className="space-y-1">
          <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {tUi(lang, "sales.contract_booking_date", "Contract / Booking Date")}
          </label>
          <div className="relative">
            <input
              type="date"
              value={form.salesDate || ""}
              onChange={(e) => setForm((p) => ({ ...p, salesDate: e.target.value }))}
              className="w-full h-9 px-3 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
            />
          </div>
        </div>

        {/* Invoice / Payment Select & Ship Option (2 inline) */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
              {tUi(lang, "sales.invoice_payment_select", "Invoice / Payment Select")}
            </label>
            <select
              value={form.paymentType || "Cash"}
              onChange={(e) => setForm((p) => ({ ...p, paymentType: e.target.value }))}
              className="w-full h-9 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
            >
              <option value="Cash">Cash</option>
              <option value="Advance Payment">Advance Payment</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Letter of Credit">Letter of Credit</option>
              <option value="Cheque">Cheque</option>
              <option value="Credit">Credit</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
              {tUi(lang, "sales.ship_option", "Ship Option")}
            </label>
            <select
              value={form.shippingMode || "By Sea"}
              onChange={(e) => setForm((p) => ({ ...p, shippingMode: e.target.value, shipmentType: e.target.value }))}
              className="w-full h-9 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
            >
              <option value="By Sea">By Sea</option>
              <option value="By Air">By Air</option>
              <option value="By Road">By Road</option>
              <option value="By Train">By Train</option>
              <option value="Transit">Transit</option>
            </select>
          </div>
        </div>

        {/* Status */}
        <div className="space-y-1">
          <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {tUi(lang, "sales.status", "Status")}
          </label>
          <select
            value={form.salesStatus || "Draft"}
            onChange={(e) => setForm((p) => ({ ...p, salesStatus: e.target.value }))}
            className="w-full h-9 px-3 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
          >
            <option value="Draft">Draft</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="In Transit">In Transit</option>
            <option value="Delivered">Delivered</option>
          </select>
        </div>

        {/* Booking Remarks / Terms */}
        <div className="space-y-1">
          <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {tUi(lang, "sales.booking_remarks_terms", "Booking Remarks / Terms")}
          </label>
          <textarea
            rows={2}
            value={form.remarks || ""}
            onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
            placeholder="Write booking terms, payment notes, invoice note, or shipping instruction..."
            className="w-full p-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-medium resize-none"
          />
        </div>

        {/* Next Button */}
        <Button
          type="button"
          onClick={onNext}
          className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-md rounded-xl flex items-center justify-center gap-1.5 transition-all"
        >
          {tUi(lang, "sales.next_goods_entry", "NEXT: GOODS ENTRY")}
          <ChevronRight className="w-4 h-4 rtl:rotate-180" />
        </Button>
      </div>

      {/* RIGHT COLUMN: UPPER 3 CARDS + GOODS ITEMS TABLE */}
      <div className="lg:col-span-8 space-y-4">
        {/* Upper 3 Cards */}
        <SalesBookingUpperCards
          form={form}
          setForm={setForm}
          lang={lang}
          dbCompanies={dbCompanies}
          dbAccounts={dbAccounts}
          mode="all"
          showBadges={false}
        />

        {/* Compact Goods Items Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              {tUi(lang, "sales.goods_items", "GOODS ITEMS")}
            </h3>
            <span className="text-[11px] font-bold text-slate-500 font-mono">
              {goodsEntries.length} Items
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-2.5 w-10 text-center">#</th>
                  <th className="p-2.5">Product Name</th>
                  <th className="p-2.5">HS Code</th>
                  <th className="p-2.5 text-center">Unit</th>
                  <th className="p-2.5 text-right">Quantity</th>
                  <th className="p-2.5 text-right">Unit Price</th>
                  <th className="p-2.5 text-right">Amount</th>
                  <th className="p-2.5 text-center w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {goodsEntries.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-2.5 text-center font-mono text-[11px] text-slate-400">{idx + 1}</td>
                    <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">{item.goodsName || item.productName}</td>
                    <td className="p-2.5 font-mono text-slate-500">{item.hsCode}</td>
                    <td className="p-2.5 text-center font-semibold text-slate-600 dark:text-slate-400">{item.qtyName || item.unit}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {Number(item.qtyNo || item.quantity || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                      {Number(item.coursePrice || item.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {Number(item.totalAmount || item.finalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditItem && onEditItem(idx)}
                          className="p-1 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-700 transition-colors"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setGoodsEntries(prev => prev.filter((_, i) => i !== idx))}
                          className="p-1 rounded-md bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {goodsEntries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400 text-xs italic">
                      No items added yet. Click Next to add goods entries.
                    </td>
                  </tr>
                )}
              </tbody>
              {goodsEntries.length > 0 && (
                <tfoot className="bg-slate-50 dark:bg-slate-950 font-black border-t-2 border-slate-200 dark:border-slate-800">
                  <tr>
                    <td colSpan={6} className="p-2.5 text-right text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Total
                    </td>
                    <td className="p-2.5 text-right font-mono text-sm text-blue-700 dark:text-blue-400">
                      {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Account Details Modal */}
      <AccountDetailsModal
        isOpen={!!viewModalAccount}
        onClose={() => setViewModalAccount(null)}
        account={viewModalAccount}
        accountType={viewModalType}
        lang={lang}
      />
    </div>
  );
}
