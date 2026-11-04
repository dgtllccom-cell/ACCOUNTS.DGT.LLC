import { buildBillPayment } from "@/lib/services/purchase-loading-payment-service";
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
const sum = (lines: Row[], keys: string[]) => {
  const values = lines.map(line => number(...keys.map(key => line[key]))).filter((n): n is number => n !== null);
  return values.length ? values.reduce((total, n) => total + n, 0) : null;
};

/** Read-only registry projection. Money uses the existing purchase-currency model. */
export function remainingBookingRow(row: Row, records: Row[] = []) {
  const data = parseJsonish(row.form_data) || {};
  const form = data.form || {};
  const transport = data.transportDetails || data.transport || {};
  const goods: Row[] = Array.isArray(data.goodsEntries) ? data.goodsEntries : [];
  const matches = (record: Row) => record.id && record.purchase_order_id === row.id && !record.deleted_at &&
    !String(record.id || "").startsWith("synthetic-");
  const linked = [...(Array.isArray(row.loading_records) ? row.loading_records : []), ...(row.__loadingRecord ? [row.__loadingRecord] : []), ...records]
    .filter(matches);
  const loadings = [...new Map(linked.map(record => [record.id, record])).values()];
  const payment = buildBillPayment(row, loadings as any[], []);
  const routes = (loadings.length ? loadings : [{}]).map(record => {
    const payload = parseJsonish(record.report_payload) || {};
    const saved = payload.form || {};
    return {
      id: text(record.id, row.id),
      loadingCountry: text(payload.loadingCountry, saved.loadingCountry, transport.loadingCountry, form.loadingCountry, form.originCountry),
      loadingPort: text(payload.loadingPort, record.loading_location, saved.loadingPort, transport.loadingPort, form.loadingPort, form.exitPort),
      loadingDate: text(record.loaded_at, payload.loadingDate, saved.loadingDate, transport.loadingDate, form.loadingDate),
      receivingCountry: text(payload.receivingCountry, payload.receivedCountry, saved.receivedCountry, transport.receivingCountry, form.receivedCountry, form.receivingCountry, form.destinationCountry),
      receivingPort: text(payload.receivingPort, payload.receivedPort, record.receiving_location, saved.receivedPort, transport.receivingPort, form.receivedPort, form.receivingPort, form.destinationPort),
      receivedDate: text(record.received_at, record.actual_arrival_date, payload.receivedDate, payload.receivingDate, transport.receivedDate, form.receivedDate, form.receivingDate),
    };
  });
  return {
    id: String(row.id),
    billNo: text(row.purchase_order_no, row.bill_no, row.order_no),
    date: text(row.order_date, form.orderDate, form.purchaseDate, form.bookingDate, row.created_at),
    countryBranch: [text(form.countryCode, row.country_code, row.countries?.iso3, row.countries?.iso2), text(row.audit?.branchCode, row.city_branch_code, form.branchCode, row.branch_code)].filter(Boolean).join(" / "),
    supplier: text(row.supplier_name, form.supplierName, form.salesAccountName, row.sales_account_name),
    goods: [...new Set(goods.map(line => text(line.goodsName, line.goods_name, line.name)).filter(Boolean))].join(", ") || text(row.goods_name, form.goodsName),
    quantity: sum(goods, ["qtyNo", "quantity", "quantityNo", "qty"]) ?? number(row.total_quantity, data.totals?.totalQuantity, data.workflow?.totalQuantity, form.totalQuantity, form.qtyNo),
    unit: [...new Set(goods.map(line => text(line.qtyName, line.quantityName, line.unit)).filter(Boolean))].join(" / ") || text(form.quantityUnit, form.qtyName),
    grossKg: sum(goods, ["grossWeight", "totalGrossWeight", "grossKgs", "grossWt"]) ?? number(row.gross_weight, data.totals?.totalGrossWeight, form.grossWeight),
    netKg: sum(goods, ["netWeight", "netKgs", "netWt"]) ?? number(row.net_weight, data.totals?.totalNetWeight, form.netWeight),
    currency: payment.currency,
    exchangeRate: number(row.exchange_rate, form.exchangeRate),
    total: payment.billTotal,
    paid: payment.totalPaid,
    balance: Math.max(0, payment.outstanding),
    routes,
  };
}

/** Each saved bill is a single parent row; multiple loadings remain inside its route columns. */
export function uniqueBookingRows(rows: Row[]) {
  return [...new Map(rows.map(row => [String(row.id), row])).values()];
}
