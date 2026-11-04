import { parseJsonish } from "@/lib/stock-journal/model";

type Row = Record<string, any>;
const text = (...values: unknown[]) => String(values.find(v => v != null && String(v).trim() !== "") ?? "");
const number = (...values: unknown[]): number | null => {
  for (const value of values) {
    if (value == null || value === "") continue;
    const parsed = Number(String(value).replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};
/** Read-only registry projection. Money uses the existing purchase-currency model. */
export function remainingBookingRow(row: Row, records: Row[] = [], dueBill?: Row) {
  const data = parseJsonish(row.form_data) || {};
  const form = data.form || {};
  const transport = data.transportDetails || data.transport || {};
  const goods: Row[] = Array.isArray(data.goodsEntries) ? data.goodsEntries : [];
  const matches = (record: Row) => record.id && record.purchase_order_id === row.id && !record.deleted_at &&
    !String(record.id || "").startsWith("synthetic-");
  const linked = [...(Array.isArray(row.loading_records) ? row.loading_records : []), ...(row.__loadingRecord ? [row.__loadingRecord] : []), ...records]
    .filter(matches);
  const loadings = [...new Map(linked.map(record => [record.id, record])).values()];
  const routes = (loadings.length ? loadings : [{}]).map(record => {
    const payload = parseJsonish(record.report_payload) || {};
    const saved = payload.form || {};
    return {
      id: text(record.id, row.id),
      loadingCountry: text(payload.loadingCountry, saved.loadingCountry, transport.loadingCountry, form.loadingCountry, form.originCountry),
      loadingPort: text(payload.loadingPort, record.loading_location, saved.loadingPort, transport.loadingPort, form.loadingPort, form.exitPort),
      loadingGate: text(payload.loadingGate, payload.loadingBorder, payload.exitBorder, saved.loadingGate, saved.loadingBorder, transport.loadingGate, form.loadingGate, form.loadingBorder, form.exitBorder),
      loadingDate: text(record.loaded_at, payload.loadingDate, saved.loadingDate, transport.loadingDate, form.loadingDate),
      receivingCountry: text(payload.receivingCountry, payload.receivedCountry, saved.receivedCountry, transport.receivingCountry, form.receivedCountry, form.receivingCountry, form.destinationCountry),
      receivingPort: text(payload.receivingPort, payload.receivedPort, record.receiving_location, saved.receivedPort, transport.receivingPort, form.receivedPort, form.receivingPort, form.destinationPort),
      receivingGate: text(payload.receivingGate, payload.receivedGate, payload.receivingBorder, payload.entryBorder, saved.receivingGate, saved.receivedGate, transport.receivingGate, form.receivingGate, form.receivedGate, form.receivingBorder, form.entryBorder),
      receivedDate: text(record.received_at, record.actual_arrival_date, payload.receivedDate, payload.receivingDate, transport.receivedDate, form.receivedDate, form.receivingDate),
    };
  });
  // Financial eligibility and allocation come from the same scoped API as payment validation.
  // Never substitute the whole contract when loading data is absent or still loading.
  const entries = (Array.isArray(dueBill?.loadings) ? dueBill.loadings : []).map((due: Row) => {
    const record = loadings.find(record => String(record.id) === String(due.id)) || {};
    const payload = parseJsonish(record.report_payload) || {};
    return {
      ...due, id: String(due.id),
      blNo: text(record.bl_number, payload.blNumber),
      route: routes.find(route => route.id === String(due.id)),
    };
  });
  const loadedSum = (key: string) => entries.reduce((total: number, entry: Row) => total + (number(entry[key]) ?? 0), 0);
  const loadedWeight = (key: string) => entries.length && entries.every((entry: Row) => number(entry[key]) !== null) ? loadedSum(key) : null;
  return {
    id: String(row.id),
    billNo: text(row.purchase_order_no, row.bill_no, row.order_no),
    date: text(row.order_date, form.orderDate, form.purchaseDate, form.bookingDate, row.created_at),
    countryBranch: [text(form.countryCode, row.country_code, row.countries?.iso3, row.countries?.iso2), text(row.audit?.branchCode, row.city_branch_code, form.branchCode, row.branch_code)].filter(Boolean).join(" / "),
    supplier: text(row.supplier_name, form.supplierName, form.salesAccountName, row.sales_account_name),
    goods: [...new Set(goods.map(line => text(line.goodsName, line.goods_name, line.name)).filter(Boolean))].join(", ") || text(row.goods_name, form.goodsName),
    quantity: loadedSum("quantity"),
    unit: [...new Set(goods.map(line => text(line.qtyName, line.quantityName, line.unit)).filter(Boolean))].join(" / ") || text(form.quantityUnit, form.qtyName),
    grossKg: loadedWeight("grossWeightKg"),
    netKg: loadedWeight("netWeightKg"),
    currency: text(dueBill?.currency, row.purchase_currency, row.currency_code),
    exchangeRate: number(row.exchange_rate, form.exchangeRate),
    total: loadedSum("value"),
    paid: loadedSum("advanceAllocated") + loadedSum("paid"),
    balance: loadedSum("outstanding"),
    entries,
    routes: routes.filter(route => entries.some((entry: Row) => entry.id === route.id)),
  };
}

/** Each saved bill is a single parent row; multiple loadings remain inside its route columns. */
export function uniqueBookingRows(rows: Row[]) {
  return [...new Map(rows.map(row => [String(row.id), row])).values()];
}
