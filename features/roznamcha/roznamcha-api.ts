"use client";

import { apiGet } from "@/lib/api/client";

export type RoznamchaType = "super_admin" | "country" | "branch";

export type RoznamchaEntryRow = {
  id: string;
  type: RoznamchaType;
  country_id: string | null;
  countries?: { name: string; currency_code: string } | null;
  country_branch_id: string | null;
  country_branches?: { name: string; code: string } | null;
  city_branch_id: string | null;
  city_branches?: { name: string; code: string } | null;
  journal_no: string;
  voucher_no: string;
  entry_date: string; // YYYY-MM-DD
  payment_method_id: string | null;
  payment_methods?: { name: string; code: string } | null;
  reference_no: string | null;
  narration: string | null;
  status: string;
  created_by: string | null;
  profiles?: { full_name: string | null } | null;
  approved_by: string | null;
  approved_at: string | null;
  posted_at: string | null;
  super_admin_serial_number?: string | null;
  country_transaction_serial_number?: string | null;
  branch_transaction_serial_number?: string | null;
  created_at: string;
  updated_at: string;
  source_module?: string | null;
  source_transaction_type?: string | null;
  source_transaction_id?: string | null;
  source_reference_no?: string | null;
  roznamcha_lines?: RoznamchaLineRow[] | null;
};

export type RoznamchaLineRow = {
  id: string;
  payment_entry_type: string;
  account_id: string | null;
  enterprise_account_id?: string | null;
  account_number?: string | null;
  manual_reference_number?: string | null;
  customer_number?: string | null;
  country_serial_number?: string | null;
  branch_serial_number?: string | null;
  ledger_id: string | null;
  description: string | null;
  debit: number;
  credit: number;
  currency: string;
  usd_rate: number;
  usd_amount: number;
  accounts?: { id: string; code: string; name: string } | null;
  ledgers?: { 
    id: string; 
    code: string; 
    name: string;
    city_branches?: { name: string } | null;
    country_branches?: { name: string } | null;
  } | null;
};

export async function listRoznamchaEntries(params: {
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  search?: string | null;
  limit?: number;
}) {
  const qp = new URLSearchParams();
  if (params.countryId) qp.set("countryId", params.countryId);
  if (params.countryBranchId) qp.set("countryBranchId", params.countryBranchId);
  if (params.cityBranchId) qp.set("cityBranchId", params.cityBranchId);
  if (params.fromDate) qp.set("fromDate", params.fromDate);
  if (params.toDate) qp.set("toDate", params.toDate);
  if (params.search) qp.set("search", params.search);
  if (params.limit) qp.set("limit", String(params.limit));

  return apiGet<{ entries: RoznamchaEntryRow[]; limit: number }>(`/api/erp/roznamcha?${qp.toString()}`);
}

export async function getRoznamchaEntry(id: string) {
  return apiGet<{
    found: boolean;
    id: string;
    header: RoznamchaEntryRow | null;
    lines: RoznamchaLineRow[];
    totals: { lines: number; debit: number; credit: number };
  }>(`/api/erp/roznamcha/${id}`);
}
