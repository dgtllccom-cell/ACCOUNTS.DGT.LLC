export type InquiryStatus =
  | "new" | "ai_draft" | "confirmed" | "in_progress" | "follow_up"
  | "customer_approved" | "converted" | "closed" | "lost";

export type InquirySource =
  | "meeting" | "phone" | "online" | "whatsapp" | "email" | "walk_in" | "referral" | "exhibition" | "other";

export const INQUIRY_STATUS_ORDER: InquiryStatus[] = [
  "new", "ai_draft", "confirmed", "in_progress", "follow_up", "customer_approved", "converted", "closed", "lost",
];

export const INQUIRY_SOURCES: InquirySource[] = [
  "meeting", "phone", "online", "whatsapp", "email", "walk_in", "referral", "exhibition", "other",
];

export function statusTone(s: InquiryStatus): string {
  switch (s) {
    case "new": return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300";
    case "ai_draft": return "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300";
    case "confirmed": return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300";
    case "in_progress": return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300";
    case "follow_up": return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300";
    case "customer_approved": return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300";
    case "converted": return "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300";
    case "closed": return "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400";
    case "lost": return "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300";
  }
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export type InquiryListItem = {
  id: string;
  inquiry_no: string;
  customer_name: string;
  company_name: string | null;
  contact_person: string | null;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  business_type: string | null;
  inquiry_summary: string | null;
  requirements: string | null;
  source: InquirySource;
  status: InquiryStatus;
  inquiry_date: string;
  follow_up_date: string | null;
  follow_up_overdue: boolean;
  assigned_to: string | null;
  assignee_name: string | null;
  creator_name: string | null;
  country_name: string | null;
  country_branch_name: string | null;
  city_branch_name: string | null;
  customer_id: string | null;
  is_existing_customer: boolean;
  linked_customer_name: string | null;
  linked_task_id: string | null;
  customer_approval_status: string;
  attachment_count: number;
  entry_mode: string;
  created_at: string;
};

export type InquiryDraft = {
  customer_name: string | null;
  company_name: string | null;
  contact_person: string | null;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  business_type: string | null;
  inquiry_summary: string | null;
  meeting_notes: string | null;
  requirements: string | null;
  source: InquirySource | null;
  follow_up_date: string | null;
  confidence: number;
  unmatched: string[];
  customerMatches: { id: string; label: string; score: number }[];
  detectedLanguage: string;
};

/** Web Speech API language tags for the 5 ERP languages. */
export const SPEECH_LANG: Record<string, string> = {
  en: "en-US",
  ur: "ur-PK",
  ps: "ps-AF",
  fa: "fa-IR",
  ar: "ar-AE",
};
