/**
 * ASP (Accredited Service Provider) adapter contract for UAE e-Invoicing.
 *
 * The ERP is NOT hard-coded to one ASP. Every accredited provider implements
 * this interface; the active provider is chosen per tax entity from
 * uae_asp_credentials. Secrets never leave the server — an adapter receives a
 * `secretRef` and resolves it from the server-side secret store itself.
 */

export type AspDocumentType = "tax_invoice" | "tax_credit_note" | "commercial_invoice" | "self_billed";

export interface AspValidationResult {
  valid: boolean;
  errors: Array<{ code: string; message: string; path?: string }>;
}

export interface AspSubmitResult {
  accepted: boolean;
  aspReference?: string;
  status: "submitted" | "processing" | "delivered" | "completed" | "rejected" | "error";
  message?: string;
  raw?: unknown;
}

export interface AspStatusResult {
  status: "submitted" | "processing" | "delivered" | "completed" | "rejected" | "error" | "retry_required";
  aspReference?: string;
  message?: string;
  raw?: unknown;
}

export interface AspContext {
  provider: string;
  mode: "mock" | "sandbox" | "production";
  endpoint?: string;
  secretRef?: string;
  taxEntityTrn: string;
}

export interface AspAdapter {
  readonly name: string;
  /** Structural + business validation of a PINT-AE payload before submission. */
  validate(payload: unknown, ctx: AspContext): Promise<AspValidationResult>;
  /** Submit a validated PINT-AE document to the UAE e-Invoicing network. */
  submit(payload: unknown, docType: AspDocumentType, ctx: AspContext): Promise<AspSubmitResult>;
  /** Poll the delivery/clearance status of a previously submitted document. */
  getStatus(aspReference: string, ctx: AspContext): Promise<AspStatusResult>;
  /** Best-effort cancellation (not always supported by the network). */
  cancel?(aspReference: string, ctx: AspContext): Promise<{ cancelled: boolean; message?: string }>;
}
