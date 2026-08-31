import type { SupportedLanguage } from "@/lib/i18n/languages";

export const BEI_SOURCE_MODULES = ["purchase_booking", "sales_booking", "local_purchase", "local_sales"] as const;
export type BeiSourceModule = (typeof BEI_SOURCE_MODULES)[number];

export const BEI_DOC_TYPES = ["commercial_invoice", "proforma_invoice", "export_invoice", "packing_list"] as const;
export type BeiDocType = (typeof BEI_DOC_TYPES)[number];

export type BeiStatus = "draft" | "finalized" | "void";

export type BeiParty = {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
  country?: string | null;
};

export type BeiLine = {
  id?: string;
  sortOrder: number;
  goodsName?: string | null;
  description?: string | null;
  hsCode?: string | null;
  brand?: string | null;
  size?: string | null;
  packing?: string | null;
  packages?: number | null;
  quantity?: number | null;
  unit?: string | null;
  netWeight?: number | null;
  grossWeight?: number | null;
  /** frozen from the source bill */
  originalUnitPrice?: number | null;
  originalAmount?: number | null;
  /** editable document values */
  documentUnitPrice?: number | null;
  documentAmount?: number | null;
};

export type BeiInvoice = {
  id: string;
  invoiceNo: string;

  sourceModule: BeiSourceModule;
  sourceId: string;
  sourceTable: string;
  originalBillNo?: string | null;
  originalManualBillNo?: string | null;
  originalBillDate?: string | null;
  originalCurrency?: string | null;
  originalExchangeRate?: number | null;
  originalTotalValue?: number | null;

  docType: BeiDocType;
  documentNo?: string | null;
  documentDate?: string | null;
  documentCurrency?: string | null;
  documentExchangeRate?: number | null;
  documentTotalValue?: number | null;

  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  companyId?: string | null;

  txnKind: "purchase" | "sales";
  tradeScope: "local" | "international";
  partyName?: string | null;
  partyDetails: BeiParty;
  consignee?: BeiParty | null;
  notifyParty?: BeiParty | null;
  seller?: BeiParty | null;
  buyer?: BeiParty | null;

  destination?: string | null;
  incoterms?: string | null;
  paymentTerms?: string | null;
  transport?: Record<string, unknown> | null;
  bank?: Record<string, unknown> | null;
  referenceNos: Record<string, string | null>;
  notes?: string | null;
  validity?: string | null;
  signatureName?: string | null;
  headerFields: Record<string, unknown>;

  originalLanguageCode: SupportedLanguage;
  status: BeiStatus;
  versionNo: number;

  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;

  lines: BeiLine[];

  // attached by getInvoice for the client
  canEdit?: boolean;
  isManager?: boolean;
};

export type BeiAvailableBill = {
  sourceModule: BeiSourceModule;
  sourceId: string;
  sourceTable: string;
  billNo?: string | null;
  manualBillNo?: string | null;
  billDate?: string | null;
  transactionDate?: string | null;
  countryId?: string | null;
  countryName?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  branchLabel?: string | null;
  partyName?: string | null;
  currency?: string | null;
  originalBillAmount: number;
  sourceStatus?: string | null;
  existingInvoiceCount: number;
};

export type CreateBeiInput = {
  sourceModule: BeiSourceModule;
  sourceId: string;
  docType?: BeiDocType;
  lang?: SupportedLanguage;
};
