/**
 * Single normalizer + loader for the Company and Owner picked on the City Branch page.
 *
 * The form, the live report, the saved record and the print all read the same
 * CompanyView / OwnerView objects produced here, so a value shown in one place is the
 * value shown in every other place. Values come only from the saved company / customer
 * records (never from fallbacks such as a code derived from a UUID).
 */
import { apiGet } from "@/lib/api/client";

export type CompanyContactView = { type: string; value: string };

export type CompanyView = {
  id: string;
  name: string;
  legalName: string;
  tradeName: string;
  companyCode: string;
  baseCurrency: string;
  businessType: string;
  companyType: string;
  companyStatus: string;
  registrationNumber: string;
  taxNumber: string;
  ownerPersonId: string;
  ownerName: string;
  country: string;
  state: string;
  city: string;
  area: string;
  zipCode: string;
  address: string;
  contacts: CompanyContactView[];
};

export type OwnerView = {
  source: "customer" | "profile";
  id: string;
  code: string;
  name: string;
  companyName: string;
  contactPerson: string;
  mobile: string;
  whatsapp: string;
  email: string;
  address: string;
  country: string;
  state: string;
  district: string;
  city: string;
};

export type CompanyOwnerViews = {
  company: CompanyView | null;
  owner: OwnerView | null;
  /** Live bank accounts owned by the company (owner_company_id). */
  companyBankCount: number;
};

type JsonGetter = <T>(url: string) => Promise<T>;

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseContacts(value: unknown): CompanyContactView[] {
  let list: unknown = value;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  const out: CompanyContactView[] = [];
  for (const row of list) {
    const item = (row ?? {}) as Record<string, unknown>;
    const type = text(item.type ?? item.label ?? item.kind ?? item.contact_type);
    const contactValue = text(item.value ?? item.contact_value ?? item.number);
    if (type && contactValue) out.push({ type, value: contactValue });
  }
  return out;
}

/** Normalizes one saved company row (snake_case API shape). Returns null when there is no saved id. */
export function normalizeCompanyRecord(raw: unknown): CompanyView | null {
  const r = (raw ?? null) as Record<string, unknown> | null;
  if (!r || !text(r.id)) return null;
  return {
    id: text(r.id),
    name: text(r.name),
    legalName: text(r.legal_name),
    tradeName: text(r.trade_name),
    companyCode: text(r.company_code),
    baseCurrency: text(r.base_currency).toUpperCase(),
    businessType: text(r.business_type),
    companyType: text(r.company_type ?? r.effective_company_type),
    companyStatus: text(r.company_status),
    registrationNumber: text(r.registration_number),
    taxNumber: text(r.tax_number),
    ownerPersonId: text(r.owner_person_id),
    ownerName: text(r.owner_name),
    country: text(r.country_name),
    state: text(r.state_name),
    city: text(r.city_name),
    area: text(r.area_name),
    zipCode: text(r.zip_code),
    address: text(r.address),
    contacts: parseContacts(r.contacts)
  };
}

/** Normalizes one saved customer (owner) row. Returns null when there is no saved id. */
export function normalizeOwnerRecord(raw: unknown, source: "customer" | "profile" = "customer"): OwnerView | null {
  const r = (raw ?? null) as Record<string, unknown> | null;
  if (!r || !text(r.id)) return null;
  return {
    source,
    id: text(r.id),
    code: text(r.person_code),
    name: text(r.customer_name ?? r.full_name ?? r.name),
    companyName: text(r.company_name),
    contactPerson: text(r.contact_person),
    mobile: text(r.mobile),
    whatsapp: text(r.whatsapp),
    email: text(r.email),
    address: text(r.address),
    country: text(r.country_name),
    state: text(r.state_province_name ?? r.state_name),
    district: text(r.district_name),
    city: text(r.city_name)
  };
}

/**
 * Owner shown when only a name is known (no loaded customer record, e.g. a profile owner or a saved name
 * whose record could not be read). Every field other than the name stays empty rather than guessed.
 */
export function emptyOwnerView(name: string, source: "customer" | "profile" = "customer"): OwnerView {
  return {
    source,
    id: "",
    code: "",
    name,
    companyName: "",
    contactPerson: "",
    mobile: "",
    whatsapp: "",
    email: "",
    address: "",
    country: "",
    state: "",
    district: "",
    city: ""
  };
}

/** Loads one company through the existing company API. Throws on transport / server error. */
export async function loadCompanyView(companyId: string, get: JsonGetter = apiGet): Promise<CompanyView | null> {
  if (!companyId) return null;
  const res = await get<{ company?: unknown }>(`/api/erp/companies/${encodeURIComponent(companyId)}`);
  return normalizeCompanyRecord(res?.company ?? null);
}

/** Loads one owner (customer master record) through the existing customer API. */
export async function loadOwnerView(customerId: string, get: JsonGetter = apiGet): Promise<OwnerView | null> {
  if (!customerId) return null;
  const res = await get<{ customer?: unknown }>(`/api/erp/customers/${encodeURIComponent(customerId)}`);
  return normalizeOwnerRecord(res?.customer ?? null, "customer");
}

/** Number of live bank accounts owned by the company (used by the "Bank / Account setup" checklist item). */
export async function loadCompanyBankCount(companyId: string, get: JsonGetter = apiGet): Promise<number> {
  if (!companyId) return 0;
  const res = await get<{ banks?: unknown[] }>(`/api/erp/companies/${encodeURIComponent(companyId)}/bank-accounts`);
  return Array.isArray(res?.banks) ? res.banks.length : 0;
}

/** Loads company, owner and bank count together. Any failing request rejects the whole load. */
export async function loadCompanyOwnerViews(
  input: { companyId: string; ownerCustomerId: string | null | undefined },
  get: JsonGetter = apiGet
): Promise<CompanyOwnerViews> {
  const [company, owner, companyBankCount] = await Promise.all([
    loadCompanyView(input.companyId, get),
    input.ownerCustomerId ? loadOwnerView(input.ownerCustomerId, get) : Promise.resolve(null),
    loadCompanyBankCount(input.companyId, get)
  ]);
  return { company, owner, companyBankCount };
}
