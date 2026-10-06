import type { SupportedLanguage } from "@/lib/i18n/languages";

export type CallDirection = "inbound" | "outbound";

export type CallStatus =
  | "ringing"
  | "in_progress"
  | "completed"
  | "no_answer"
  | "busy"
  | "failed"
  | "voicemail"
  | "handed_off";

export type CallIntent =
  | "order_status"
  | "balance"
  | "hours"
  | "address"
  | "message"
  | "callback"
  | "agent"
  | "other";

export type NumberMapPurpose = "reception" | "sales" | "support" | "collections" | "outbound";

export interface AiCallNumberMap {
  id: string;
  phone_e164: string;
  label: string | null;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  purpose: NumberMapPurpose;
  default_language: SupportedLanguage;
  greeting_override: string | null;
  announce_recording: boolean;
  assigned_to: string | null;
  is_active: boolean;
}

export interface AiCallRow {
  id: string;
  direction: CallDirection;
  provider: string;
  provider_call_id: string | null;
  from_e164: string | null;
  to_e164: string | null;
  number_map_id: string | null;
  customer_id: string | null;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  language_code: SupportedLanguage;
  status: CallStatus;
  intent: CallIntent | null;
  outcome: string | null;
  recording_url: string | null;
  transcript: string | null;
  duration_seconds: number | null;
  cost_amount: number | null;
  cost_currency: string | null;
  inquiry_id: string | null;
  task_id: string | null;
  created_by: string | null;
  started_at: string;
  ended_at: string | null;
}

/** Normalised, provider-agnostic inbound-call notification. */
export interface InboundCallNotification {
  providerCallId: string;
  fromE164: string;
  toE164: string;
  event: "ringing" | "answered" | "speech" | "dtmf" | "completed";
  speechText?: string;
  dtmf?: string;
  durationSeconds?: number;
  recordingUrl?: string;
}

/** What the dialogue policy returns for the provider to speak / do next. */
export interface DialogueTurn {
  say: string;
  gather?: "speech" | "dtmf" | "none";
  handoff?: boolean;
  hangup?: boolean;
  intent?: CallIntent;
}
