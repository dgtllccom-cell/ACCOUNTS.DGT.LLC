export const INQUIRY_STATUSES = [
  "new",
  "ai_draft",
  "confirmed",
  "in_progress",
  "follow_up",
  "customer_approved",
  "converted",
  "closed",
  "lost",
] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const INQUIRY_SOURCES = [
  "meeting",
  "phone",
  "online",
  "whatsapp",
  "email",
  "walk_in",
  "referral",
  "exhibition",
  "other",
] as const;
export type InquirySource = (typeof INQUIRY_SOURCES)[number];

export const ENTRY_MODES = ["manual", "ai_text", "ai_voice"] as const;
export type EntryMode = (typeof ENTRY_MODES)[number];

export const CUSTOMER_APPROVAL_STATUSES = ["pending", "approved", "declined", "not_required"] as const;
export type CustomerApprovalStatus = (typeof CUSTOMER_APPROVAL_STATUSES)[number];

export const ORIGINAL_LANGS = ["en", "ur", "ps", "fa", "ar"] as const;

/** Free-text columns that get translated views via `record_translations`. */
export const INQUIRY_TRANSLATABLE_FIELDS = [
  "customer_name",
  "company_name",
  "contact_person",
  "business_type",
  "inquiry_summary",
  "meeting_notes",
  "requirements",
] as const;

export type InquiryRow = {
  id: string;
  inquiry_no: string;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  customer_id: string | null;
  is_existing_customer: boolean;
  customer_name: string;
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
  source: InquirySource;
  inquiry_date: string;
  follow_up_date: string | null;
  assigned_to: string | null;
  status: InquiryStatus;
  ai_raw_input: string | null;
  ai_confidence: number | null;
  entry_mode: EntryMode;
  original_language_code: string;
  customer_approval_status: CustomerApprovalStatus;
  customer_approved_at: string | null;
  customer_approved_note: string | null;
  linked_task_id: string | null;
  converted_customer_id: string | null;
  converted_at: string | null;
  status_note: string | null;
  confirmed_at: string | null;
  closed_at: string | null;
  lost_reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** The structured draft the AI extractor produces for Preview / Confirm. */
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
  /** fields the extractor could not fill — surfaced to the user for confirmation */
  unmatched: string[];
  /** possible existing-customer matches (id + label) for the link step */
  customerMatches: { id: string; label: string; score: number }[];
  detectedLanguage: string;
};
