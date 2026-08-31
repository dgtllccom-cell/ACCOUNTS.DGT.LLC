"use client";

import { useEffect, useState } from "react";
import { Sparkles, PencilLine, Loader2, CheckCircle2, Link2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { AiVoiceTextEntry } from "./ai-voice-text-entry";
import { INQUIRY_SOURCES, type InquiryDraft, type InquirySource } from "../lib/shared";

type FormState = {
  customerId: string | null;
  customerName: string;
  companyName: string;
  contactPerson: string;
  mobile: string;
  whatsapp: string;
  email: string;
  address: string;
  businessType: string;
  inquirySummary: string;
  meetingNotes: string;
  requirements: string;
  source: InquirySource;
  followUpDate: string;
  assignedTo: string;
};

const EMPTY: FormState = {
  customerId: null, customerName: "", companyName: "", contactPerson: "", mobile: "", whatsapp: "",
  email: "", address: "", businessType: "", inquirySummary: "", meetingNotes: "", requirements: "",
  source: "meeting", followUpDate: "", assignedTo: "",
};

export function InquiryForm({
  lang: langProp,
  onSaved,
  onCancel,
}: {
  lang?: string;
  onSaved: (id: string, inquiryNo: string) => void;
  onCancel: () => void;
}) {
  const s = useErpScreen("cinq", langProp);
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [phase, setPhase] = useState<"entry" | "preview">("entry");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [draft, setDraft] = useState<InquiryDraft | null>(null);
  const [rawInput, setRawInput] = useState("");
  const [entryMode, setEntryMode] = useState<"manual" | "ai_text" | "ai_voice">("manual");
  const [assignees, setAssignees] = useState<{ userId: string; name: string | null }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/erp/customer-inquiries/assignees")
      .then((r) => r.json())
      .then((d) => setAssignees(d?.data?.assignees ?? []))
      .catch(() => setAssignees([]));
  }, []);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function applyDraft(d: InquiryDraft, raw: string, m: "ai_text" | "ai_voice") {
    setDraft(d);
    setRawInput(raw);
    setEntryMode(m);
    setForm({
      ...EMPTY,
      customerName: d.customer_name ?? "",
      companyName: d.company_name ?? "",
      contactPerson: d.contact_person ?? "",
      mobile: d.mobile ?? "",
      whatsapp: d.whatsapp ?? "",
      email: d.email ?? "",
      address: d.address ?? "",
      businessType: d.business_type ?? "",
      inquirySummary: d.inquiry_summary ?? "",
      meetingNotes: d.meeting_notes ?? "",
      requirements: d.requirements ?? "",
      source: d.source ?? "meeting",
      followUpDate: d.follow_up_date ?? "",
      customerId: null,
    });
    setPhase("preview");
  }

  async function save() {
    if (!form.customerName.trim()) { setError(s.t("err_name", "Customer name is required.")); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/erp/customer-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: form.customerId,
          customerName: form.customerName.trim(),
          companyName: form.companyName || null,
          contactPerson: form.contactPerson || null,
          mobile: form.mobile || null,
          whatsapp: form.whatsapp || null,
          email: form.email || null,
          address: form.address || null,
          businessType: form.businessType || null,
          inquirySummary: form.inquirySummary || null,
          meetingNotes: form.meetingNotes || null,
          requirements: form.requirements || null,
          source: form.source,
          followUpDate: form.followUpDate || null,
          assignedTo: form.assignedTo || null,
          entryMode: mode === "ai" ? entryMode : "manual",
          aiRawInput: mode === "ai" ? rawInput : null,
          aiConfidence: draft?.confidence ?? null,
          originalLanguageCode: (draft?.detectedLanguage as any) || s.lang,
          status: mode === "ai" ? "confirmed" : "new",
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error?.message || data?.error || "Save failed");
      onSaved(data.data.id, data.data.inquiryNo);
    } catch (e: any) {
      setError(e?.message || "Could not save the inquiry.");
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, k: keyof FormState, opts?: { textarea?: boolean; type?: string; placeholder?: string }) => (
    <div>
      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">{label}</label>
      {opts?.textarea ? (
        <textarea
          value={String(form[k] ?? "")}
          onChange={(e) => set(k, e.target.value as any)}
          rows={3}
          dir="auto"
          placeholder={opts?.placeholder}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
        />
      ) : (
        <input
          value={String(form[k] ?? "")}
          onChange={(e) => set(k, e.target.value as any)}
          type={opts?.type || "text"}
          dir="auto"
          placeholder={opts?.placeholder}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
        />
      )}
    </div>
  );

  return (
    <div className="space-y-4" dir={s.dir}>
      {/* mode toggle */}
      <div className="flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => { setMode("ai"); setPhase("entry"); }}
          className={`flex-1 rounded-lg px-3 py-1.5 flex items-center justify-center gap-1.5 ${mode === "ai" ? "bg-white dark:bg-slate-950 shadow-sm text-violet-700 dark:text-violet-300" : "text-slate-500"}`}
        >
          <Sparkles className="h-3.5 w-3.5" /> {s.t("mode_ai", "AI Voice / Text")}
        </button>
        <button
          type="button"
          onClick={() => { setMode("manual"); setPhase("preview"); setForm(EMPTY); setDraft(null); }}
          className={`flex-1 rounded-lg px-3 py-1.5 flex items-center justify-center gap-1.5 ${mode === "manual" ? "bg-white dark:bg-slate-950 shadow-sm text-blue-700 dark:text-blue-300" : "text-slate-500"}`}
        >
          <PencilLine className="h-3.5 w-3.5" /> {s.t("mode_manual", "Manual Entry")}
        </button>
      </div>

      {mode === "ai" && phase === "entry" && (
        <AiVoiceTextEntry lang={s.lang} onDraft={applyDraft} />
      )}

      {(mode === "manual" || phase === "preview") && (
        <div className="space-y-3">
          {mode === "ai" && draft && (
            <div className="rounded-xl border border-violet-200 dark:border-violet-900 bg-violet-50 dark:bg-violet-950/40 p-3 text-[11.5px]">
              <div className="flex items-center gap-1.5 font-bold text-violet-700 dark:text-violet-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {s.t("preview_title", "Preview — check and confirm before saving")}
                <span className="ms-auto rounded-full bg-white dark:bg-slate-900 px-2 py-0.5 text-[10px]">
                  {s.t("confidence", "Confidence")}: {Math.round((draft.confidence || 0) * 100)}%
                </span>
              </div>
              {draft.unmatched.length > 0 && (
                <p className="mt-1 flex items-center gap-1 text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-3 w-3" />
                  {s.t("preview_missing", "AI could not fill:")} {draft.unmatched.join(", ")}
                </p>
              )}
              {draft.customerMatches.length > 0 && (
                <div className="mt-2">
                  <span className="font-bold text-slate-600 dark:text-slate-300">{s.t("possible_match", "Possible existing customer — link instead of creating a duplicate:")}</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {draft.customerMatches.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => set("customerId", form.customerId === m.id ? null : m.id)}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10.5px] font-bold ${form.customerId === m.id ? "border-emerald-400 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}
                      >
                        <Link2 className="h-3 w-3" /> {m.label}
                      </button>
                    ))}
                  </div>
                  {form.customerId && <p className="mt-1 text-emerald-700 dark:text-emerald-400">{s.t("will_link", "This inquiry will be linked to the selected customer.")}</p>}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {field(s.t("f_customer_name", "Customer Name *"), "customerName")}
            {field(s.t("f_company", "Company Name"), "companyName")}
            {field(s.t("f_contact_person", "Contact Person"), "contactPerson")}
            {field(s.t("f_mobile", "Mobile"), "mobile", { type: "tel" })}
            {field(s.t("f_whatsapp", "WhatsApp"), "whatsapp", { type: "tel" })}
            {field(s.t("f_email", "Email"), "email", { type: "email" })}
            <div className="sm:col-span-2">{field(s.t("f_address", "Address"), "address")}</div>
            {field(s.t("f_business_type", "Business Type"), "businessType")}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">{s.t("f_source", "Source")}</label>
              <select
                value={form.source}
                onChange={(e) => set("source", e.target.value as InquirySource)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-sm"
              >
                {INQUIRY_SOURCES.map((src) => (
                  <option key={src} value={src}>{s.t(`source_${src}`, src.replace("_", " "))}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">{field(s.t("f_summary", "Inquiry Summary"), "inquirySummary")}</div>
            <div className="sm:col-span-2">{field(s.t("f_meeting_notes", "Meeting / Inquiry Notes"), "meetingNotes", { textarea: true })}</div>
            <div className="sm:col-span-2">{field(s.t("f_requirements", "Requirements"), "requirements", { textarea: true })}</div>
            {field(s.t("f_follow_up", "Follow-up Date"), "followUpDate", { type: "date" })}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">{s.t("f_assigned_to", "Assigned User")}</label>
              <select
                value={form.assignedTo}
                onChange={(e) => set("assignedTo", e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-sm"
              >
                <option value="">{s.t("assign_me", "Me (default)")}</option>
                {assignees.map((a) => (
                  <option key={a.userId} value={a.userId}>{a.name || a.userId.slice(0, 8)}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-[11px] font-bold text-rose-600">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            {mode === "ai" && (
              <Button type="button" variant="outline" size="sm" onClick={() => setPhase("entry")}>
                {s.t("back_to_ai", "← Back to voice/text")}
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="ms-auto">
              {s.t("cancel", "Cancel")}
            </Button>
            <Button type="button" onClick={save} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {mode === "ai" ? s.t("confirm_save", "Confirm & Save") : s.t("save", "Save Inquiry")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
