/**
 * Company Master option lists + their central-dictionary keys (lib/i18n/ui.ts, `company.*`).
 * Stored values are stable codes; labels are always rendered through t(lang, key, fallback).
 */
import { t } from "@/lib/i18n/ui";

export const COMPANY_TYPES = [
  { value: "customer", key: "company.type_customer", en: "Customer Company" },
  { value: "internal", key: "company.type_internal", en: "Internal / Branch Company" },
] as const;

export const LEGAL_STRUCTURE_OPTIONS = [
  { value: "llc", key: "company.ls_llc", en: "LLC — Limited Liability Company" },
  { value: "fzco", key: "company.ls_fzco", en: "FZCO — Free Zone Company" },
  { value: "fze", key: "company.ls_fze", en: "FZE — Free Zone Establishment" },
  { value: "sole_establishment", key: "company.ls_sole", en: "Sole Establishment" },
  { value: "partnership", key: "company.ls_partnership", en: "Partnership" },
  { value: "private_limited", key: "company.ls_private_limited", en: "Private Limited Company" },
  { value: "public_limited", key: "company.ls_public_limited", en: "Public Limited Company" },
  { value: "branch_of_foreign_company", key: "company.ls_foreign_branch", en: "Branch of a Foreign Company" },
  { value: "civil_company", key: "company.ls_civil", en: "Civil Company" },
  { value: "other", key: "company.ls_other", en: "Other" },
] as const;

export const REGISTRATION_TYPE_OPTIONS = [
  { value: "trade_license", key: "company.rt_trade_license", en: "Trade License" },
  { value: "commercial_registration", key: "company.rt_commercial_registration", en: "Commercial Registration" },
  { value: "certificate_of_incorporation", key: "company.rt_incorporation", en: "Certificate of Incorporation" },
  { value: "free_zone_license", key: "company.rt_free_zone", en: "Free Zone License" },
  { value: "professional_license", key: "company.rt_professional", en: "Professional License" },
  { value: "other", key: "company.rt_other", en: "Other Registration" },
] as const;

export const COMPANY_STATUS_OPTIONS = [
  { value: "active", key: "company.status_active", en: "Active" },
  { value: "expired", key: "company.status_expired", en: "Expired" },
  { value: "suspended", key: "company.status_suspended", en: "Suspended" },
  { value: "closed", key: "company.status_closed", en: "Closed" },
] as const;

type Opt = { readonly value: string; readonly key: string; readonly en: string };

/** Label for a stored code; unknown legacy free text is shown as-is (it is data, not chrome). */
export function optionLabel(list: readonly Opt[], value: string | null | undefined, lang: string): string {
  if (!value) return "";
  const o = list.find((x) => x.value === value);
  return o ? t(lang as never, o.key as never, o.en) : value;
}

export const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800",
  expired: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-800",
  suspended: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800",
  closed: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
};
