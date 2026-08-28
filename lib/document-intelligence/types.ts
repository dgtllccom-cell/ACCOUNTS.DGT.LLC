/**
 * AI Document Intake — shared types.
 *
 * The provider-adapter contract. `local` is the default + complete path
 * (pdf-parse for digital PDFs, tesseract.js WASM OCR for scans/photos, sharp for
 * pre-processing). An approved external provider can implement the same
 * interface later without changing any caller.
 */

export type OperationalDomain = "business" | "shipping";

export type OcrPage = {
  pageNumber: number;
  text: string;
  width?: number;
  height?: number;
  rotationApplied?: number;
  wordBoxes?: Array<{ text: string; x: number; y: number; w: number; h: number; confidence: number }>;
};

export type IngestResult = {
  engine: string;                 // e.g. "pdf-parse", "tesseract.js@eng+ara"
  isDigital: boolean;             // true = text layer used, no OCR
  pageCount: number;
  fullText: string;
  pages: OcrPage[];
  languageDetected: string | null;
  ocrMs: number;
  meanConfidence: number | null;  // 0..1 for OCR pages
};

export type FieldCandidate = {
  key: string;
  label: string;
  rawValue: string | null;
  normalizedValue: string | null;
  confidence: number;             // 0..1
  pageNumber: number | null;
  bbox: { x: number; y: number; w: number; h: number } | null;
  validationStatus: "green" | "amber" | "red";
  validationMessage: string | null;
};

export type LineItemCandidate = {
  lineNo: number;
  description: string | null;
  hsCode: string | null;
  brand: string | null;
  quantity: number | null;
  unit: string | null;
  packages: number | null;
  grossWeight: number | null;
  netWeight: number | null;
  unitPrice: number | null;
  amount: number | null;
  currency: string | null;
  confidence: number;
  pageNumber: number | null;
};

export type ClassificationResult = {
  code: string;
  name: string;
  confidence: number;             // 0..1
  domain: "business" | "shipping" | "both";
  category: string;
  targetModule: string | null;
  requiresQvc: boolean;
  scores: Array<{ code: string; score: number }>;
};

export type ExtractionResult = {
  fields: FieldCandidate[];
  lineItems: LineItemCandidate[];
  summary: Record<string, string | number | null>;
};

export type RegistryDocType = {
  code: string;
  name: string;
  operational_domain: "business" | "shipping" | "both";
  category: string;
  target_module: string | null;
  classifier_keywords: string[];
  min_confidence: number;
  requires_qvc: boolean;
  expected_fields: Array<{ key: string; label: string; required?: boolean }>;
};

export interface DocumentAiProvider {
  readonly name: string;
  /** OCR / text-layer extraction + light pre-processing. */
  ingest(input: { buffer: Buffer; mimeType: string; filename: string }): Promise<IngestResult>;
  /** Rule/model classification against the document type registry. */
  classify(text: string, registry: RegistryDocType[], domainHint?: OperationalDomain | null): Promise<ClassificationResult>;
  /** Field + line-item extraction for a given document type. */
  extract(input: { text: string; pages: OcrPage[]; docType: RegistryDocType }): Promise<ExtractionResult>;
}
