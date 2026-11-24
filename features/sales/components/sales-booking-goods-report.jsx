"use client";

import React from "react";
import { Building2, Edit3, FileText, Package, Trash2, UserRound, Users } from "lucide-react";
import { translateHeader } from "@/lib/i18n/table-headers";
import { getBookingCurrencies } from "@/lib/sales/booking-currencies";

export function SalesBookingSummaryCards({ form, goodsEntries = [], lang, hideRate = false }) {
  const tr = label => translateHeader(lang, label);
  const purchases = goodsEntries.length ? goodsEntries : [form];
  const purchaseValues = key => [...new Set(purchases.map(item => item[key]).filter(Boolean))].join(" · ");
  const serials = form.bookingSerials || {};
  const bookingNumbers = [["Super Admin Serial", serials.superAdminSerialNumber],
    ["Country Serial", serials.countryTransactionSerialNumber], ["Branch Serial", serials.branchTransactionSerialNumber],
    ["Bill No", form.billNo || form.salesOrderNo]];
  const cards = [
    { title: "Sales Booking", Icon: FileText, color: "border-s-blue-600 text-blue-950 dark:text-blue-100", numbers: bookingNumbers,
      rows: [["Booking No", form.salesOrderNo], ["Booking Date", form.salesDate], ["Payment Type", form.paymentType],
        ["Ship Type", form.shippingMode || form.shipmentType], ["Delivery Type", form.deliveryType || form.deliveryMethod],
        ["Purchase Type", form.purchaseType], ...(!hideRate ? [["Sales Currency", form.salesCurrency || form.currencyType]] : [])] },
    { title: "Branch Details", Icon: Building2, color: "border-s-amber-500 text-amber-950 dark:text-amber-100",
      rows: [["Branch", form.branchName || form.cityBranchName], ["Branch Code", form.branchCode],
        ["Country", form.countryName || form.branchCountry], ["Branch ID", form.cityBranchId],
        ["Created By", form.userName], ["User ID", form.userId],
        ...((form.blNo || form.billOfLadingNo) ? [["Bill of Lading", form.blNo || form.billOfLadingNo]] : [])] },
    { title: "Sales Account Details", Icon: UserRound, color: "border-s-emerald-600 text-emerald-950 dark:text-emerald-100",
      rows: [["Account Code", form.salesAccountNo], ["Account Name", form.salesAccountName]],
      contact: [form.salesCompanyName, form.salesCompanyAddress, form.salesAccountPhone || form.salesAccountMobile, form.salesAccountEmail] },
    { title: "Customer / Purchase Account", Icon: Users, color: "border-s-violet-600 text-violet-950 dark:text-violet-100",
      rows: [["Customer Account Code", form.customerAccountNo], ["Customer Account (DR)", form.customerAccountName],
        ["Purchase Account", purchaseValues("purchaseAccountName")], ["Purchase Account Code", purchaseValues("purchaseAccountNo")]],
      contact: [form.customerCompanyName, form.customerCompanyAddress, form.customerAccountPhone || form.customerAccountMobile, form.customerAccountEmail] },
  ];

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ title, Icon, color, rows, numbers, contact }) => (
        <section key={title} className={`min-w-0 rounded-xl border border-slate-200 border-s-[3px] bg-white p-3 dark:border-y-slate-700 dark:border-e-slate-700 dark:bg-slate-900 ${color}`}>
          <h3 className="mb-2 flex gap-1.5 text-xs font-bold">
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{tr(title)}
          </h3>
          <dl className="space-y-1.5 text-[11px]">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-2">
                <dt className="min-w-0 break-words">{tr(label)}</dt>
                <dd className="min-w-0 break-words text-end font-semibold"><bdi>{value || "—"}</bdi></dd>
              </div>
            ))}
          </dl>
          {numbers?.some(([, value]) => value) && (
            <details className="mt-2 rounded-md bg-blue-50 px-2 py-1 text-[11px] dark:bg-slate-800">
              <summary className="cursor-pointer font-semibold">{tr("More")}</summary>
              <dl className="mt-1 space-y-1">
                {numbers.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-2">
                    <dt>{tr(label)}</dt><dd className="break-all text-end font-semibold"><bdi>{value || "—"}</bdi></dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
          {contact?.some(Boolean) && (
            <div className="mt-2 space-y-1 break-words rounded-md bg-blue-50 p-2 text-[11px] dark:bg-slate-800">
              {contact.map((value, index) => value && <p key={index} className={index === 0 ? "font-semibold" : undefined}><bdi>{value}</bdi></p>)}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

export function SalesBookingGoodsReport({ form, goodsEntries, lang, onEdit, onDelete, showOrigin = false, hideRate = false }) {
  const currencies = getBookingCurrencies(form);
  const tr = label => translateHeader(lang, label);
  const number = (value, digits = 3) => value == null || value === "" || !Number.isFinite(Number(value))
    ? "—"
    : Number(value).toLocaleString(lang, { maximumFractionDigits: digits });
  const amount = (value, currency) => value == null || value === ""
    ? "—"
    : [currency, Number(value).toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 })].filter(Boolean).join(" ");
  const rateText = (rate, operator) => Number(rate) > 0 ? `${operator === "/" ? "÷" : "×"} ${rate}` : "—";
  const volume = item => {
    const value = item.cbm ?? item.volumeCbm ?? String(item.stackWeight ?? "").match(/(\d+(?:\.\d+)?)\s*(?:cbm\b|m³)/i)?.[1];
    return value == null || value === "" ? null : Number(value);
  };
  const hasActions = Boolean(onEdit || onDelete);

  return (
  <div className="min-w-0 space-y-3">
    <SalesBookingSummaryCards form={form} goodsEntries={goodsEntries} lang={lang} hideRate={hideRate} />

    <section className="min-w-0 space-y-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="flex items-center gap-2 rounded-lg bg-blue-50 px-2.5 py-2 text-sm font-bold text-blue-950 dark:bg-blue-950 dark:text-blue-100">
        <Package className="h-4 w-4 shrink-0" aria-hidden="true" />
        {tr("Goods and Lotwise Report")}
      </h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full border-collapse text-start text-xs">
          <thead className="bg-blue-50 text-blue-950 dark:bg-blue-950 dark:text-blue-100">
            <tr className="text-start">
              <th scope="col" className="px-2 py-2">#</th>
              {["Goods Name", "Brand", "Size", "HS Code", "Lot / Item ID", ...(showOrigin ? ["Origin"] : []), "Quantity", "Net Weight", "Gross Weight", "CBM",
                "Unit Price", "Total Sales Amount", ...(!hideRate ? ["Exchange Rate"] : []), "Final Amount", ...(hasActions ? ["Action"] : [])].map(label => (
                <th key={label} scope="col" className="whitespace-nowrap px-2 py-2 text-start">{tr(label)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {goodsEntries.map((item, index) => (
              <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                <td className="px-2 py-2 text-center">{index + 1}</td>
                <td className="px-2 py-2 font-semibold">{item.goodsName || item.productName}</td>
                <td className="whitespace-nowrap px-2 py-2">{item.brandName || item.brand || "—"}</td>
                <td className="whitespace-nowrap px-2 py-2">{item.sizeName || item.size || "—"}</td>
                <td className="whitespace-nowrap px-2 py-2"><bdi>{item.hsCode || "—"}</bdi></td>
                <td className="whitespace-nowrap px-2 py-2"><bdi>{item.lotNo || item.itemId || "—"}</bdi></td>
                {showOrigin && <td className="whitespace-nowrap px-2 py-2">{item.origin || "—"}</td>}
                <td className="whitespace-nowrap px-2 py-2"><bdi>{number(item.qtyNo ?? item.quantity)} {item.qtyName || item.unit}</bdi></td>
                <td className="whitespace-nowrap px-2 py-2"><bdi>{number(item.netWeight)}{item.netWeight == null ? "" : " kg"}</bdi></td>
                <td className="whitespace-nowrap px-2 py-2"><bdi>{number(item.grossWeight)}{item.grossWeight == null ? "" : " kg"}</bdi></td>
                <td className="whitespace-nowrap px-2 py-2"><bdi>{number(volume(item))}</bdi></td>
                <td className="whitespace-nowrap px-2 py-2"><bdi>{amount(item.coursePrice ?? item.unitPrice, item.salesCurrency || item.currencyType || currencies.sales)}</bdi></td>
                <td className="whitespace-nowrap px-2 py-2"><bdi>{amount(item.totalAmount, item.salesCurrency || item.currencyType || currencies.sales)}</bdi></td>
                {!hideRate && <td className="whitespace-nowrap px-2 py-2"><bdi>{rateText(item.exchangeRate, item.op || item.operator)}</bdi></td>}
                <td className="whitespace-nowrap px-2 py-2 font-semibold"><bdi>{amount(item.finalAmount, item.secondaryCurrency || currencies.final)}</bdi></td>
                {hasActions && <td className="px-2 py-2">
                  <div className="flex gap-1">
                    {onEdit && <button type="button" onClick={() => onEdit(index)}
                      className="rounded bg-sky-50 p-1 text-sky-700 hover:bg-sky-100" aria-label={tr("Edit")}>
                      <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>}
                    {onDelete && <button type="button" onClick={() => onDelete(index)}
                      className="rounded bg-red-50 p-1 text-red-600 hover:bg-red-100" aria-label={tr("Delete")}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>}
                  </div>
                </td>}
              </tr>
            ))}
            {goodsEntries.length === 0 && (
              <tr>
                <td colSpan={14 + Number(showOrigin) + Number(hasActions) - Number(hideRate)} className="p-6 text-center text-slate-500">{tr("No goods entered")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  </div>
  );
}
