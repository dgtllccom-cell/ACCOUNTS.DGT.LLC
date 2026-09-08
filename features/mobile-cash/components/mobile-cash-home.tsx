"use client";

import Link from "next/link";
import { BookOpen, ClipboardList, ScrollText, Wallet } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { MobileCashShell } from "./mobile-cash-shell";

export function MobileCashHome({ langProp, userName }: { langProp?: SupportedLanguage; userName: string; scopeLabel?: string }) {
  const s = useErpScreen("mcash", langProp);

  const items = [
    { href: "/m/cash/entry", icon: Wallet, key: "menu_entry", fb: "New Cash Entry", subKey: "menu_entry_sub", subFb: "Record a daily cash receipt or payment", tone: "bg-emerald-600" },
    { href: "/m/cash/book", icon: BookOpen, key: "menu_book", fb: "Cash Book", subKey: "menu_book_sub", subFb: "View the day book and roznamcha", tone: "bg-sky-600" },
    { href: "/m/cash/ledger", icon: ClipboardList, key: "menu_ledger", fb: "Ledger Search", subKey: "menu_ledger_sub", subFb: "Find an account and view its ledger", tone: "bg-violet-600" },
    { href: "/m/cash/journal", icon: ScrollText, key: "menu_journal", fb: "Journal", subKey: "menu_journal_sub", subFb: "View journal entries", tone: "bg-amber-600" },
  ] as const;

  return (
    <MobileCashShell title={s.t("app_title", "Cash & Ledger")} langProp={langProp}>
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
        {s.t("hi", "Assalam o Alaikum")}, <span className="text-slate-900 dark:text-slate-100">{userName}</span>
      </p>

      <div className="mt-5 grid gap-3">
        {items.map(({ href, icon: Icon, key, fb, subKey, subFb, tone }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900"
          >
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${tone} text-white`}>
              <Icon className="h-7 w-7" />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-black tracking-tight">{s.t(key, fb)}</span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{s.t(subKey, subFb)}</span>
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-6 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        {s.t("scope_note", "You can work only within your authorized country and branch.")}
      </p>
    </MobileCashShell>
  );
}
