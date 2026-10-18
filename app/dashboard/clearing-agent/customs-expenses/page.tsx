"use client";

import React, { useState } from "react";
import { ExpensesBillRegisterView } from "@/features/clearing-agent/components/expenses-bill-register-view";
import { ExpensesBillEntryForm } from "@/features/roznamcha/components/expenses-bill-entry-form";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { ArrowLeft } from "lucide-react";

export default function CustomsExpensesBillPage() {
  const lang = useActiveLanguage();
  const [viewMode, setViewMode] = useState<"register" | "entry">("register");

  return (
    <div className="space-y-4">
      {viewMode === "entry" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMode("register")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Custom Bills Register</span>
            </button>
          </div>
          <ExpensesBillEntryForm lang={lang} initialBillCategory="customs_expenses" />
        </div>
      ) : (
        <ExpensesBillRegisterView
          category="customs"
          onOpenEntryForm={() => setViewMode("entry")}
        />
      )}
    </div>
  );
}
