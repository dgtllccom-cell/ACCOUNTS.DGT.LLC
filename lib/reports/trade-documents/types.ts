import type { DocumentBranding } from "@/lib/reports/resolve-document-branding";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export type TradeDocType =
  | "commercial_invoice"
  | "export_invoice"
  | "packing_list"
  | "proforma_invoice"
  | "contract"
  // 2026-11 additions: Purchase / Sales / Tax invoices. Share the shared builder so every template renders them automatically.
  | "purchase_invoice"
  | "sales_invoice"
  | "tax_invoice"
  | "purchase_order";
export type TradeTxnKind = "purchase" | "sales";
export type TradeScope = "international" | "local";

export type TradeParty = {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
  country?: string | null;
};

export type TradeLineItem = {
  description?: string | null;
  hsCode?: string | null;
  brand?: string | null;
  size?: string | null;
  packing?: string | null;
  packages?: number | null;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  netWeight?: number | null;
  grossWeight?: number | null;
  amount?: number | null;
  /** optional — only populated when present on the source line; never fabricated */
  discount?: number | null;
  taxAmount?: number | null;
};

export type BeneficiaryBank = {
  bankName?: string | null;
  branchName?: string | null;
  accountTitle?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  swift?: string | null;
  currency?: string | null;
  address?: string | null;
};

export type TradeTransport = {
  mode?: string | null;
  vessel?: string | null;
  voyage?: string | null;
  portOfLoading?: string | null;
  loadingCountry?: string | null;
  portOfDischarge?: string | null;
  dischargeCountry?: string | null;
  placeOfDelivery?: string | null;
  finalDestination?: string | null;
  shippingLine?: string | null;
  blNumber?: string | null;
  containers?: string[] | null;
  containerSize?: string | null;
  marks?: string | null;
  etd?: string | null;
  eta?: string | null;
};

export type TradeDocumentInput = {
  docType: TradeDocType;
  txnKind: TradeTxnKind;
  tradeScope: TradeScope;
  lang: SupportedLanguage;
  branding: DocumentBranding;

  docNo: string;
  docDate?: string | null;
  referenceNos?: {
    contract?: string | null;
    po?: string | null;
    so?: string | null;
    invoice?: string | null;
    quotation?: string | null;
    booking?: string | null;
  };

  /** seller / shipper (the party issuing goods) */
  seller: TradeParty;
  /** buyer / consignee */
  buyer: TradeParty;
  notifyParty?: TradeParty | null;

  delivery?: {
    incoterms?: string | null;
    paymentTerms?: string | null;
    deliveryTerms?: string | null;
  };

  transport?: TradeTransport | null;

  goods: TradeLineItem[];

  currency: string;
  /** frozen historical rate from the source record — never invented here */
  exchangeRate?: number | null;
  functionalCurrency?: string | null;

  totals?: {
    totalPackages?: number | null;
    totalQuantity?: number | null;
    totalNetWeight?: number | null;
    totalGrossWeight?: number | null;
    subTotal?: number | null;
    taxAmount?: number | null;
    freight?: number | null;
    insurance?: number | null;
    grandTotal?: number | null;
    advanceAmount?: number | null;
    balanceAmount?: number | null;
  };

  bank?: BeneficiaryBank | null;

  validity?: string | null;
  notes?: string | null;
  signatureName?: string | null;
  /** Public invoice link encoded as the document's QR code (set when the document is printed). */
  publicUrl?: string | null;

  /** critical fields the source record was missing — surfaced to the user, not faked */
  missingFields?: string[];

  orientation?: "portrait" | "landscape";
  /**
   * Presentation only. "uae_tax" is the local-sales tax layout (proforma / tax invoice with VAT columns and a
   * tax summary). It is set from the source record (a local sale), never guessed from the amounts.
   */
  layout?: "standard" | "uae_tax";
  autoPrint?: boolean;
};
