/** Navigation after a successful POST only. This never posts or allocates money. */
export async function afterPurchasePayment({ mode, fromLoading, hasOrder, refresh, navigate }: {
  mode: string;
  fromLoading: boolean;
  hasOrder: boolean;
  refresh: () => Promise<void>;
  navigate: (path: string) => void;
}) {
  // Loading is the source of a Remaining entry, not its return destination.
  // Both partial and final installments stay here and reload authoritative due/history.
  if (mode !== "remaining" && (fromLoading || (mode === "advance" && hasOrder))) {
    setTimeout(() => navigate("/dashboard/purchase/purchase-loading-records"), 1200);
    return;
  }
  await refresh();
}
