"use client";
import React, { useState } from "react";
import { Ship, Globe2, CreditCard, ChevronLeft, ChevronRight } from "lucide-react";
import { translateHeader } from "@/lib/i18n/table-headers";
import { Button } from "@/components/ui/button";
import { SalesBookingGoodsReport } from "./sales-booking-goods-report";
import { BookingRouteFields } from "@/features/location-master/components/booking-route-fields";
import { t } from "@/lib/i18n/ui";
import { translateOptionLabel } from "@/lib/i18n/option-labels";

function ShippingOption({ id, label, value, options, onChange, tr }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const values = [...new Set([...options, value].filter(Boolean))];
  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="block text-[11px] font-bold">{label}</label>
      <select id={id} className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950"
        value={value || ""} onChange={event => {
          if (event.target.value === "__new_shipping_option__") {
            setName("");
            setAdding(true);
          } else {
            setAdding(false);
            onChange(event.target.value);
          }
        }}>
        <option value="">—</option>
        {values.map(option => <option key={option} value={option}>{tr(option)}</option>)}
        <option value="__new_shipping_option__">+ {tr("New")}</option>
      </select>
      {adding && (
        <div className="flex flex-wrap gap-1">
          <input aria-label={label} value={name} onChange={event => setName(event.target.value)}
            className="h-8 min-w-0 flex-1 rounded border px-2 text-xs dark:bg-slate-950" />
          <Button type="button" size="sm" disabled={!name.trim()} onClick={() => {
            onChange(name.trim());
            setAdding(false);
          }}>{tr("Save")}</Button>
        </div>
      )}
    </div>
  );
}

export function SalesBookingStep3({
  form,
  setForm,
  goodsEntries = [],
  setGoodsEntries,
  lang = "en",
  onNext,
  onBack,
  onEditItem,
  countries = [],
  ports = []
}) {
  const tr = label => translateHeader(lang, label);
  const currency = form.salesCurrency || form.currencyType || "AED";
  const totalAmount = goodsEntries.reduce((sum, item) => sum + Number(item.totalAmount ?? item.finalAmount ?? 0), 0);
  const advanceAmount = totalAmount * Number(form.advancePercent ?? 10) / 100;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,1fr)_minmax(0,2.2fr)] gap-3 items-start">
        {/* LEFT COLUMN: SHIPPING & PAYMENT DETAILS FORM */}
        <div className="min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
          <div className="rounded-lg bg-blue-900 px-3 py-2 text-white">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Ship className="h-4 w-4" aria-hidden="true" />
              {tr("Shipping & Payment")}
            </h3>
          </div>

          {/* Section 1: Shipping Information */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-black text-xs uppercase tracking-wide">
              <Globe2 className="w-3.5 h-3.5" />
              <span>{tr("Shipping Information")}</span>
            </div>

            {/* Shipping Mode * & Shipping Line */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {t(lang, "purchase.shipping_mode_label", "Shipping Mode")} <span className="text-red-500">*</span>
                </label>
                <select
                  aria-label={t(lang, "purchase.shipping_mode_label", "Shipping Mode")}
                  value={form.shippingMode || "By Sea"}
                  onChange={(e) => setForm((p) => ({ ...p, shippingMode: e.target.value, shipmentType: e.target.value }))}
                  className="w-full h-8 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
                >
                  {["By Sea", "By Air", "By Road", "By Train"].map(mode => (
                    <option key={mode} value={mode}>{translateOptionLabel(lang, mode)}</option>
                  ))}
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

            <div className="space-y-1">
              <div className="space-y-1">
                <label htmlFor="sales-booking-bl-no" className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {tr("Bill of Lading")} (B/L)
                </label>
                <input
                  id="sales-booking-bl-no"
                  type="text"
                  maxLength={120}
                  dir="ltr"
                  value={form.blNo ?? form.billOfLadingNo ?? ""}
                  onChange={event => {
                    const blNo = event.currentTarget.value;
                    setForm(previous => ({ ...previous, blNo, billOfLadingNo: blNo }));
                  }}
                  className="h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
            </div>

            {/* Loading route: country → port / border / airport from the Route & Location Master */}
            <BookingRouteFields
              side="loading"
              testId="sales-booking-loading-route"
              className="grid grid-cols-2 gap-2.5"
              shippingMode={form.shippingMode || "By Sea"}
              value={{
                countryId: form.loadingCountryId || "",
                countryName: form.loadingCountry || "",
                locationId: form.loadingLocationId || "",
                locationName: form.loadingPort || form.airportName || form.loadingBorder || ""
              }}
              onChange={leg => setForm(p => {
                const mode = p.shippingMode || "By Sea";
                return {
                  ...p,
                  loadingCountryId: leg.countryId, loadingCountry: leg.countryName,
                  loadingLocationId: leg.locationId, loadingPort: leg.locationName, loadingLocation: leg.locationName,
                  ...(mode === "By Air" ? { airportName: leg.locationName } : {}),
                  ...(mode === "By Road" ? { loadingBorder: leg.locationName } : {}),
                };
              })}
            />

            {/* Receiving route */}
            <BookingRouteFields
              side="receiving"
              testId="sales-booking-receiving-route"
              className="grid grid-cols-2 gap-2.5"
              shippingMode={form.shippingMode || "By Sea"}
              value={{
                countryId: form.receivedCountryId || "",
                countryName: form.receivedCountry || form.destinationCountry || "",
                locationId: form.receivedLocationId || "",
                locationName: form.receivedPort || form.receivingPort || form.destinationPort || ""
              }}
              onChange={leg => setForm(p => {
                const mode = p.shippingMode || "By Sea";
                return {
                  ...p,
                  receivedCountryId: leg.countryId, receivedCountry: leg.countryName, receivingCountry: leg.countryName,
                  // the destination country follows the receiving country until the user sets it separately
                  destinationCountry: !p.destinationCountry || p.destinationCountry === (p.receivedCountry || "") ? leg.countryName : p.destinationCountry,
                  receivedLocationId: leg.locationId, receivedPort: leg.locationName, receivingPort: leg.locationName,
                  receivedPortName: leg.locationName,
                  ...(mode === "By Air" ? { destinationAirportName: leg.locationName } : {}),
                  ...(mode === "By Road" ? { receivingBorder: leg.locationName } : {}),
                };
              })}
            />

            {/* Loading Date & Receiving Date */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label htmlFor="sales-booking-loading-date" className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {t(lang, "sales_loading.loading_date", "Loading Date")}
                </label>
                <input
                  id="sales-booking-loading-date"
                  type="date"
                  value={form.loadingDate || ""}
                  onChange={(e) => setForm((p) => ({ ...p, loadingDate: e.target.value }))}
                  className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="sales-booking-received-date" className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {t(lang, "plr.receiving_date", "Receiving Date")}
                </label>
                <input
                  id="sales-booking-received-date"
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

            <div className="grid grid-cols-2 gap-2.5">
              <ShippingOption id="sales-booking-loading-type" label={tr("Loading Type")} tr={tr}
                value={form.loadingType} options={["Container", "Bulk Cargo", "Flatbed Truck"]}
                onChange={loadingType => setForm(previous => ({ ...previous, loadingType }))} />
              <ShippingOption id="sales-booking-container-type" label={tr("Container Type")} tr={tr}
                value={form.containerType || (/^\d+ FT/i.test(form.transportType || "") ? form.transportType : "")}
                options={["20 FT Dry", "40 FT Dry", "40 FT Reefer"]}
                onChange={containerType => setForm(previous => ({ ...previous, containerType }))} />
            </div>
          </div>

          {/* Section 2: Payment Information */}
          <div className="space-y-2.5 border-t border-slate-100 dark:border-slate-800 pt-3">
            <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 font-black text-xs uppercase tracking-wide">
              <CreditCard className="w-3.5 h-3.5" />
              <span>{tr("Payment Information")}</span>
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
                  {currency} {advanceAmount.toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              {tr("Back")}
            </Button>
            <Button
              type="button"
              onClick={onNext}
              className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md uppercase tracking-wider"
            >
              {tr("Next")}
              <ChevronRight className="w-4 h-4 rtl:rotate-180 ml-1" />
            </Button>
          </div>
        </div>

        <SalesBookingGoodsReport
          form={form}
          goodsEntries={goodsEntries}
          lang={lang}
          onEdit={onEditItem}
          onDelete={setGoodsEntries ? index => setGoodsEntries(previous => previous.filter((_, i) => i !== index)) : undefined}
        />
      </div>
    </div>
  );
}
