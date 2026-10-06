// Country-specific Clearing Form framework (Phase 2, directive item #7).
// Reuses the EXISTING clearance_type / duty_treatment / customs_status
// vocabulary already validated by clearing-customer-order-service.ts
// (LEG_CLEARANCE_TYPES / LEG_DUTY_TREATMENTS / LEG_CUSTOMS_STATUSES) — this
// module does not introduce a second enum or a second customs data model, it
// only decides which of the EXISTING clearing_customer_order_legs customs
// columns a given country's clearing form should show/require, and supplies
// that country's local document-reference labels.
//
// Cross-border movement is never assumed to mean "import" — every country
// entry supports import / export / transit, and clearance_type is always an
// explicit user choice, never inferred from country pair.

export type ClearanceType = "import" | "export" | "transit";
export type DutyTreatment = "duty_payable" | "no_duty_exempt" | "transit_bonded" | "pending";
export type CustomsStatus = "not_applicable" | "pending" | "submitted" | "cleared" | "held" | "rejected";

export const CLEARANCE_TYPES: ClearanceType[] = ["import", "export", "transit"];
export const DUTY_TREATMENTS: DutyTreatment[] = ["duty_payable", "no_duty_exempt", "transit_bonded", "pending"];
export const CUSTOMS_STATUSES: CustomsStatus[] = ["not_applicable", "pending", "submitted", "cleared", "held", "rejected"];

export type CustomsFieldKey =
  | "billOfEntryNo"
  | "pgmNumber"
  | "declarationReference"
  | "customsReceiptRef"
  | "dutyAmount"
  | "taxAmount"
  | "otherCharges";

export type CountryCustomsFieldConfig = {
  /** ISO2 the config was matched on ("default" if no country-specific entry exists). */
  countryIso2: string;
  /** Fields shown on the clearing form for this country, in display order. */
  fields: CustomsFieldKey[];
  /** Subset of `fields` that must be filled before the leg can be marked "cleared". */
  requiredForClearance: CustomsFieldKey[];
  /** Local label overrides for fields whose real-world document name differs by country. */
  fieldLabels: Partial<Record<CustomsFieldKey, string>>;
};

const FIELD_LABEL_DEFAULTS: Record<CustomsFieldKey, string> = {
  billOfEntryNo: "Bill of Entry No.",
  pgmNumber: "PGM Number",
  declarationReference: "Customs Declaration Reference",
  customsReceiptRef: "Customs Receipt Reference",
  dutyAmount: "Duty Amount",
  taxAmount: "Tax Amount",
  otherCharges: "Other Charges",
};

// Keyed by ISO2. Add a country here only when its clearing paperwork
// genuinely differs — every entry still uses the SAME underlying columns.
const COUNTRY_CONFIGS: Record<string, Omit<CountryCustomsFieldConfig, "countryIso2">> = {
  PK: {
    fields: ["billOfEntryNo", "pgmNumber", "declarationReference", "dutyAmount", "taxAmount", "otherCharges"],
    requiredForClearance: ["billOfEntryNo", "pgmNumber"],
    fieldLabels: { billOfEntryNo: "Bill of Entry No. (Pakistan Customs)", pgmNumber: "PGM Number (WeBOC)" },
  },
  AE: {
    fields: ["customsReceiptRef", "declarationReference", "dutyAmount", "taxAmount", "otherCharges"],
    requiredForClearance: ["customsReceiptRef"],
    fieldLabels: { customsReceiptRef: "Customs Declaration Number (Dubai Trade)" },
  },
  AF: {
    fields: ["declarationReference", "customsReceiptRef", "dutyAmount", "otherCharges"],
    requiredForClearance: ["declarationReference"],
    fieldLabels: { declarationReference: "ASYCUDA Declaration Reference" },
  },
  IN: {
    fields: ["billOfEntryNo", "declarationReference", "dutyAmount", "taxAmount", "otherCharges"],
    requiredForClearance: ["billOfEntryNo"],
    fieldLabels: { billOfEntryNo: "Bill of Entry No. (ICEGATE)" },
  },
};

const DEFAULT_CONFIG: Omit<CountryCustomsFieldConfig, "countryIso2"> = {
  fields: ["declarationReference", "customsReceiptRef", "dutyAmount", "taxAmount", "otherCharges"],
  requiredForClearance: ["declarationReference"],
  fieldLabels: {},
};

export function getCountryCustomsFieldConfig(countryIso2: string | null | undefined): CountryCustomsFieldConfig {
  const iso = (countryIso2 || "").trim().toUpperCase();
  const base = (iso && COUNTRY_CONFIGS[iso]) || DEFAULT_CONFIG;
  return {
    countryIso2: (iso && COUNTRY_CONFIGS[iso]) ? iso : "default",
    fields: base.fields,
    requiredForClearance: base.requiredForClearance,
    fieldLabels: { ...FIELD_LABEL_DEFAULTS, ...base.fieldLabels },
  };
}

export function listConfiguredCountryIso2Codes(): string[] {
  return Object.keys(COUNTRY_CONFIGS);
}
