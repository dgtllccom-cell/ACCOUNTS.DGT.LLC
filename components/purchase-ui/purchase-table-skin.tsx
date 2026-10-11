import type { ReactNode } from "react";
import "./purchase-table-skin.css";

/** Wrapper only: the page's ORIGINAL table JSX goes in `children` untouched; this adds the scoped visual skin class. */
export function PurchaseTableSkin({ children }: { children: ReactNode }) {
  return <div className="dgt-purchase-table-skin">{children}</div>;
}
