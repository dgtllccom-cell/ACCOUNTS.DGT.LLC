type AnyRow = Record<string, any>;

export const purchaseStockDestinations = ["warehouse", "in-transit", "export", "re-export", "local-sale"] as const;
export type PurchaseStockDestination = (typeof purchaseStockDestinations)[number];

export const purchaseStockStages = [
  "booking",
  "remaining",
  "land",
  "in-transit",
  "warehouse",
  "export",
  "re-export",
  "local-sale"
] as const;

export type PurchaseStockStage = (typeof purchaseStockStages)[number];

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function extractTotalQuantity(order: AnyRow) {
  const formData = order?.form_data ?? {};
  const form = formData?.form ?? {};
  const goods = Array.isArray(formData?.goodsEntries) ? formData.goodsEntries : [];

  return toNumber(
    order?.total_quantity ??
      order?.form_data?.workflow?.totalQuantity ??
      formData?.totals?.totalQuantity ??
      goods.reduce((sum: number, item: AnyRow) => sum + toNumber(item.qtyNo ?? item.quantity ?? item.qty ?? 0), 0) ??
      form?.qtyNo ??
      form?.quantity ??
      0
  );
}

function extractLoadedQuantity(record: AnyRow) {
  const payload = record?.report_payload ?? {};
  return toNumber(
    record?.loaded_quantity ??
      payload?.loadedQuantity ??
      payload?.loadingQuantity ??
      payload?.currentLoadedQuantity ??
      0
  );
}

function extractPaymentProof(order: AnyRow) {
  const paymentStatus = normalize(order?.payment_status ?? order?.form_data?.workflow?.paymentStatus);
  const remainingDue = toNumber(order?.remaining_due ?? order?.form_data?.workflow?.remainingDue);
  const advancePaid = toNumber(order?.advance_paid ?? order?.form_data?.workflow?.advancePaid);

  return {
    complete: paymentStatus === "completed" || paymentStatus === "paid" || remainingDue <= 0 || advancePaid > 0 && remainingDue <= 0,
    paymentStatus,
    remainingDue,
    advancePaid
  };
}

function extractLatestLifecycleStage(records: AnyRow[]) {
  const ordered = [...records].sort((a, b) => {
    const aTime = new Date(a?.updated_at || a?.created_at || 0).getTime();
    const bTime = new Date(b?.updated_at || b?.created_at || 0).getTime();
    return bTime - aTime;
  });
  const latest = ordered[0];
  const payload = latest?.report_payload ?? {};
  const stage = normalize(payload?.lifecycleStage || payload?.stockStage || payload?.destinationStage || latest?.shipment_status || latest?.loading_status);
  const nextDestination = normalize(payload?.nextDestination || payload?.destination || payload?.stockDestination);
  return { latest, stage, nextDestination, payload };
}

export function normalizePurchaseStockDestination(value: unknown): PurchaseStockDestination | null {
  const normalized = normalize(value);
  if (normalized === "warehouse") return "warehouse";
  if (normalized === "in-transit" || normalized === "in transit" || normalized === "transit") return "in-transit";
  if (normalized === "export") return "export";
  if (normalized === "re-export" || normalized === "reexport" || normalized === "re export") return "re-export";
  if (normalized === "local-sale" || normalized === "local sale" || normalized === "delivered") return "local-sale";
  return null;
}

export function purchaseStockDestinationLabel(value: unknown): string {
  const normalized = normalizePurchaseStockDestination(value);
  if (normalized === "warehouse") return "Warehouse";
  if (normalized === "in-transit") return "In Transit";
  if (normalized === "export") return "Export";
  if (normalized === "re-export") return "Re-export";
  if (normalized === "local-sale") return "Local Sale / Delivered";
  return "Land / In Transit";
}

export function derivePurchaseStockLifecycle(order: AnyRow, loadingRecords: AnyRow[] = []) {
  const totalQuantity = extractTotalQuantity(order);
  const totalLoadedQuantity = loadingRecords.reduce((sum, record) => sum + extractLoadedQuantity(record), 0);
  const remainingQuantity = Math.max(0, totalQuantity - totalLoadedQuantity);
  const payment = extractPaymentProof(order);
  const { latest, stage, nextDestination, payload } = extractLatestLifecycleStage(loadingRecords);
  const destination = normalizePurchaseStockDestination(nextDestination || payload?.destinationType || payload?.stockDestination);
  const hasLoading = totalLoadedQuantity > 0;

  let currentStage: PurchaseStockStage = "booking";
  if (destination) {
    currentStage = destination;
  } else if (stage === "land") {
    currentStage = "land";
  } else if (stage === "in-transit" || stage === "in_transit" || stage === "transit") {
    currentStage = "in-transit";
  } else if (stage === "remaining" || stage === "loading" || stage === "loaded" || stage === "received" || hasLoading) {
    currentStage = payment.complete ? "land" : "remaining";
  } else if (payment.complete) {
    currentStage = "land";
  }

  const nextStage: PurchaseStockStage = currentStage === "booking"
    ? "remaining"
    : currentStage === "remaining"
      ? "land"
      : currentStage === "land"
        ? (destination || "in-transit")
        : currentStage;

  const proofComplete = Boolean(
    payment.complete &&
    (currentStage === "warehouse" || currentStage === "export" || currentStage === "re-export" || currentStage === "local-sale")
  );

  return {
    totalQuantity,
    totalLoadedQuantity,
    remainingQuantity,
    paymentProofComplete: payment.complete,
    paymentStatus: payment.paymentStatus,
    remainingDue: payment.remainingDue,
    advancePaid: payment.advancePaid,
    hasLoading,
    latestLoadingRecordId: latest?.id ?? null,
    lifecycleStage: currentStage,
    nextStage,
    destination,
    destinationLabel: purchaseStockDestinationLabel(destination ?? nextStage),
    nextDestinationLabel: purchaseStockDestinationLabel(nextStage),
    proofComplete,
    visualStatus: proofComplete ? "black" : "red",
    statusLabel: proofComplete ? "BLACK" : "RED",
    statusReason: proofComplete
      ? "Payment proof and destination stock proof are complete."
      : payment.complete
        ? "Payment proof is complete but the stock has not reached its destination stage yet."
        : "Payment proof is still pending or incomplete."
  };
}
