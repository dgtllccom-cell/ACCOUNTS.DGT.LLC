import { isLocalSalesFormData } from "@/lib/sales/local-sales-source";
import { postedPaymentVoucherSides, type PostedVoucherLine, type PaymentVoucherSide } from "@/lib/reports/payment-voucher-data";

export type SalesPaymentReceipt = {
  orderId: string; number: string; date: string; bill: string; customer: string; local: boolean;
  amount: number; currency: string; method: "cash" | "bank" | null; reference: string;
  manualBill?: string;
  goods?: SalesReceiptGoods[];
  sides?: { debit: PaymentVoucherSide; credit: PaymentVoucherSide };
};

type SalesReceiptGoods = {
  name: string; brand: string; size: string; hsCode: string; origin: string; lotName: string; lotNo: string; unit: string;
  quantity: number | null; gross: number | null; net: number | null; price: number | null; amount: number | null; currency: string;
};
const clean = (v: unknown) => typeof v === "string" || typeof v === "number" ? String(v).trim() : "";
const savedNumber = (...values: unknown[]) => {
  for (const value of values) {
    const raw = clean(value);
    if (!raw) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

/** Only issued journals can produce a customer copy; a booking transfer is not money received. */
export function issuedSalesPaymentReceipt(order: {
  id?: unknown; sales_order_no?: unknown; sales_contract_no?: unknown; customer_name?: unknown; currency_code?: unknown; form_data?: any;
}, payment: {
  payment_kind?: unknown; payment_date?: unknown; status?: unknown; amount?: unknown; currency_code?: unknown;
}, journal: {
  status?: unknown; voucher_no?: unknown; super_admin_serial_number?: unknown; source_reference_no?: unknown;
  entry_category?: unknown; deleted_at?: unknown;
} | null | undefined, viewGoodsPrices = false, postedLines?: PostedVoucherLine[]): SalesPaymentReceipt | null {
  if (!journal || journal.deleted_at || journal.status !== "posted" || payment.status !== "posted" || payment.payment_kind === "booking") return null;
  const number = clean(journal.voucher_no) || clean(journal.super_admin_serial_number);
  const bill = clean(order.sales_order_no);
  const currency = clean(payment.currency_code).toUpperCase();
  const amount = Number(payment.amount);
  const date = payment.payment_date instanceof Date && Number.isFinite(payment.payment_date.getTime())
    ? payment.payment_date.toISOString().slice(0, 10) : clean(payment.payment_date).slice(0, 10);
  if (!number || !bill || !/^[A-Z]{3}$/.test(currency) || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const form = order.form_data?.form ?? {};
  const customer = clean(form.customerAccountName || form.customerName || form.buyerName || order.customer_name);
  const method = journal.entry_category === "cash" ? "cash" : journal.entry_category === "bank" || journal.entry_category === "transfer" ? "bank" : null;
  const manualBill = clean(form.manualBillNumber || form.manual_bill_number || form.billNo || form.salesContractNo || order.sales_contract_no);
  const savedLines = order.form_data?.goodsEntries;
  const lines = Array.isArray(savedLines) && savedLines.length ? savedLines : [form];
  const goods = lines.flatMap((line): SalesReceiptGoods[] => {
    const name = clean(line?.goodsName || line?.productName || line?.name);
    if (!name) return [];
    const goodsCurrency = clean(line.salesCurrency || line.pricingCurrency || line.currencyType || form.salesCurrency || form.pricingCurrency || order.currency_code).toUpperCase();
    return [{
      name, brand: clean(line.brandName || line.brand), size: clean(line.sizeName || line.size), hsCode: clean(line.hsCode),
      origin: clean(line.origin), lotName: clean(line.lotName), lotNo: clean(line.lotNo || line.lotNumber),
      unit: clean(line.qtyName || line.unit || line.quantityUnit), quantity: savedNumber(line.qtyNo, line.quantity, line.qty),
      gross: savedNumber(line.grossWeight, line.gross_weight), net: savedNumber(line.netWeight, line.net_weight),
      price: viewGoodsPrices ? savedNumber(line.coursePrice, line.unitPrice) : null,
      amount: viewGoodsPrices ? savedNumber(line.totalAmount, line.salesAmount) : null,
      currency: viewGoodsPrices && /^[A-Z]{3}$/.test(goodsCurrency) ? goodsCurrency : "",
    }];
  });
  return { orderId: clean(order.id), number, date, customer, bill, local: isLocalSalesFormData(order.form_data), amount, currency,
    method, reference: clean(journal.source_reference_no), manualBill: manualBill === bill ? "" : manualBill, goods,
    sides: viewGoodsPrices ? postedPaymentVoucherSides(postedLines) : undefined };
}
