"use client";
import React, { useMemo } from "react";
import {
  Ship,
  Globe2,
  CreditCard,
  Building2,
  Calendar,
  Hash,
  ChevronLeft,
  ChevronRight,
  Package,
  Edit3,
  Trash2,
  Truck,
  Landmark,
  FileText
} from "lucide-react";
import { t as tUi } from "@/lib/i18n/ui";
import { Button } from "@/components/ui/button";
import { SalesBookingUpperCards, formatDisplayDate } from "./sales-booking-upper-cards";

export function SalesBookingStep3({
  form,
  setForm,
  goodsEntries = [],
  setGoodsEntries,
  lang = "en",
  onNext,
  onBack,
  onEditItem,
  dbCompanies = [],
  dbAccounts = [],
  countries = [],
  ports = []
}) {
  // Totals calculations
  const totals = useMemo(() => {
    const totalItems = goodsEntries.length;
    const totalQuantity = goodsEntries.reduce((sum, g) => sum + Number(g.qtyNo || g.quantity || 0), 0);
    const totalGross = goodsEntries.reduce((sum, g) => sum + Number(g.grossWeight || (Number(g.qtyNo || 0) * 1200) || 0), 0);
    const totalNet = goodsEntries.reduce((sum, g) => sum + Number(g.netWeight || (Number(g.qtyNo || 0) * 1100) || 0), 0);
    const totalAmount = goodsEntries.reduce((sum, g) => sum + Number(g.totalAmount || g.finalAmount || 0), 0);

    const advancePercent = Number(form.advancePercent || 10);
    const advanceAmount = (totalAmount * advancePercent) / 100;
    const remainingAmount = totalAmount - advanceAmount;

    return {
      totalItems,
      totalQuantity,
      totalGross,
      totalNet,
      totalAmount,
      advancePercent,
      advanceAmount,
      remainingAmount
    };
  }, [goodsEntries, form.advancePercent]);

  const currency = form.salesCurrency || form.currencyType || "AED";

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN: SHIPPING & PAYMENT DETAILS FORM */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Ship className="w-4 h-4 text-blue-600" />
              {tUi(lang, "sales.shipping_payment_details", "SHIPPING & PAYMENT DETAILS")}
            </h3>
          </div>

          {/* Section 1: Shipping Information */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-black text-xs uppercase tracking-wide">
              <Globe2 className="w-3.5 h-3.5" />
              <span>Shipping Information</span>
            </div>

            {/* Shipping Mode * & Shipping Line */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Shipping Mode <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.shippingMode || "By Sea"}
                  onChange={(e) => setForm((p) => ({ ...p, shippingMode: e.target.value, shipmentType: e.target.value }))}
                  className="w-full h-8 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="By Sea">By Sea</option>
                  <option value="By Air">By Air</option>
                  <option value="By Road">By Road</option>
                  <option value="By Train">By Train</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Shipping Line
                </label>
                <select
                  value={form.shippingLine || ""}
                  onChange={(e) => setForm((p) => ({ ...p, shippingLine: e.target.value }))}
                  className="w-full h-8 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="">Select Shipping Line</option>
                  <option value="MSC Line">MSC Line</option>
                  <option value="Maersk Line">Maersk Line</option>
                  <option value="CMA CGM">CMA CGM</option>
                  <option value="Hapag-Lloyd">Hapag-Lloyd</option>
                  <option value="Cosco Shipping">Cosco Shipping</option>
                  <option value="ONE Line">ONE (Ocean Network)</option>
                  <option value="Evergreen Line">Evergreen Line</option>
                </select>
              </div>
            </div>

            {/* Vessel Name & Voyage No */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Vessel Name
                </label>
                <input
                  type="text"
                  value={form.vesselName || ""}
                  onChange={(e) => setForm((p) => ({ ...p, vesselName: e.target.value }))}
                  placeholder="Select or enter vessel"
                  className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Voyage No.
                </label>
                <input
                  type="text"
                  value={form.voyageNo || ""}
                  onChange={(e) => setForm((p) => ({ ...p, voyageNo: e.target.value }))}
                  placeholder="e.g. VY1234"
                  className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            {/* Loading Country * & Loading Port */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Loading Country <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.loadingCountry || "United Arab Emirates"}
                  onChange={(e) => setForm((p) => ({ ...p, loadingCountry: e.target.value }))}
                  className="w-full h-8 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="United Arab Emirates">United Arab Emirates</option>
                  <option value="Pakistan">Pakistan</option>
                  <option value="Saudi Arabia">Saudi Arabia</option>
                  <option value="USA">USA</option>
                  <option value="China">China</option>
                  <option value="India">India</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Loading Port
                </label>
                <select
                  value={form.loadingPort || "Jebel Ali Port"}
                  onChange={(e) => setForm((p) => ({ ...p, loadingPort: e.target.value }))}
                  className="w-full h-8 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="Jebel Ali Port">Jebel Ali Port</option>
                  <option value="Port Rashid">Port Rashid</option>
                  <option value="Sharjah Port">Sharjah Port</option>
                  <option value="Abu Dhabi Port">Abu Dhabi Port</option>
                </select>
              </div>
            </div>

            {/* Loading Date & Receiving Country * */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Loading Date
                </label>
                <input
                  type="date"
                  value={form.loadingDate || ""}
                  onChange={(e) => setForm((p) => ({ ...p, loadingDate: e.target.value }))}
                  className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Receiving Country <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.receivedCountry || form.destinationCountry || "Pakistan"}
                  onChange={(e) => setForm((p) => ({ ...p, receivedCountry: e.target.value, destinationCountry: e.target.value }))}
                  className="w-full h-8 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="Pakistan">Pakistan</option>
                  <option value="United Arab Emirates">United Arab Emirates</option>
                  <option value="Afghanistan">Afghanistan</option>
                  <option value="Saudi Arabia">Saudi Arabia</option>
                  <option value="Oman">Oman</option>
                  <option value="Turkey">Turkey</option>
                </select>
              </div>
            </div>

            {/* Receiving Port & Receiving Date */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Receiving Port
                </label>
                <select
                  value={form.receivedPort || "Karachi Port"}
                  onChange={(e) => setForm((p) => ({ ...p, receivedPort: e.target.value }))}
                  className="w-full h-8 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="Karachi Port">Karachi Port</option>
                  <option value="Port Qasim">Port Qasim</option>
                  <option value="Gwadar Port">Gwadar Port</option>
                  <option value="Jeddah Port">Jeddah Port</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Receiving Date
                </label>
                <input
                  type="date"
                  value={form.receivedDate || ""}
                  onChange={(e) => setForm((p) => ({ ...p, receivedDate: e.target.value }))}
                  className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
                />
              </div>
            </div>

            {/* Destination Country * & Destination City */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Destination Country <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.destinationCountry || "Pakistan"}
                  onChange={(e) => setForm((p) => ({ ...p, destinationCountry: e.target.value }))}
                  className="w-full h-8 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="Pakistan">Pakistan</option>
                  <option value="United Arab Emirates">United Arab Emirates</option>
                  <option value="Afghanistan">Afghanistan</option>
                  <option value="Saudi Arabia">Saudi Arabia</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Destination City
                </label>
                <input
                  type="text"
                  value={form.destinationCity || "Karachi"}
                  onChange={(e) => setForm((p) => ({ ...p, destinationCity: e.target.value }))}
                  placeholder="Select or enter city"
                  className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
                />
              </div>
            </div>

            {/* Container Number & Transport Type */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Container Number
                </label>
                <input
                  type="text"
                  value={form.containerNumbers || form.containerNumber || ""}
                  onChange={(e) => setForm((p) => ({ ...p, containerNumbers: e.target.value, containerNumber: e.target.value }))}
                  placeholder="e.g. MSKU1234567"
                  className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Transport Type
                </label>
                <select
                  value={form.transportType || "40 FT Container"}
                  onChange={(e) => setForm((p) => ({ ...p, transportType: e.target.value }))}
                  className="w-full h-8 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="40 FT Container">40 FT Container</option>
                  <option value="20 FT Container">20 FT Container</option>
                  <option value="40 FT Reefer">40 FT Reefer</option>
                  <option value="Bulk Cargo">Bulk Cargo</option>
                  <option value="Flatbed Truck">Flatbed Truck</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Payment Information */}
          <div className="space-y-2.5 border-t border-slate-100 dark:border-slate-800 pt-3">
            <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 font-black text-xs uppercase tracking-wide">
              <CreditCard className="w-3.5 h-3.5" />
              <span>Payment Information</span>
            </div>

            {/* Payment Type *, Advance Percentage, Advance Amount */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
                  Payment Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.paymentType || "Cash"}
                  onChange={(e) => setForm((p) => ({ ...p, paymentType: e.target.value }))}
                  className="w-full h-8 px-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="Cash">Cash</option>
                  <option value="Advance Payment">Advance</option>
                  <option value="Bank Transfer">Bank</option>
                  <option value="Letter of Credit">LC</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Credit">Credit</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
                  Advance %
                </label>
                <input
                  type="number"
                  value={form.advancePercent ?? 10}
                  onChange={(e) => setForm((p) => ({ ...p, advancePercent: Number(e.target.value) }))}
                  className="w-full h-8 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
                  Advance Amount
                </label>
                <div className="h-8 px-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center font-mono font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                  {currency} {totals.advanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Advance Payment Date, Final Payment Date, Currency */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
                  Advance Date
                </label>
                <input
                  type="date"
                  value={form.advancePaymentDate || ""}
                  onChange={(e) => setForm((p) => ({ ...p, advancePaymentDate: e.target.value }))}
                  className="w-full h-8 px-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
                  Final Payment Date
                </label>
                <input
                  type="date"
                  value={form.paymentDate || ""}
                  onChange={(e) => setForm((p) => ({ ...p, paymentDate: e.target.value }))}
                  className="w-full h-8 px-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setForm((p) => ({ ...p, salesCurrency: e.target.value, customerAccountCurrency: e.target.value }))}
                  className="w-full h-8 px-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-bold"
                >
                  <option value="AED">AED</option>
                  <option value="USD">USD</option>
                  <option value="PKR">PKR</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>

            {/* Remarks & Note */}
            <div className="space-y-1">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Remarks & Note
              </label>
              <textarea
                rows={2}
                value={form.remarks || ""}
                onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                placeholder="Add any remarks or note here..."
                className="w-full p-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-medium resize-none"
              />
            </div>
          </div>

          {/* Action Buttons: Back & Next */}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="flex-1 h-9 border-slate-300 text-slate-700 dark:text-slate-200 text-xs font-bold"
            >
              <ChevronLeft className="w-4 h-4 rtl:rotate-180 mr-1" />
              Back
            </Button>
            <Button
              type="button"
              onClick={onNext}
              className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md uppercase tracking-wider"
            >
              Next
              <ChevronRight className="w-4 h-4 rtl:rotate-180 ml-1" />
            </Button>
          </div>
        </div>

        {/* RIGHT COLUMN: UPPER 3 CARDS + GOODS ITEMS TABLE + 3 LOWER REPORTS */}
        <div className="lg:col-span-7 space-y-4">
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

          {/* Goods Items Table (with Gross Weight and Net Weight columns) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                {tUi(lang, "sales.goods_items", "GOODS ITEMS")}
              </h3>
              <span className="text-[11px] font-bold text-slate-500 font-mono">
                {goodsEntries.length} Items Added
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-2 w-8 text-center">#</th>
                    <th className="p-2">Product Name</th>
                    <th className="p-2">HS Code</th>
                    <th className="p-2 text-center">Unit</th>
                    <th className="p-2 text-right">Quantity</th>
                    <th className="p-2 text-right">Unit Price</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-right">Gross Weight</th>
                    <th className="p-2 text-right">Net Weight</th>
                    <th className="p-2 text-center w-16">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {goodsEntries.map((item, idx) => {
                    const gross = Number(item.grossWeight || (Number(item.qtyNo || 0) * 1200));
                    const net = Number(item.netWeight || (Number(item.qtyNo || 0) * 1100));
                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-2 text-center font-mono text-[11px] text-slate-400">{idx + 1}</td>
                        <td className="p-2 font-bold text-slate-900 dark:text-slate-100">{item.goodsName || item.productName}</td>
                        <td className="p-2 font-mono text-slate-500">{item.hsCode}</td>
                        <td className="p-2 text-center font-semibold text-slate-600 dark:text-slate-400">{item.qtyName || item.unit}</td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {Number(item.qtyNo || item.quantity || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                        </td>
                        <td className="p-2 text-right font-mono text-slate-600 dark:text-slate-400">
                          {Number(item.coursePrice || item.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {Number(item.totalAmount || item.finalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-2 text-right font-mono text-slate-600 dark:text-slate-400">
                          {gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-2 text-right font-mono text-slate-600 dark:text-slate-400">
                          {net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-2 text-center">
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
                    );
                  })}
                  {goodsEntries.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-slate-400 text-xs italic">
                        No goods items in booking order.
                      </td>
                    </tr>
                  )}
                </tbody>
                {goodsEntries.length > 0 && (
                  <tfoot className="bg-slate-50 dark:bg-slate-950 font-black border-t-2 border-slate-200 dark:border-slate-800">
                    <tr>
                      <td colSpan={4} className="p-2 text-right text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        Total
                      </td>
                      <td className="p-2 text-right font-mono text-xs text-slate-900 dark:text-slate-100">
                        {totals.totalQuantity.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                      </td>
                      <td></td>
                      <td className="p-2 text-right font-mono text-xs text-blue-700 dark:text-blue-400">
                        {totals.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 text-right font-mono text-xs text-slate-700 dark:text-slate-300">
                        {totals.totalGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 text-right font-mono text-xs text-slate-700 dark:text-slate-300">
                        {totals.totalNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Three Lower Reports: Goods Summary, Shipping Details, Payment Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. GOODS SUMMARY REPORT */}
            <div className="bg-white dark:bg-slate-900 border border-blue-200/80 dark:border-blue-900/60 rounded-xl p-3 shadow-xs space-y-2 text-[11px]">
              <div className="flex items-center gap-2 border-b border-blue-100 dark:border-blue-900/40 pb-1.5 text-blue-700 dark:text-blue-400 font-black uppercase tracking-wider">
                <Package className="w-3.5 h-3.5" />
                <span>{tUi(lang, "sales.goods_summary_report", "GOODS SUMMARY REPORT")}</span>
              </div>
              <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Total Items</span>
                  <span className="font-bold">: {totals.totalItems}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Total Quantity</span>
                  <span className="font-bold font-mono">: {totals.totalQuantity.toLocaleString()} MT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Total Gross Weight</span>
                  <span className="font-bold font-mono">: {totals.totalGross.toLocaleString(undefined, { minimumFractionDigits: 2 })} KG</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Total Net Weight</span>
                  <span className="font-bold font-mono">: {totals.totalNet.toLocaleString(undefined, { minimumFractionDigits: 2 })} KG</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-1">
                  <span className="text-slate-500 font-bold">Total Amount</span>
                  <span className="font-black text-blue-700 dark:text-blue-400 font-mono">
                    : {currency} {totals.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. SHIPPING DETAILS REPORT */}
            <div className="bg-white dark:bg-slate-900 border border-purple-200/80 dark:border-purple-900/60 rounded-xl p-3 shadow-xs space-y-2 text-[11px]">
              <div className="flex items-center gap-2 border-b border-purple-100 dark:border-purple-900/40 pb-1.5 text-purple-700 dark:text-purple-400 font-black uppercase tracking-wider">
                <Truck className="w-3.5 h-3.5" />
                <span>{tUi(lang, "sales.shipping_details_report", "SHIPPING DETAILS REPORT")}</span>
              </div>
              <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Shipping Mode</span>
                  <span className="font-bold">: {form.shippingMode || "By Sea"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Shipping Line</span>
                  <span className="font-bold truncate max-w-[120px]">: {form.shippingLine || "MSC Line"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Vessel Name</span>
                  <span className="font-bold truncate max-w-[120px]">: {form.vesselName || "MSC Evergreen"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Voyage No</span>
                  <span className="font-bold font-mono">: {form.voyageNo || "VY1234"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Loading Port</span>
                  <span className="font-bold truncate max-w-[120px]">: {form.loadingPort || "Jebel Ali Port"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Receiving Port</span>
                  <span className="font-bold truncate max-w-[120px]">: {form.receivedPort || "Karachi Port"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Destination City</span>
                  <span className="font-bold truncate max-w-[120px]">: {form.destinationCity || "Karachi"}</span>
                </div>
              </div>
            </div>

            {/* 3. PAYMENT DETAILS REPORT */}
            <div className="bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 rounded-xl p-3 shadow-xs space-y-2 text-[11px]">
              <div className="flex items-center gap-2 border-b border-emerald-100 dark:border-emerald-900/40 pb-1.5 text-emerald-700 dark:text-emerald-400 font-black uppercase tracking-wider">
                <Landmark className="w-3.5 h-3.5" />
                <span>{tUi(lang, "sales.payment_details_report", "PAYMENT DETAILS REPORT")}</span>
              </div>
              <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Payment Type</span>
                  <span className="font-bold">: {form.paymentType || "Cash"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Advance Percentage</span>
                  <span className="font-bold">: {totals.advancePercent} %</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Advance Amount</span>
                  <span className="font-bold font-mono">: {currency} {totals.advanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Advance Date</span>
                  <span className="font-bold">: {formatDisplayDate(form.advancePaymentDate || form.salesDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Remaining Amount</span>
                  <span className="font-bold font-mono">: {currency} {totals.remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Final Payment Date</span>
                  <span className="font-bold">: {formatDisplayDate(form.paymentDate || form.salesDate)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-1">
                  <span className="text-slate-500 font-bold">Currency</span>
                  <span className="font-black text-emerald-700 dark:text-emerald-400 font-mono">: {currency}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
