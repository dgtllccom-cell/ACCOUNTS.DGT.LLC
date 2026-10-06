import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api/client";

export type TempBillListRow = {
  id: string;
  entry_no: string | null;
  bill_kind: "purchase" | "sale";
  party_name: string;
  reference_no: string | null;
  goods_name: string | null;
  bill_no: string | null;
  container_no: string | null;
  bl_no: string | null;
  bill_date: string;
  quantity: number | null;
  weight_cartons: number | null;
  unit: string | null;
  rate: number | null;
  amount: number | null;
  currency_code: string;
  remarks: string | null;
  country_name?: string | null;
  country_branch_name?: string | null;
  city_branch_name?: string | null;
};

export type TempBillSummary = {
  purchase?: { count: number; total: number };
  sale?: { count: number; total: number };
  parties?: number;
  currencies?: string[];
};

export type TempBillInput = {
  billKind: "purchase" | "sale";
  partyAccountId?: string | null;
  partyCustomerId?: string | null;
  partyName: string;
  referenceNo?: string | null;
  goodsId?: string | null;
  goodsName?: string | null;
  billNo?: string | null;
  containerNo?: string | null;
  blNo?: string | null;
  billDate?: string | null;
  quantity?: number | string | null;
  weightCartons?: number | string | null;
  unit?: string | null;
  rate?: number | string | null;
  amount?: number | string | null;
  currencyCode?: string | null;
  remarks?: string | null;
};

export async function fetchTempBills(params: {
  kind?: string;
  q?: string;
  partyId?: string;
  referenceNo?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<{ rows: TempBillListRow[]; summary: TempBillSummary; setupPending?: boolean }> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, String(v));
  qs.set("limit", "300");
  return apiGet(`/api/erp/temp-bills?${qs.toString()}`);
}

export async function fetchTempBill(id: string): Promise<{ bill: TempBillListRow }> {
  return apiGet(`/api/erp/temp-bills/${id}`);
}

export async function createTempBillReq(input: TempBillInput): Promise<{ id: string; entryNo: string }> {
  return apiPost(`/api/erp/temp-bills`, input);
}

export async function updateTempBillReq(id: string, patch: Partial<TempBillInput>): Promise<{ ok: true }> {
  return apiPatch(`/api/erp/temp-bills/${id}`, patch);
}

export async function deleteTempBillReq(id: string): Promise<{ ok: true }> {
  return apiDelete(`/api/erp/temp-bills/${id}`);
}
