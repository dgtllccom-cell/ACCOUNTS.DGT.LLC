"use client";

import React, { useState } from "react";
import { Package, Layers, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type GoodItemSummary = {
  goodsName?: string;
  name?: string;
  productName?: string;
  grade?: string;
  origin?: string;
  qtyNo?: number | string;
  quantity?: number | string;
  unit?: string;
  grossWeight?: number | string;
  netWeight?: number | string;
  rate?: number | string;
  unitPrice?: number | string;
  totalAmount?: number | string;
};

export interface GoodsPopoverCellProps {
  goods: GoodItemSummary[] | string;
  fallbackName?: string;
  className?: string;
  textColorClass?: string;
  maxDisplayLength?: number;
}

export function GoodsPopoverCell({
  goods,
  fallbackName = "-",
  className,
  textColorClass,
  maxDisplayLength = 28
}: GoodsPopoverCellProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Normalize goods list
  const goodsList: GoodItemSummary[] = Array.isArray(goods)
    ? goods
    : typeof goods === "string" && goods.trim() && goods !== "-"
    ? goods.split(",").map((name) => ({ goodsName: name.trim() }))
    : [];

  const rawFallback = fallbackName && fallbackName !== "-" ? fallbackName : "";
  if (goodsList.length === 0 && rawFallback) {
    goodsList.push({ goodsName: rawFallback });
  }

  if (goodsList.length === 0) {
    return <span className={cn("text-slate-400 font-normal", className)}>-</span>;
  }

  const firstItemName = goodsList[0]?.goodsName || goodsList[0]?.productName || goodsList[0]?.name || "Goods Item";
  const otherCount = goodsList.length - 1;
  const fullText = goodsList.map((g) => g.goodsName || g.productName || g.name).filter(Boolean).join(", ");

  return (
    <div
      className={cn("relative inline-block text-left group cursor-pointer max-w-[260px]", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={fullText}
    >
      {/* Compact In-Cell View */}
      <div className="flex items-center gap-1.5 py-0.5">
        <span
          className={cn(
            "font-extrabold text-[11px] truncate max-w-[170px] inline-block",
            textColorClass || "text-slate-900 dark:text-slate-100"
          )}
        >
          {firstItemName}
        </span>

        {otherCount > 0 ? (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border border-blue-300 dark:border-blue-700 whitespace-nowrap shadow-2xs">
            +{otherCount} more
          </span>
        ) : null}
      </div>

      {/* Rich Hover Popover Message Box */}
      <div
        className={cn(
          "absolute left-0 top-full z-50 mt-1 w-80 rounded-xl bg-slate-900 text-white p-3 shadow-2xl border border-slate-700 pointer-events-none transition-all duration-200 ease-out origin-top-left",
          isHovered ? "opacity-100 scale-100 visible" : "opacity-0 scale-95 invisible"
        )}
        style={{ minWidth: "280px" }}
      >
        {/* Popover Header */}
        <div className="flex items-center justify-between border-b border-slate-700 pb-2 mb-2">
          <div className="flex items-center gap-1.5 font-bold text-xs text-blue-400">
            <Package className="h-3.5 w-3.5 text-blue-400" />
            <span>Goods & Cargo Details ({goodsList.length} Items)</span>
          </div>
          <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
            Hover Info
          </span>
        </div>

        {/* Goods List Breakdown */}
        <div className="max-h-60 overflow-y-auto space-y-2 text-[10px] scrollbar-thin scrollbar-thumb-slate-700">
          {goodsList.map((item, idx) => {
            const itemName = item.goodsName || item.productName || item.name || `Item #${idx + 1}`;
            const qty = item.qtyNo || item.quantity;
            const netWt = item.netWeight;
            const grossWt = item.grossWeight;
            const rate = item.rate || item.unitPrice;
            const grade = item.grade;
            const origin = item.origin;

            return (
              <div
                key={idx}
                className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60 flex flex-col gap-1"
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="font-extrabold text-slate-100 flex items-center gap-1">
                    <span className="text-blue-400 font-mono text-[9px]">{idx + 1}.</span>
                    {itemName}
                  </span>
                  {grade && (
                    <span className="text-[8px] bg-blue-950 text-blue-300 border border-blue-800 px-1 py-0.2 rounded font-semibold whitespace-nowrap">
                      {grade}
                    </span>
                  )}
                </div>

                {(qty || netWt || grossWt || rate || origin) && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-slate-300 border-t border-slate-700/40 pt-1 mt-0.5">
                    {qty && (
                      <span>
                        <strong className="text-slate-400">Qty:</strong> {qty} {item.unit || "CTN"}
                      </span>
                    )}
                    {netWt && (
                      <span>
                        <strong className="text-slate-400">Net Wt:</strong> {Number(netWt).toLocaleString()} KG
                      </span>
                    )}
                    {grossWt && (
                      <span>
                        <strong className="text-slate-400">Gross:</strong> {Number(grossWt).toLocaleString()} KG
                      </span>
                    )}
                    {rate && (
                      <span>
                        <strong className="text-slate-400">Rate:</strong> ${rate}
                      </span>
                    )}
                    {origin && (
                      <span>
                        <strong className="text-slate-400">Origin:</strong> {origin}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Popover Footer */}
        <div className="mt-2 pt-1.5 border-t border-slate-800 text-[8.5px] text-slate-400 flex justify-between items-center">
          <span>Digital Dock ERP Cargo System</span>
          <span className="text-blue-400 font-semibold">{goodsList.length} Total Registered Goods</span>
        </div>
      </div>
    </div>
  );
}
