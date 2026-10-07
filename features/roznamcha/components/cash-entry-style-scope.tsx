"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Palette } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";

/**
 * Cash Entry visual style — appearance ONLY. It sets one attribute (`data-cash-style`) on the page wrapper; the matching CSS in
 * app/cash-entry-styles.css re-skins the existing form. It never touches the form's data, fields, validation or behaviour, and it is
 * stored separately from the Light / Dark / System setting (`erp_theme_mode`), so the two can be combined freely.
 */
export type CashEntryStyle = "standard" | "titanium" | "swiss" | "executive";
const STYLES: CashEntryStyle[] = ["standard", "titanium", "swiss", "executive"];
const STORAGE_KEY = "erp_cash_style";

export function CashEntryStyleScope({ lang, children }: { lang?: string | null; children: ReactNode }) {
  const s = useErpScreen("cashstyle", lang);
  // "standard" on the server and on first paint (no hydration mismatch), then the saved choice
  const [style, setStyle] = useState<CashEntryStyle>("standard");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as CashEntryStyle | null;
      if (saved && STYLES.includes(saved)) setStyle(saved);
    } catch {}
  }, []);
  const choose = (next: CashEntryStyle) => {
    setStyle(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
  };
  const labels: Record<CashEntryStyle, string> = {
    standard: s.t("standard", "Standard"),
    titanium: s.t("titanium", "Titanium Dark FinTech"),
    swiss: s.t("swiss", "Swiss Minimalist"),
    executive: s.t("executive", "Executive Split Desk"),
  };
  return (
    <div className="space-y-2" data-cash-style={style} dir={s.dir}>
      <div className="no-print flex flex-wrap items-center justify-end gap-2" data-cash-style-bar>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
          <Palette className="h-3.5 w-3.5" aria-hidden />
          {s.t("label", "Visual style")}
        </span>
        <div role="radiogroup" aria-label={s.t("label", "Visual style")} className="inline-flex flex-wrap items-center gap-1 rounded-xl border bg-card p-1 shadow-sm">
          {STYLES.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={style === id}
              onClick={() => choose(id)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${style === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              {labels[id]}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">{s.t("hint", "Appearance only — your entries and data are not affected.")}</span>
      </div>
      {children}
    </div>
  );
}
