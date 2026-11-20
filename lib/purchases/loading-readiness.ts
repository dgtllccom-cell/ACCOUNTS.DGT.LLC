/**
 * Why a saved purchase bill is not in the Loading queue yet — a display hint only; no rule is changed here.
 *
 * Loading queues accept a bill only after Transfer & Post (Purchase Booking: app/api/erp/purchases/loading-records,
 * Local Purchase: …/local-purchase/destination-stage). After that, the payment rules decide:
 * credit / final / cash go straight to Loading, advance waits until the advance is paid
 * (lib/services/purchase-calculation-service.ts resolveLoadingEligibility, lib/purchases/local-purchase-loading-rules.ts).
 */
export type LoadingReadinessNote = "transfer_first" | "transfer_then_advance" | null;

export function loadingReadinessNote(input: { saved: boolean; posted: boolean; paymentTerms: string | null | undefined }): LoadingReadinessNote {
  if (!input.saved || input.posted) return null;
  const terms = String(input.paymentTerms ?? "").trim().toLowerCase();
  if (terms.includes("advance") || terms.includes("endorsement")) return "transfer_then_advance";
  return "transfer_first";
}
