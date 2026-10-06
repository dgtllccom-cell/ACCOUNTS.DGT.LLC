import { validatePintAe } from "@/lib/services/einvoice/pint-ae-mapper";
import type {
  AspAdapter,
  AspContext,
  AspDocumentType,
  AspStatusResult,
  AspSubmitResult,
  AspValidationResult,
} from "@/lib/services/asp/asp-adapter";

/**
 * Deterministic mock ASP for development and end-to-end testing. It exercises
 * the whole pipeline (validate -> submit -> status -> retry -> dedup) without a
 * real accredited provider. Behaviour is driven by markers in the payload so
 * tests can assert each path:
 *   - buyer_trn ending "REJECT"  -> submit returns rejected
 *   - buyer_trn ending "ERROR"   -> submit throws (retry_required)
 *   - anything else               -> submitted -> processing -> completed
 */
export class MockAspAdapter implements AspAdapter {
  readonly name = "mock";

  async validate(payload: unknown, _ctx: AspContext): Promise<AspValidationResult> {
    const errors = validatePintAe(payload);
    return { valid: errors.length === 0, errors };
  }

  async submit(payload: unknown, _docType: AspDocumentType, _ctx: AspContext): Promise<AspSubmitResult> {
    const p = payload as any;
    const buyerTrn = String(
      p?.buyer?.trn ?? p?.accountingCustomerParty?.party?.partyTaxScheme?.[0]?.companyId ?? "",
    );
    const ref = `MOCK-${Date.now().toString(36).toUpperCase()}`;

    if (buyerTrn.toUpperCase().endsWith("ERROR")) {
      throw new Error("Mock ASP: transient network error");
    }
    if (buyerTrn.toUpperCase().endsWith("REJECT")) {
      return { accepted: false, aspReference: ref, status: "rejected", message: "Mock ASP: buyer TRN not registered" };
    }
    return { accepted: true, aspReference: ref, status: "submitted", message: "Mock ASP: accepted for processing", raw: { ref } };
  }

  async getStatus(aspReference: string, _ctx: AspContext): Promise<AspStatusResult> {
    // Advance one step each poll based on a cheap hash of the reference + minute.
    const tick = (aspReference.length + new Date().getMinutes()) % 3;
    const status = (["processing", "delivered", "completed"] as const)[tick];
    return { status, aspReference, message: `Mock ASP: ${status}` };
  }

  async cancel(aspReference: string): Promise<{ cancelled: boolean; message?: string }> {
    return { cancelled: true, message: `Mock ASP: ${aspReference} cancelled` };
  }
}
