"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";

/**
 * Universal "Add Expense Bill" entry point for the source screens (Purchase
 * Booking, Local Purchase, Sales Booking, Shipping/BL, Clearing). It never
 * creates a source transaction or a second expense system — it resolves the
 * source bill to its bill_expenses register row (auto-created by the DB trigger
 * when the bill is eligible) and deep-links into the one-page drill-down where
 * the expense lines are added.
 */
export function AddExpenseBillButton({
  sourceId,
  lang: langProp,
  size = "sm",
  variant = "outline",
  className
}: {
  sourceId: string;
  lang?: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "outline" | "ghost" | "default" | "secondary";
  className?: string;
}) {
  const s = useErpScreen("bexp", langProp);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/erp/bill-expenses/resolve?sourceId=${encodeURIComponent(sourceId)}`);
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error?.message || `HTTP ${res.status}`);
      if (!j.data?.id) {
        setMsg(s.t("aeb_not_ready", "This bill is not yet eligible for expenses. Submit / post it first."));
        return;
      }
      router.push(`/dashboard/bill-cost-profit/bill/${j.data.id}`);
    } catch (e: any) {
      setMsg(e?.message || s.t("aeb_failed", "Could not open the expense bill."));
    } finally {
      setBusy(false);
    }
  }

  const iconOnly = size === "icon";
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className}
        onClick={go}
        disabled={busy}
        title={iconOnly ? s.t("aeb_label", "Add Expense Bill") : undefined}
      >
        {busy ? (
          <Loader2 className={`h-4 w-4 animate-spin ${iconOnly ? "" : "me-1"}`} />
        ) : (
          <Coins className={`h-4 w-4 ${iconOnly ? "" : "me-1"}`} />
        )}
        {!iconOnly && s.t("aeb_label", "Add Expense Bill")}
      </Button>
      {msg && <span className="text-[11px] text-amber-600">{msg}</span>}
    </span>
  );
}
