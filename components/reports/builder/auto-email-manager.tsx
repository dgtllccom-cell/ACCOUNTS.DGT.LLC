"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Mail, Send } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";

type AutoEmailManagerProps = {
  savedReportId: string | null;
  reportName: string;
  buildEmailHtml: () => string;
};

/** "Setup Auto Email" — saves recipients/frequency/format against a saved report layout.
 * Requires the report to be saved first (a saved report is what the config attaches to).
 * Recurring delivery itself needs an external scheduler to call the send endpoint on a
 * cron — not implemented here (see app/api/erp/reports/auto-email/route.ts). "Send Test
 * Email Now" sends one real email immediately via the existing SMTP service, so the
 * recipients/format/content path is genuinely verifiable without a scheduler. */
export function AutoEmailManager({ savedReportId, reportName, buildEmailHtml }: AutoEmailManagerProps) {
  const lang = useActiveLanguage();
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [format, setFormat] = useState<"pdf" | "excel">("pdf");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !savedReportId) return;
    fetch(`/api/erp/reports/auto-email?savedReportId=${savedReportId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json?.data) {
          setRecipients((json.data.recipients || []).join(", "));
          setFrequency(json.data.frequency || "daily");
          setFormat(json.data.format || "pdf");
        }
      })
      .catch(() => null);
  }, [open, savedReportId]);

  async function handleSaveConfig() {
    if (!savedReportId) return;
    const list = recipients.split(",").map((r) => r.trim()).filter(Boolean);
    if (list.length === 0) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/erp/reports/auto-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savedReportId, recipients: list, frequency, format })
      });
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendNow() {
    const list = recipients.split(",").map((r) => r.trim()).filter(Boolean);
    if (list.length === 0) return;
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/erp/reports/auto-email?action=send-now", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients: list, reportName, htmlBody: buildEmailHtml() })
      });
      const json = await res.json();
      setStatus(json.success ? "sent" : "error");
    } catch {
      setStatus("error");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 text-xs" disabled={!savedReportId}>
          <Mail className="h-3.5 w-3.5 mr-1.5" /> {t(lang, "report.builder_auto_email", "Auto Email")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t(lang, "report.builder_setup_auto_email", "Setup Auto Email")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {!savedReportId ? (
            <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded p-3">
              {t(lang, "report.builder_save_first", "Save this report layout first (Save As) before configuring Auto Email.")}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t(lang, "report.builder_recipients", "Recipients (comma-separated)")}
            </label>
            <Input
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="finance@example.com, manager@example.com"
              disabled={!savedReportId}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t(lang, "report.builder_frequency", "Frequency")}
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as any)}
                disabled={!savedReportId}
                className="w-full h-9 text-xs border rounded px-2 bg-white dark:bg-slate-950"
              >
                <option value="daily">{t(lang, "report.builder_daily", "Daily")}</option>
                <option value="weekly">{t(lang, "report.builder_weekly", "Weekly")}</option>
                <option value="monthly">{t(lang, "report.builder_monthly", "Monthly")}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t(lang, "report.builder_format", "Format")}
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
                disabled={!savedReportId}
                className="w-full h-9 text-xs border rounded px-2 bg-white dark:bg-slate-950"
              >
                <option value="pdf">PDF</option>
                <option value="excel">Excel</option>
              </select>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {t(lang, "report.builder_auto_email_note", "Recurring delivery requires the recipients list to be saved here; actual scheduled sending depends on your server's task scheduler being configured to call this report's send job.")}
          </p>

          {status === "saved" && <div className="text-xs text-emerald-600">{t(lang, "report.builder_config_saved", "Configuration saved.")}</div>}
          {status === "sent" && <div className="text-xs text-emerald-600">{t(lang, "report.builder_test_sent", "Test email sent.")}</div>}
          {status === "error" && <div className="text-xs text-red-600">{t(lang, "report.builder_action_failed", "Action failed. Please try again.")}</div>}

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={handleSendNow} disabled={!savedReportId || sending || !recipients.trim()}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {sending ? t(lang, "report.builder_sending", "Sending...") : t(lang, "report.builder_send_test_now", "Send Test Now")}
            </Button>
            <Button size="sm" onClick={handleSaveConfig} disabled={!savedReportId || saving || !recipients.trim()}>
              {saving ? t(lang, "report.builder_saving", "Saving...") : t(lang, "report.builder_save_config", "Save Config")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
