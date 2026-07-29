"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Plus,
  Play,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Globe2,
  Building2,
  RefreshCw,
  X,
  Save,
  Bell
} from "lucide-react";
import { t, type UiKey } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";

type ReminderRule = {
  id: string;
  ruleName: string;
  triggerEvent: string;
  daysOffset: number;
  triggerTime?: string;
  channel: "whatsapp" | "email" | "both";
  recipientType: "customer" | "supplier" | "both";
  countryId?: string | null;
  cityBranchId?: string | null;
  preferredLanguage?: "en" | "ur" | "ps" | "fa";
  maxReminders: number;
  reminderIntervalDays: number;
  requireApproval: boolean;
  isActive: boolean;
};

type Props = {
  lang: SupportedLanguage;
};

export function ReminderSettingsView({ lang }: Props) {
  const _ = (key: UiKey, fallback?: string) => t(lang, key, fallback);
  const isRTL = ["ar", "ur", "fa", "ps"].includes(lang);

  const [rules, setRules] = useState<ReminderRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<ReminderRule>>({});

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/erp/return-sms-reply/reminders");
      const json = await res.json();
      if (json.ok && json.data) {
        setRules(json.data.rules || []);
      }
    } catch {}
    finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // Save Rule
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/erp/return-sms-reply/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingRule)
      });
      const json = await res.json();
      if (json.ok) {
        setIsModalOpen(false);
        fetchRules();
      }
    } catch {}
    finally {
      setSaving(false);
    }
  };

  // Run Manual Trigger Batch
  const handleProcessReminders = async () => {
    setProcessing(true);
    try {
      const res = await fetch("/api/erp/return-sms-reply/reminders?action=process", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        alert(`Payment Reminder Engine Processed: ${json.data.processed} reminders evaluated. Completed payment reminders auto-halted.`);
      }
    } catch {}
    finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-6 text-white shadow-xl">
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl p-3 bg-white/20 backdrop-blur-sm">
              <Bell className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Automated Payment Reminders Scheduler</h2>
              <p className="text-xs text-white/80 mt-0.5">
                Automatically schedule and dispatch WhatsApp & Email payment reminders before, on, and after due dates. Completed payment reminders auto-halt automatically.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleProcessReminders}
              disabled={processing}
              className="flex items-center gap-1.5 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 px-4 py-2 text-xs font-black text-white hover:bg-white/30 transition-all shadow-sm disabled:opacity-50"
            >
              <Play className={cn("h-4 w-4 text-emerald-300", processing && "animate-spin")} />
              {processing ? "Evaluating Reminders..." : "Run Reminder Evaluation Now"}
            </button>

            <button
              onClick={() => { setEditingRule({ ruleName: "Payment Due Reminder", triggerEvent: "before_due_date", daysOffset: -3, channel: "both", recipientType: "customer", preferredLanguage: "en", maxReminders: 3, reminderIntervalDays: 3, isActive: true }); setIsModalOpen(true); }}
              className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-black text-indigo-700 hover:bg-white/90 transition-all shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Add Reminder Rule
            </button>
          </div>
        </div>
      </div>

      {/* Rules Table */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading reminder rules...</div>
        ) : rules.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            <Clock className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            No automated reminder rules configured yet
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-100 dark:bg-slate-950">
                <th className="px-4 py-3 text-left font-black uppercase">Rule Name</th>
                <th className="px-4 py-3 text-left font-black uppercase">Trigger Event</th>
                <th className="px-4 py-3 text-center font-black uppercase">Offset</th>
                <th className="px-4 py-3 text-center font-black uppercase">Channel</th>
                <th className="px-4 py-3 text-center font-black uppercase">Language</th>
                <th className="px-4 py-3 text-center font-black uppercase">Approval</th>
                <th className="px-4 py-3 text-center font-black uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{r.ruleName}</td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-[11px] uppercase">{r.triggerEvent.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-center font-mono font-bold">{r.daysOffset > 0 ? `+${r.daysOffset} days` : `${r.daysOffset} days`}</td>
                  <td className="px-4 py-3 text-center font-bold uppercase">{r.channel}</td>
                  <td className="px-4 py-3 text-center uppercase font-bold text-indigo-600">{r.preferredLanguage || "en"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("text-[10px] font-black rounded-full px-2 py-0.5", r.requireApproval ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
                      {r.requireApproval ? "Required" : "Automatic"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("text-[10px] font-black rounded-full px-2 py-0.5", r.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                      {r.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Drawer */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Add Payment Reminder Rule</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-600">Rule Name</label>
                <input
                  type="text"
                  value={editingRule.ruleName || ""}
                  onChange={(e) => setEditingRule({ ...editingRule, ruleName: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 outline-none font-bold text-slate-900 dark:bg-slate-950 dark:border-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600">Trigger Event</label>
                  <select
                    value={editingRule.triggerEvent || "before_due_date"}
                    onChange={(e) => setEditingRule({ ...editingRule, triggerEvent: e.target.value as any })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold dark:bg-slate-950 dark:border-slate-800"
                  >
                    <option value="before_due_date">Before Due Date</option>
                    <option value="on_due_date">On Due Date</option>
                    <option value="overdue">Overdue</option>
                    <option value="payment_approved">Payment Approved</option>
                    <option value="payment_completed">Payment Completed</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-600">Days Offset</label>
                  <input
                    type="number"
                    value={editingRule.daysOffset ?? 0}
                    onChange={(e) => setEditingRule({ ...editingRule, daysOffset: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold font-mono dark:bg-slate-950 dark:border-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600">Channel</label>
                  <select
                    value={editingRule.channel || "both"}
                    onChange={(e) => setEditingRule({ ...editingRule, channel: e.target.value as any })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold dark:bg-slate-950 dark:border-slate-800"
                  >
                    <option value="both">WhatsApp & Email</option>
                    <option value="whatsapp">WhatsApp Only</option>
                    <option value="email">Email Only</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-600">Language</label>
                  <select
                    value={editingRule.preferredLanguage || "en"}
                    onChange={(e) => setEditingRule({ ...editingRule, preferredLanguage: e.target.value as any })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold uppercase dark:bg-slate-950 dark:border-slate-800"
                  >
                    <option value="en">English (EN)</option>
                    <option value="ur">Urdu (UR)</option>
                    <option value="ps">Pashto (PS)</option>
                    <option value="fa">Farsi (FA)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-indigo-600 text-white px-5 py-2 font-black shadow-sm disabled:opacity-50">
                  {saving ? "Saving..." : "Save Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
