/** Navigation after a successful POST only. This never posts or allocates money. */
export async function afterPurchasePayment({ mode, fromLoading, hasOrder, refresh, navigate, returnToRegister }: {
  mode: string;
  fromLoading: boolean;
  hasOrder: boolean;
  refresh: () => Promise<void>;
  navigate: (path: string) => void;
  returnToRegister: () => void;
}) {
  // Loading is the source of a Remaining entry, not its return destination.
  // Both partial and final installments return to its register, then reload due/history.
  if (mode !== "remaining" && (fromLoading || (mode === "advance" && hasOrder))) {
    setTimeout(() => navigate("/dashboard/purchase/purchase-loading-records"), 1200);
    return;
  }
  if (mode === "remaining") returnToRegister();
  await refresh();
}

/** Remove entry-only hints while retaining register filters, language and hash. */
export function purchasePaymentRegisterUrl(href: string) {
  const url = new URL(href);
  for (const key of ["purchaseOrderNo", "fromLoading", "loadingRecordId"]) url.searchParams.delete(key);
  return `${url.pathname}${url.search}${url.hash}`;
}
