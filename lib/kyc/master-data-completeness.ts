export type CompanyCompletenessInput = {
  legal_name?: string | null;
  name?: string | null;
  country_id?: string | null;
  base_currency?: string | null;
  address?: string | null;
  contacts?: unknown;
};

export type CustomerCompletenessInput = {
  customer_name?: string | null;
  country_id?: string | null;
  mobile?: string | null;
  whatsapp?: string | null;
  address?: string | null;
};

export function getCompanyMissingRequirements(company: CompanyCompletenessInput): string[] {
  const missing: string[] = [];
  if (!(company.legal_name?.trim() || company.name?.trim())) missing.push("Missing Company Legal Name");
  if (!company.country_id) missing.push("Missing Company Country");
  if (!company.base_currency?.trim()) missing.push("Missing Company Base Currency");
  if (!company.address?.trim()) missing.push("Missing Company Address");
  if (!Array.isArray(company.contacts) || company.contacts.length === 0) missing.push("Missing Company Contact Details");
  return missing;
}

export function getCustomerMissingRequirements(customer: CustomerCompletenessInput): string[] {
  const missing: string[] = [];
  if (!customer.customer_name?.trim()) missing.push("Missing Customer Name");
  if (!customer.country_id) missing.push("Missing Customer Country");
  if (!(customer.mobile?.trim() || customer.whatsapp?.trim())) missing.push("Missing Customer Mobile / WhatsApp");
  if (!customer.address?.trim()) missing.push("Missing Customer Address");
  return missing;
}

