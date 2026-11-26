"use client";

import { useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { demoRowsSchema, type DemoRow, type DemoRowResult } from "@/lib/accounts-demo-import";
import type { SupportedLanguage } from "@/lib/i18n/languages";

const labels = {
  en: ["Al Ras demo accounts", "Choose the approved JSON file. Preview does not create anything.", "Preview", "Create ready accounts", "AED 0.00 • Business • ARE-AEDU-001", "Ready", "Existing", "Blocked", "Created", "Processing…", "Stopped. Preview again to reconcile saved accounts before resuming.", "Invalid demo file."],
  ur: ["الرأس ڈیمو اکاؤنٹس", "منظور شدہ JSON فائل منتخب کریں۔ پیشگی جائزے سے ریکارڈ نہیں بنے گا۔", "پیشگی جائزہ", "تیار اکاؤنٹس بنائیں", "AED 0.00 • بزنس • ARE-AEDU-001", "تیار", "موجودہ", "رکے ہوئے", "بن گئے", "کارروائی جاری ہے…", "کارروائی رک گئی۔ دوبارہ پیشگی جائزہ لے کر محفوظ اکاؤنٹس چیک کریں۔", "ڈیمو فائل درست نہیں ہے۔"],
  ar: ["حسابات الرأس التجريبية", "اختر ملف JSON المعتمد. المعاينة لا تنشئ سجلات.", "معاينة", "إنشاء الحسابات الجاهزة", "AED 0.00 • الأعمال • ARE-AEDU-001", "جاهز", "موجود", "متوقف", "تم الإنشاء", "جارٍ المعالجة…", "توقفت العملية. أعد المعاينة للتحقق مما تم حفظه قبل المتابعة.", "ملف تجريبي غير صالح."],
  fa: ["حساب‌های آزمایشی الرأس", "فایل JSON تأییدشده را انتخاب کنید. پیش‌نمایش رکوردی ایجاد نمی‌کند.", "پیش‌نمایش", "ایجاد حساب‌های آماده", "AED 0.00 • تجاری • ARE-AEDU-001", "آماده", "موجود", "مسدود", "ایجاد شد", "در حال پردازش…", "عملیات متوقف شد. پیش از ادامه، پیش‌نمایش را برای بررسی حساب‌های ذخیره‌شده تکرار کنید.", "فایل آزمایشی نامعتبر است."],
  ps: ["د الراس ازمایښتي حسابونه", "تایید شوی JSON فایل غوره کړئ. مخکتنه ریکارډونه نه جوړوي.", "مخکتنه", "چمتو حسابونه جوړ کړئ", "AED 0.00 • سوداګري • ARE-AEDU-001", "چمتو", "موجود", "بند", "جوړ شو", "پروسس روان دی…", "پروسس ودرېد. د دوام مخکې مخکتنه بیا وکړئ او خوندي حسابونه وګورئ.", "ازمایښتي فایل ناسم دی."],
} as const;

export function AlRasDemoImport({ lang }: { lang: SupportedLanguage }) {
  const [title, help, preview, create, scope, readyText, existingText, blockedText, createdText, busyText, stopText, badFile] = labels[lang] ?? labels.en;
  const [rows, setRows] = useState<DemoRow[]>([]);
  const [results, setResults] = useState<DemoRowResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviewed, setReviewed] = useState(false);

  async function fileChanged(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setRows([]); setResults([]); setReviewed(false); setError("");
    if (!file) return;
    if (file.size > 256_000) { setError(badFile); return; }
    setBusy(true);
    try { setRows(demoRowsSchema.parse(JSON.parse(await file.text()))); }
    catch { setError(badFile); }
    finally { setBusy(false); }
  }

  async function send(action: "preview" | "create", data: DemoRow[]) {
    const response = await fetch("/api/erp/accounting/accounts/bulk-create", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "al-ras-demo", action, rows: data }),
    });
    const payload = await response.json();
    if (!response.ok || !Array.isArray(payload?.data?.results)) throw new Error(payload?.error?.message || stopText);
    return payload.data.results as DemoRowResult[];
  }

  async function runPreview() {
    setBusy(true); setReviewed(false); setError("");
    try { setResults(await send("preview", rows)); setReviewed(true); }
    catch (e) { setError(e instanceof Error ? e.message : stopText); }
    finally { setBusy(false); }
  }

  async function runCreate() {
    setBusy(true); setReviewed(false); setError("");
    const ready = results.filter((row) => row.status === "ready");
    try {
      for (let i = 0; i < ready.length; i += 5) {
        const batch = ready.slice(i, i + 5).map(({ reference, name, category }) => ({ reference, name, category }));
        const returned = await send("create", batch);
        const updates = new Map(returned.map((r) => [r.reference, r]));
        setResults((prior) => prior.map((r) => updates.get(r.reference) ?? r));
        if (returned.length !== batch.length || returned.some((r) => r.status !== "created" && r.status !== "existing")) {
          throw new Error(stopText);
        }
      }
    } catch { setError(stopText); }
    finally { setBusy(false); }
  }

  const readyCount = results.filter((r) => r.status === "ready").length;
  const statusText = { ready: readyText, existing: existingText, blocked: blockedText, created: createdText, unknown: stopText };

  return <details className="space-y-3 rounded-lg border p-3">
    <summary className="cursor-pointer font-semibold">{title}</summary>
    <p>{help}</p>
    <p dir="ltr">{scope}</p>
    <input type="file" accept=".json,application/json" disabled={busy} aria-label={title} onChange={fileChanged} />
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={busy || rows.length === 0} onClick={runPreview}>{preview}</Button>
      <Button type="button" disabled={busy || !reviewed || readyCount === 0} onClick={runCreate}>{create} ({readyCount})</Button>
    </div>
    {busy && <p role="status">{busyText}</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {!!results.length && <>
      <p role="status">{(["ready", "existing", "blocked", "created"] as const).map((s) => `${statusText[s]}: ${results.filter((r) => r.status === s).length}`).join(" • ")}</p>
      <ul className="max-h-64 overflow-auto divide-y" dir="ltr">
        {results.map((r) => <li key={r.reference} className="py-1 text-sm">
          {r.reference} · {r.name} · {r.category} · {r.country} · {statusText[r.status]} {r.code ?? ""} {r.reason ?? ""}
        </li>)}
      </ul>
    </>}
  </details>;
}
