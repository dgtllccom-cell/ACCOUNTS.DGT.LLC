"use client";

import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ExpensesBillRegisterView } from "@/features/clearing-agent/components/expenses-bill-register-view";
import { ExpensesBillEntryForm, type CustomerOrderContext } from "@/features/roznamcha/components/expenses-bill-entry-form";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";
import Link from "next/link";

function OtherExpensesBillPageInner() {
  const lang = useActiveLanguage();
  const searchParams = useSearchParams();

  const orderId = searchParams.get("orderId") || undefined;
  const orderNo = searchParams.get("orderNo") || undefined;
  const customerName = searchParams.get("customerName") || undefined;
  const loadingCountry = searchParams.get("loadingCountry") || undefined;
  const receivingCountry = searchParams.get("receivingCountry") || undefined;
  const goodsName = searchParams.get("goodsName") || undefined;
  const date = searchParams.get("date") || undefined;

  const hasOrderContext = Boolean(orderId || orderNo);

  const customerOrderContext: CustomerOrderContext | undefined = hasOrderContext
    ? { orderId, orderNo, customerName, loadingCountry, receivingCountry, goodsName, date }
    : undefined;

  const [viewMode, setViewMode] = useState<"register" | "entry">(hasOrderContext ? "entry" : "register");

  return (
    <div className="space-y-4">
      {viewMode === "entry" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setViewMode("register")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t(lang, "expreg.back_other", "Back to Other Expenses Register")}</span>
            </button>
            {hasOrderContext && (
              <Link
                href={`/dashboard/clearing-agent/order-transfer${orderId ? `?orderId=${orderId}` : ""}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition shadow-2xs"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                <span>{t(lang, "expreg.back_to_order_transfer", "Back to Order Transfer")}</span>
              </Link>
            )}
          </div>
          <ExpensesBillEntryForm lang={lang} initialBillCategory="other_expenses" customerOrderContext={customerOrderContext} />
        </div>
      ) : (
        <ExpensesBillRegisterView
          category="other"
          onOpenEntryForm={() => setViewMode("entry")}
        />
      )}
    </div>
  );
}

export default function OtherExpensesBillPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading...</div>}>
      <OtherExpensesBillPageInner />
    </Suspense>
  );
}
