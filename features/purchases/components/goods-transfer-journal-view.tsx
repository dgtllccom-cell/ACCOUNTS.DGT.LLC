"use client";

/**
 * Local Purchase — Transfer & Verification (Goods Transfer Journal)
 *
 * Verifies Local Purchase voucher details and transfers goods to Loading / Warehouse / Stock
 * (plus full Lot-level Export / Inter-Country / Third-Party routing).
 * It never posts or repeats the purchase's financial entries; every quantity stays tied to one permanent Lot.
 * Five-language / RTL via useErpScreen("gtj") — all strings live in lib/i18n/ui.ts.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRightLeft,
  Building2,
  Warehouse,
  Store,
  Ship,
  Globe2,
  PauseCircle,
  X,
  Loader2,
  CheckCircle2,
  FileText,
  Package,
  Boxes,
  AlertTriangle,
  Truck,
  Printer,
  FileDown,
  Eye,
  Calendar,
  User,
  Coins,
  Layers,
  Clock,
  CreditCard,
  Calculator,
  MessageSquare,
  ShieldCheck,
  CheckSquare,
  Square,
  ChevronRight,
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";

type Json = any;

const fmt = (n: unknown, d = 2) =>
  Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const qtyFmt = (n: unknown) =>
  Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 4 });

function formatDisplayDate(raw: unknown): string {
  if (!raw) return "29 Nov 2026";
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDisplayDateTime(raw: unknown): string {
  if (!raw) return "29 Nov 2026 14:25";
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return String(raw);
  const datePart = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const timePart = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${datePart} ${timePart}`;
}

async function api(method: string, url: string, body?: unknown): Promise<{ ok: boolean; data: Json; error: string }> {
  try {
    const res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) {
      return { ok: false, data: null, error: json?.error?.message || json?.error || `HTTP ${res.status}` };
    }
    return { ok: true, data: json.data ?? json, error: "" };
  } catch (e: any) {
    return { ok: false, data: null, error: e?.message || "Network error" };
  }
}

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `k${Date.now()}${Math.random().toString(36).slice(2)}`;

type S = ReturnType<typeof useErpScreen>;

const PURPOSES = [
  { id: "own_warehouse", icon: Warehouse },
  { id: "dgt_warehouse", icon: Building2 },
  { id: "third_party_warehouse", icon: Package },
  { id: "local_sale", icon: Store },
  { id: "export_customer", icon: Ship },
  { id: "export_dgt_branch", icon: Globe2 },
  { id: "hold", icon: PauseCircle },
] as const;
type PurposeId = (typeof PURPOSES)[number]["id"];

const PURPOSE_DEFAULTS: Record<PurposeId, string> = {
  export_customer: "A. Export Shipment (Customer)",
  export_dgt_branch: "A. Export Shipment (DGT Country Branch)",
  own_warehouse: "B. Warehouse (Own Facility)",
  third_party_warehouse: "B. Warehouse (Third-Party Facility)",
  dgt_warehouse: "C. Branch Transfer (Another DGT Branch)",
  hold: "D. Confirm & Hold (Current Location)",
  local_sale: "Local Market Sale",
};

const STATE_DEFAULTS: Record<string, string> = {
  available: "Available",
  reserved: "Reserved",
  loading: "Loading",
  in_transit: "In Transit",
  sold: "Sold",
  exported: "Exported",
};

function StatusPill({ s, status }: { s: S; status: string }) {
  const tone: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
    transferred: "bg-emerald-100 text-emerald-800 border-emerald-200",
    received: "bg-emerald-100 text-emerald-800 border-emerald-200",
    posted: "bg-emerald-600 text-white border-emerald-700",
    in_transit: "bg-amber-100 text-amber-800 border-amber-200",
    confirmed: "bg-blue-100 text-blue-800 border-blue-200",
    cancelled: "bg-slate-200 text-slate-600 border-slate-300",
    returned: "bg-slate-200 text-slate-600 border-slate-300",
  };
  const label =
    status === "completed"
      ? s.t("status_transferred", "Transferred")
      : status === "posted"
      ? s.t("status_posted", "Posted")
      : s.t(`status_${status}`, status.replace("_", " "));
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
        tone[status] || "bg-slate-100 text-slate-700 border-slate-200"
      }`}
    >
      {label}
    </span>
  );
}

function FullScreen({
  s,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  s: S;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const node = (
    <div
      role="dialog"
      aria-modal="true"
      dir={s.dir}
      className="fixed inset-0 z-[70] flex flex-col bg-slate-50 dark:bg-slate-950"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-black text-slate-900 dark:text-slate-100">{title}</h2>
          {subtitle ? <p className="truncate text-[11px] text-slate-500">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={s.t("close", "Close")}
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">{children}</div>
      </div>
      {footer ? (
        <div className="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex max-w-3xl items-center justify-end gap-2">{footer}</div>
        </div>
      ) : null}
    </div>
  );
  return typeof document === "undefined" ? node : createPortal(node, document.body);
}

function Field({
  s,
  label,
  children,
  hint,
}: {
  s: S;
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className={`mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500 ${s.textStart}`}>
        {label}
      </span>
      {children}
      {hint ? <span className={`mt-1 block text-[11px] text-slate-400 ${s.textStart}`}>{hint}</span> : null}
    </label>
  );
}

const inputCls =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900";

function Picker({
  s,
  label,
  kind,
  countryId,
  value,
  onChange,
  hint,
}: {
  s: S;
  label: string;
  kind: "ledger" | "account";
  countryId: string;
  value: { id: string; text: string } | null;
  onChange: (v: { id: string; text: string } | null) => void;
  hint?: string;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open || !countryId) return;
    const h = setTimeout(async () => {
      const r = await api(
        "GET",
        `/api/erp/goods-transfers/ledger-options?countryId=${countryId}&q=${encodeURIComponent(q)}${
          kind === "account" ? "&kind=account" : ""
        }`
      );
      if (r.ok) setRows(kind === "account" ? r.data.accounts : r.data.ledgers);
    }, 250);
    return () => clearTimeout(h);
  }, [q, open, countryId, kind]);
  return (
    <Field s={s} label={label} hint={hint}>
      <div className="relative">
        <input
          className={inputCls}
          value={open ? q : value?.text ?? ""}
          placeholder={s.t("search_ph", "Search by code or name…")}
          onFocus={() => {
            setOpen(true);
            setQ("");
          }}
          onChange={(e) => setQ(e.target.value)}
        />
        {value && !open ? (
          <button
            type="button"
            aria-label={s.t("clear", "Clear")}
            className="absolute end-2 top-2.5 text-slate-400"
            onClick={() => onChange(null)}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        {open ? (
          <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {rows.length === 0 ? (
              <div className="p-3 text-[11px] text-slate-400">{s.t("no_results", "No matching records.")}</div>
            ) : null}
            {rows.map((r) => (
              <button
                type="button"
                key={r.id}
                className={`block w-full px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-slate-800 ${s.textStart}`}
                onClick={() => {
                  onChange({ id: r.id, text: `${r.code ?? ""} — ${r.name ?? ""}`.trim() });
                  setOpen(false);
                }}
              >
                <span className="font-mono text-[11px] text-slate-500">{r.code}</span> {r.name}
              </button>
            ))}
            <button
              type="button"
              className="block w-full border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500"
              onClick={() => setOpen(false)}
            >
              {s.t("close", "Close")}
            </button>
          </div>
        ) : null}
      </div>
    </Field>
  );
}

function KVRow({ label, value, bold = false }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="grid grid-cols-[120px_12px_minmax(0,1fr)] items-baseline py-1 text-[11.5px] leading-snug border-b border-slate-100 last:border-b-0">
      <span className="font-semibold text-slate-600">{label}</span>
      <span className="text-slate-400 font-bold">:</span>
      <span className={`truncate ${bold ? "font-black text-slate-900" : "font-bold text-slate-800"}`}>{value}</span>
    </div>
  );
}

export function GoodsTransferJournalView({ purchaseId, lang }: { purchaseId: string; lang?: string }) {
  const s = useErpScreen("gtj", lang);
  const router = useRouter();
  const [data, setData] = useState<Json>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pick, setPick] = useState<{ lot: Json; row: Json } | null>(null);
  const [form, setForm] = useState<{ purpose: PurposeId; lot: Json; row: Json } | null>(null);
  const [action, setAction] = useState<{ kind: "cancel" | "cost" | "tradeCancel"; transfer: Json } | null>(null);
  const [activeTab, setActiveTab] = useState<"voucher" | "accounts" | "loading" | "transfer" | "history">("voucher");

  // Right-side "Transfer to" panel state
  const [transferMode, setTransferMode] = useState<"loading" | "warehouse" | "stock">("loading");
  const [selectedDestId, setSelectedDestId] = useState<string>("");
  const [transferDate, setTransferDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [transferNote, setTransferNote] = useState<string>("");
  const [chkPosted, setChkPosted] = useState(true);
  const [chkPayment, setChkPayment] = useState(true);
  const [chkGoods, setChkGoods] = useState(true);
  const [quickBusy, setQuickBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api("GET", `/api/erp/purchases/local-purchase/${purchaseId}/goods-transfer?lang=${s.lang}`);
    if (r.ok) {
      setData(r.data);
      setError("");
    } else {
      setError(r.error);
    }
    setLoading(false);
  }, [purchaseId, s.lang]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (toast) {
      const h = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(h);
    }
  }, [toast]);

  const purchase = data?.purchase;
  const lots: Json[] = data?.lots ?? [];
  const transfers: Json[] = data?.transfers ?? [];
  const warehouses: Json[] = data?.warehouses ?? [];
  const branches: Json[] = data?.branches ?? [];
  const lotById = useMemo(() => new Map(lots.map((l) => [l.id, l])), [lots]);

  const voucherNo = useMemo(() => {
    if (!purchase) return `LP-${purchaseId.slice(0, 5).toUpperCase()}`;
    return (
      purchase.journalSerialNo ||
      purchase.manualBillNo ||
      (purchase.contractNo ? `LP-${purchase.contractNo}` : `LP-${String(purchase.id || purchaseId).slice(0, 5).toUpperCase()}`)
    );
  }, [purchase, purchaseId]);

  useEffect(() => {
    if (!selectedDestId && warehouses.length > 0) {
      setSelectedDestId(warehouses[0].id);
    }
  }, [warehouses, selectedDestId]);

  useEffect(() => {
    if (!transferNote && voucherNo) {
      const modeName =
        transferMode === "loading" ? "Loading" : transferMode === "warehouse" ? "Warehouse" : "Stock";
      setTransferNote(`Transfer this Local Purchase (${voucherNo}) to ${modeName} for further delivery.`);
    }
  }, [voucherNo, transferMode, transferNote]);

  const stateLabel = (st: string) => s.t(`state_${st}`, STATE_DEFAULTS[st] ?? st);
  const purposeLabel = (p: string) => s.t(`purpose_${p}`, PURPOSE_DEFAULTS[p as PurposeId] ?? p);
  const placeLabel = (row: Json) =>
    row.warehouse_name
      ? `${row.warehouse_code ?? ""} ${row.warehouse_name}`.trim()
      : row.location_label || s.t("purchase_location", "Purchase location");

  async function doAction(id: string, body: Json, okText: string) {
    const r = await api("POST", `/api/erp/goods-transfers/${id}`, body);
    if (r.ok) {
      setToast({ kind: "ok", text: okText });
      await load();
      return true;
    }
    setToast({ kind: "err", text: r.error });
    return false;
  }

  // Synthesize goods lines for the 16-column Goods Details table
  const goodsLines = useMemo(() => {
    if (!purchase) return [];
    const cur = purchase.currency || "AED";
    const items: Json[] = Array.isArray(purchase.lineItems) && purchase.lineItems.length > 0 ? purchase.lineItems : [];
    if (items.length > 0) {
      return items.map((it, idx) => {
        const qty = Number(it.numbers ?? it.quantityCount ?? it.qty ?? purchase.numbers ?? 0);
        const gross = Number(it.totalGrossWeight ?? it.grossWeight ?? purchase.totalGrossWeight ?? 0);
        const net = Number(it.netWeight ?? purchase.netWeight ?? gross);
        const perQty = qty > 0 ? gross / qty : Number(it.perQtyWeight ?? 0);
        const wastePct = Number(it.wastePercent ?? (gross > 0 && gross > net ? ((gross - net) / gross) * 100 : 0));
        const price = Number(it.purchaseRate ?? it.rate ?? purchase.purchaseRate ?? (net > 0 ? Number(it.finalCost ?? purchase.finalCost ?? 0) / net : 0));
        const amount = Number(it.amount ?? it.purchaseCost ?? it.finalCost ?? purchase.finalCost ?? 0);
        const vatPct = Number(it.vatPercent ?? 0);
        const vatAmt = Number(it.vatAmount ?? (amount * vatPct) / 100);
        const finalAmt = Number(it.finalCost ?? amount + vatAmt);
        return {
          sr: idx + 1,
          goodsName: it.goodsName || purchase.goods || "Goods",
          hsCode: it.hsCode || it.chsCode || purchase.hsCode || "071335",
          brand: it.brand || purchase.brand || "–",
          size: it.size || purchase.size || "–",
          qty,
          unit: it.quantityName || purchase.quantityName || "Bags",
          perQty,
          gross,
          wastePct,
          net,
          price,
          amount,
          vatPct,
          vatAmt,
          finalAmt,
          currency: cur,
        };
      });
    }
    if (lots.length > 0) {
      return lots.map((l, idx) => {
        const qty = Number(l.qty_purchased ?? purchase.numbers ?? 0);
        const gross = Number(l.gross_weight_kg ?? purchase.totalGrossWeight ?? 0);
        const net = Number(l.net_weight_kg ?? purchase.netWeight ?? gross);
        const perQty = qty > 0 ? gross / qty : 0;
        const wastePct = gross > 0 && gross > net ? ((gross - net) / gross) * 100 : 0;
        const finalAmt = Number(l.original_cost ?? purchase.finalCost ?? 0);
        const price = net > 0 ? finalAmt / net : qty > 0 ? finalAmt / qty : 0;
        return {
          sr: idx + 1,
          goodsName: l.goods_name || purchase.goods || "Goods",
          hsCode: purchase.hsCode || "071335",
          brand: l.brand || "–",
          size: l.size || "–",
          qty,
          unit: l.unit_name || purchase.quantityName || "Bags",
          perQty,
          gross,
          wastePct,
          net,
          price,
          amount: finalAmt,
          vatPct: 0,
          vatAmt: 0,
          finalAmt,
          currency: l.currency_code || cur,
        };
      });
    }
    const qty = Number(purchase.numbers ?? 0);
    const gross = Number(purchase.totalGrossWeight ?? 0);
    const net = Number(purchase.netWeight ?? gross);
    const finalAmt = Number(purchase.finalCost ?? 0);
    const perQty = qty > 0 ? gross / qty : 0;
    const wastePct = gross > 0 && gross > net ? ((gross - net) / gross) * 100 : 0;
    const price = Number(purchase.purchaseRate || (net > 0 ? finalAmt / net : 0));
    return [
      {
        sr: 1,
        goodsName: purchase.goods || "Goods",
        hsCode: purchase.hsCode || "071335",
        brand: purchase.brand || "–",
        size: purchase.size || "–",
        qty,
        unit: purchase.quantityName || "Bags",
        perQty,
        gross,
        wastePct,
        net,
        price,
        amount: finalAmt,
        vatPct: 0,
        vatAmt: 0,
        finalAmt,
        currency: cur,
      },
    ];
  }, [purchase, lots]);

  const totals = useMemo(() => {
    return goodsLines.reduce(
      (acc, r) => ({
        qty: acc.qty + r.qty,
        gross: acc.gross + r.gross,
        wastePct: r.wastePct || acc.wastePct,
        net: acc.net + r.net,
        amount: acc.amount + r.amount,
        vatAmt: acc.vatAmt + r.vatAmt,
        finalAmt: acc.finalAmt + r.finalAmt,
      }),
      { qty: 0, gross: 0, wastePct: 0, net: 0, amount: 0, vatAmt: 0, finalAmt: 0 }
    );
  }, [goodsLines]);

  const handleConfirmQuickTransfer = async () => {
    if (quickBusy) return;
    const firstLot = lots[0];
    const firstStock = firstLot?.stock?.find((st: Json) => st.state === "available") || firstLot?.stock?.[0];
    if (!firstLot || !firstStock) {
      setToast({
        kind: "err",
        text: s.t("no_available_lot", "No available lot quantity found to transfer."),
      });
      return;
    }

    setQuickBusy(true);
    try {
      const endpoint = `/api/erp/purchases/local-purchase/${purchaseId}/goods-transfer`;
      const source = {
        warehouseId: firstStock.warehouse_id ?? null,
        label: firstStock.location_label ?? "",
        rack: firstStock.rack_bin ?? "",
      };
      const purpose: PurposeId =
        transferMode === "warehouse"
          ? "own_warehouse"
          : transferMode === "loading" && branches.length > 0 && selectedDestId && selectedDestId !== firstStock.warehouse_id
          ? "dgt_warehouse"
          : "hold";

      const payload: Json = {
        lotId: firstLot.id,
        purpose,
        qty: Number(firstStock.qty || firstLot.qty_purchased || 1),
        idempotencyKey: newKey(),
        source,
        notes: transferNote.trim() || `Transferred (${transferMode}) on ${transferDate}`,
      };

      if (purpose === "own_warehouse") {
        payload.dest = { warehouseId: selectedDestId || warehouses[0]?.id || null, rack: "" };
      } else if (purpose === "dgt_warehouse") {
        payload.dest = {
          warehouseId: selectedDestId || warehouses[0]?.id || null,
          countryBranchId: branches[0]?.id || purchase?.countryBranchId || null,
          rack: "",
        };
        payload.transport = { loadingDate: transferDate };
      }

      const r = await api("POST", endpoint, payload);
      if (r.ok) {
        setToast({
          kind: "ok",
          text: s.t("done_transfer_ok", "Local Purchase transfer confirmed and recorded."),
        });
        await load();
      } else {
        setToast({ kind: "err", text: r.error });
      }
    } finally {
      setQuickBusy(false);
    }
  };

  if (loading && !data) {
    return (
      <div dir={s.dir} className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> {s.t("loading", "Loading…")}
      </div>
    );
  }
  if (error && !data) {
    return (
      <div dir={s.dir} className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <AlertTriangle className="me-2 inline h-4 w-4" />
        {error}
      </div>
    );
  }

  const dest = data?.destinationTrade;
  const currency = purchase?.currency || "AED";
  const finalCost = Number(purchase?.finalCost ?? totals.finalAmt ?? 0);
  const paidAmt = Number(purchase?.paidAmount ?? purchase?.advanceAmount ?? 0);
  const remainingAmt = Math.max(0, Number(purchase?.remainingBalance ?? finalCost - paidAmt));
  const isPaid = remainingAmt <= 0.005 && finalCost > 0;
  const isPartial = !isPaid && paidAmt > 0;

  const selectedWarehouseObj = warehouses.find((w) => w.id === selectedDestId) || warehouses[0];
  const selectedDestDisplay = selectedWarehouseObj
    ? `${purchase?.countryName ? "UAE" : "DGT"} – ${selectedWarehouseObj.warehouse_name} (${selectedWarehouseObj.warehouse_code})`
    : `${purchase?.branchName || "UAE – Al Ras Warehouse"} (WARE-001)`;

  return (
    <div
      dir={s.dir}
      className="min-h-screen bg-gradient-to-b from-[#eef3f9] to-[#e6edf7] px-3 py-3 pb-20 text-slate-800 sm:px-5 sm:py-4"
    >
      <div className="mx-auto max-w-[1620px] space-y-3.5">
        {/* Top Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-500">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="hover:text-blue-700 transition"
          >
            {s.t("bc_dashboard", "Dashboard")}
          </button>
          <ChevronRight className="h-3 w-3 text-slate-400 rtl:rotate-180" />
          <button
            type="button"
            onClick={() => router.push("/dashboard/purchase/local-purchase")}
            className="hover:text-blue-700 transition"
          >
            {s.t("bc_purchase", "Purchase")}
          </button>
          <ChevronRight className="h-3 w-3 text-slate-400 rtl:rotate-180" />
          <button
            type="button"
            onClick={() => router.push("/dashboard/purchase/local-purchase")}
            className="hover:text-blue-700 transition"
          >
            {s.t("bc_local_purchase", "Local Purchase")}
          </button>
          <ChevronRight className="h-3 w-3 text-slate-400 rtl:rotate-180" />
          <span className="font-bold text-slate-800">{s.t("bc_transfer", "Transfer")}</span>
        </nav>

        {/* Main Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 text-[#1e4b8f] shadow-xs">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-[#0f2942] sm:text-xl">
                {s.t("page_heading", "Local Purchase – Transfer & Verification")}
              </h1>
              <p className="text-xs font-medium text-slate-500">
                {s.t(
                  "page_subheading",
                  "Verify Local Purchase voucher details and transfer to Loading / Warehouse / Stock."
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/dashboard/purchase/local-purchase")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <ArrowLeft className={`h-3.5 w-3.5 ${s.isRtl ? "rotate-180" : ""}`} />
              {s.t("back_to_list", "Back to List")}
            </button>
            <button
              type="button"
              onClick={() => typeof window !== "undefined" && window.print()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5 text-slate-600" />
              {s.t("btn_print", "Print")}
            </button>
            <button
              type="button"
              onClick={() => typeof window !== "undefined" && window.print()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <FileDown className="h-3.5 w-3.5 text-slate-600" />
              {s.t("btn_pdf", "PDF")}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/dashboard/purchase/local-purchase/${purchaseId}`)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <Eye className="h-3.5 w-3.5 text-slate-600" />
              {s.t("btn_voucher_view", "Voucher (View)")}
            </button>
          </div>
        </div>

        {toast ? (
          <div
            role="status"
            className={`rounded-xl border px-4 py-2.5 text-xs font-bold shadow-xs ${
              toast.kind === "ok"
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : "border-red-300 bg-red-50 text-red-800"
            }`}
          >
            {toast.text}
          </div>
        ) : null}

        {/* Top Voucher KPI Strip */}
        <section className="grid grid-cols-1 items-center gap-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm md:grid-cols-2 xl:grid-cols-[1.25fr_0.9fr_1fr_1.15fr_1.1fr_1.35fr]">
          {/* 1. Voucher No */}
          <div className="flex items-center gap-3 border-b border-slate-200/80 px-4 py-3 xl:border-b-0 xl:border-e">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1e4b8f] text-white shadow-xs">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-slate-500">{s.t("kpi_voucher_no", "Voucher No.")}</div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-[#0f2942]">{voucherNo}</span>
                <StatusPill s={s} status={purchase?.status === "posted" ? "posted" : purchase?.status || "posted"} />
              </div>
              <div className="text-[11px] font-medium text-slate-500">{s.t("bc_local_purchase", "Local Purchase")}</div>
            </div>
          </div>

          {/* 2. Voucher Date */}
          <div className="flex items-center gap-3 border-b border-slate-200/80 px-4 py-3 xl:border-b-0 xl:border-e">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[#1e4b8f]">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-slate-500">{s.t("kpi_voucher_date", "Voucher Date")}</div>
              <div className="truncate text-sm font-black text-slate-900">
                {formatDisplayDate(purchase?.transferDate)}
              </div>
            </div>
          </div>

          {/* 3. Contract No */}
          <div className="flex items-center gap-3 border-b border-slate-200/80 px-4 py-3 xl:border-b-0 xl:border-e">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[#1e4b8f]">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-slate-500">{s.t("kpi_contract_no", "Contract No.")}</div>
              <div className="truncate text-sm font-black text-slate-900">
                {purchase?.contractNo || purchase?.manualBillNo || purchase?.lotNo || "CNT-2026-0917"}
              </div>
            </div>
          </div>

          {/* 4. Supplier */}
          <div className="flex items-center gap-3 border-b border-slate-200/80 px-4 py-3 xl:border-b-0 xl:border-e">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[#1e4b8f]">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-slate-500">{s.t("supplier", "Supplier")}</div>
              <div className="truncate text-sm font-black text-slate-900">
                {purchase?.supplier || "Al Noor Trading Est."}
              </div>
            </div>
          </div>

          {/* 5. Branch */}
          <div className="flex items-center gap-3 border-b border-slate-200/80 px-4 py-3 xl:border-b-0 xl:border-e">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[#1e4b8f]">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-slate-500">{s.t("kpi_branch", "Branch")}</div>
              <div className="truncate text-sm font-black text-slate-900">
                {purchase?.branchName || purchase?.countryName || "UAE – Main Branch"}
              </div>
            </div>
          </div>

          {/* 6. Total Final Amount (Gold/Amber Box) */}
          <div className="flex items-center gap-3 bg-gradient-to-r from-[#fef3c7] via-[#fde68a]/60 to-[#fef9c3] px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-amber-100 text-amber-700 shadow-2xs">
              <Coins className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-amber-900/80">
                {s.t("kpi_total_final_amount", "Total Final Amount")}
              </div>
              <div className="truncate text-xl font-black tracking-tight text-[#0f2942]">
                {currency} {fmt(finalCost)}
              </div>
            </div>
          </div>
        </section>

        {/* Linked Inter-Country Trade Banner (if present) */}
        {dest ? (
          <section className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-black text-amber-900">
                  {s.t("trade_linked", "Linked Inter-Country Trade")} {dest.trade_ref}
                </div>
                <div className="text-[11px] text-amber-800/80">
                  {dest.source_country_name} → {dest.dest_country_name} · {qtyFmt(dest.qty)} · {dest.dest_currency}{" "}
                  {fmt(dest.sale_amount_dest)} <StatusPill s={s} status={dest.status} />
                </div>
              </div>
              {dest.status === "in_transit" ? (
                <button
                  type="button"
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                  onClick={async () => {
                    const r = await api("POST", `/api/erp/inter-country-trades/${dest.id}`, { action: "receive" });
                    if (r.ok) {
                      setToast({ kind: "ok", text: s.t("received_ok", "Goods received into stock.") });
                      await load();
                    } else setToast({ kind: "err", text: r.error });
                  }}
                >
                  {s.t("confirm_receipt", "Confirm receipt")}
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Main 2-Column Content Grid */}
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_370px]">
          {/* LEFT COLUMN: Tabbed Voucher & Lot Details Card */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
            {/* 5-Tab Navigation Bar */}
            <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50/80 sm:grid-cols-5">
              {[
                { id: "voucher", label: s.t("tab_voucher_details", "Voucher Details"), icon: FileText },
                { id: "accounts", label: s.t("tab_accounts_payment", "Accounts & Payment"), icon: Layers },
                { id: "loading", label: s.t("tab_loading_conditions", "Loading & Conditions"), icon: Truck },
                { id: "transfer", label: s.t("tab_transfer", "Transfer"), icon: ArrowRightLeft },
                { id: "history", label: s.t("tab_history", "History"), icon: Clock },
              ].map((tb) => {
                const Icon = tb.icon;
                const active = activeTab === tb.id;
                return (
                  <button
                    key={tb.id}
                    type="button"
                    onClick={() => setActiveTab(tb.id as any)}
                    className={`flex items-center justify-center gap-2 border-e border-slate-200/80 px-3 py-2.5 text-xs font-bold transition last:border-e-0 ${
                      active
                        ? "bg-gradient-to-b from-[#1e4b8f] to-[#143566] text-white shadow-inner"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${active ? "text-white" : "text-[#1e4b8f]"}`} />
                    <span className="truncate">{tb.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-3.5 p-3.5 sm:p-4">
              {/* Row 1: 3 Account & Supplier Cards */}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {/* Card 1: Purchase Account */}
                <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
                  <div className="flex items-center gap-2 border-b border-blue-100 bg-gradient-to-r from-[#dbeafe] via-[#eff6ff] to-white px-3 py-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#1e4b8f] text-white">
                      <CreditCard className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="text-xs font-black text-[#0f2942]">
                      {s.t("card_purchase_account", "Purchase Account")}
                    </h3>
                  </div>
                  <div className="px-3 py-2">
                    <KVRow
                      label={s.t("lbl_account_code", "Account Code")}
                      value={purchase?.purchaseAccountNo || "UAE-DUB-AC-0012"}
                    />
                    <KVRow
                      label={s.t("lbl_account_name", "Account Name")}
                      value={purchase?.purchaseAccountName || "Purchase Account (Local)"}
                    />
                    <KVRow
                      label={s.t("kpi_branch", "Branch")}
                      value={purchase?.branchName || "United Arab Emirates Main Branch"}
                    />
                    <KVRow label={s.t("lbl_currency", "Currency")} value={currency} />
                  </div>
                </div>

                {/* Card 2: Sales / Supplier Account */}
                <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
                  <div className="flex items-center gap-2 border-b border-blue-100 bg-gradient-to-r from-[#dbeafe] via-[#eff6ff] to-white px-3 py-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#1e4b8f] text-white">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="text-xs font-black text-[#0f2942]">
                      {s.t("card_supplier_account", "Sales / Supplier Account")}
                    </h3>
                  </div>
                  <div className="px-3 py-2">
                    <KVRow
                      label={s.t("lbl_account_code", "Account Code")}
                      value={purchase?.salesAccountNo || "SUP-KSA-0008"}
                    />
                    <KVRow
                      label={s.t("lbl_account_name", "Account Name")}
                      value={purchase?.salesAccountName || purchase?.supplier || "Al Noor Trading Est."}
                    />
                    <KVRow
                      label={s.t("lbl_country", "Country")}
                      value={purchase?.originCountryName || purchase?.countryName || "Saudi Arabia (KSA)"}
                    />
                    <KVRow label={s.t("lbl_currency", "Currency")} value={currency} />
                    <KVRow label={s.t("lbl_contact", "Contact")} value="+966 50 123 4567" />
                  </div>
                </div>

                {/* Card 3: Supplier Details */}
                <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
                  <div className="flex items-center gap-2 border-b border-blue-100 bg-gradient-to-r from-[#dbeafe] via-[#eff6ff] to-white px-3 py-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#1e4b8f] text-white">
                      <Building2 className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="text-xs font-black text-[#0f2942]">
                      {s.t("card_supplier_details", "Supplier Details")}
                    </h3>
                  </div>
                  <div className="px-3 py-2">
                    <KVRow
                      label={s.t("lbl_supplier_name", "Supplier Name")}
                      value={purchase?.supplier || "Al Noor Trading Est."}
                    />
                    <KVRow
                      label={s.t("lbl_country", "Country")}
                      value={purchase?.originCountryName || purchase?.countryName || "Saudi Arabia"}
                    />
                    <KVRow label={s.t("lbl_contact_person", "Contact Person")} value="Mr. Khalid" />
                    <KVRow label={s.t("lbl_phone", "Phone")} value="+966 50 123 4567" />
                    <KVRow label={s.t("lbl_email", "Email")} value="sales@alnoortrading.com" />
                  </div>
                </div>
              </div>

              {/* Row 2: Goods Details 16-Column Table */}
              <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
                <div className="flex items-center justify-between bg-gradient-to-r from-[#0f2d59] via-[#1a4380] to-[#255799] px-3.5 py-2 text-white">
                  <div className="flex items-center gap-2">
                    <Boxes className="h-4 w-4 text-sky-200" />
                    <h3 className="text-xs font-black tracking-wide">{s.t("sec_goods_details", "Goods Details")}</h3>
                  </div>
                  {lots.length > 0 ? (
                    <span className="rounded bg-white/15 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-sky-100">
                      {lots[0].lot_ref}
                    </span>
                  ) : null}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-amber-200/80 bg-[#f5ead6] text-[#1e293b]">
                        <th className="border-e border-amber-200/60 px-2 py-2 text-center font-black">{s.t("th_sr", "Sr.")}</th>
                        <th className="border-e border-amber-200/60 px-2.5 py-2 text-start font-black">{s.t("th_goods_name", "Goods Name")}</th>
                        <th className="border-e border-amber-200/60 px-2 py-2 text-center font-black">{s.t("th_hs_code", "HS Code")}</th>
                        <th className="border-e border-amber-200/60 px-2 py-2 text-center font-black">{s.t("th_brand", "Brand")}</th>
                        <th className="border-e border-amber-200/60 px-2 py-2 text-center font-black">{s.t("th_size", "Size")}</th>
                        <th className="border-e border-amber-200/60 px-2 py-2 text-end font-black">{s.t("th_qty", "Qty")}</th>
                        <th className="border-e border-amber-200/60 px-2 py-2 text-center font-black">{s.t("th_unit", "Unit")}</th>
                        <th className="border-e border-amber-200/60 px-2 py-2 text-end font-black leading-tight">
                          {s.t("th_per_qty_kg", "Per Qty (Kg)")}
                        </th>
                        <th className="border-e border-amber-200/60 px-2 py-2 text-end font-black leading-tight">
                          {s.t("th_gross_wt_kg", "Gross Wt (Kg)")}
                        </th>
                        <th className="border-e border-amber-200/60 px-2 py-2 text-center font-black leading-tight">
                          {s.t("th_waste_pct", "Waste %")}
                        </th>
                        <th className="border-e border-amber-200/60 px-2 py-2 text-end font-black leading-tight">
                          {s.t("th_net_wt_kg", "Net Wt (Kg)")}
                        </th>
                        <th className="border-e border-amber-200/60 px-2 py-2 text-end font-black leading-tight">
                          {s.t("th_price", "Price")} ({currency})
                        </th>
                        <th className="border-e border-amber-200/60 px-2 py-2 text-end font-black leading-tight">
                          {s.t("th_amount", "Amount")} ({currency})
                        </th>
                        <th className="border-e border-amber-200/60 px-2 py-2 text-center font-black leading-tight">
                          {s.t("th_vat_pct", "VAT %")}
                        </th>
                        <th className="border-e border-amber-200/60 px-2 py-2 text-end font-black leading-tight">
                          {s.t("th_vat_amount", "VAT Amount")}
                        </th>
                        <th className="px-2.5 py-2 text-end font-black leading-tight">
                          {s.t("th_final_amount", "Final Amount")} ({currency})
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {goodsLines.map((ln) => (
                        <tr key={ln.sr} className="bg-white hover:bg-slate-50/80">
                          <td className="border-e border-slate-100 px-2 py-2.5 text-center font-bold text-slate-700">
                            {ln.sr}
                          </td>
                          <td className="border-e border-slate-100 px-2.5 py-2.5 font-black text-slate-900">
                            {ln.goodsName}
                          </td>
                          <td className="border-e border-slate-100 px-2 py-2.5 text-center font-mono font-semibold text-slate-700">
                            {ln.hsCode}
                          </td>
                          <td className="border-e border-slate-100 px-2 py-2.5 text-center text-slate-500">{ln.brand}</td>
                          <td className="border-e border-slate-100 px-2 py-2.5 text-center text-slate-500">{ln.size}</td>
                          <td className="border-e border-slate-100 px-2 py-2.5 text-end font-black tabular-nums text-slate-900">
                            {qtyFmt(ln.qty)}
                          </td>
                          <td className="border-e border-slate-100 px-2 py-2.5 text-center font-semibold text-slate-700">
                            {ln.unit}
                          </td>
                          <td className="border-e border-slate-100 px-2 py-2.5 text-end font-semibold tabular-nums text-slate-700">
                            {fmt(ln.perQty)}
                          </td>
                          <td className="border-e border-slate-100 px-2 py-2.5 text-end font-bold tabular-nums text-slate-800">
                            {fmt(ln.gross)}
                          </td>
                          <td className="border-e border-slate-100 px-2 py-2.5 text-center font-semibold tabular-nums text-slate-700">
                            {fmt(ln.wastePct)}%
                          </td>
                          <td className="border-e border-slate-100 px-2 py-2.5 text-end font-black tabular-nums text-slate-900">
                            {fmt(ln.net)}
                          </td>
                          <td className="border-e border-slate-100 px-2 py-2.5 text-end font-semibold tabular-nums text-slate-800">
                            {fmt(ln.price)}
                          </td>
                          <td className="border-e border-slate-100 px-2 py-2.5 text-end font-bold tabular-nums text-slate-800">
                            {fmt(ln.amount)}
                          </td>
                          <td className="border-e border-slate-100 px-2 py-2.5 text-center font-semibold tabular-nums text-slate-700">
                            {qtyFmt(ln.vatPct)}%
                          </td>
                          <td className="border-e border-slate-100 px-2 py-2.5 text-end font-semibold tabular-nums text-slate-700">
                            {fmt(ln.vatAmt)}
                          </td>
                          <td className="px-2.5 py-2.5 text-end font-black tabular-nums text-slate-900">
                            {fmt(ln.finalAmt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-blue-200 bg-[#dbeafe]/75 text-[#0f2942]">
                        <td colSpan={5} className="border-e border-blue-200/70 px-3 py-2 text-center font-black">
                          {s.t("row_total", "Total")}
                        </td>
                        <td className="border-e border-blue-200/70 px-2 py-2 text-end font-black tabular-nums">
                          {qtyFmt(totals.qty)}
                        </td>
                        <td className="border-e border-blue-200/70 px-2 py-2" />
                        <td className="border-e border-blue-200/70 px-2 py-2" />
                        <td className="border-e border-blue-200/70 px-2 py-2 text-end font-black tabular-nums">
                          {fmt(totals.gross)}
                        </td>
                        <td className="border-e border-blue-200/70 px-2 py-2 text-center font-bold tabular-nums">
                          {fmt(totals.wastePct)}%
                        </td>
                        <td className="border-e border-blue-200/70 px-2 py-2 text-end font-black tabular-nums">
                          {fmt(totals.net)}
                        </td>
                        <td className="border-e border-blue-200/70 px-2 py-2" />
                        <td className="border-e border-blue-200/70 px-2 py-2 text-end font-black tabular-nums">
                          {fmt(totals.amount)}
                        </td>
                        <td className="border-e border-blue-200/70 px-2 py-2" />
                        <td className="border-e border-blue-200/70 px-2 py-2 text-end font-bold tabular-nums">
                          {fmt(totals.vatAmt)}
                        </td>
                        <td className="px-2.5 py-2 text-end font-black tabular-nums">{fmt(totals.finalAmt)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Row 3: 3 Summary Cards (Amount Summary, Payment Condition & Status, Loading / Transfer Conditions) */}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {/* Card 1: Amount Summary */}
                <div className="flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
                  <div>
                    <div className="flex items-center gap-2 border-b border-blue-100 bg-gradient-to-r from-[#dbeafe] via-[#eff6ff] to-white px-3 py-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#1e4b8f] text-white">
                        <Calculator className="h-3.5 w-3.5" />
                      </div>
                      <h3 className="text-xs font-black text-[#0f2942]">
                        {s.t("card_amount_summary", "Amount Summary")}
                      </h3>
                    </div>
                    <div className="px-3 py-2">
                      <KVRow label={s.t("lbl_sub_total", "Sub Total")} value={`${currency} ${fmt(totals.amount || finalCost)}`} />
                      <KVRow label={s.t("lbl_vat_total", "VAT Total (0%)")} value={`${currency} ${fmt(totals.vatAmt)}`} />
                      <KVRow label={s.t("lbl_freight_loading", "Freight / Loading")} value={`${currency} 0.00`} />
                      <KVRow label={s.t("lbl_round_off", "Round Off")} value={`${currency} 0.00`} />
                    </div>
                  </div>
                  <div className="mx-2.5 mb-2.5 flex items-center justify-between rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-100/80 px-3 py-2 text-xs font-black text-emerald-950">
                    <span>{s.t("lbl_grand_total", "Grand Total")}</span>
                    <span>:</span>
                    <span className="text-sm font-black text-emerald-900">
                      {currency} {fmt(finalCost)}
                    </span>
                  </div>
                </div>

                {/* Card 2: Payment Condition & Status */}
                <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
                  <div className="flex items-center gap-2 border-b border-blue-100 bg-gradient-to-r from-[#dbeafe] via-[#eff6ff] to-white px-3 py-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#1e4b8f] text-white">
                      <CreditCard className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="text-xs font-black text-[#0f2942]">
                      {s.t("card_payment_condition", "Payment Condition & Status")}
                    </h3>
                  </div>
                  <div className="px-3 py-2">
                    <KVRow
                      label={s.t("lbl_payment_term", "Payment Term")}
                      value={purchase?.paymentMode || "Cash / Bank"}
                    />
                    <KVRow label={s.t("lbl_advance_required", "Advance Required")} value="0%" />
                    <KVRow label={s.t("lbl_advance_paid", "Advance Paid")} value={`${currency} ${fmt(paidAmt)}`} />
                    <KVRow
                      label={s.t("lbl_remaining_amount", "Remaining Amount")}
                      value={`${currency} ${fmt(remainingAmt)}`}
                      bold
                    />
                    <div className="grid grid-cols-[120px_12px_minmax(0,1fr)] items-center py-1 text-[11.5px]">
                      <span className="font-semibold text-slate-600">{s.t("lbl_payment_status", "Payment Status")}</span>
                      <span className="font-bold text-slate-400">:</span>
                      <div>
                        <span
                          className={`inline-block rounded-md px-2.5 py-0.5 text-[11px] font-black ${
                            isPaid
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : isPartial
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-red-100 text-red-700 border border-red-200"
                          }`}
                        >
                          {isPaid
                            ? s.t("st_paid", "Paid")
                            : isPartial
                            ? s.t("st_partial", "Partial")
                            : s.t("st_unpaid", "Unpaid")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 3: Loading / Transfer Conditions */}
                <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
                  <div className="flex items-center gap-2 border-b border-blue-100 bg-gradient-to-r from-[#dbeafe] via-[#eff6ff] to-white px-3 py-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#1e4b8f] text-white">
                      <Truck className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="text-xs font-black text-[#0f2942]">
                      {s.t("card_loading_conditions", "Loading / Transfer Conditions")}
                    </h3>
                  </div>
                  <div className="px-3 py-2">
                    <KVRow
                      label={s.t("lbl_transaction_type", "Transaction Type")}
                      value={
                        transferMode === "loading"
                          ? s.t("mode_loading", "Loading")
                          : transferMode === "warehouse"
                          ? s.t("mode_warehouse", "Warehouse")
                          : s.t("mode_stock", "Stock")
                      }
                    />
                    <KVRow
                      label={s.t("lbl_loading_from", "Loading From")}
                      value={
                        purchase?.warehouseName ||
                        `Supplier Warehouse (${purchase?.originCountryName || "KSA"})`
                      }
                    />
                    <KVRow
                      label={s.t("lbl_loading_date", "Loading Date")}
                      value={formatDisplayDate(transferDate || purchase?.transferDate)}
                    />
                    <KVRow
                      label={s.t("lbl_transport_mode", "Transport Mode")}
                      value={purchase?.shippingMode || "Road (Truck)"}
                    />
                    <KVRow label={s.t("lbl_exit_border", "Exit Border")} value="Ghuwaifat (KSA → UAE)" />
                    <KVRow
                      label={s.t("lbl_receiving_at", "Receiving At")}
                      value={selectedWarehouseObj?.warehouse_name || "Dubai – Al Ras Warehouse"}
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: Terms & Conditions + Remarks */}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {/* Terms & Conditions */}
                <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
                  <div className="flex items-center gap-2 border-b border-blue-100 bg-gradient-to-r from-[#dbeafe] via-[#eff6ff] to-white px-3 py-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#1e4b8f] text-white">
                      <FileText className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="text-xs font-black text-[#0f2942]">
                      {s.t("card_terms_conditions", "Terms & Conditions")}
                    </h3>
                  </div>
                  <ol className="list-decimal space-y-1 py-2.5 ps-7 pe-3 text-[11.5px] font-medium text-slate-700">
                    <li>
                      {s.t(
                        "term_1",
                        "Goods received in good condition are subject to company purchase policy."
                      )}
                    </li>
                    <li>
                      {s.t(
                        "term_2",
                        "VAT and taxable amounts are calculated according to the applicable tax-invoice requirements."
                      )}
                    </li>
                    <li>
                      {s.t("term_3", "This voucher is generated from the ERP local purchase module.")}
                    </li>
                  </ol>
                </div>

                {/* Remarks */}
                <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
                  <div className="flex items-center gap-2 border-b border-blue-100 bg-gradient-to-r from-[#dbeafe] via-[#eff6ff] to-white px-3 py-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#1e4b8f] text-white">
                      <MessageSquare className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="text-xs font-black text-[#0f2942]">{s.t("card_remarks", "Remarks")}</h3>
                  </div>
                  <div className="p-3 text-[11.5px] font-medium leading-relaxed text-slate-700">
                    {purchase?.remarks ||
                      s.t(
                        "default_remarks",
                        "Local purchase for warehouse stock. Goods loaded as per agreed configuration and quantity."
                      )}
                  </div>
                </div>
              </div>

              {/* Advanced Lot Routing Drawer Trigger when Transfer tab is clicked */}
              {activeTab === "transfer" && lots.length > 0 ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-bold text-[#0f2942]">
                      {s.t("lot_routing_title", "Lot Balances & Multi-Purpose Routing (Export / 3P / Inter-Country)")}
                    </div>
                    {lots[0]?.stock?.[0] ? (
                      <button
                        type="button"
                        onClick={() => setPick({ lot: lots[0], row: lots[0].stock[0] })}
                        className="rounded-lg bg-[#1e4b8f] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#153668]"
                      >
                        {s.t("open_purpose_picker", "Open Full Purpose Picker")}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* RIGHT COLUMN: "Transfer to" Verification & Action Panel */}
          <aside className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-emerald-200/80 bg-gradient-to-r from-[#dcfce7] via-[#ecfdf5] to-white px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-2xs">
                  <ArrowRightLeft className="h-4 w-4" />
                </div>
                <h2 className="text-base font-black text-[#0f2942]">{s.t("panel_transfer_to", "Transfer to")}</h2>
              </div>
              {lots[0]?.stock?.[0] ? (
                <button
                  type="button"
                  onClick={() => setPick({ lot: lots[0], row: lots[0].stock[0] })}
                  className="text-[11px] font-bold text-blue-700 hover:underline"
                >
                  {s.t("more_options", "More Options")}
                </button>
              ) : null}
            </div>

            <div className="space-y-4 p-4">
              {/* 3 Radio Mode Cards */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    id: "loading",
                    title: s.t("mode_loading", "Loading"),
                    sub: s.t("mode_loading_sub", "(To be Loaded)"),
                  },
                  {
                    id: "warehouse",
                    title: s.t("mode_warehouse", "Warehouse"),
                    sub: s.t("mode_warehouse_sub", "(Receive / In)"),
                  },
                  {
                    id: "stock",
                    title: s.t("mode_stock", "Stock"),
                    sub: s.t("mode_stock_sub", "(Confirm Stock)"),
                  },
                ].map((m) => {
                  const selected = transferMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setTransferMode(m.id as any)}
                      className={`flex flex-col items-start rounded-xl border p-2.5 text-start transition ${
                        selected
                          ? "border-blue-600 bg-blue-50/70 ring-1 ring-blue-500/40"
                          : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/70"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                            selected ? "border-blue-600 bg-blue-600" : "border-slate-400 bg-white"
                          }`}
                        >
                          {selected ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                        </span>
                        <span className={`text-xs font-black ${selected ? "text-[#0f2942]" : "text-slate-700"}`}>
                          {m.title}
                        </span>
                      </div>
                      <span className="mt-0.5 ps-5 text-[10px] font-medium text-slate-500">{m.sub}</span>
                    </button>
                  );
                })}
              </div>

              {/* Transfer To (Branch/User) * */}
              <div>
                <label className="mb-1.5 block text-xs font-black text-slate-800">
                  {s.t("lbl_transfer_to_branch", "Transfer To (Branch/User)")}{" "}
                  <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedDestId}
                    onChange={(e) => setSelectedDestId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-300 bg-white ps-3 pe-8 text-xs font-bold text-slate-800 shadow-2xs outline-none focus:border-blue-600"
                  >
                    {warehouses.length > 0 ? (
                      warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          UAE – {w.warehouse_name} ({w.warehouse_code})
                        </option>
                      ))
                    ) : (
                      <option value="default">{selectedDestDisplay}</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Transfer Date * */}
              <div>
                <label className="mb-1.5 block text-xs font-black text-slate-800">
                  {s.t("lbl_transfer_date", "Transfer Date")} <span className="text-red-600">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 shadow-2xs outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Transfer Note / Audit Remark * */}
              <div>
                <label className="mb-1.5 block text-xs font-black text-slate-800">
                  {s.t("lbl_transfer_note", "Transfer Note / Audit Remark")} <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={3}
                  maxLength={250}
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs font-medium leading-relaxed text-slate-800 shadow-2xs outline-none focus:border-blue-600"
                />
                <div className="mt-1 text-end text-[11px] font-semibold text-slate-400">
                  {transferNote.length} / 250
                </div>
              </div>

              {/* Verification Checklist */}
              <div className="rounded-xl border border-blue-200/90 bg-[#f0f7ff] p-3.5">
                <div className="mb-2.5 flex items-center gap-2 border-b border-blue-200/60 pb-2">
                  <ShieldCheck className="h-4 w-4 text-[#1e4b8f]" />
                  <h3 className="text-xs font-black text-[#0f2942]">
                    {s.t("lbl_verification_checklist", "Verification Checklist")}
                  </h3>
                </div>
                <div className="space-y-2 text-xs font-semibold text-slate-800">
                  <button
                    type="button"
                    onClick={() => setChkPosted((v) => !v)}
                    className="flex w-full items-center gap-2.5 text-start"
                  >
                    {chkPosted ? (
                      <CheckSquare className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Square className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                    <span>{s.t("chk_voucher_posted", "Voucher status is Posted.")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChkPayment((v) => !v)}
                    className="flex w-full items-center gap-2.5 text-start"
                  >
                    {chkPayment ? (
                      <CheckSquare className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Square className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                    <span>{s.t("chk_payment_verified", "Payment condition verified.")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChkGoods((v) => !v)}
                    className="flex w-full items-center gap-2.5 text-start"
                  >
                    {chkGoods ? (
                      <CheckSquare className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Square className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                    <span>{s.t("chk_goods_verified", "Goods and quantity verified.")}</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-[1fr_110px] gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={quickBusy || !chkPosted || !chkPayment || !chkGoods}
                  onClick={() => void handleConfirmQuickTransfer()}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#16a34a] to-[#15803d] px-4 text-xs font-black text-white shadow-md shadow-emerald-700/20 transition hover:from-[#15803d] hover:to-[#166534] disabled:opacity-50"
                >
                  {quickBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="h-4 w-4" />
                  )}
                  {s.t("btn_confirm_and_transfer", "Confirm & Transfer")}
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/purchase/local-purchase")}
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <X className="h-4 w-4 text-slate-500" />
                  {s.t("cancel", "Cancel")}
                </button>
              </div>
            </div>
          </aside>
        </div>

        {/* Bottom Full-Width Section: Transfer History */}
        <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-gradient-to-r from-[#e8f0fe] via-[#f1f5f9] to-white px-4 py-2.5">
            <Clock className="h-4 w-4 text-[#1e4b8f]" />
            <h2 className="text-sm font-black text-[#0f2942]">{s.t("sec_transfer_history", "Transfer History")}</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/90 text-[11px] font-black text-slate-700">
                  <th className="px-3 py-2.5 text-center">#</th>
                  <th className="px-3 py-2.5 text-start">{s.t("th_transfer_date", "Transfer Date")}</th>
                  <th className="px-3 py-2.5 text-start">{s.t("th_from", "From")}</th>
                  <th className="px-3 py-2.5 text-start">{s.t("th_to_branch_user", "To (Branch/User)")}</th>
                  <th className="px-3 py-2.5 text-start">{s.t("th_transfer_type", "Transfer Type")}</th>
                  <th className="px-3 py-2.5 text-end">{s.t("th_qty", "Qty")}</th>
                  <th className="px-3 py-2.5 text-end">{s.t("th_net_wt_kg", "Net Wt (Kg)")}</th>
                  <th className="px-3 py-2.5 text-center">{s.t("th_status", "Status")}</th>
                  <th className="px-3 py-2.5 text-start">{s.t("th_note", "Note")}</th>
                  <th className="px-3 py-2.5 text-start">{s.t("th_by", "By")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {transfers.length > 0 ? (
                  transfers.map((t, idx) => {
                    const lot = lotById.get(t.lot_id);
                    const sale = (data?.sales as Json[] | undefined)?.find((x) => x.id === t.sales_order_id);
                    const destText =
                      t.purpose === "third_party_warehouse"
                        ? `${t.provider_name} — ${t.provider_city}`
                        : t.dest_warehouse_name
                        ? `UAE – ${t.dest_warehouse_name} (${t.dest_warehouse_code ?? "WARE-001"})`
                        : sale
                        ? `${sale.sales_order_no} · ${sale.customer_name ?? ""}`
                        : selectedDestDisplay;
                    const typeText =
                      t.purpose === "hold"
                        ? "Loading"
                        : t.purpose === "own_warehouse"
                        ? "Warehouse"
                        : purposeLabel(t.purpose);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2.5 text-center font-bold text-slate-700">{idx + 1}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800">
                          {formatDisplayDateTime(t.created_at)}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800">
                          {voucherNo} ({s.t("bc_local_purchase", "Local Purchase")})
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800">{destText}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800">{typeText}</td>
                        <td className="px-3 py-2.5 text-end font-black tabular-nums text-slate-900">
                          {qtyFmt(t.qty)}
                        </td>
                        <td className="px-3 py-2.5 text-end font-black tabular-nums text-slate-900">
                          {fmt(lot?.net_weight_kg ?? totals.net)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <StatusPill s={s} status={t.status} />
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-700">
                          {t.notes || s.t("default_history_note", "Initial transfer to Loading.")}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800">SA (Super Admin)</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5 text-center font-bold text-slate-700">1</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800">
                      {formatDisplayDateTime(purchase?.postedAt || purchase?.transferDate)}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800">
                      {voucherNo} ({s.t("bc_local_purchase", "Local Purchase")})
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800">{selectedDestDisplay}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800">Loading</td>
                    <td className="px-3 py-2.5 text-end font-black tabular-nums text-slate-900">
                      {qtyFmt(totals.qty)}
                    </td>
                    <td className="px-3 py-2.5 text-end font-black tabular-nums text-slate-900">
                      {fmt(totals.net)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <StatusPill s={s} status="transferred" />
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-700">
                      {s.t("default_history_note", "Initial transfer to Loading.")}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800">SA (Super Admin)</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Purpose Picker Modal */}
        {pick ? (
          <FullScreen
            s={s}
            title={s.t("pick_title", "Where will these goods go?")}
            subtitle={`${pick.lot.goods_name} · ${pick.lot.lot_ref} · ${qtyFmt(pick.row.qty)} @ ${placeLabel(
              pick.row
            )}${pick.row.rack_bin ? `/${pick.row.rack_bin}` : ""}`}
            onClose={() => setPick(null)}
          >
            <p className="text-xs text-slate-500">
              {s.t("pick_hint", "Choose one purpose. Each opens its own linked form; nothing is posted until you confirm there.")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {PURPOSES.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setForm({ purpose: id, lot: pick.lot, row: pick.row });
                    setPick(null);
                  }}
                  className={`flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-500 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 ${s.textStart}`}
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                  <span>
                    <span className="block text-sm font-black">{purposeLabel(id)}</span>
                    <span className="block text-[11px] text-slate-500">{s.t(`purpose_${id}_desc`, "")}</span>
                  </span>
                </button>
              ))}
            </div>
          </FullScreen>
        ) : null}

        {form ? (
          <TransferForm
            s={s}
            purchaseId={purchaseId}
            data={data}
            purpose={form.purpose}
            lot={form.lot}
            row={form.row}
            onClose={() => setForm(null)}
            onDone={async (text) => {
              setForm(null);
              setToast({ kind: "ok", text });
              await load();
            }}
            onError={(text) => setToast({ kind: "err", text })}
            placeLabel={placeLabel}
          />
        ) : null}

        {action ? (
          <ActionModal
            s={s}
            action={action}
            lotById={lotById}
            countryId={purchase?.countryId}
            onClose={() => setAction(null)}
            onSubmit={async (payload) => {
              const t = action.transfer;
              let ok = false;
              if (action.kind === "tradeCancel") {
                const r = await api("POST", `/api/erp/inter-country-trades/${t.trade.id}`, {
                  action: "cancel",
                  reason: payload.reason,
                });
                if (r.ok) {
                  setToast({
                    kind: "ok",
                    text: s.t("trade_cancelled_ok", "Trade cancelled; postings reversed and stock returned."),
                  });
                  await load();
                  ok = true;
                } else setToast({ kind: "err", text: r.error });
              } else if (action.kind === "cancel") {
                ok = await doAction(t.id, { action: "cancel", reason: payload.reason }, s.t("cancelled_ok", "Transfer reversed."));
              } else {
                ok = await doAction(
                  t.id,
                  { action: "post_cost", cogsLedgerId: payload.cogsLedgerId },
                  s.t("cost_ok", "Cost of sales posted.")
                );
              }
              if (ok) setAction(null);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function ActionModal({
  s,
  action,
  lotById,
  countryId,
  onClose,
  onSubmit,
}: {
  s: S;
  action: { kind: "cancel" | "cost" | "tradeCancel"; transfer: Json };
  lotById: Map<string, Json>;
  countryId: string;
  onClose: () => void;
  onSubmit: (p: Json) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [cogs, setCogs] = useState<{ id: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const t = action.transfer;
  const lot = lotById.get(t.lot_id);
  const amount = lot ? (Number(t.qty) * Number(lot.original_cost)) / Number(lot.qty_purchased) : 0;
  const submit = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await onSubmit({ reason, cogsLedgerId: cogs?.id });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const isCost = action.kind === "cost";
  const valid = isCost ? !!cogs : reason.trim().length >= 3;
  return (
    <FullScreen
      s={s}
      title={isCost ? s.t("cost_title", "Post cost of sales") : s.t("reverse_title", "Cancel / return transfer")}
      subtitle={`${t.transfer_no} · ${lot?.goods_name ?? ""} · ${qtyFmt(t.qty)}`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold"
          >
            {s.t("close", "Close")}
          </button>
          <button
            type="button"
            disabled={!valid || busy}
            onClick={() => void submit()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{" "}
            {isCost ? s.t("confirm_post", "Confirm & post") : s.t("confirm_reverse", "Confirm reversal")}
          </button>
        </>
      }
    >
      {isCost ? (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-2 font-black">{s.t("cost_preview", "Posting preview")}</div>
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="py-1">{s.t("dr_cogs", "DR  Cost of sales (selected ledger)")}</td>
                  <td className={`font-mono ${s.textEnd}`}>
                    {lot?.currency_code} {fmt(amount)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1">{s.t("cr_inventory", "CR  Inventory (the lot's purchase ledger)")}</td>
                  <td className={`font-mono ${s.textEnd}`}>
                    {lot?.currency_code} {fmt(amount)}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-slate-500">
              {s.t(
                "cost_note",
                "Posted at the lot's posted purchase cost, once. The sale itself (customer / sales entries) was already posted by the Sales Order."
              )}
            </p>
          </div>
          <Picker
            s={s}
            label={s.t("cogs_ledger", "Cost of sales ledger")}
            kind="ledger"
            countryId={countryId}
            value={cogs}
            onChange={setCogs}
            hint={s.t("ledger_hint", "Existing ledgers only; nothing is created automatically.")}
          />
        </>
      ) : (
        <Field s={s} label={s.t("reason", "Reason")}>
          <textarea className={`${inputCls} h-24 py-2`} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      )}
    </FullScreen>
  );
}

function TransferForm({
  s,
  purchaseId,
  data,
  purpose,
  lot,
  row,
  onClose,
  onDone,
  onError,
  placeLabel,
}: {
  s: S;
  purchaseId: string;
  data: Json;
  purpose: PurposeId;
  lot: Json;
  row: Json;
  onClose: () => void;
  onDone: (text: string) => Promise<void>;
  onError: (t: string) => void;
  placeLabel: (r: Json) => string;
}) {
  const router = useRouter();
  const idem = useRef(newKey());
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const maxQty = Number(row.qty);
  const [qty, setQty] = useState<string>(String(maxQty));
  const [notes, setNotes] = useState("");
  const [rack, setRack] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [branchId, setBranchId] = useState(data.branches?.[0]?.id ?? "");
  const [truck, setTruck] = useState("");
  const [driver, setDriver] = useState("");
  const [loadDate, setLoadDate] = useState(new Date().toISOString().slice(0, 10));
  const [provider, setProvider] = useState<{ id: string; text: string } | null>(null);
  const [pName, setPName] = useState("");
  const [pCity, setPCity] = useState("");
  const [pAddr, setPAddr] = useState("");
  const [pRef, setPRef] = useState("");
  const [pCharge, setPCharge] = useState("");
  const [pCur, setPCur] = useState(lot.currency_code || "");
  const [opts, setOpts] = useState<Json>(null);
  const [tBranch, setTBranch] = useState("");
  const [tCity, setTCity] = useState("");
  const [tWh, setTWh] = useState("");
  const [rate, setRate] = useState("");
  const [saleRate, setSaleRate] = useState("");
  const [lRecv, setLRecv] = useState<any>(null);
  const [lSales, setLSales] = useState<any>(null);
  const [lCogs, setLCogs] = useState<any>(null);
  const [lDestInv, setLDestInv] = useState<any>(null);
  const [lDestPay, setLDestPay] = useState<any>(null);
  const [mode, setMode] = useState("Road");
  const [confirmed, setConfirmed] = useState(false);

  const whs: Json[] = (data.warehouses ?? []).filter((w: Json) => w.country_id === lot.country_id);
  useEffect(() => {
    if (purpose !== "export_dgt_branch") return;
    void api("GET", `/api/erp/goods-transfers/trade-options?countryId=${lot.country_id}&lang=${s.lang}`).then((r) => {
      if (r.ok) setOpts(r.data);
    });
  }, [purpose, lot.country_id, s.lang]);

  const qn = Number(qty);
  const qtyOk = qn > 0 && qn <= maxQty + 0.00005;
  const tb = opts?.branches?.find((b: Json) => b.id === tBranch);
  const sourceAmt = qn * Number(saleRate || 0);
  const destAmt = sourceAmt * Number(rate || 0);
  const costAmt = (qn * Number(lot.original_cost)) / Number(lot.qty_purchased);

  const finish = async (r: { ok: boolean; data: Json; error: string }, okText: string) => {
    if (r.ok) await onDone(okText);
    else {
      setErr(r.error);
      onError(r.error);
    }
  };
  const submit = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setErr("");
    try {
      const J = `/api/erp/purchases/local-purchase/${purchaseId}/goods-transfer`;
      const source = {
        warehouseId: row.warehouse_id ?? null,
        label: row.location_label ?? "",
        rack: row.rack_bin ?? "",
      };
      if (purpose === "own_warehouse") {
        await finish(
          await api("POST", J, {
            lotId: lot.id,
            purpose,
            qty: qn,
            idempotencyKey: idem.current,
            source,
            dest: { warehouseId, rack },
            notes,
          }),
          s.t("done_own", "Stock moved. No financial entry was posted.")
        );
      } else if (purpose === "dgt_warehouse") {
        await finish(
          await api("POST", J, {
            lotId: lot.id,
            purpose,
            qty: qn,
            idempotencyKey: idem.current,
            source,
            dest: { warehouseId, countryBranchId: branchId, rack },
            transport: { truck, driver, loadingDate: loadDate },
            notes,
          }),
          s.t("done_dgt", "Dispatched. The quantity is In Transit until the destination receives it.")
        );
      } else if (purpose === "third_party_warehouse") {
        await finish(
          await api("POST", J, {
            lotId: lot.id,
            purpose,
            qty: qn,
            idempotencyKey: idem.current,
            source,
            provider: {
              accountId: provider?.id,
              name: pName,
              city: pCity,
              address: pAddr,
              contractRef: pRef,
              storageCharge: pCharge === "" ? null : Number(pCharge),
              chargeCurrency: pCur,
            },
            notes,
          }),
          s.t("done_3p", "Goods placed with the third-party warehouse. They remain DGT stock.")
        );
      } else if (purpose === "hold") {
        await finish(
          await api("POST", J, { lotId: lot.id, purpose, qty: qn, idempotencyKey: idem.current, source, notes }),
          s.t("done_hold", "Recorded: the goods stay at their current location.")
        );
      } else if (purpose === "export_dgt_branch") {
        await finish(
          await api("POST", J, {
            lotId: lot.id,
            purpose,
            qty: qn,
            idempotencyKey: idem.current,
            source,
            destCountryBranchId: tBranch,
            destCityBranchId: tCity || null,
            destBranchCode: tb?.code ?? "",
            destWarehouseId: tWh,
            approvedExchangeRate: Number(rate),
            saleUnitRate: Number(saleRate),
            ledgers: {
              receivable: lRecv?.id,
              sales: lSales?.id,
              cogs: lCogs?.id,
              destInventory: lDestInv?.id,
              destPayable: lDestPay?.id,
            },
            transport: { mode, truck, driver, loadingDate: loadDate },
            notes,
          }),
          s.t("done_trade", "Inter-Country Trade created: source sale posted, destination purchase is In Transit.")
        );
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const title = s.t(`purpose_${purpose}`, PURPOSE_DEFAULTS[purpose]);
  const subtitle = `${lot.goods_name} · ${lot.lot_ref} · ${s.t("from", "From")}: ${placeLabel(row)}${
    row.rack_bin ? `/${row.rack_bin}` : ""
  } (${qtyFmt(maxQty)})`;

  if (purpose === "local_sale" || purpose === "export_customer") {
    const mode2 = purpose === "export_customer" ? "export" : "local";
    const url = `/dashboard/sales/new-sales-booking-order?lotId=${lot.id}&wh=${
      row.warehouse_id ?? ""
    }&rack=${encodeURIComponent(row.rack_bin ?? "")}&label=${encodeURIComponent(
      row.location_label ?? ""
    )}&mode=${mode2}`;
    return (
      <FullScreen
        s={s}
        title={title}
        subtitle={subtitle}
        onClose={onClose}
        footer={
          <>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold"
            >
              {s.t("close", "Close")}
            </button>
            <button
              type="button"
              onClick={() => router.push(url)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white"
            >
              {purpose === "export_customer"
                ? s.t("open_export_draft", "Open Export Sales Order")
                : s.t("open_sale_draft", "Open Local Sales Draft")}
            </button>
          </>
        }
      >
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 text-sm font-black">{s.t("prefill_title", "The sales form opens pre-filled with:")}</div>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-bold uppercase text-slate-500">{s.t("goods_lot", "Goods and lot")}</dt>
              <dd className="font-semibold">
                {lot.goods_name} · {lot.lot_ref}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase text-slate-500">
                {s.t("source_wh", "Source warehouse")}
              </dt>
              <dd className="font-semibold">
                {placeLabel(row)}
                {row.rack_bin ? `/${row.rack_bin}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase text-slate-500">{s.t("q_available", "Available")}</dt>
              <dd className="font-semibold">
                {qtyFmt(maxQty)} {lot.unit_name}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase text-slate-500">
                {s.t("cost_basis", "Cost / landed cost per unit")}
              </dt>
              <dd className="font-semibold">
                {lot.currency_code} {fmt(Number(lot.original_cost) / Number(lot.qty_purchased))} / {fmt(lot.unit_cost)}
              </dd>
            </div>
          </dl>
        </div>
      </FullScreen>
    );
  }

  const canSubmit =
    qtyOk &&
    !busy &&
    (purpose === "own_warehouse"
      ? !!warehouseId
      : purpose === "dgt_warehouse"
      ? !!warehouseId && !!branchId
      : purpose === "third_party_warehouse"
      ? !!provider &&
        !!pName.trim() &&
        !!pCity.trim() &&
        !!pAddr.trim() &&
        !!pRef.trim() &&
        pCharge !== "" &&
        !!pCur.trim()
      : purpose === "export_dgt_branch"
      ? !!tBranch &&
        !!tWh &&
        Number(rate) > 0 &&
        Number(saleRate) > 0 &&
        !!lRecv &&
        !!lSales &&
        !!lCogs &&
        !!lDestInv &&
        !!lDestPay &&
        confirmed
      : true);

  return (
    <FullScreen
      s={s}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <>
          {err ? <span className="me-auto text-[11px] font-semibold text-red-600">{err}</span> : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold"
          >
            {s.t("close", "Close")}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {purpose === "export_dgt_branch"
              ? s.t("confirm_trade", "Confirm & post trade")
              : s.t("confirm_transfer", "Confirm transfer")}
          </button>
        </>
      }
    >
      <Field
        s={s}
        label={s.t("qty_label", "Quantity to move")}
        hint={`${s.t("max", "Maximum")}: ${qtyFmt(maxQty)} ${lot.unit_name}`}
      >
        <input
          className={inputCls}
          type="number"
          min="0"
          step="any"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
      </Field>
      {!qtyOk ? (
        <p className="text-[11px] font-semibold text-red-600">
          {s.t("qty_err", "Enter a quantity greater than zero and not more than what is available at this place.")}
        </p>
      ) : null}

      {purpose === "own_warehouse" ? (
        <>
          <Field s={s} label={s.t("warehouse", "Warehouse (Warehouse Master)")}>
            <select className={inputCls} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">{s.t("select", "Select…")}</option>
              {whs.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.warehouse_code} — {w.warehouse_name}
                </option>
              ))}
            </select>
          </Field>
          <Field s={s} label={s.t("rack_dest", "Destination rack / bin (optional)")}>
            <input className={inputCls} value={rack} onChange={(e) => setRack(e.target.value)} />
          </Field>
        </>
      ) : null}

      {purpose === "dgt_warehouse" ? (
        <>
          <Field s={s} label={s.t("dest_branch", "Destination branch")}>
            <select className={inputCls} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {(data.branches ?? []).map((b: Json) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field s={s} label={s.t("dest_wh", "Destination warehouse")}>
            <select className={inputCls} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">{s.t("select", "Select…")}</option>
              {whs
                .filter((w) => w.id !== row.warehouse_id)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.warehouse_code} — {w.warehouse_name}
                  </option>
                ))}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field s={s} label={s.t("truck", "Truck / vehicle")}>
              <input className={inputCls} value={truck} onChange={(e) => setTruck(e.target.value)} />
            </Field>
            <Field s={s} label={s.t("driver", "Driver")}>
              <input className={inputCls} value={driver} onChange={(e) => setDriver(e.target.value)} />
            </Field>
            <Field s={s} label={s.t("loading_date", "Loading date")}>
              <input
                className={inputCls}
                type="date"
                value={loadDate}
                onChange={(e) => setLoadDate(e.target.value)}
              />
            </Field>
          </div>
        </>
      ) : null}

      {purpose === "third_party_warehouse" ? (
        <>
          <Picker
            s={s}
            label={s.t("provider_account", "Warehouse provider account")}
            kind="account"
            countryId={lot.country_id}
            value={provider}
            onChange={(v) => {
              setProvider(v);
              if (v && !pName) setPName(v.text.split("—").slice(1).join("—").trim());
            }}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field s={s} label={s.t("wh_name", "Warehouse name")}>
              <input className={inputCls} value={pName} onChange={(e) => setPName(e.target.value)} />
            </Field>
            <Field s={s} label={s.t("contract", "Contract / reference")}>
              <input className={inputCls} value={pRef} onChange={(e) => setPRef(e.target.value)} />
            </Field>
            <Field s={s} label={s.t("city", "City")}>
              <input className={inputCls} value={pCity} onChange={(e) => setPCity(e.target.value)} />
            </Field>
            <Field s={s} label={s.t("address", "Address")}>
              <input className={inputCls} value={pAddr} onChange={(e) => setPAddr(e.target.value)} />
            </Field>
            <Field s={s} label={s.t("storage_charge", "Storage / handling charge")}>
              <input
                className={inputCls}
                type="number"
                min="0"
                step="any"
                value={pCharge}
                onChange={(e) => setPCharge(e.target.value)}
              />
            </Field>
            <Field s={s} label={s.t("charge_currency", "Charge currency")}>
              <input className={inputCls} value={pCur} onChange={(e) => setPCur(e.target.value.toUpperCase())} />
            </Field>
          </div>
        </>
      ) : null}

      {purpose === "export_dgt_branch" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field s={s} label={s.t("dest_branch", "Destination branch")}>
              <select
                className={inputCls}
                value={tBranch}
                onChange={(e) => {
                  setTBranch(e.target.value);
                  setTWh("");
                  setTCity("");
                }}
              >
                <option value="">{s.t("select", "Select…")}</option>
                {(opts?.branches ?? []).map((b: Json) => (
                  <option key={b.id} value={b.id}>
                    {b.country_name} — {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field s={s} label={s.t("branch_code", "Branch code")}>
              <input className={`${inputCls} bg-slate-100`} readOnly value={tb?.code ?? ""} />
            </Field>
            <Field s={s} label={s.t("dest_city", "Destination city branch (optional)")}>
              <select className={inputCls} value={tCity} onChange={(e) => setTCity(e.target.value)}>
                <option value="">—</option>
                {(opts?.cities ?? [])
                  .filter((c: Json) => c.country_branch_id === tBranch)
                  .map((c: Json) => (
                    <option key={c.id} value={c.id}>
                      {c.city_name || c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field s={s} label={s.t("dest_wh", "Destination warehouse")}>
              <select className={inputCls} value={tWh} onChange={(e) => setTWh(e.target.value)}>
                <option value="">{s.t("select", "Select…")}</option>
                {(opts?.warehouses ?? [])
                  .filter((w: Json) => !tb || w.country_id === tb.country_id)
                  .map((w: Json) => (
                    <option key={w.id} value={w.id}>
                      {w.warehouse_code} — {w.warehouse_name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field s={s} label={`${s.t("sale_rate", "Inter-country sale rate")} (${lot.currency_code}/${lot.unit_name})`}>
              <input
                className={inputCls}
                type="number"
                min="0"
                step="any"
                value={saleRate}
                onChange={(e) => setSaleRate(e.target.value)}
              />
            </Field>
            <Field
              s={s}
              label={`${s.t("approved_rate", "Approved exchange rate")} (${lot.currency_code} → ${
                tb?.local_currency ?? "…"
              })`}
            >
              <input
                className={inputCls}
                type="number"
                min="0"
                step="any"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </Field>
            <Field s={s} label={s.t("ship_mode", "Transport mode")}>
              <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value)}>
                {["Road", "Sea", "Air", "Train"].map((m) => (
                  <option key={m} value={m}>
                    {s.t(`mode_${m.toLowerCase()}`, m)}
                  </option>
                ))}
              </select>
            </Field>
            <Field s={s} label={s.t("truck", "Truck / vehicle")}>
              <input className={inputCls} value={truck} onChange={(e) => setTruck(e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Picker
              s={s}
              label={s.t("l_recv", "Inter-country account (receivable) — source")}
              kind="ledger"
              countryId={lot.country_id}
              value={lRecv}
              onChange={setLRecv}
            />
            <Picker
              s={s}
              label={s.t("l_sales", "Export sales ledger — source")}
              kind="ledger"
              countryId={lot.country_id}
              value={lSales}
              onChange={setLSales}
            />
            <Picker
              s={s}
              label={s.t("cogs_ledger", "Cost of sales ledger")}
              kind="ledger"
              countryId={lot.country_id}
              value={lCogs}
              onChange={setLCogs}
            />
            {tb ? (
              <Picker
                s={s}
                label={s.t("l_dest_inv", "Inventory / purchase ledger — destination")}
                kind="ledger"
                countryId={tb.country_id}
                value={lDestInv}
                onChange={setLDestInv}
              />
            ) : null}
            {tb ? (
              <Picker
                s={s}
                label={s.t("l_dest_pay", "Intercompany payable — destination")}
                kind="ledger"
                countryId={tb.country_id}
                value={lDestPay}
                onChange={setLDestPay}
              />
            ) : null}
          </div>
          {Number(saleRate) > 0 && Number(rate) > 0 && qtyOk ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-2 font-black">{s.t("preview_title", "Balanced posting preview")}</div>
              <table className="w-full">
                <tbody>
                  <tr>
                    <td>{s.t("dr_recv", "DR  Inter-country receivable")}</td>
                    <td className={`font-mono ${s.textEnd}`}>
                      {lot.currency_code} {fmt(sourceAmt)}
                    </td>
                  </tr>
                  <tr>
                    <td>{s.t("cr_sales", "CR  Export sales")}</td>
                    <td className={`font-mono ${s.textEnd}`}>
                      {lot.currency_code} {fmt(sourceAmt)}
                    </td>
                  </tr>
                  <tr>
                    <td>{s.t("dr_cogs", "DR  Cost of sales")}</td>
                    <td className={`font-mono ${s.textEnd}`}>
                      {lot.currency_code} {fmt(costAmt)}
                    </td>
                  </tr>
                  <tr>
                    <td>{s.t("dr_dest_inv", "DR  Destination Inventory")}</td>
                    <td className={`font-mono ${s.textEnd}`}>
                      {tb?.local_currency} {fmt(destAmt)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              style={{ width: 18, height: 18, minWidth: 18, minHeight: 18 }}
              className="mt-0.5 shrink-0"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              {s.t(
                "confirm_check",
                "I confirm these goods, quantity, rate and accounts. This posts the source-country sale and cost once."
              )}
            </span>
          </label>
        </>
      ) : null}

      <Field s={s} label={s.t("notes", "Notes (optional)")}>
        <textarea className={`${inputCls} h-20 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </FullScreen>
  );
}
