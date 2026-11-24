"use client";
import React from "react";
import { Building2, ChevronRight, Package, Edit3, Trash2, Sparkles } from "lucide-react";
import { t as tUi } from "@/lib/i18n/ui";
import { Button } from "@/components/ui/button";
import { translateHeader } from "@/lib/i18n/table-headers";
import { getBookingCurrencies } from "@/lib/sales/booking-currencies";
import { VoiceFormFill } from "@/components/voice-form-fill";
import { SearchSelect } from "@/components/ui/search-select";
import { SalesBookingCurrencyFields } from "./sales-booking-currencies";
import { SalesBookingSummaryCards } from "./sales-booking-goods-report";

export function SalesBookingStep1({
  form,
  setForm,
  goodsEntries = [],
  setGoodsEntries,
  lang = "en",
  onNext,
  onEditItem,
  onCurrencyChange,
  currencyReadOnly = false,
  dbAccounts = [],
  applyAccountMaster
}) {
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

  const tr = key => translateHeader(lang, key);
  const number = (value, digits = 3) => Number(value ?? 0).toLocaleString(lang, {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  });
  const { sales, final, rate } = getBookingCurrencies(form);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(290px,340px)_minmax(0,1fr)] gap-3 items-start animate-in fade-in duration-200">
      {/* Booking form */}
      <div className="lg:col-start-1 lg:row-start-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3.5">
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
            <span className="px-1.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
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
                setForm(prev => ({ ...prev, customerAccountNo: "", customerAccountName: "", customerAccountId: null, customerAccountLedgerId: null, customerId: null, customerName: "" }));
              }
            }}
            options={accountOptions}
            placeholder={tUi(lang, "sales.search_customer_ph", "Search customer name, account number, company, phone...")}
            accountCards
            clearable
          />
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
                  salesAccountCountry: acc.countryName || "",
                  salesAccountBranch: acc.cityBranchName || acc.branchName || prev.branchName || "",
                  salesAccountKind: acc.kind || acc.businessName || prev.salesAccountKind || "Income / Revenue",
                  salesCompanyName: acc.companyName || acc.name || prev.salesCompanyName,
                  salesCompanyAddress: acc.address || prev.salesCompanyAddress,
                  salesLicenseNo: acc.licenseNo || prev.salesLicenseNo,
                  salesGstTrn: acc.gstTrn || prev.salesGstTrn,
                }));
              } else {
                setForm(prev => ({ ...prev, salesAccountNo: "", salesAccountName: "", salesAccountLedgerId: null, salesAccountCountry: "" }));
              }
            }}
            options={accountOptions}
            placeholder={tUi(lang, "sales.search_sales_ph", "Search sales account name, account number, company...")}
            accountCards
            clearable
          />
        </div>

        <SalesBookingCurrencyFields form={form} lang={lang} onChange={onCurrencyChange ?? ((key, value) => setForm(previous => ({ ...previous, [key]: value })))} readOnly={currencyReadOnly} />

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

      <div className="lg:col-start-2 lg:row-start-1 min-w-0 space-y-3">
        <SalesBookingSummaryCards form={form} goodsEntries={goodsEntries} lang={lang} />

        {/* Compact Goods Items Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              {tUi(lang, "sales.goods_items", "GOODS ITEMS")}
            </h3>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-xs text-start border-collapse">
              <thead className="bg-blue-800 text-white text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-2.5 w-10 text-center">#</th>
                  <th className="p-2.5">{tr("Product Name")}</th>
                  <th className="p-2.5">{tr("HS Code")}</th>
                  <th className="p-2.5 text-center">{tr("Unit")}</th>
                  <th className="p-2.5 text-end">{tr("Quantity")}</th>
                  <th className="p-2.5 text-end">{tr("Gross Weight")} (KG)</th>
                  <th className="p-2.5 text-end">{tr("Net Weight")} (KG)</th>
                  <th className="p-2.5 text-end">{tr("Unit Price")}</th>
                  <th className="p-2.5 text-end whitespace-nowrap">{tr("Total Sales Amount")}</th>
                  <th className="p-2.5 text-end whitespace-nowrap">{tr("Exchange Rate")}</th>
                  <th className="p-2.5 text-end whitespace-nowrap">{tr("Final Amount")}</th>
                  <th className="p-2.5 text-center w-20">{tr("Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {goodsEntries.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-2.5 text-center font-mono text-[11px] text-slate-400">{idx + 1}</td>
                    <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">{item.goodsName || item.productName}</td>
                    <td className="p-2.5 font-mono text-slate-500">{item.hsCode}</td>
                    <td className="p-2.5 text-center font-semibold text-slate-600 dark:text-slate-400">{item.qtyName || item.unit}</td>
                    <td className="p-2.5 text-end font-mono font-bold text-slate-900 dark:text-slate-100">
                      {Number(item.qtyNo || item.quantity || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                    </td>
                    <td className="p-2.5 text-end tabular-nums">{item.grossWeight == null ? "—" : number(item.grossWeight)}</td>
                    <td className="p-2.5 text-end tabular-nums">{item.netWeight == null ? "—" : number(item.netWeight)}</td>
                    <td className="p-2.5 text-end font-mono text-slate-600 dark:text-slate-400">
                      <bdi>{item.coursePrice == null && item.unitPrice == null ? "—" : `${item.salesCurrency || item.currencyType || sales} ${number(item.coursePrice ?? item.unitPrice, 2)}`.trim()}</bdi>
                    </td>
                    <td className="p-2.5 text-end font-mono font-bold text-slate-900 dark:text-slate-100">
                      <bdi>{item.totalAmount == null ? "—" : `${item.salesCurrency || item.currencyType || sales} ${number(item.totalAmount, 2)}`.trim()}</bdi>
                    </td>
                    <td className="p-2.5 text-end font-mono whitespace-nowrap">
                      <bdi>{Number(item.exchangeRate) > 0 ? `${item.op === "/" || item.operator === "/" ? "÷" : "×"} ${item.exchangeRate}` : rate.ok ? `${rate.operator === "/" ? "÷" : "×"} ${rate.rate}` : "—"}</bdi>
                    </td>
                    <td className="p-2.5 text-end whitespace-nowrap font-mono font-bold text-emerald-700 dark:text-emerald-300">
                      <bdi>{item.finalAmount == null ? "—" : `${item.secondaryCurrency || final} ${number(item.finalAmount, 2)}`.trim()}</bdi>
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditItem && onEditItem(idx)}
                          className="p-1 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-700 transition-colors"
                          title={tr("Edit")}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setGoodsEntries(prev => prev.filter((_, i) => i !== idx))}
                          className="p-1 rounded-md bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                          title={tr("Delete")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {goodsEntries.length === 0 && (
                  <tr>
                    <td colSpan={12} className="p-6 text-center text-slate-400 text-xs italic">
                      {tr("No goods entered")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
