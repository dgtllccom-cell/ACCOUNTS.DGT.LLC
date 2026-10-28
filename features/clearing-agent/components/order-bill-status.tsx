"use client";

/**
 * Customer order ↔ expense bills — ONE place for the four expense bill types a customer order is transferred to, the link between
 * an order and its bills, and the per-order bill status shown by Order Transfer and the General Received Bills desk.
 *
 * The link is the existing expense bill header: an order's bill is saved "attached" with reference_no = the order number (no
 * separate table). Each bill type is read with its own category, so a login only sees the bill types it may read (403 → "no access").
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, FilePlus2, Lock, Loader2 } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";

export const ORDER_BILL_TYPES = [
  { key: "customs", billTitle: "customs_expenses", href: "/dashboard/clearing-agent/customs-expenses", labelKey: "obill.type_customs" },
  { key: "truck", billTitle: "truck_expenses", href: "/dashboard/clearing-agent/truck-expenses", labelKey: "obill.type_truck" },
  { key: "customer", billTitle: "customer_expenses", href: "/dashboard/clearing-agent/customer-expenses", labelKey: "obill.type_customer" },
  { key: "other", billTitle: "other_expenses", href: "/dashboard/clearing-agent/other-expenses", labelKey: "obill.type_other" },
] as const;

/** The bill type's name in the active language (the dictionary holds it in all five). */
export function orderBillTypeLabel(lang: SupportedLanguage, type: OrderBillType): string {
  return t(lang, (ORDER_BILL_TYPES.find((b) => b.key === type) ?? ORDER_BILL_TYPES[3]).labelKey);
}

export type OrderBillType = (typeof ORDER_BILL_TYPES)[number]["key"];

export const GENERAL_RECEIVED_BILLS_HREF = "/dashboard/clearing-agent/general-received-bill";

export type OrderBill = {
  id: string;
  serialNo: string;
  billDate: string | null;
  total: number | null;
  currency: string | null;
  transferred: boolean;
};

/** bills per order number per bill type */
export type OrderBillMap = Record<string, Partial<Record<OrderBillType, OrderBill[]>>>;

/** what an expense bill page needs to open on a customer order (and, with billId, on one of its bills) */
export type OrderBillLink = {
  orderId: string;
  orderNo: string;
  billId?: string | null;
  customerId?: string | null;
  truckNo?: string | null;
  driver?: string | null;
  assignedUserId?: string | null;
  assignedUser?: string | null;
  date?: string | null;
};

export function orderBillHref(type: OrderBillType, link: OrderBillLink): string {
  const def = ORDER_BILL_TYPES.find((b) => b.key === type) ?? ORDER_BILL_TYPES[3];
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(link)) if (v) q.set(k, String(v));
  return `${def.href}?${q.toString()}`;
}

function mapBill(b: any): OrderBill {
  const lines: any[] = Array.isArray(b.expenses_bill_lines) ? b.expenses_bill_lines : [];
  const sum = lines.reduce((a, l) => a + (Number(l.grand_amount ?? l.final_amount ?? l.amount) || 0), 0);
  return {
    id: String(b.id),
    serialNo: String(b.serial_no || b.entry_serial || b.branch_serial || ""),
    billDate: b.bill_date ? String(b.bill_date).slice(0, 10) : null,
    total: lines.length ? Math.round(sum * 100) / 100 : null,
    currency: b.base_currency ?? null,
    transferred: Boolean(b.transferred_to_roznamcha),
  };
}

/** The expense bills of these customer orders, per bill type (each type read with its own permission). */
export function useOrderBillStatus(orderNos: string[]) {
  const key = useMemo(() => [...new Set(orderNos.filter(Boolean))].sort().join(","), [orderNos]);
  const [bills, setBills] = useState<OrderBillMap>({});
  const [denied, setDenied] = useState<OrderBillType[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const refs = key ? key.split(",") : [];
    if (!refs.length) { setBills({}); setDenied([]); return; }
    setLoading(true);
    try {
      const next: OrderBillMap = {};
      const noAccess: OrderBillType[] = [];
      // at most 200 references per request (the API's cap)
      const chunks: string[][] = [];
      for (let i = 0; i < refs.length; i += 200) chunks.push(refs.slice(i, i + 200));
      await Promise.all(ORDER_BILL_TYPES.flatMap((type) => chunks.map(async (chunk) => {
        const qs = new URLSearchParams({ category: type.billTitle, referenceNos: chunk.join(","), limit: "500" });
        const res = await fetch(`/api/erp/expenses?${qs.toString()}`, { credentials: "include", cache: "no-store" }).catch(() => null);
        if (!res) return;
        if (res.status === 401 || res.status === 403) { if (!noAccess.includes(type.key)) noAccess.push(type.key); return; }
        const json = await res.json().catch(() => null);
        for (const b of (json?.bills ?? []) as any[]) {
          const ref = String(b.reference_no ?? "");
          if (!ref) continue;
          ((next[ref] ??= {})[type.key] ??= []).push(mapBill(b));
        }
      })));
      setBills(next);
      setDenied(noAccess);
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { bills, denied, loading, refresh };
}

const money = (n: number | null, cur: string | null) =>
  n == null ? "" : `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${cur ? ` ${cur}` : ""}`;

/**
 * The status of ONE bill type for ONE order: the bills already made (Open Bill) or none yet (Create Bill). Compact; used inside the
 * Order Transfer destination cards and the General Received Bills table.
 */
export function OrderBillStatusCell({
  lang, type, orderBills, denied, loading, link, compact = false, onCreate,
}: {
  lang: SupportedLanguage;
  type: OrderBillType;
  orderBills: OrderBill[] | undefined;
  denied: boolean;
  loading?: boolean;
  link: OrderBillLink;
  compact?: boolean;
  /** when set, "Create bill" calls this (e.g. Order Transfer opens its assignment dialog) instead of linking straight to the form */
  onCreate?: () => void;
}) {
  const tt = (k: string, fb: string) => t(lang, k as never, fb);
  if (loading && !orderBills) {
    return <span className="inline-flex items-center gap-1 text-[10px] text-slate-400"><Loader2 className="h-3 w-3 animate-spin" />{tt("obill.checking", "Checking bills…")}</span>;
  }
  if (denied) {
    return <span className="inline-flex items-center gap-1 text-[10px] text-slate-400" data-testid={`obill-${type}-denied`}><Lock className="h-3 w-3" />{tt("obill.no_access", "No access")}</span>;
  }
  const list = orderBills ?? [];
  if (!list.length) {
    return (
      <span className={cn("inline-flex flex-wrap items-center gap-1.5", compact ? "text-[10px]" : "text-[11px]")} data-testid={`obill-${type}-none`}>
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{tt("obill.none", "No bill yet")}</span>
        {onCreate ? (
          <button type="button" onClick={onCreate} className="inline-flex items-center gap-0.5 font-bold text-blue-600 hover:underline dark:text-blue-400">
            <FilePlus2 className="h-3 w-3" />{tt("obill.create", "Create bill")}
          </button>
        ) : (
          <Link href={orderBillHref(type, link) as never} className="inline-flex items-center gap-0.5 font-bold text-blue-600 hover:underline dark:text-blue-400">
            <FilePlus2 className="h-3 w-3" />{tt("obill.create", "Create bill")}
          </Link>
        )}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex flex-col gap-0.5", compact ? "text-[10px]" : "text-[11px]")} data-testid={`obill-${type}-made`}>
      {list.slice(0, 3).map((b) => (
        <span key={b.id} className="inline-flex flex-wrap items-center gap-1.5">
          <span className={cn("rounded-full px-1.5 py-0.5 font-bold", b.transferred ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300")}>
            {b.transferred ? tt("obill.posted", "Posted") : tt("obill.created", "Bill created")}
          </span>
          <span className="font-mono font-bold text-slate-700 dark:text-slate-200" dir="ltr">{b.serialNo}</span>
          {b.total != null && <span className="font-mono text-slate-500" dir="ltr">{money(b.total, b.currency)}</span>}
          <Link href={orderBillHref(type, { ...link, billId: b.id }) as never} className="inline-flex items-center gap-0.5 font-bold text-blue-600 hover:underline dark:text-blue-400" data-testid={`obill-${type}-open`}>
            <ExternalLink className="h-3 w-3" />{tt("obill.open", "Open bill")}
          </Link>
        </span>
      ))}
      {list.length > 3 && <span className="text-slate-400">+{list.length - 3}</span>}
    </span>
  );
}
