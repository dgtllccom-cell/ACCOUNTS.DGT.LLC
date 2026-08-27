"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Plus,
  Globe,
  Edit2,
  Trash2,
  Save,
  X,
  CheckCircle2,
  Copy
} from "lucide-react";
import { t, type UiKey } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";

type TemplateItem = {
  id: string;
  code: string;
  title: string;
  category: string;
  bodyEn: string;
  bodyUr?: string;
  bodyPs?: string;
  bodyFa?: string;
  isActive: boolean;
};

type Props = {
  lang: SupportedLanguage;
};

export function TemplateManagerView({ lang }: Props) {
  const _ = (key: UiKey, fallback?: string) => t(lang, key, fallback);
  const isRTL = ["ar", "ur", "fa", "ps"].includes(lang);

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLangTab, setActiveLangTab] = useState<"en" | "ur" | "ps" | "fa">("en");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<TemplateItem>>({});

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/erp/return-sms-reply/templates");
      const json = await res.json();
      if (json.ok && json.data) {
        setTemplates(json.data.templates || []);
      }
    } catch {}
    finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/erp/return-sms-reply/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTemplate)
      });
      const json = await res.json();
      if (json.ok) {
        setIsModalOpen(false);
        fetchTemplates();
      }
    } catch {}
    finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white shadow-xl">
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl p-3 bg-white/20 backdrop-blur-sm">
              <FileText className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">{_("tmv.header", "4-Language Business Reply Templates")}</h2>
              <p className="text-xs text-white/80 mt-0.5">
                Manage reusable business response templates in English, Urdu, Pashto, and Farsi with dynamic ERP variable placeholders.
              </p>
            </div>
          </div>

          <button
            onClick={() => { setEditingTemplate({ code: "TMP-CUSTOM", title: "New Template", category: "general", bodyEn: "Dear {{customer_name}}, ...", bodyUr: "", bodyPs: "", bodyFa: "", isActive: true }); setIsModalOpen(true); }}
            className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-black text-emerald-700 hover:bg-white/90 transition-all shadow-sm whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            {_("tmv.add_btn", "Add Template")}
          </button>
        </div>
      </div>

      {/* Language Switcher Bar */}
      <div className="flex items-center justify-between gap-2 border-b pb-3 dark:border-slate-800">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 text-xs">
          <Globe className="h-4 w-4 text-slate-400 ml-2" />
          <span className="font-bold text-slate-600 dark:text-slate-400 mr-2">{_("tmv.preview_lang", "Preview Language:")}</span>
          {(["en", "ur", "ps", "fa"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setActiveLangTab(l)}
              className={cn(
                "px-3 py-1 font-bold uppercase rounded-lg transition-all text-xs",
                activeLangTab === l ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200 dark:text-slate-400"
              )}
            >
              {l === "en" ? _("tmv.en_lbl", "English (EN)") : l === "ur" ? _("tmv.ur_lbl", "Urdu (UR)") : l === "ps" ? _("tmv.ps_lbl", "Pashto (PS)") : _("tmv.fa_lbl", "Farsi (FA)")}
            </button>
          ))}
        </div>

        <div className="text-[11px] font-mono text-slate-400">
          Variables: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-emerald-600">{"{{customer_name}}"}</code> <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-emerald-600">{"{{amount}}"}</code> <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-emerald-600">{"{{due_date}}"}</code>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 py-16 text-center text-xs text-slate-400">{_("tmv.loading", "Loading template library...")}</div>
        ) : templates.map((tmpl) => {
          const bodyText = activeLangTab === "ur" ? (tmpl.bodyUr || tmpl.bodyEn) : activeLangTab === "ps" ? (tmpl.bodyPs || tmpl.bodyEn) : activeLangTab === "fa" ? (tmpl.bodyFa || tmpl.bodyEn) : tmpl.bodyEn;
          return (
            <div key={tmpl.id} className="rounded-2xl border border-slate-200 bg-white p-5 dark:bg-slate-900 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-black rounded-lg bg-emerald-100 text-emerald-700 px-2 py-0.5 dark:bg-emerald-950 dark:text-emerald-400">
                    {tmpl.code}
                  </span>
                  <span className="text-[10px] font-bold uppercase rounded-md bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {tmpl.category}
                  </span>
                </div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white mt-2">{tmpl.title}</h4>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 whitespace-pre-wrap">
                  {bodyText}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400">
                  {_("tmv.langs_count", "4 Languages Configured")}
                </span>
                <button
                  onClick={() => { setEditingTemplate(tmpl); setIsModalOpen(true); }}
                  className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:underline"
                >
                  <Edit2 className="h-3.5 w-3.5" /> {_("tmv.edit_btn", "Edit Template")}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">{_("tmv.modal_title", "Edit 4-Language Template")}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600">{_("tmv.code_lbl", "Template Code")}</label>
                  <input
                    type="text"
                    value={editingTemplate.code || ""}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, code: e.target.value.toUpperCase() })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 outline-none font-mono font-bold dark:bg-slate-950 dark:border-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600">{_("tmv.title_lbl", "Title")}</label>
                  <input
                    type="text"
                    value={editingTemplate.title || ""}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 outline-none font-bold text-slate-900 dark:bg-slate-950 dark:border-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-600">{_("tmv.en_lbl", "English (EN)")}</label>
                <textarea
                  rows={2}
                  value={editingTemplate.bodyEn || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, bodyEn: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 outline-none font-medium dark:bg-slate-950 dark:border-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600">{_("tmv.ur_lbl", "Urdu (UR)")}</label>
                <textarea
                  rows={2}
                  dir="rtl"
                  value={editingTemplate.bodyUr || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, bodyUr: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 outline-none font-medium dark:bg-slate-950 dark:border-slate-800 text-right"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600">{_("tmv.ps_lbl", "Pashto (PS)")}</label>
                <textarea
                  rows={2}
                  dir="rtl"
                  value={editingTemplate.bodyPs || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, bodyPs: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 outline-none font-medium dark:bg-slate-950 dark:border-slate-800 text-right"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600">{_("tmv.fa_lbl", "Farsi (FA)")}</label>
                <textarea
                  rows={2}
                  dir="rtl"
                  value={editingTemplate.bodyFa || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, bodyFa: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 outline-none font-medium dark:bg-slate-950 dark:border-slate-800 text-right"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600">{_("common.cancel", "Cancel")}</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 text-white px-5 py-2 font-black shadow-sm disabled:opacity-50">
                  {saving ? _("tmv.saving", "Saving...") : _("tmv.save_tmpl", "Save Template")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
