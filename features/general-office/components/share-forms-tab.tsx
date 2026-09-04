"use client";

/**
 * ShareFormsTab — rendered inside General Office Management
 *
 * Clean White Official ERP Theme.
 * Staff can:
 * 1. Generate secure external form links (Customer / Employee / Company / Agent)
 * 2. Copy the link or share directly via WhatsApp
 * 3. View all generated links with live status tracking
 * 4. View full submitted data (Personal info, Address, CNIC Front/Back, Passport Pages, Photo)
 * 5. Revoke links they no longer need
 *
 * Supports all 5 ERP languages (EN, UR, AR, FA, PS).
 */

import React, { useState, useEffect, useCallback } from "react";
import { t as centralT } from "@/lib/i18n/ui";
import {
  Link2,
  Copy,
  MessageCircle,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCcw,
  ChevronDown,
  Eye,
  Shield,
  Users,
  Building2,
  Briefcase,
  UserCheck,
  FileText,
  MapPin,
  Image as ImageIcon,
  ExternalLink,
  Download,
  X,
  Calendar,
  Phone,
  Mail,
  User,
  CreditCard,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SupportedLanguage } from "@/lib/i18n/languages";

// ─── Dictionary ───────────────────────────────────────────────────────────────

type Lang = SupportedLanguage;

const dictEn: Record<string, string> = {
  "title": "Share Form / External Form Link",
  "subtitle": "Generate secure links to share ERP forms with external recipients — no login required on their end.",
  "generateTitle": "Generate New Form Link",
  "selectFormType": "Select Form Type",
  "customer": "Customer Registration",
  "employee": "Employee Registration",
  "company": "Company Registration",
  "agent": "Agent Registration",
  "expiryLabel": "Link Expiry",
  "expiry24h": "24 Hours",
  "expiry48h": "48 Hours",
  "expiry7d": "7 Days (Default)",
  "expiry14d": "14 Days",
  "expiry30d": "30 Days",
  "expiryNever": "Never Expires",
  "notesLabel": "Notes (optional)",
  "generateBtn": "Generate Secure Link",
  "generatedLink": "Your Secure Link",
  "copyLink": "Copy Link",
  "copied": "Copied!",
  "whatsappShare": "WhatsApp Share",
  "linksRegistry": "Generated Links Registry",
  "colSerial": "#",
  "colFormType": "Form Type",
  "colStatus": "Status",
  "colCreatedBy": "Created By",
  "colCreatedAt": "Created",
  "colExpiry": "Expires",
  "colSubmission": "Submission",
  "colActions": "Actions",
  "statusActive": "Active",
  "statusUsed": "Submitted",
  "statusExpired": "Expired",
  "statusRevoked": "Revoked",
  "revokeBtn": "Revoke",
  "copyShort": "Copy",
  "viewForm": "View Form",
  "noLinks": "No links generated yet. Use the form above to create your first link.",
  "refreshBtn": "Refresh",
  "whatsappMsg": "Please fill this secure form to register your information",
  "never": "Never",
  "pending": "Pending",
  "selectFormFirst": "Please select a form type first",
  "submissionDetails": "Submitted Form Details",
  "closeModal": "Close",
  "personalInfo": "Personal Information",
  "addressInfo": "Address Details",
  "documentsInfo": "Uploaded Documents",
  "contractsInfo": "Contracts & Attachments",
  "photoInfo": "Candidate Photo",
  "openLink": "Open Form Link",
  "resendLink": "Re-send Fresh Link",
};

function tx(key: string, lang: string): string {
  return centralT(lang as never, ("shareform." + key) as never, dictEn[key] ?? key);
}

// ─── Status badge component ───────────────────────────────────────────────────

function StatusBadge({ status, lang }: { status: string; lang: Lang }) {
  const cfg: Record<string, { bg: string; color: string; border: string; icon: React.ReactNode; key: string }> = {
    active:  { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0", icon: <CheckCircle2 size={12} />, key: "statusActive" },
    used:    { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe", icon: <Eye size={12} />,          key: "statusUsed" },
    expired: { bg: "#fffbeb", color: "#d97706", border: "#fde68a", icon: <Clock size={12} />,        key: "statusExpired" },
    revoked: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca", icon: <XCircle size={12} />,      key: "statusRevoked" },
  };
  const c = cfg[status] ?? cfg.expired;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border shadow-2xs"
      style={{ background: c.bg, color: c.color, borderColor: c.border }}
    >
      {c.icon} {tx(c.key, lang)}
    </span>
  );
}

// ─── Form type icon ───────────────────────────────────────────────────────────

function FormTypeIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    customer: <Users size={14} className="text-blue-600" />,
    employee: <UserCheck size={14} className="text-emerald-600" />,
    company:  <Building2 size={14} className="text-purple-600" />,
    agent:    <Briefcase size={14} className="text-amber-600" />,
  };
  return <>{icons[type] ?? <Link2 size={14} />}</>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ShareFormsTabProps {
  lang: Lang;
}

interface LinkRecord {
  id: string;
  token: string;
  form_type: string;
  status: string;
  created_by_name: string | null;
  created_at: string;
  expires_at: string | null;
  submitted_at: string | null;
  submitted_record_id: string | null;
  submission_data?: any;
  notes: string | null;
}

export function ShareFormsTab({ lang }: ShareFormsTabProps) {
  const [formType, setFormType] = useState("");
  const [expiryHours, setExpiryHours] = useState(168);
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [generatedFormType, setGeneratedFormType] = useState("");
  const [copied, setCopied] = useState(false);
  const [links, setLinks] = useState<LinkRecord[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
  const [viewSubmissionModal, setViewSubmissionModal] = useState<LinkRecord | null>(null);

  const loadLinks = useCallback(async () => {
    setLoadingLinks(true);
    try {
      const res = await fetch("/api/erp/general-office/share-links", { credentials: "include" });
      const json = await res.json();
      if (json.ok) setLinks(json.data?.links ?? []);
    } catch { /* silent */ } finally {
      setLoadingLinks(false);
    }
  }, []);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  const handleGenerate = useCallback(async () => {
    if (!formType) {
      setGenerateError(tx("selectFormFirst", lang));
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    setGeneratedUrl(null);
    try {
      const res = await fetch("/api/erp/general-office/share-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ formType, expiryHours, notes }),
      });
      const json = await res.json();
      if (json.ok) {
        const token = json.data?.link?.token;
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const url = token && origin ? `${origin}/ext/form/${token}` : (json.data?.publicUrl ?? "");
        setGeneratedUrl(url);
        setGeneratedFormType(formType);
        setFormType("");
        setNotes("");
        await loadLinks();
      } else {
        setGenerateError(json.error ?? "Failed to generate link");
      }
    } catch {
      setGenerateError("Network error");
    } finally {
      setGenerating(false);
    }
  }, [formType, expiryHours, notes, lang, loadLinks]);

  const handleCopy = useCallback(async (url: string, rowId?: string) => {
    await navigator.clipboard.writeText(url).catch(() => {
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    });
    if (rowId) {
      setCopiedRowId(rowId);
      setTimeout(() => setCopiedRowId(null), 2000);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, []);

  const handleWhatsapp = useCallback((url: string) => {
    const msg = encodeURIComponent(`${tx("whatsappMsg", lang)}:\n${url}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }, [lang]);

  const [resendingId, setResendingId] = useState<string | null>(null);

  const handleResend = useCallback(async (link: LinkRecord) => {
    setResendingId(link.id);
    try {
      const res = await fetch("/api/erp/general-office/share-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          formType: link.form_type,
          expiryHours: 48,
          notes: link.notes ? `${link.notes} (Re-sent)` : "Re-sent fresh link"
        })
      });
      const json = await res.json();
      if (json.ok && json.data) {
        await loadLinks();
        const newUrl = json.data.publicUrl || (typeof window !== "undefined" ? getPublicUrl(json.data.link?.token) : "");
        if (newUrl) {
          handleWhatsapp(newUrl);
        }
      }
    } catch {
      // Ignore
    } finally {
      setResendingId(null);
    }
  }, [loadLinks, handleWhatsapp]);

  const handleRevoke = useCallback(async (id: string) => {
    if (!confirm("Revoke this link? The recipient will no longer be able to open it.")) return;
    setRevoking(id);
    try {
      await fetch("/api/erp/general-office/share-links", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      });
      await loadLinks();
    } catch { /* silent */ } finally {
      setRevoking(null);
    }
  }, [loadLinks]);

  const getPublicUrl = (token: string) =>
    `${window.location.origin}/ext/form/${token}`;

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(
      lang === "ar" ? "ar-SA" : lang === "ur" ? "ur-PK" : "en-GB",
      { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
    );
  };

  const formTypes = [
    { value: "customer", label: tx("customer", lang), icon: <Users size={16} /> },
    { value: "employee", label: tx("employee", lang), icon: <UserCheck size={16} /> },
    { value: "company",  label: tx("company",  lang), icon: <Building2 size={16} /> },
    { value: "agent",    label: tx("agent",    lang), icon: <Briefcase size={16} /> },
  ];

  const expiryOptions = [
    { value: 24,   label: tx("expiry24h", lang) },
    { value: 48,   label: tx("expiry48h", lang) },
    { value: 168,  label: tx("expiry7d",  lang) },
    { value: 336,  label: tx("expiry14d", lang) },
    { value: 720,  label: tx("expiry30d", lang) },
    { value: 0,    label: tx("expiryNever", lang) },
  ];

  return (
    <div className="space-y-6">
      {/* ── Generate Section (Clean White ERP Theme) ─────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {tx("generateTitle", lang)}
              </h3>
              <p className="text-xs text-slate-500">
                {tx("subtitle", lang)}
              </p>
            </div>
          </div>
        </div>

        {/* Form type selector */}
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">
            {tx("selectFormType", lang)}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {formTypes.map((ft) => {
              const active = formType === ft.value;
              return (
                <button
                  key={ft.value}
                  type="button"
                  onClick={() => { setFormType(ft.value); setGenerateError(null); }}
                  className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                    active
                      ? "bg-blue-50 border-blue-600 text-blue-700 shadow-2xs"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {ft.icon} {ft.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Expiry + notes row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              {tx("expiryLabel", lang)}
            </label>
            <div className="relative">
              <select
                value={expiryHours}
                onChange={(e) => setExpiryHours(Number(e.target.value))}
                className="w-full h-10 px-3 pr-8 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:bg-white focus:border-blue-500 focus:outline-none appearance-none cursor-pointer"
              >
                {expiryOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              {tx("notesLabel", lang)}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={tx("linkPurposePlaceholder", lang)}
              className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-sm placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {generateError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-lg flex items-center gap-2">
            <span>⚠️</span> {generateError}
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <Plus size={16} />
            {generating ? "Generating..." : tx("generateBtn", lang)}
          </Button>
        </div>
      </div>

      {/* ── Generated URL display (Clean White Theme) ────────────────────────── */}
      {generatedUrl && (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 shadow-xs space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <span>{tx("generatedLink", lang)} — {tx(generatedFormType, lang)}</span>
          </div>

          <div className="flex items-center gap-2 bg-white border border-emerald-200 rounded-xl p-2.5">
            <Link2 size={16} className="text-blue-600 shrink-0 ml-1" />
            <input
              readOnly
              value={generatedUrl}
              className="w-full bg-transparent text-xs sm:text-sm font-mono text-slate-800 focus:outline-none select-all"
            />
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              type="button"
              onClick={() => handleCopy(generatedUrl)}
              variant="outline"
              className={`text-xs font-semibold px-4 py-2 rounded-lg gap-1.5 transition-all cursor-pointer ${
                copied ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {copied ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Copy size={13} />}
              {copied ? tx("copied", lang) : tx("copyLink", lang)}
            </Button>
            <Button
              type="button"
              onClick={() => handleWhatsapp(generatedUrl)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg gap-1.5 shadow-2xs cursor-pointer"
            >
              <MessageCircle size={14} />
              {tx("whatsappShare", lang)}
            </Button>
            <a
              href={generatedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg gap-1.5 shadow-2xs inline-flex items-center cursor-pointer transition-all"
            >
              <ExternalLink size={13} />
              <span>{tx("openLink", lang)}</span>
            </a>
          </div>
        </div>
      )}

      {/* ── Links Registry (Clean White Table) ────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Link2 size={14} />
            </div>
            <h4 className="font-bold text-slate-900 text-sm sm:text-base">
              {tx("linksRegistry", lang)}
            </h4>
            <span className="bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5 text-xs font-bold">
              {links.length}
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadLinks}
            className="text-xs font-semibold gap-1.5 text-slate-600 border-slate-200 hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCcw size={12} /> {tx("refreshBtn", lang)}
          </Button>
        </div>

        {loadingLinks ? (
          <div className="text-center py-12 text-slate-400">
            <RefreshCcw size={20} className="animate-spin mx-auto mb-2 text-blue-600" />
            <span className="text-xs">{tx("loadingRegistry", lang)}</span>
          </div>
        ) : links.length === 0 ? (
          <div className="text-center py-14 px-4 text-slate-400">
            <Link2 size={36} className="mx-auto mb-2 opacity-30 text-slate-500" />
            <div className="text-sm font-medium text-slate-600">{tx("noLinks", lang)}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">{tx("colSerial", lang)}</th>
                  <th className="py-3 px-4">{tx("colFormType", lang)}</th>
                  <th className="py-3 px-4">{tx("colStatus", lang)}</th>
                  <th className="py-3 px-4">{tx("colCreatedBy", lang)}</th>
                  <th className="py-3 px-4">{tx("colCreatedAt", lang)}</th>
                  <th className="py-3 px-4">{tx("colExpiry", lang)}</th>
                  <th className="py-3 px-4">{tx("colSubmission", lang)}</th>
                  <th className="py-3 px-4 text-right">{tx("colActions", lang)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {links.map((link, idx) => {
                  const url = typeof window !== "undefined" ? getPublicUrl(link.token) : "";
                  const isSubmitted = link.status === "used" || Boolean(link.submitted_at);

                  return (
                    <tr key={link.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-mono font-medium">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 font-bold text-slate-800">
                          <FormTypeIcon type={link.form_type} />
                          {tx(link.form_type, lang)}
                        </span>
                        {link.notes && (
                          <div className="text-[11px] text-slate-500 truncate max-w-[160px]">
                            {link.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={link.status} lang={lang} />
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {link.created_by_name ?? "—"}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {formatDate(link.created_at)}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {link.expires_at ? formatDate(link.expires_at) : tx("never", lang)}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        {isSubmitted ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                            <CheckCircle2 size={14} className="text-emerald-500" />
                            <span>{formatDate(link.submitted_at)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">{tx("pending", lang)}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Re-send Fresh 48-Hour Link (WhatsApp & Copy) */}
                          <button
                            type="button"
                            onClick={() => handleResend(link)}
                            disabled={resendingId === link.id}
                            className="px-2 py-1 rounded-md border bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 flex items-center gap-1 text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                            title={tx("resendLink", lang)}
                          >
                            <RefreshCcw size={11} className={resendingId === link.id ? "animate-spin text-amber-600" : "text-amber-600"} />
                            <span className="hidden sm:inline">{tx("resendLink", lang)}</span>
                          </button>

                          {/* Open Form directly in new tab */}
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-md border bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 flex items-center gap-1 text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                            title={tx("openLink", lang)}
                          >
                            <ExternalLink size={12} />
                          </a>

                          {/* View Submitted Form Data Modal Button */}
                          {isSubmitted && (
                            <button
                              type="button"
                              onClick={() => setViewSubmissionModal(link)}
                              className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                              title={tx("viewForm", lang)}
                            >
                              <Eye size={12} />
                              <span>{tx("viewForm", lang)}</span>
                            </button>
                          )}

                          {/* Copy Link */}
                          {link.status === "active" && (
                            <button
                              type="button"
                              onClick={() => handleCopy(url, link.id)}
                              className={`p-1.5 rounded-md border text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                                copiedRowId === link.id
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                              }`}
                              title={tx("copyLink", lang)}
                            >
                              {copiedRowId === link.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                            </button>
                          )}

                          {/* WhatsApp Share */}
                          {link.status === "active" && (
                            <button
                              type="button"
                              onClick={() => handleWhatsapp(url)}
                              className="p-1.5 rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 flex items-center cursor-pointer transition-colors"
                              title={tx("whatsappShare", lang)}
                            >
                              <MessageCircle size={12} />
                            </button>
                          )}

                          {/* Revoke */}
                          {link.status === "active" && (
                            <button
                              type="button"
                              onClick={() => handleRevoke(link.id)}
                              disabled={revoking === link.id}
                              className="p-1.5 rounded-md border bg-red-50 text-red-700 border-red-200 hover:bg-red-100 flex items-center cursor-pointer transition-colors"
                              title={tx("revokeBtn", lang)}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── View Submitted Data Modal (Clean White Theme) ─────────────────────── */}
      {viewSubmissionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl p-6 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <FormTypeIcon type={viewSubmissionModal.form_type} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {tx("submissionDetails", lang)}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <span className="font-bold text-blue-700 uppercase">
                      {tx(viewSubmissionModal.form_type, lang)}
                    </span>
                    <span>•</span>
                    <span>{formatDate(viewSubmissionModal.submitted_at)}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewSubmissionModal(null)}
                className="h-8 w-8 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Submission Content */}
            {viewSubmissionModal.submission_data ? (
              <div className="space-y-6">
                {/* 1. Candidate Photo & Basic Header */}
                <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                  {viewSubmissionModal.submission_data.photo ? (
                    <img
                      src={viewSubmissionModal.submission_data.photo}
                      alt={tx("uploadedPhoto", lang)}
                      className="h-16 w-16 rounded-full object-cover border-2 border-white shadow-xs"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-400">
                      <User size={24} />
                    </div>
                  )}
                  <div>
                    <h4 className="text-base font-bold text-slate-900">
                      {viewSubmissionModal.submission_data.fullName || viewSubmissionModal.submission_data.customerName || "Applicant / Customer"}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {viewSubmissionModal.submission_data.email || viewSubmissionModal.submission_data.mobile || "No contact info"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                        {tx("statusUsed", lang)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Personal Information Grid */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <User size={13} className="text-blue-600" />
                    {tx("personalInfo", lang)}
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white border border-slate-200 p-4 rounded-2xl text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">{tx("firstName", lang)}</span>
                      <span className="font-semibold text-slate-800">{viewSubmissionModal.submission_data.firstName || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">{tx("lastName", lang)}</span>
                      <span className="font-semibold text-slate-800">{viewSubmissionModal.submission_data.lastName || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">{tx("fatherGuardian", lang)}</span>
                      <span className="font-semibold text-slate-800">{viewSubmissionModal.submission_data.fatherName || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">{tx("mobilePhone", lang)}</span>
                      <span className="font-semibold text-slate-800">{viewSubmissionModal.submission_data.mobile || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">{tx("whatsapp", lang)}</span>
                      <span className="font-semibold text-slate-800">{viewSubmissionModal.submission_data.whatsapp || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">{tx("gender", lang)}</span>
                      <span className="font-semibold text-slate-800 capitalize">{viewSubmissionModal.submission_data.gender || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Address Information Grid */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <MapPin size={13} className="text-emerald-600" />
                    {tx("addressInfo", lang)}
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white border border-slate-200 p-4 rounded-2xl text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">{tx("country", lang)}</span>
                      <span className="font-semibold text-slate-800">{viewSubmissionModal.submission_data.country || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">{tx("stateProvince", lang)}</span>
                      <span className="font-semibold text-slate-800">{viewSubmissionModal.submission_data.stateProvince || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">{tx("city", lang)}</span>
                      <span className="font-semibold text-slate-800">{viewSubmissionModal.submission_data.city || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">{tx("postalCode", lang)}</span>
                      <span className="font-semibold text-slate-800">{viewSubmissionModal.submission_data.postalCode || "—"}</span>
                    </div>
                    <div className="col-span-2 sm:col-span-4 border-t border-slate-100 pt-2.5 mt-1">
                      <span className="text-slate-400 block text-[11px]">{tx("fullStreetAddress", lang)}</span>
                      <span className="font-semibold text-slate-800">{viewSubmissionModal.submission_data.address || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Uploaded Documents (CNIC Front & Back / Passport Pages) */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <CreditCard size={13} className="text-purple-600" />
                    {tx("documentsInfo", lang)}
                  </h4>
                  <div className="space-y-3">
                    {Array.isArray(viewSubmissionModal.submission_data.documents) && viewSubmissionModal.submission_data.documents.length > 0 ? (
                      viewSubmissionModal.submission_data.documents.map((doc: any, i: number) => (
                        <div key={i} className="bg-white border border-slate-200 p-3.5 rounded-2xl space-y-2.5">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                            <span className="flex items-center gap-1.5 text-blue-700">
                              <FileText size={14} /> {doc.type || "Document"}
                            </span>
                            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                              {doc.number || "—"}
                            </span>
                          </div>

                          {/* Front & Back Previews */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                            {doc.frontImage && (
                              <div className="border border-slate-200 rounded-xl p-2 bg-slate-50">
                                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                  {tx("frontSide", lang)}
                                </span>
                                <img
                                  src={doc.frontImage}
                                  alt={tx("frontSide", lang)}
                                  className="h-28 w-full object-cover rounded-lg border border-slate-200"
                                />
                              </div>
                            )}
                            {doc.backImage && (
                              <div className="border border-slate-200 rounded-xl p-2 bg-slate-50">
                                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                  {tx("backSide", lang)}
                                </span>
                                <img
                                  src={doc.backImage}
                                  alt={tx("backSide", lang)}
                                  className="h-28 w-full object-cover rounded-lg border border-slate-200"
                                />
                              </div>
                            )}
                            {!doc.frontImage && !doc.backImage && doc.fileName && (
                              <div className="col-span-2 text-xs text-slate-500 font-mono bg-slate-50 p-2 rounded-lg border border-slate-200">
                                📎 {doc.fileName}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        {tx("noDocuments", lang)}
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Uploaded Contracts */}
                {Array.isArray(viewSubmissionModal.submission_data.contracts) && viewSubmissionModal.submission_data.contracts.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <Briefcase size={13} className="text-amber-600" />
                      {tx("contractsInfo", lang)}
                    </h4>
                    <div className="space-y-2">
                      {viewSubmissionModal.submission_data.contracts.map((cnt: any, i: number) => (
                        <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs">
                          <span className="font-bold text-slate-800">{cnt.type || "Contract"}</span>
                          <span className="font-mono text-slate-500">{cnt.contractNo || cnt.fileName || "CNT-ATTACHMENT"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">
                {tx("noSnapshot", lang)}
              </div>
            )}

            {/* Modal Footer */}
            <div className="border-t border-slate-100 pt-4 flex justify-end">
              <Button
                type="button"
                onClick={() => setViewSubmissionModal(null)}
                variant="outline"
                className="text-xs font-semibold px-5 py-2 rounded-xl cursor-pointer"
              >
                {tx("closeModal", lang)}
              </Button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
