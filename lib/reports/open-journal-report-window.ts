import { openUniversalPrintReport } from "./universal-print-engine";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { autoTranslate5Languages } from "@/lib/i18n/multilingual-translator";

export type JournalColumn = { key: string; label: string; num?: boolean; align?: "start" | "center" | "end"; width?: string };
export type JournalKpi = { label: string; value: string; tone?: "open" | "current" | "debit" | "credit" | "neutral" };
export type JournalChip = { label: string; value: string | null | undefined };

export type JournalReportConfig = {
  lang?: string;
  autoPrint?: boolean;
  title: string;
  subtitle: string;
  overviewLabel?: string;
  scopeName?: string;
  status?: string;
  chips?: JournalChip[];
  kpis?: JournalKpi[];
  columns: JournalColumn[];
  rows: Array<Record<string, any>>;
  totals?: Record<string, string | number | null | undefined>;
  createdBy?: string;
  reportIdPrefix?: string;
  reportIdValue?: string;
  signatures?: string[];
  orientation?: "portrait" | "landscape" | "auto";
};

export function openJournalReportWindow(config: JournalReportConfig) {
  if (typeof window === "undefined") return;

  const targetLang = (config.lang || (typeof document !== "undefined" ? (localStorage.getItem("erp_lang") || "en") : "en")) as SupportedLanguage;
  const tr = (str: string) => {
    if (!str) return str;
    const res = autoTranslate5Languages(str);
    return res[targetLang] || str;
  };

  const columns = config.columns.map((c) => ({
    key: c.key,
    label: c.label,
    align: c.num || c.align === "end" ? ("right" as const) : c.align === "center" ? ("center" as const) : ("left" as const),
    width: c.width,
    format: c.num ? ("number" as const) : ("text" as const),
  }));

  const filters = (config.chips || [])
    .filter((c) => c.value !== null && c.value !== undefined && String(c.value).trim() !== "")
    .map((c) => ({
      label: c.label,
      value: String(c.value),
    }));

  const kpis = (config.kpis || []).map((k) => ({
    label: k.label,
    value: k.value,
  }));

  const cleanedTotals: Record<string, string | number> = {};
  if (config.totals) {
    for (const [k, v] of Object.entries(config.totals)) {
      if (v !== null && v !== undefined && String(v).trim() !== "") {
        cleanedTotals[k] = v;
      }
    }
  }

  openUniversalPrintReport({
    title: config.title,
    subtitle: config.subtitle,
    documentNo: config.reportIdValue || `${config.reportIdPrefix || "JRN"}-REG`,
    orientation: config.orientation || (columns.length > 7 ? "landscape" : "portrait"),
    reportType: "register",
    scope: {
      scopeLevel: config.scopeName || "Universal Journal Register",
      userName: config.createdBy || "",
    },
    generalBrand: {
      name: (config as any).companyName || "",
      tagline: "UNIVERSAL JOURNAL & AUDIT REGISTER",
    },
    columns,
    rows: config.rows || [],
    totals: Object.keys(cleanedTotals).length > 0 ? cleanedTotals : undefined,
    kpis,
    filters,
    lang: targetLang,
    autoPrint: config.autoPrint,
  });
}

