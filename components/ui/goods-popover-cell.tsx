"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Package, X, Layers, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

export type GoodItemSummary = {
  id?: string | number;
  goodsName?: string;
  name?: string;
  productName?: string;
  grade?: string;
  brand?: string;
  origin?: string;
  size?: string;
  qtyNo?: number | string;
  quantity?: number | string;
  unit?: string;
  qtyName?: string;
  grossWeight?: number | string;
  netWeight?: number | string;
  rate?: number | string;
  unitPrice?: number | string;
  coursePrice?: number | string;
  price?: number | string;
  totalAmount?: number | string;
  finalAmount?: number | string;
};

export interface GoodsPopoverCellProps {
  goods: GoodItemSummary[] | string;
  fallbackName?: string;
  className?: string;
  textColorClass?: string;
  maxDisplayLength?: number;
  maxWidthClass?: string;
}

export function GoodsPopoverCell({
  goods,
  fallbackName = "-",
  className,
  textColorClass,
  maxDisplayLength = 24,
  maxWidthClass = "max-w-[180px]"
}: GoodsPopoverCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const lang = useActiveLanguage();
  const isRtl = lang === "ur" || lang === "ar" || lang === "fa" || lang === "ps";
  const gt = (key: string, fallback: string) => t(lang, ("gpc." + key) as never, fallback);

  // Normalize goods list into individual item entries
  const goodsList: GoodItemSummary[] = useMemo(() => {
    if (Array.isArray(goods) && goods.length > 0) {
      return goods;
    }
    if (typeof goods === "string" && goods.trim() && goods !== "-" && goods !== "—") {
      return goods
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => ({ goodsName: name }));
    }
    const rawFallback = fallbackName && fallbackName !== "-" && fallbackName !== "—" ? fallbackName.trim() : "";
    if (rawFallback) {
      return [{ goodsName: rawFallback }];
    }
    return [];
  }, [goods, fallbackName]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = Math.min(360, typeof window !== "undefined" ? window.innerWidth - 24 : 360);

    // Compute top: default below the field
    let top = rect.bottom + 6;
    let maxHeight = typeof window !== "undefined" ? window.innerHeight - top - 16 : 400;

    // Flip above if tight at bottom and enough space above
    if (maxHeight < 180 && rect.top > 220) {
      top = Math.max(12, rect.top - 380);
      maxHeight = rect.top - 20;
    }

    // Clamp horizontally to stay within viewport
    let left = isRtl ? rect.right - tooltipWidth : rect.left;
    if (typeof window !== "undefined") {
      if (left + tooltipWidth > window.innerWidth - 12) {
        left = window.innerWidth - tooltipWidth - 12;
      }
      if (left < 12) {
        left = 12;
      }
    }

    setCoords({
      top: Math.max(8, top),
      left,
      width: tooltipWidth,
      maxHeight: Math.max(180, maxHeight)
    });
  }, [isRtl]);

  const handleOpen = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    updatePosition();
    setIsOpen(true);
  }, [updatePosition]);

  const handleClose = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsOpen(false);
  }, []);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      handleOpen();
    }, 120);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 180);
  };

  // Close when tapping/clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  if (goodsList.length === 0) {
    return <span className={cn("text-slate-400 font-normal", className)}>—</span>;
  }

  // Display only the primary goods name in the compact field
  const firstItem = goodsList[0];
  const primaryName = firstItem?.goodsName || firstItem?.productName || firstItem?.name || gt("goods_item", "Goods Item");
  const otherCount = goodsList.length - 1;
  const fullText = goodsList.map((g) => g.goodsName || g.productName || g.name).filter(Boolean).join(", ");

  return (
    <>
      {/* Compact In-Cell View with Sensible Maximum Width & Ellipsis */}
      <div
        ref={triggerRef}
        className={cn(
          "relative inline-flex items-center gap-1.5 cursor-pointer select-none group/gpc text-left",
          maxWidthClass,
          className
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => {
          e.stopPropagation();
          if (isOpen) {
            handleClose();
          } else {
            handleOpen();
          }
        }}
        title={fullText}
        dir={isRtl ? "rtl" : "ltr"}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span
          className={cn(
            "font-extrabold text-[12px] truncate inline-block flex-1 transition-colors",
            textColorClass || "text-slate-800 dark:text-slate-200 group-hover/gpc:text-blue-600 dark:group-hover/gpc:text-blue-400"
          )}
        >
          {primaryName}
        </span>

        {otherCount > 0 && (
          <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[11px] font-black bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0 whitespace-nowrap shadow-2xs">
            +{otherCount}
          </span>
        )}
      </div>

      {/* Tooltip rendered in Portal: boundary protected & never clipped by table overflow-x-auto */}
      {isOpen &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={tooltipRef}
            className="fixed z-[99999] rounded-xl bg-slate-900/98 dark:bg-slate-950/98 text-slate-100 p-3 shadow-2xl border border-slate-700/80 backdrop-blur-md transition-all duration-150 ease-out animate-in fade-in zoom-in-95"
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              maxHeight: `${coords.maxHeight}px`
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => e.stopPropagation()}
            dir={isRtl ? "rtl" : "ltr"}
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
              <div className="flex items-center gap-1.5 font-bold text-xs text-blue-400">
                <Package className="h-4 w-4 text-blue-400 shrink-0" />
                <span className="font-extrabold text-[12px]">
                  {gt("goods_cargo_details", "Goods & Cargo Details")}
                </span>
                <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800 shrink-0">
                  {goodsList.length} {goodsList.length === 1 ? gt("item", "Item") : gt("items", "Items")}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                aria-label={gt("close_tooltip", "Close goods tooltip")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Goods List Breakdown */}
            <div
              className="overflow-y-auto space-y-2 pr-1 text-[11px] scrollbar-thin scrollbar-thumb-slate-700"
              style={{ maxHeight: `${Math.min(320, coords.maxHeight - 75)}px` }}
            >
              {goodsList.map((item, idx) => {
                const itemName = item.goodsName || item.productName || item.name || `Item #${idx + 1}`;
                const qty = item.qtyNo || item.quantity;
                const unit = item.unit || item.qtyName || "CTN";
                const netWt = item.netWeight;
                const grossWt = item.grossWeight;
                const rate = item.rate || item.unitPrice || item.coursePrice || item.price;
                const amount = item.totalAmount || item.finalAmount;
                const grade = item.grade;
                const brand = item.brand;
                const origin = item.origin;
                const size = item.size;

                return (
                  <div
                    key={item.id ?? idx}
                    className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60 flex flex-col gap-1 text-slate-200"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="font-bold text-slate-100 flex items-start gap-1.5 text-xs leading-snug">
                        <span className="text-blue-400 font-mono text-[11px] mt-0.5 shrink-0">{idx + 1}.</span>
                        <span>{itemName}</span>
                      </span>
                      <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                        {grade && (
                          <span className="text-[11px] bg-blue-950 text-blue-300 border border-blue-800 px-1.5 py-0.5 rounded font-bold">
                            {grade}
                          </span>
                        )}
                        {brand && (
                          <span className="text-[11px] bg-purple-950 text-purple-300 border border-purple-800 px-1.5 py-0.5 rounded font-bold">
                            {brand}
                          </span>
                        )}
                        {origin && (
                          <span className="text-[11px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded font-bold">
                            {origin}
                          </span>
                        )}
                      </div>
                    </div>

                    {(size || qty || netWt || grossWt || rate || amount) && (
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-slate-300 border-t border-slate-700/50 pt-1.5 mt-1 font-mono">
                        {size && (
                          <div className="col-span-2 text-[11px] text-slate-400">
                            <span className="font-sans font-medium text-slate-400">{gt("size", "Size:")}</span> {size}
                          </div>
                        )}
                        {qty && (
                          <div>
                            <span className="font-sans font-medium text-slate-400">{gt("qty", "Qty:")}</span> {Number(qty).toLocaleString()} {unit}
                          </div>
                        )}
                        {netWt && (
                          <div>
                            <span className="font-sans font-medium text-slate-400">{gt("net_wt", "Net Wt:")}</span> {Number(netWt).toLocaleString()} KG
                          </div>
                        )}
                        {grossWt && (
                          <div>
                            <span className="font-sans font-medium text-slate-400">{gt("gross", "Gross:")}</span> {Number(grossWt).toLocaleString()} KG
                          </div>
                        )}
                        {rate && (
                          <div>
                            <span className="font-sans font-medium text-slate-400">{gt("rate", "Rate:")}</span> {rate}
                          </div>
                        )}
                        {amount && (
                          <div className="col-span-2 text-emerald-400 font-bold">
                            <span className="font-sans font-medium text-slate-400">{gt("amount", "Amount:")}</span> {Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Popover Footer */}
            <div className="mt-2 pt-1.5 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between items-center">
              <span className="text-slate-500 font-medium">{gt("footer_brand", "Digital Dock ERP Cargo System")}</span>
              <span className="text-blue-400 font-bold">{goodsList.length} {gt("total_registered_goods", "Total Registered Goods")}</span>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
