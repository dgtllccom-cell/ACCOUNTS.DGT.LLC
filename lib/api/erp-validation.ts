import { z } from "zod";
import { approvalActions, approvalStatuses } from "@/lib/approval/approval-actions";
import { paymentEntryTypes, roznamchaTypes } from "@/lib/accounting/roznamcha-flow";
import { enterpriseRoles } from "@/lib/permissions/enterprise-roles";

export const uuidSchema = z.string().uuid();
export const optionalUuidSchema = z.preprocess(
  (val) => (val === "" || val === undefined ? null : val),
  uuidSchema.nullish()
);
export const supportedLanguageSchema = z.enum(["en", "ar", "ur", "fa", "ps"]);

export const scopeSchema = z.object({
  countryId: optionalUuidSchema,
  countryBranchId: optionalUuidSchema,
  cityBranchId: optionalUuidSchema
});

export const permissionCheckSchema = scopeSchema.extend({
  resource: z.string().min(2).max(80),
  action: z.string().min(2).max(40)
});

export const approvalCreateSchema = scopeSchema.extend({
  resource: z.string().min(2).max(120),
  action: z.enum(approvalActions),
  targetTable: z.string().min(2).max(120),
  targetId: uuidSchema,
  reason: z.string().max(1000).optional(),
  beforeData: z.unknown().optional(),
  afterData: z.unknown().optional()
});

export const approvalDecisionSchema = z.object({
  action: z.enum(["approve", "reject", "cancel", "unlock"]),
  note: z.string().max(1000).optional(),
  countryId: optionalUuidSchema,
  cityBranchId: optionalUuidSchema,
  recordTable: z.string().min(2).max(120).optional(),
  recordId: uuidSchema.optional()
});

export const recordTranslationSchema = z.object({
  recordTable: z.string().min(2).max(120),
  recordId: uuidSchema,
  fieldName: z.string().min(1).max(120),
  originalText: z.string().min(1).max(10_000),
  originalLanguage: supportedLanguageSchema,
  translations: z
    .object({
      en: z.string().max(10_000).optional(),
      ar: z.string().max(10_000).optional(),
      ur: z.string().max(10_000).optional(),
      fa: z.string().max(10_000).optional(),
      ps: z.string().max(10_000).optional()
    })
    .optional(),
  source: z.enum(["auto", "manual", "imported"]).default("manual")
});

const moneySchema = z.coerce.number().finite().min(0).default(0);
const positiveRateSchema = z.coerce.number().finite().positive().default(1);
const accountKindSchema = z.enum(["asset", "liability", "equity", "income", "expense"]);
export const ledgerScopeSchema = z.enum(["super_admin", "country", "main_branch", "city_branch"]);
const normalBalanceSchema = z.enum(["debit", "credit"]);

const ledgerPostingLineCoreSchema = z.object({
  // Backward-compatible: older flows used `accounts.id` as `accountId`.
  // Newer enterprise accounting uses `enterprise_accounts.id` as `enterpriseAccountId`.
  // For posting, at least one should be provided (or the ledger can imply enterpriseAccountId).
  accountId: uuidSchema.optional().nullable(),
  enterpriseAccountId: uuidSchema.optional().nullable(),
  ledgerId: uuidSchema.optional().nullable(),
  description: z.string().max(5000).optional(),
  debit: moneySchema,
  credit: moneySchema,
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  exchangeRate: positiveRateSchema,
  accountNumber: z.string().trim().max(120).optional().nullable(),
  manualReferenceNumber: z.string().trim().max(120).optional().nullable(),
  customerNumber: z.string().trim().max(120).optional().nullable(),
  countrySerialNumber: z.string().trim().max(120).optional().nullable(),
  branchSerialNumber: z.string().trim().max(120).optional().nullable()
});

export const ledgerPostingLineSchema = ledgerPostingLineCoreSchema.superRefine((input, context) => {
  if (!input.accountId && !input.enterpriseAccountId && !input.ledgerId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["accountId"],
      message: "accountId, enterpriseAccountId, or ledgerId is required"
    });
  }
});

export const ledgerPostingSchema = scopeSchema
  .extend({
    mode: z.enum(["validate", "post"]).default("validate"),
    scope: ledgerScopeSchema.default("city_branch"),
    entryDate: z.string().date(),
    referenceNo: z.string().max(120).optional(),
    narration: z.string().max(1000).optional(),
    lines: z.array(ledgerPostingLineSchema).min(2)
  })
  .superRefine((input, context) => {
    if (input.mode === "post" && input.lines.some((line) => !line.ledgerId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lines"],
        message: "ledgerId is required on every line when posting"
      });
    }
  });

export const roznamchaLineSchema = ledgerPostingLineCoreSchema
  .extend({
    paymentEntryType: z.enum(paymentEntryTypes)
  })
  .superRefine((input, context) => {
    if (!input.accountId && !input.enterpriseAccountId && !input.ledgerId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["accountId"],
        message: "accountId, enterpriseAccountId, or ledgerId is required"
      });
    }
  });

export const roznamchaPostingSchema = scopeSchema
  .extend({
    mode: z.enum(["validate", "post"]).default("validate"),
    type: z.enum(roznamchaTypes),
    entryDate: z.string().date(),
    journalNo: z.string().min(1).max(120),
    voucherNo: z.string().min(1).max(120),
    paymentMethodId: optionalUuidSchema,
    referenceNo: z.string().max(120).optional(),
    narration: z.string().max(5000).optional(),
    lines: z.array(roznamchaLineSchema).min(1),
    paymentDetails: z.record(z.string(), z.unknown()).optional().nullable()
  })
  .superRefine((input, context) => {
    if (input.mode === "post" && input.lines.some((line) => !line.ledgerId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lines"],
        message: "ledgerId is required on every line when posting"
      });
    }
  });

export const rolesQuerySchema = z.object({
  includeMatrix: z.coerce.boolean().default(true)
});

export const roleNameSchema = z.enum(enterpriseRoles);
export const approvalStatusSchema = z.enum(approvalStatuses);

export const userCreateSchema = scopeSchema.extend({
  role: roleNameSchema,
  fullName: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(200),
  preferredLanguage: supportedLanguageSchema.default("en"),
  userCode: z.string().trim().min(2).max(80).optional(),
  permissions: z.array(z.string().trim().min(3).max(120)).optional(),
  phone: z.string().trim().max(50).optional(),
  companyId: optionalUuidSchema,
  idType: z.string().trim().max(80).optional(),
  idValue: z.string().trim().max(120).optional()
});

export const accountCreateSchema = scopeSchema.extend({
  companyId: uuidSchema,
  branchId: optionalUuidSchema,
  parentId: optionalUuidSchema,
  code: z.string().trim().min(2).max(50),
  startDate: z.string().date(),
  endDate: z.string().date()
});

export const financialPeriodUpdateSchema = z.object({
  status: z.enum(["open", "locked", "closed"]),
  reason: z.string().max(1000).optional(),
  approvalRequestId: uuidSchema.optional()
});

export const openingBalanceSchema = z.object({
  ledgerId: uuidSchema,
  financialPeriodId: uuidSchema,
  openingBalance: z.coerce.number().finite(),
  approvalRequestId: uuidSchema.optional()
});

export const ledgerStatementQuerySchema = z.object({
  fromDate: z.string().date(),
  toDate: z.string().date()
});

export const trialBalanceQuerySchema = scopeSchema.extend({
  scope: ledgerScopeSchema,
  asOfDate: z.string().date()
});

export const purchaseOrderStatusSchema = z.enum(["pending", "partial", "completed", "cancelled"]);
export const purchaseOrderPaymentKindSchema = z.enum(["advance", "remaining", "credit", "booking"]);

const currencyCodeSchema = z
  .string()
  .trim()
  .length(3)
  .transform((value) => value.toUpperCase());

export const purchaseOrderCreateSchema = scopeSchema.extend({
  // Optional: callers can provide their chosen scope (Super Admin), otherwise server will infer from session.
  countryId: optionalUuidSchema,
  countryBranchId: optionalUuidSchema,
  cityBranchId: optionalUuidSchema,

  supplierCompanyId: optionalUuidSchema,
  purchaseContractNo: z.string().trim().max(120).optional(),

  currencyCode: currencyCodeSchema.default("USD"),
  paymentCurrencyCode: currencyCodeSchema.default("USD"),
  exchangeRate: z.coerce.number().finite().positive().default(1),
  orderTotal: z.coerce.number().finite().min(0).default(0),

  totalGoodsOriginal: z.coerce.number().finite().min(0).default(0),
  totalGoodsLocal: z.coerce.number().finite().min(0).default(0),
  totalGoodsUsd: z.coerce.number().finite().min(0).default(0),
  
  totalExpensesOriginal: z.coerce.number().finite().min(0).default(0),
  totalExpensesLocal: z.coerce.number().finite().min(0).default(0),
  totalExpensesUsd: z.coerce.number().finite().min(0).default(0),
  
  landedCostOriginal: z.coerce.number().finite().min(0).default(0),
  landedCostLocal: z.coerce.number().finite().min(0).default(0),
  landedCostUsd: z.coerce.number().finite().min(0).default(0),

  items: z.array(z.any()).optional(),
  expenses: z.array(z.any()).optional(),

  // Flexible payload (goods, shipping, notes, etc.) until full PO schema is modeled.
  formData: z.unknown().optional(),
  ledgerPostingStatus: z.string().optional(),
  paymentStatus: z.string().optional()
});

export const purchaseOrderUpdateSchema = purchaseOrderCreateSchema.partial().extend({
  // Allow adjusting totals and details on draft orders.
  supplierCompanyId: optionalUuidSchema,
  currencyCode: currencyCodeSchema.optional(),
  exchangeRate: z.coerce.number().finite().positive().optional(),
  orderTotal: z.coerce.number().finite().min(0).optional()
});

export const purchaseOrderPaymentPostSchema = scopeSchema.extend({
  kind: purchaseOrderPaymentKindSchema,
  entryDate: z.string().date(),
  amount: z.coerce.number().finite().positive(),
  currencyCode: currencyCodeSchema.default("USD"),
  exchangeRate: z.coerce.number().finite().positive().default(1),
  debitLedgerId: uuidSchema,
  creditLedgerId: uuidSchema,
  referenceNo: z.string().trim().max(120).optional(),
  narration: z.string().trim().max(1000).optional(),
  typeDetails: z.record(z.string(), z.unknown()).optional()
});

export const globalConsolidationQuerySchema = z.object({
  fromDate: z.string().date(),
  toDate: z.string().date()
});

export const reversalSchema = z.object({
  sourceType: z.enum(["ledger_batch", "roznamcha"]),
  sourceId: uuidSchema,
  reason: z.string().trim().min(3).max(1000),
  approvalRequestId: uuidSchema.optional()
});

export const customerContactInputSchema = z.object({
  type: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(200),
  isPrimary: z.coerce.boolean().optional()
});

export const customerRegistrationInputSchema = z.object({
  type: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(200)
});

export const customerCreateSchema = scopeSchema.extend({
  countryId: uuidSchema,
  stateProvinceId: optionalUuidSchema,
  districtId: optionalUuidSchema,
  cityId: optionalUuidSchema,
  areaLocationId: optionalUuidSchema,
  customerName: z.string().trim().min(2).max(200),
  // Many forms intentionally send `null` for empty optional fields to keep payloads explicit.
  // Accept both omitted and explicit null here.
  companyName: z.string().trim().max(200).nullable().optional(),
  contactPerson: z.string().trim().max(200).nullable().optional(),
  mobile: z.string().trim().max(50).nullable().optional(),
  whatsapp: z.string().trim().max(50).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  address: z.string().trim().max(1000).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  originalLanguage: supportedLanguageSchema.default("en"),
  contacts: z.array(customerContactInputSchema).default([]),
  registrations: z.array(customerRegistrationInputSchema).default([])
});
export const customerUpdateSchema = customerCreateSchema.partial().extend({
  countryId: uuidSchema
});

const companyContactSchema = z.object({
  id: z.string().trim().max(80).optional(),
  type: z.string().trim().max(80).optional(),
  value: z.string().trim().max(200).optional(),
  isPrimary: z.coerce.boolean().optional()
});

const companyRegistrationSchema = z.object({
  id: z.string().trim().max(80).optional(),
  type: z.string().trim().max(80).optional(),
  value: z.string().trim().max(200).optional()
});

export const companyCreateSchema = z.object({
  name: z.string().trim().min(2).max(200),
  legalName: z.string().trim().max(200).nullable().optional(),
  baseCurrency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase())
    .default("USD"),
  originalLanguage: supportedLanguageSchema.default("en"),
  ownerName: z.string().trim().max(200).nullable().optional(),
  businessType: z.string().trim().max(300).nullable().optional(),
  countryId: optionalUuidSchema,
  stateProvinceId: optionalUuidSchema,
  districtId: optionalUuidSchema,
  cityId: optionalUuidSchema,
  areaLocationId: optionalUuidSchema,
  countryName: z.string().trim().max(200).nullable().optional(),
  stateName: z.string().trim().max(200).nullable().optional(),
  districtName: z.string().trim().max(200).nullable().optional(),
  cityName: z.string().trim().max(200).nullable().optional(),
  areaName: z.string().trim().max(200).nullable().optional(),
  zipCode: z.string().trim().max(40).nullable().optional(),
  address: z.string().trim().max(1000).nullable().optional(),
  contacts: z.array(companyContactSchema).default([]),
  registrations: z.array(companyRegistrationSchema).default([]),
  ownerIds: z.array(companyRegistrationSchema).default([])
});

export const companyUpdateSchema = companyCreateSchema.partial();

export const goodsCreateSchema = z.object({
  chsCode: z.string().trim().min(2).max(100),
  goodsName: z.string().trim().min(2).max(200),
  originCountryId: uuidSchema.nullable().optional(),
  originalLanguage: supportedLanguageSchema.default("en"),
  initialVariation: z.object({
    size: z.string().trim().min(1).max(100),
    brand: z.string().trim().min(1).max(100)
  }).optional().nullable()
});

export const goodsUpdateSchema = goodsCreateSchema.partial();

export const goodsVariationCreateSchema = z.object({
  size: z.string().trim().min(1).max(100),
  brand: z.string().trim().min(1).max(100)
});

export const goodsVariationUpdateSchema = goodsVariationCreateSchema.partial().extend({
  isActive: z.boolean().optional()
});

export const chsProductCreateSchema = scopeSchema.extend({
  chsCode: z.string().trim().min(1).max(120),
  goodsName: z.string().trim().min(2).max(240),
  origin: z.string().trim().max(160).nullable().optional(),
  branch: z.string().trim().max(200).nullable().optional(),
  status: z.enum(["active", "inactive"]).default("active")
});

export const chsProductUpdateSchema = chsProductCreateSchema.partial();

export const productTranslationInputSchema = z.object({
  languageCode: supportedLanguageSchema,
  productName: z.string().trim().min(1).max(240),
  productDescription: z.string().trim().max(2000).nullable().optional(),
  productCategory: z.string().trim().max(160).nullable().optional(),
  productBrand: z.string().trim().max(160).nullable().optional(),
  productSpecifications: z.string().trim().max(4000).nullable().optional()
});

export const productCreateSchema = scopeSchema.extend({
  countryId: uuidSchema,
  stateProvinceId: optionalUuidSchema,
  districtId: optionalUuidSchema,
  cityId: optionalUuidSchema,
  countryBranchId: optionalUuidSchema,
  cityBranchId: optionalUuidSchema,
  categoryId: optionalUuidSchema,
  brandId: optionalUuidSchema,
  unitId: optionalUuidSchema,
  productCode: z.string().trim().min(2).max(100),
  sku: z.string().trim().max(120).nullable().optional(),
  productName: z.string().trim().min(2).max(240),
  productDescription: z.string().trim().max(2000).nullable().optional(),
  productSpecifications: z.record(z.string(), z.unknown()).default({}),
  hsCode: z.string().trim().max(40).nullable().optional(),
  size: z.string().trim().max(120).nullable().optional(),
  originCountryId: optionalUuidSchema,
  imageUrl: z.string().trim().url().nullable().optional(),
  originalLanguage: supportedLanguageSchema.default("en"),
  translations: z.array(productTranslationInputSchema).default([])
});

export const productUpdateSchema = productCreateSchema.partial().extend({
  countryId: uuidSchema.optional()
});

export const shipmentStatusSchema = z.enum(["draft", "booked", "in_transit", "arrived", "cleared", "delivered", "cancelled"]);

export const shippingBlRecordCreateSchema = scopeSchema.extend({
  countryId: optionalUuidSchema,
  countryBranchId: optionalUuidSchema,
  cityBranchId: optionalUuidSchema,
  purchaseOrderId: optionalUuidSchema,
  salesOrderId: optionalUuidSchema,
  loadingRecordId: optionalUuidSchema,
  roznamchaEntryId: optionalUuidSchema,
  ledgerId: optionalUuidSchema,
  shippingLineName: z.string().trim().min(2).max(200),
  blNumber: z.string().trim().min(2).max(120),
  containerNumber: z.string().trim().max(120).nullable().optional(),
  vesselName: z.string().trim().max(200).nullable().optional(),
  voyageNumber: z.string().trim().max(120).nullable().optional(),
  loadingPort: z.string().trim().max(200).nullable().optional(),
  dischargePort: z.string().trim().max(200).nullable().optional(),
  eta: z.string().date().nullable().optional(),
  etd: z.string().date().nullable().optional(),
  shipmentStatus: shipmentStatusSchema.default("draft"),
  accountNumber: z.string().trim().max(120).nullable().optional(),
  debit: z.coerce.number().finite().min(0).default(0),
  credit: z.coerce.number().finite().min(0).default(0),
  currencyCode: currencyCodeSchema.default("USD"),
});

export const shippingBlRecordUpdateSchema = shippingBlRecordCreateSchema.partial();

// ─── Bank Master ─────────────────────────────────────────────────────────────
export const bankCreateSchema = z.object({
  bankType: z.string().trim().min(1).max(80),
  accountType: z.string().trim().min(1).max(80),
  bankName: z.string().trim().min(2).max(200),
  branchName: z.string().trim().min(2).max(200),
  branchCode: z.string().trim().min(1).max(80),
  branchCodeType: z.string().trim().min(1).max(80),
  shortName: z.string().trim().min(1).max(20),
  accountTitle: z.string().trim().min(2).max(200),
  accountNumber: z.string().trim().min(2).max(120),
  ibanNumber: z.preprocess((val) => (val === "" || val === undefined ? null : val), z.string().trim().max(34).nullable().optional()),
  currency: z.string().trim().length(3).transform((v) => v.toUpperCase()),
  accountStatus: z.enum(["Active", "Inactive", "Frozen", "Closed"]).default("Active"),
  countryId: optionalUuidSchema,
  stateProvinceId: optionalUuidSchema,
  districtId: optionalUuidSchema,
  cityId: optionalUuidSchema,
  fullAddress: z.preprocess((val) => (val === "" || val === undefined ? null : val), z.string().trim().max(500).nullable().optional()),
  phone: z.preprocess((val) => (val === "" || val === undefined ? null : val), z.string().trim().max(50).nullable().optional()),
  email: z.preprocess((val) => (val === "" || val === undefined ? null : val), z.string().trim().email().nullable().optional()),
  swiftBic: z.preprocess((val) => (val === "" || val === undefined ? null : val), z.string().trim().max(20).nullable().optional()),
  website: z.preprocess((val) => (val === "" || val === undefined ? null : val), z.string().trim().max(255).nullable().optional()),
  remarks: z.preprocess((val) => (val === "" || val === undefined ? null : val), z.string().trim().max(2000).nullable().optional())
});

export const bankUpdateSchema = bankCreateSchema.partial();

// ─── Missing Schemas ─────────────────────────────────────────────────────────

export const accountUpdateSchema = scopeSchema.partial().extend({
  branchId: optionalUuidSchema,
  parentId: optionalUuidSchema,
  code: z.string().trim().min(2).max(50).optional(),
  name: z.string().trim().min(2).max(200).optional(),
  kind: accountKindSchema.optional(),
  currency: z.string().trim().length(3).transform((v) => v.toUpperCase()).optional(),
  status: z.string().trim().max(80).optional(),
  isControlAccount: z.coerce.boolean().optional(),
  approvalRequestId: optionalUuidSchema,
  customerId: optionalUuidSchema,
  companyId: optionalUuidSchema,
  bankId: optionalUuidSchema,
  contacts: z.array(z.object({ type: z.string(), value: z.string() })).optional()
});

export const enterpriseAccountCreateSchema = scopeSchema.extend({
  scope: ledgerScopeSchema,
  parentId: optionalUuidSchema,
  code: z.string().trim().min(2).max(120),
  manualReferenceNumber: z.string().trim().max(120).optional().nullable(),
  name: z.string().trim().min(2).max(200),
  kind: accountKindSchema,
  currency: z.string().trim().length(3).transform((v) => v.toUpperCase()),
  openingBalance: z.coerce.number().finite().default(0),
  isControlAccount: z.coerce.boolean().default(false),
  customerId: optionalUuidSchema,
  companyId: optionalUuidSchema,
  bankId: optionalUuidSchema,
  status: z.string().trim().max(80).optional(),
  contacts: z.array(z.object({ type: z.string(), value: z.string() })).default([])
});

export const enterpriseLedgerCreateSchema = scopeSchema.extend({
  scope: ledgerScopeSchema,
  enterpriseAccountId: optionalUuidSchema,
  parentLedgerId: optionalUuidSchema,
  code: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(200),
  currency: z.string().trim().length(3).transform((v) => v.toUpperCase()),
  openingBalance: z.coerce.number().finite().default(0),
  normalBalance: normalBalanceSchema
});

export const financialPeriodCreateSchema = scopeSchema.extend({
  scope: ledgerScopeSchema,
  periodName: z.string().trim().min(2).max(120),
  startDate: z.string().date(),
  endDate: z.string().date()
});

// ─── Port Masters ────────────────────────────────────────────────────────────
export const portCreateSchema = z.object({
  portName: z.string().trim().min(2).max(200),
  countryId: optionalUuidSchema,
  portCode: z.preprocess((val) => (val === "" || val === undefined ? null : val), z.string().trim().max(80).nullable().optional()),
  transportType: z.enum(["sea", "road", "air"]).default("sea"),
  isActive: z.boolean().default(true)
});

export const portUpdateSchema = portCreateSchema.partial();



