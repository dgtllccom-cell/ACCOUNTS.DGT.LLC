/**
 * Enum → localized label helpers shared by the Customer Order / Bill screens
 * (register, full-details view, transfer hub). Raw enum values ("by_road",
 * "in_process", "Yes") are data, not UI — every place that renders one goes
 * through these so the screen follows the active ERP language.
 *
 * Keys live in the central dictionary (lib/i18n/ui.ts): reuses `com.mode_by_*`,
 * `com.mv_*`, `com.status_*`, `common.*` and the `cbill.*` / `cod.*` additions.
 */
import { t } from "@/lib/i18n/ui";

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");

/** "By Road" / "by_road" / "road" → localized transport-mode label. Unknown values pass through. */
export function coModeLabel(lang: string, raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const m = norm(s);
  if (m.includes("road")) return t(lang, "com.mode_by_road", "By Road");
  if (m.includes("air")) return t(lang, "com.mode_by_air", "By Air");
  if (m.includes("rail") || m.includes("train")) return t(lang, "com.mode_by_rail", "By Train");
  if (m.includes("sea")) return t(lang, "com.mode_by_sea", "By Sea");
  return s;
}

const MOVEMENTS: Record<string, [string, string]> = {
  import: ["com.mv_import", "Import"],
  export: ["com.mv_export", "Export"],
  re_export: ["com.mv_re_export", "Re-export"],
  up_transit: ["com.mv_up_transit", "Up Transit"],
  down_transit: ["com.mv_down_transit", "Down Transit"],
  transit: ["com.mv_transit", "Transit"],
  domestic: ["com.mv_domestic", "Domestic"],
};

/** "Transit" / "re_export" … → localized movement/operation label. Unknown values pass through. */
export function coMovementLabel(lang: string, raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const hit = MOVEMENTS[norm(s)];
  return hit ? t(lang, hit[0], hit[1]) : s;
}

const STATUSES: Record<string, [string, string]> = {
  draft: ["com.status_draft", "Draft"],
  completed: ["com.status_completed", "Completed"],
  pending: ["common.pending", "Pending"],
  approved: ["com.ord_approved", "Approved"],
  rejected: ["com.ord_rejected", "Rejected"],
  in_process: ["cbill.reg_status_in_process", "In Process"],
  in_progress: ["cbill.reg_status_in_process", "In Process"],
  submitted: ["cbill.status_submitted", "Submitted"],
  posted: ["cbill.status_posted", "Posted to Ledger"],
  paid: ["cbill.status_paid", "Paid"],
  cancelled: ["cbill.status_cancelled", "Cancelled"],
  canceled: ["cbill.status_cancelled", "Cancelled"],
};

/** Order / bill status enum (any casing, spaces or underscores) → localized label. */
export function coStatusLabel(lang: string, raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const hit = STATUSES[norm(s)];
  return hit ? t(lang, hit[0], hit[1]) : s.replace(/_/g, " ");
}

/** "Yes" / "No" stored as English text → localized. Other values pass through. */
export function coYesNoLabel(lang: string, raw: unknown): string {
  const s = String(raw ?? "").trim();
  const m = s.toLowerCase();
  if (m === "yes" || m === "true") return t(lang, "common.yes", "Yes");
  if (m === "no" || m === "false") return t(lang, "common.no", "No");
  return s;
}

/** Customer type enum ("Company") → localized. Other values pass through. */
export function coCustomerTypeLabel(lang: string, raw: unknown): string {
  const s = String(raw ?? "").trim();
  return s.toLowerCase() === "company" ? t(lang, "cod.type_company", "Company") : s;
}

/** Replace `{name}` placeholders in a dictionary template. */
export function coFill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, k) => (k in vars ? vars[k] : `{${k}}`));
}
