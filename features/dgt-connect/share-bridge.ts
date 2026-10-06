"use client";

import type { DgtSharedRecord } from "@/lib/dgt-connect/types";

/**
 * Fire-and-forget bridge so any ERP screen can push a record into DGT Connect
 * without importing the widget. The mounted widget listens for this event,
 * opens itself and lets the user pick a conversation.
 *
 *   import { shareToDgtConnect } from "@/features/dgt-connect/share-bridge";
 *   shareToDgtConnect({ module: "purchase_order", id: po.id,
 *     label: `PO ${po.purchase_order_no}`, route: `/dashboard/purchase/...`,
 *     summary: `${po.currency} ${po.order_total}` });
 */
export const DGT_SHARE_EVENT = "dgt-connect:share";

export function shareToDgtConnect(record: DgtSharedRecord) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DGT_SHARE_EVENT, { detail: record }));
}
