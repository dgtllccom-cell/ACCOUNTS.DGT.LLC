/**
 * Turns a failed City Branch save response into the full, readable reason.
 * Field-level validation errors are listed with the field name, so the user sees
 * exactly which input the server rejected.
 */

/** API field name -> central i18n key for the field label. */
export const CITY_BRANCH_FIELD_KEYS: Record<string, string> = {
  id: "cbs.field_record",
  countryId: "cbs.field_country",
  countryBranchId: "cbs.field_main_branch",
  operationalDomain: "cbs.field_section",
  cityName: "cbs.field_city_name",
  stateProvinceId: "cbs.field_state_province",
  districtId: "cbs.field_district",
  cityId: "cbs.field_city",
  areaLocationId: "cbs.field_area",
  name: "cbs.field_branch_name",
  code: "cbs.field_branch_code",
  currencyCode: "cbs.field_currency",
  address: "cbs.field_address",
  phone: "cbs.field_phone",
  email: "cbs.field_email",
  whatsappNumber: "cbs.field_whatsapp",
  companyId: "cbs.field_company",
  ownerName: "cbs.field_owner",
  ownerCustomerId: "cbs.field_owner",
  ownerProfileId: "cbs.field_owner",
  contacts: "cbs.field_contacts",
  documents: "cbs.field_documents",
  permissionTemplate: "cbs.field_permission_template",
  permissionGrants: "cbs.field_permissions",
  emailPrefix: "cbs.field_email_prefix",
  emailServerSettings: "cbs.field_email_server",
  whatsappConfig: "cbs.field_whatsapp_config"
};

export type CityBranchFieldLabel = (field: string) => string;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function joinMessages(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean).join(", ");
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * Builds the complete error text from a response body. Accepts the legacy string form, a plain
 * `{ message }` object, and the Zod flatten form `{ formErrors, fieldErrors }`. Returns `fallback`
 * only when the body carries no message at all.
 */
export function describeCityBranchServerError(body: unknown, fallback: string, fieldLabel: CityBranchFieldLabel): string {
  if (typeof body === "string" && body.trim()) return body.trim();
  if (!isRecord(body)) return fallback;

  const candidate = body.error ?? body.message;
  if (typeof candidate === "string" && candidate.trim()) return candidate.trim();

  if (isRecord(candidate)) {
    const lines: string[] = [];
    const fieldErrors = isRecord(candidate.fieldErrors) ? candidate.fieldErrors : {};
    for (const [field, messages] of Object.entries(fieldErrors)) {
      const text = joinMessages(messages);
      if (text) lines.push(`${fieldLabel(field)}: ${text}`);
    }
    const formErrors = joinMessages(candidate.formErrors);
    if (formErrors) lines.push(formErrors);
    if (typeof candidate.message === "string" && candidate.message.trim()) lines.push(candidate.message.trim());
    if (lines.length) return lines.join("\n");
  }

  if (isRecord(body) && typeof body.message === "string" && body.message.trim()) return body.message.trim();
  return fallback;
}
