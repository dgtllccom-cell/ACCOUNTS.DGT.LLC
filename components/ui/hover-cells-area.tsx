"use client";

import React, { useRef, type HTMLAttributes } from "react";
import { useCellHoverTitles } from "@/lib/ui/use-cell-hover-titles";

/**
 * A plain <div> wrapper: every row cell (tbody td) of any table inside it shows its complete data in a
 * message bubble on hover. Drop-in replacement for a table's scroll/border wrapper div.
 */
export function HoverCellsArea({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement | null>(null);
  useCellHoverTitles(ref);
  return (
    <div ref={ref} data-hover-cells="" {...props}>
      {children}
    </div>
  );
}
