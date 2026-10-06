"use client";

import React, { useState, useEffect, useCallback } from "react";
import { t as centralT } from "@/lib/i18n/ui";
import { Link2, Copy, MessageCircle, CheckCircle2, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SupportedLanguage } from "@/lib/i18n/languages";

interface SendToCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: SupportedLanguage;
  defaultFormType?: "customer" | "employee" | "company" | "agent";
}

const dictEn: Record<string, string> = {
  "title": "SEND TO CUSTOMER — Secure External Form Link",
  "subtitle": "Generate a secure link to send directly to your customer. They will open and fill their details on mobile/desktop without needing an ERP login.",
  "generating": "Generating secure link...",
  "copyLink": "Copy Link",
  "copied": "Link Copied!",
  "whatsappShare": "Share via WhatsApp",
  "whatsappMsg": "Dear Customer, please fill your registration details using this secure link",
  "close": "Close",
  "retry": "Retry",
};

function t(key: string, lang: string): string {
  return centralT(lang as never, ("sendcust." + key) as never, dictEn[key] ?? key);
}

export function SendToCustomerModal({
  isOpen,
  onClose,
  lang,
  defaultFormType = "customer"
}: SendToCustomerModalProps) {
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateLink = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/erp/general-office/share-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          formType: defaultFormType,
          expiryHours: 48, // 48 Hours Valid
          notes: "Generated from Customer Master View"
        })
      });
      const json = await res.json();
      if (json.ok && json.data) {
        const token = json.data.link?.token;
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const url = token && origin ? `${origin}/ext/form/${token}` : (json.data.publicUrl || "");
        setPublicUrl(url);
      } else {
        setError(json.error || "Failed to generate link");
      }
    } catch {
      setError("Network error while generating link");
    } finally {
      setLoading(false);
    }
  }, [defaultFormType]);

  useEffect(() => {
    if (isOpen) {
      setPublicUrl(null);
      setCopied(false);
      void generateLink();
    }
  }, [isOpen, generateLink]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
    } catch {
      const el = document.createElement("textarea");
      el.value = publicUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsapp = () => {
    if (!publicUrl) return;
    const msg = encodeURIComponent(`${t("whatsappMsg", lang)}:\n${publicUrl}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const isRtl = lang === "ur" || lang === "ar" || lang === "fa" || lang === "ps";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div
        className="w-full max-w-lg rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl text-slate-900 relative animate-in fade-in zoom-in-95 duration-150"
        dir={isRtl ? "rtl" : "ltr"}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-4">
          <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-xs">
            <Shield className="h-5 w-5 fill-indigo-100" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              {t("title", lang)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              {t("subtitle", lang)}
            </p>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="py-10 text-center text-slate-500 space-y-3">
            <div className="h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-semibold">{t("generating", lang)}</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs my-4">
            ⚠️ {error}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generateLink}
              className="mt-3 block text-xs border-rose-300 bg-white text-rose-700 hover:bg-rose-100"
            >
              {t("retry", lang)}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 my-2">
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 flex items-center gap-3">
              <Link2 className="h-4 w-4 text-indigo-600 shrink-0" />
              <input
                type="text"
                readOnly
                value={publicUrl || ""}
                className="bg-transparent text-xs text-slate-800 font-semibold w-full outline-none select-all font-mono"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <Button
                type="button"
                onClick={handleCopy}
                className="flex-1 min-w-[140px] bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs gap-2 h-11 rounded-2xl shadow-xs"
              >
                {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-slate-600" />}
                {copied ? t("copied", lang) : t("copyLink", lang)}
              </Button>

              <Button
                type="button"
                onClick={handleWhatsapp}
                className="flex-1 min-w-[160px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2 h-11 rounded-2xl shadow-md shadow-emerald-200"
              >
                <MessageCircle className="h-4 w-4" />
                {t("whatsappShare", lang)}
              </Button>
            </div>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-900 rounded-xl"
          >
            {t("close", lang)}
          </Button>
        </div>
      </div>
    </div>
  );
}
