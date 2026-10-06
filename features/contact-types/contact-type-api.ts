"use client";

import { apiGet, apiPost } from "@/lib/api/client";

export type ContactTypeKey = "mobile" | "phone" | "whatsapp" | "fax" | "extension";

export type ContactTypeRow = {
  id: string;
  key: ContactTypeKey;
  name: string;
  is_active: boolean;
  sort_order: number;
};

export type CountryContactRuleRow = {
  id: string;
  countryId: string;
  contactTypeId: string;
  contactTypeKey: ContactTypeKey;
  contactTypeName: string;
  callingCode: string;
  prefix: string | null;
  formatMask: string | null;
  example: string | null;
  isActive: boolean;
};

export async function getCountryContactRules(countryId: string) {
  const qp = new URLSearchParams({ countryId });
  return apiGet<{
    countryId: string | null;
    contactTypes: ContactTypeRow[];
    rules: CountryContactRuleRow[];
  }>(`/api/erp/settings/contact-type-rules?${qp.toString()}`);
}

export async function upsertCountryContactRules(input: {
  countryId: string;
  rules: Array<{
    contactTypeKey: ContactTypeKey;
    callingCode: string;
    prefix?: string | null;
    formatMask?: string | null;
    example?: string | null;
    isActive?: boolean;
  }>;
}) {
  return apiPost<{ ok: true }>(`/api/erp/settings/contact-type-rules`, input);
}

