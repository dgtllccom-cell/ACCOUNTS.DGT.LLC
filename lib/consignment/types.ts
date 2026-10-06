import type { SupportedLanguage } from "@/lib/i18n/languages";

export const CONSIGNMENT_STATUSES = ["open", "in_progress", "completed", "closed", "cancelled"] as const;
export const CONTAINER_STATUSES = ["expected", "in_transit", "received", "unloaded", "closed"] as const;
/** Sales-fulfilment status of a container — auto-maintained (sold qty vs received qty). */
export const CONTAINER_SALE_STATUSES = ["pending", "partial", "sold"] as const;
/** Owner spec list first; legacy values kept so existing rows still validate. */
export const EXPENSE_TYPES = [
  "customs", "commission", "cold_store", "transport", "loading_unloading", "other",
  "freight", "clearing", "labour", "storage", "duty",
] as const;
export const RECEIPT_METHODS = ["cash", "bank", "cheque", "online", "adjustment", "other"] as const;

export type ConsignmentStatus = (typeof CONSIGNMENT_STATUSES)[number];
export type ContainerStatus = (typeof CONTAINER_STATUSES)[number];
export type ContainerSaleStatus = (typeof CONTAINER_SALE_STATUSES)[number];
export type ExpenseType = (typeof EXPENSE_TYPES)[number];
export type ReceiptMethod = (typeof RECEIPT_METHODS)[number];

export interface ConsignmentRow {
  id: string;
  consignment_no: string;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  party_account_id: string | null;
  party_customer_id: string | null;
  party_name: string;
  party_contact: string | null;
  party_phone: string | null;
  title: string | null;
  reference_no: string | null;
  tender_no: string | null;
  loading_from_date: string | null;
  loading_to_date: string | null;
  reference_value: number | null;
  base_currency: string;
  consignment_date: string;
  status: ConsignmentStatus;
  accounting_status: "not_transferred" | "transferred";
  transferred_at: string | null;
  notes: string | null;
  original_language_code: SupportedLanguage;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ContainerRow {
  id: string;
  consignment_id: string;
  container_no: string | null;
  bl_no: string | null;
  loading_date: string | null;
  arrival_date: string | null;
  vessel_name: string | null;
  shipping_line: string | null;
  origin_country_id: string | null;
  seal_no: string | null;
  total_cartons: number | null;
  total_gross_weight: number | null;
  total_net_weight: number | null;
  reference_rate: number | null;
  reference_value: number | null;
  status: ContainerStatus;
  sale_status: ContainerSaleStatus;
  notes: string | null;
}

export interface ContainerGoodRow {
  id: string;
  container_id: string;
  consignment_id: string;
  goods_id: string | null;
  goods_name: string;
  unit_id: string | null;
  unit_label: string | null;
  cartons: number | null;
  quantity: number;
  gross_weight: number | null;
  net_weight: number | null;
  rate: number | null;
  amount: number | null;
  currency: string | null;
  notes: string | null;
}

export interface ExpenseRow {
  id: string;
  consignment_id: string;
  container_id: string | null;
  expense_type: ExpenseType;
  description: string | null;
  currency: string;
  amount: number;
  expense_date: string;
  paid_by: string | null;
  reference_no: string | null;
  notes: string | null;
}

export interface SaleRow {
  id: string;
  consignment_id: string;
  container_id: string | null;
  sale_date: string;
  buyer_name: string | null;
  buyer_customer_id: string | null;
  goods_id: string | null;
  goods_name: string;
  unit_id: string | null;
  unit_label: string | null;
  cartons: number | null;
  quantity: number;
  net_weight: number | null;
  rate: number | null;
  currency: string;
  amount: number;
  reference_no: string | null;
  notes: string | null;
}

export interface ReceiptRow {
  id: string;
  consignment_id: string;
  receipt_date: string;
  amount: number;
  currency: string;
  method: ReceiptMethod;
  reference_no: string | null;
  notes: string | null;
}

export type Numish = number | string | null | undefined;

export interface ConsignmentReport {
  consignment: ConsignmentRow;
  containers: (ContainerRow & { goods: ContainerGoodRow[] })[];
  expenses: ExpenseRow[];
  sales: SaleRow[];
  receipts: ReceiptRow[];
  events: Array<{ id: string; event_type: string; detail: string | null; actor_name: string | null; created_at: string }>;
  /** per-goods stock position (received − sold) */
  stockByGoods: Array<{ goodsKey: string; goodsName: string; unit: string | null; received: number; sold: number; remaining: number }>;
  totals: {
    containerCount: number;
    totalCartons: number;          // Σ container goods cartons
    goodsReceivedQty: number;
    goodsSoldQty: number;
    remainingStockQty: number;
    soldCartons: number;           // Σ sale cartons
    remainingCartons: number;      // totalCartons − soldCartons
    totalGrossWeight: number;
    totalNetWeight: number;
    referenceValue: number;        // head reference_value, else Σ container goods amount
    totalSales: number;            // Total Sales Value
    totalExpenses: number;         // Total Expenses
    netReceivable: number;         // totalSales − totalExpenses
    amountReceived: number;        // Σ receipts  (= totalReceipts)
    totalReceipts: number;         // kept for backward compat
    balanceReceivable: number;     // netReceivable − amountReceived
    remainingReceivable: number;   // kept: totalSales − totalReceipts
    netPosition: number;           // kept: totalSales − totalExpenses − totalReceipts
  };
}
