"use client";

import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api/client";

export type BankRecord = {
  id: string;
  account_code?: string | null;
  owner_person_id?: string | null;
  owner_company_id?: string | null;
  bank_type: string;
  account_type: string;
  bank_name: string;
  branch_name: string;
  branch_code: string;
  branch_code_type: string;
  short_name: string;
  account_title: string;
  account_number: string;
  iban_number: string | null;
  opening_balance?: number | string | null;
  currency: string;
  account_status: string;
  country_id: string | null;
  state_province_id: string | null;
  district_id: string | null;
  city_id: string | null;
  full_address: string | null;
  phone: string | null;
  email: string | null;
  swift_bic: string | null;
  website: string | null;
  remarks: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function listBanks(params?: {
  q?: string;
  countryId?: string;
  limit?: number;
}) {
  const qp = new URLSearchParams();
  if (params?.q) qp.set("q", params.q);
  if (params?.countryId) qp.set("countryId", params.countryId);
  if (params?.limit) qp.set("limit", String(params.limit));
  const res = await apiGet<{ banks: BankRecord[] }>(
    `/api/erp/banks?${qp.toString()}`
  );
  return res.banks ?? [];
}

export async function getBankById(id: string) {
  const res = await apiGet<{ bank: BankRecord }>(`/api/erp/banks/${id}`);
  return res.bank;
}

export async function createBank(data: {
  ownerPersonId?: string | null;
  ownerCompanyId?: string | null;
  bankType: string;
  accountType: string;
  bankName: string;
  branchName: string;
  branchCode: string;
  branchCodeType: string;
  shortName: string;
  accountTitle: string;
  accountNumber: string;
  ibanNumber?: string | null;
  currency: string;
  accountStatus?: string;
  countryId?: string | null;
  stateProvinceId?: string | null;
  districtId?: string | null;
  cityId?: string | null;
  fullAddress?: string | null;
  phone?: string | null;
  email?: string | null;
  swiftBic?: string | null;
  website?: string | null;
  remarks?: string | null;
}) {
  // The route returns { bank }, not { bankId } — reading res.bankId here always
  // produced undefined, silently breaking the picker's post-create selection.
  const res = await apiPost<{ bank: BankRecord }>("/api/erp/banks", data);
  return res.bank.id;
}

export async function updateBank(id: string, data: Partial<Parameters<typeof createBank>[0]>) {
  return await apiPatch(`/api/erp/banks/${id}`, data);
}

export async function deleteBank(id: string) {
  return await apiDelete(`/api/erp/banks/${id}`);
}
