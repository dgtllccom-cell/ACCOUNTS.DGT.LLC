"use client";

import { useState } from "react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { cn } from "@/lib/utils";
import { ConsignmentRegisterView } from "./consignment-register-view";
import { LoadingConsignmentView } from "./loading-consignment-view";

/** Consignment page: the loading destination queue (both purchase sources) plus the existing party Consignment Register. */
export function ConsignmentWorkspace({ lang, initialTab, initialSource, initialQuery }: { lang?: string; initialTab?: string; initialSource?: string; initialQuery?: string }) {
  const active = useActiveLanguage();
  const tr = (s: string) => translateHeader(active, s) || s;
  const [tab, setTab] = useState(initialTab === "register" ? "register" : "loadings");
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-1 rounded-lg border border-slate-200/80 bg-white p-1 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {([
          ["loadings", "Loading Consignments"],
          ["register", "Consignment Register"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-bold transition-all",
              tab === value ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
            )}
          >
            {tr(label)}
          </button>
        ))}
      </div>
      {tab === "loadings" ? <LoadingConsignmentView initialSource={initialSource} initialQuery={initialQuery} /> : <ConsignmentRegisterView lang={lang} />}
    </div>
  );
}

