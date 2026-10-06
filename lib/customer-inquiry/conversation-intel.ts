/**
 * Conversation Intelligence — deterministic, local (no external AI), reusing the Customer
 * Inquiry extractor. Turns meeting notes, a WhatsApp chat export or an email / document text
 * into: summary, decisions, requirements, action items (owner + due date), important dates and
 * draft follow-up messages. It only PREPARES — the user confirms what is written to the
 * existing Inquiry / User Tasks, and nothing is ever sent.
 */
import { extractInquiryDraft } from "./ai-extract";
import { t } from "@/lib/i18n/ui";

export type Channel = "meeting" | "whatsapp" | "email";
export type ActionItem = { text: string; owner: string | null; ownerSide: "us" | "customer" | "unknown"; dueDate: string | null; priority: "high" | "normal" };
export type ImportantDate = { date: string; kind: "deadline" | "payment" | "delivery" | "expiry" | "meeting" | "other"; context: string };
export type WhatsAppMessage = { date: string | null; time: string | null; sender: string; text: string };

const DECISION_RE = /\b(agreed|agree|decided|confirmed|approved|finali[sz]ed|accepted|signed off|will go with|go ahead|deal done)\b|طے|منظور|اتفاق|تم الاتفاق|وافق|موافقت|توافق|منل شو/i;
const ACTION_VERB = "(send|share|prepare|arrange|call|follow[- ]?up|confirm|deliver|dispatch|pay|transfer|submit|visit|quote|provide|check|book|schedule|review|update|sign|issue|collect|email|whatsapp|revert|finalize|finalise)";
const ACTION_RE = new RegExp(`\\b(will|shall|to|please|pls|need to|needs to|must|should|going to|kindly)\\b[^.!?\\n]{0,60}\\b${ACTION_VERB}\\b|^\\s*(action|todo|to do|next step)s?\\s*[:\\-]|\\b${ACTION_VERB}\\b[^.!?\\n]{0,40}\\b(by|before|until|on)\\b`, "i");
const REQUIRE_RE = /\b(require|requirement|need|needs|looking for|interested in|quantity|qty|budget|specification|spec)\b|ضرورت|چاہیے|يحتاج|نیاز|اړتیا/i;
const URGENT_RE = /\b(urgent|asap|immediately|today|priority|critical)\b|فوری|عاجل|فوري/i;
const DATE_KIND: Array<[ImportantDate["kind"], RegExp]> = [
  ["payment", /\b(pay|payment|paid|invoice|due amount|balance|remit|transfer)\b/i],
  ["delivery", /\b(deliver|delivery|dispatch|shipment|ship|eta|arrival|loading)\b/i],
  // Word stems ("expires", "expiring", "renewal") — no trailing boundary on the stem.
  ["expiry", /\b(expir\w*|valid until|validity|renew\w*)/i],
  ["meeting", /\b(meet|meeting|call|visit|appointment|demo)\b/i],
  ["deadline", /\b(deadline|due|before|by|latest|submit|last date)\b/i],
];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
function addDays(ref: string, n: number) { const d = new Date(`${ref}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return isoOf(d); }
function validDate(y: number, m: number, d: number) {
  if (y < 100) y += 2000;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? isoOf(dt) : null;
}

/** First date mentioned in `s` (absolute or relative to `ref`, YYYY-MM-DD). */
export function findDate(s: string, ref: string): string | null {
  let m = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = s.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
  if (m) return validDate(+m[3], +m[2], +m[1]); // day-first (UAE / PK convention)
  m = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s*(\d{4})?\b/);
  if (m && MONTHS.includes(m[2].slice(0, 3).toLowerCase())) {
    const y = m[3] ? +m[3] : +ref.slice(0, 4);
    const d = validDate(y, MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, +m[1]);
    return d && !m[3] && d < ref ? validDate(y + 1, MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, +m[1]) : d;
  }
  m = s.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?\b/);
  if (m && MONTHS.includes(m[1].slice(0, 3).toLowerCase())) {
    const y = m[3] ? +m[3] : +ref.slice(0, 4);
    return validDate(y, MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, +m[2]);
  }
  const low = s.toLowerCase();
  if (/\btoday\b/.test(low)) return ref;
  if (/\btomorrow\b|کل\b|غدا|فردا|سبا/.test(low)) return addDays(ref, 1);
  m = low.match(/\bin\s+(\d{1,3})\s+days?\b/);
  if (m) return addDays(ref, +m[1]);
  if (/\bnext week\b|اگلے ہفتے|الأسبوع القادم|هفته آینده/.test(low)) return addDays(ref, 7);
  if (/\bend of (the )?month\b/.test(low)) { const d = new Date(`${ref}T00:00:00Z`); return isoOf(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))); }
  if (/\bnext month\b/.test(low)) return addDays(ref, 30);
  m = low.match(/\b(?:by|on|before|next|this)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (m) {
    const cur = new Date(`${ref}T00:00:00Z`).getUTCDay();
    let diff = (WEEKDAYS.indexOf(m[1]) - cur + 7) % 7;
    if (diff === 0) diff = 7;
    return addDays(ref, diff);
  }
  return null;
}

/** WhatsApp "Export chat" text → messages (Android and iOS layouts). Non-matching lines continue the previous message. */
export function parseWhatsAppExport(text: string): WhatsAppMessage[] {
  const re = /^‎?\[?(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s?(?:[AaPp]\.?[Mm]\.?)?)\]?\s*(?:[-–]\s*)?([^:\n]{1,60}):\s?(.*)$/;
  const out: WhatsAppMessage[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(re);
    if (m) out.push({ date: m[1], time: m[2].trim(), sender: m[3].trim(), text: m[4].trim() });
    else if (out.length && line.trim()) out[out.length - 1].text += `\n${line.trim()}`;
  }
  return out.filter((x) => x.text && !/^<media omitted>$|messages and calls are end-to-end encrypted/i.test(x.text));
}

function sentencesOf(text: string) {
  return text.split(/(?<=[.!?؟۔])\s+|\n+/).map((s) => s.replace(/^[-*•\d.)\s]+/, "").trim()).filter((s) => s.length > 2);
}

function ownerOf(sentence: string, customerNames: string[]): { owner: string | null; side: ActionItem["ownerSide"] } {
  const s = sentence.trim();
  if (/^(we|i|our team|us)\b/i.test(s) || /\b(we will|i will|we'll|i'll|our side)\b/i.test(s)) return { owner: null, side: "us" };
  if (/^(they|customer|client|buyer)\b/i.test(s) || /\b(they will|they'll|customer will|client will)\b/i.test(s)) return { owner: null, side: "customer" };
  const m = s.match(/^(?:Mr\.?\s+|Ms\.?\s+|Mrs\.?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:will|to|shall|should|must|is going to)\b/);
  if (m) return { owner: m[1], side: customerNames.some((n) => n && n.toLowerCase().includes(m[1].toLowerCase())) ? "customer" : "unknown" };
  const w = s.match(/^([A-Z][a-z]+):\s/); // WhatsApp "Sender: ..."
  if (w) return { owner: w[1], side: "unknown" };
  return { owner: null, side: "unknown" };
}

export function analyzeConversation(input: { channel: Channel; text: string; refDate: string; lang: string; authorName?: string | null }) {
  const raw = (input.text || "").trim();
  let messages: WhatsAppMessage[] = [];
  let body = raw;
  if (input.channel === "whatsapp") {
    messages = parseWhatsAppExport(raw);
    if (messages.length) body = messages.map((m) => `${m.sender}: ${m.text}`).join("\n");
  }
  const draft = extractInquiryDraft(input.channel === "whatsapp" && messages.length ? messages.map((m) => m.text).join("\n") : body);
  // A WhatsApp chat names its people in the sender column: the first sender is taken as the contact
  // when the text itself names nobody (the user can change it in the preview).
  if (input.channel === "whatsapp" && messages.length && !draft.customer_name) {
    draft.customer_name = messages[0].sender;
    draft.contact_person = draft.contact_person ?? messages[0].sender;
  }
  const customerNames = [draft.customer_name, draft.company_name, draft.contact_person].filter(Boolean) as string[];
  const sents = sentencesOf(body);
  const decisions = [...new Set(sents.filter((s) => DECISION_RE.test(s)))].slice(0, 12);
  const requirements = [...new Set(sents.filter((s) => REQUIRE_RE.test(s)))].slice(0, 12);
  const actions: ActionItem[] = [];
  for (const s of sents) {
    if (!ACTION_RE.test(s)) continue;
    const o = ownerOf(s, customerNames);
    actions.push({ text: s.replace(/^[A-Z][a-z]+:\s/, "").slice(0, 300), owner: o.owner, ownerSide: o.side, dueDate: findDate(s, input.refDate), priority: URGENT_RE.test(s) ? "high" : "normal" });
  }
  const dates: ImportantDate[] = [];
  for (const s of sents) {
    const d = findDate(s, input.refDate);
    if (!d) continue;
    const kind = DATE_KIND.find(([, re]) => re.test(s))?.[0] ?? "other";
    if (!dates.some((x) => x.date === d && x.kind === kind)) dates.push({ date: d, kind, context: s.slice(0, 240) });
  }
  dates.sort((a, b) => a.date.localeCompare(b.date));
  const followUpDate = draft.follow_up_date ?? actions.map((a) => a.dueDate).filter(Boolean).sort()[0] ?? null;
  const lead = sents[0] ?? "";
  const who = draft.company_name || draft.customer_name;
  const summary = [
    who ? `${who}${draft.business_type ? ` (${draft.business_type})` : ""}` : null,
    lead.slice(0, 200),
    decisions.length ? `${decisions.length} ${t(input.lang as never, "ci.sum_decisions" as never, "decision(s)")}` : null,
    actions.length ? `${actions.length} ${t(input.lang as never, "ci.sum_actions" as never, "action item(s)")}` : null,
  ].filter(Boolean).join(" · ");

  return {
    channel: input.channel,
    detectedLanguage: draft.detectedLanguage,
    summary,
    decisions,
    requirements: requirements.length ? requirements : draft.requirements ? [draft.requirements] : [],
    actions,
    dates,
    followUpDate,
    whatsapp: input.channel === "whatsapp" ? { messages: messages.length, participants: [...new Set(messages.map((m) => m.sender))], first: messages[0]?.date ?? null, last: messages[messages.length - 1]?.date ?? null } : null,
    draft,
    replies: draftReplies({ lang: input.lang, channel: input.channel, name: draft.contact_person || draft.customer_name, decisions, actions, requirements, author: input.authorName ?? null }),
  };
}

/** Draft follow-up email + WhatsApp text in the chosen language. Returned for the user to edit and send themselves. */
export function draftReplies(i: { lang: string; channel: Channel; name: string | null; decisions: string[]; actions: ActionItem[]; requirements: string[]; author: string | null }) {
  const L = (k: string, fb: string) => t(i.lang as never, `ci.${k}` as never, fb);
  const greet = i.name ? `${L("reply_dear", "Dear")} ${i.name},` : `${L("reply_hello", "Hello")},`;
  const thanks = i.channel === "meeting" ? L("reply_thanks_meeting", "Thank you for meeting with us today.") : L("reply_thanks_message", "Thank you for your message.");
  const lines: string[] = [greet, "", thanks];
  if (i.decisions.length) { lines.push("", `${L("reply_agreed", "What we agreed")}:`); i.decisions.slice(0, 6).forEach((d) => lines.push(`• ${d}`)); }
  if (i.requirements.length) { lines.push("", `${L("reply_requirements", "Your requirements")}:`); i.requirements.slice(0, 5).forEach((d) => lines.push(`• ${d}`)); }
  if (i.actions.length) {
    lines.push("", `${L("reply_next", "Next steps")}:`);
    i.actions.slice(0, 8).forEach((a) => lines.push(`• ${a.text}${a.dueDate ? ` (${a.dueDate})` : ""}`));
  }
  lines.push("", L("reply_closing", "Please let us know if anything needs to be corrected."), "", `${L("reply_regards", "Regards")},`, i.author ?? "");
  const email = { subject: `${L("reply_subject", "Follow-up")}${i.name ? ` — ${i.name}` : ""}`, body: lines.join("\n").trim() };
  const wa = [greet, thanks, ...(i.actions.length ? [`${L("reply_next", "Next steps")}:`, ...i.actions.slice(0, 5).map((a) => `- ${a.text}${a.dueDate ? ` (${a.dueDate})` : ""}`)] : []), L("reply_closing", "Please let us know if anything needs to be corrected.")].join("\n");
  return { email, whatsapp: wa };
}
