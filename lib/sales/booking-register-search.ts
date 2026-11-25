import type { RegisterSearchField } from "@/components/purchase-ui/advanced-register-search";
import { registerSearchOptions, type RegisterSearchRow } from "./register-search";

export function bookingSearchRow(row: any, transferred: boolean): RegisterSearchRow {
  const form = row.form_data?.form ?? {};
  const goods = Array.isArray(row.form_data?.goodsEntries) ? row.form_data.goodsEntries : [];
  return {
    bookingNo: String(row.salesBookingOrderNumber || row.sales_order_no || ""),
    bookingDate: String(row.salesDate || row.bookingDate || row.createdAt || row.order_date || row.created_at || ""),
    country: String(row.countryName || row.country_name || form.branchCountry || ""),
    mainBranch: String(form.mainBranchName || row.mainBranchName || row.country_branch_name || ""),
    cityBranch: String(row.branchName || row.branch_name || form.branchName || ""),
    user: String(form.transferAudit?.userName || row.postedByName || row.createdByName || form.createdByName || ""),
    purchaseAccount: String(form.purchaseAccountName || row.purchaseAccountName || row.purchase_account_name || form.purchaseAccountNo || ""),
    salesAccount: String(form.salesAccountName || row.salesAccountName || row.sales_account_name || form.salesAccountNo || ""),
    goods: [row.productName || row.product_summary, form.goodsName, ...goods.map((item: any) => item.goodsName)].filter(Boolean).map(String),
    lot: [form.lotName, form.lotNo, form.stockLotNo, ...goods.flatMap((item: any) => [item.lotName, item.stockLotNo, item.lotNo])].filter(Boolean).map(String),
    currency: String(row.finalCurrency || form.secondaryCurrency || row.currency || row.currency_code || "").toUpperCase(),
    paymentType: String(form.paymentType || row.paymentType || form.paymentCondition || ""),
    status: String(row.status || row.sales_status || ""),
    transferStatus: transferred ? "transferred" : "pending",
    loadingCountry: String(form.loadingCountry || ""),
    loadingPort: String(form.loadingPort || ""),
    receivedCountry: String(form.receivedCountry || form.receivingCountry || ""),
    receivedPort: String(form.receivedPort || form.receivingPort || ""),
    loadingDate: String(form.loadingDate || ""),
    receivedDate: String(form.receivedDate || form.receivingDate || ""),
  };
}

export function bookingSearchFields(rows: readonly RegisterSearchRow[], tr: (label: string) => string): RegisterSearchField[] {
  const select = (key: string, label: string, group?: RegisterSearchField["group"], wide?: boolean): RegisterSearchField => ({
    key, label: tr(label), type: "select", options: registerSearchOptions(rows, key), group, wide,
  });
  const date = (key: string, label: string, group?: RegisterSearchField["group"]): RegisterSearchField => ({ key, label: tr(label), type: "date", group });
  const cascading = (key: string, label: string, parents: string[], children: string[], group?: RegisterSearchField["group"]): RegisterSearchField => ({
    ...select(key, label, group),
    clearOnChange: children,
    optionsFor: draft => registerSearchOptions(rows.filter(row => parents.every(parent => !draft[parent] || row[parent] === draft[parent])), key),
  });
  return [
    { key: "bookingNo", label: tr("Sales Booking No."), wide: true },
    date("bookingDateFrom", "Booking Date From"), date("bookingDateTo", "Booking Date To"),
    cascading("country", "Country", [], ["mainBranch", "cityBranch"]),
    cascading("mainBranch", "Main Branch", ["country"], ["cityBranch"]),
    cascading("cityBranch", "City Branch", ["country", "mainBranch"], []), select("user", "User Name"),
    select("purchaseAccount", "Purchase DR Account", undefined, true), select("salesAccount", "Sales CR Account", undefined, true),
    select("goods", "Goods Name", undefined, true), select("lot", "Lot Name / Number", undefined, true),
    select("currency", "Currency"), select("paymentType", "Payment Type"), select("status", "Booking Status"),
    { ...select("transferStatus", "Transfer Status"), options: [
      { value: "transferred", label: tr("Transferred") }, { value: "pending", label: tr("Awaiting Transfer") },
    ] },
    cascading("loadingCountry", "Loading Country", [], ["loadingPort"], "origin"),
    cascading("loadingPort", "Loading Port", ["loadingCountry"], [], "origin"),
    cascading("receivedCountry", "Received Country", [], ["receivedPort"], "destination"),
    cascading("receivedPort", "Received Port", ["receivedCountry"], [], "destination"),
    date("loadingDateFrom", "Loading Date From", "dates"), date("loadingDateTo", "Loading Date To", "dates"),
    date("receivedDateFrom", "Received Date From", "dates"), date("receivedDateTo", "Received Date To", "dates"),
  ];
}
