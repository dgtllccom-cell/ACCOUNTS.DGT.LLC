"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, RefreshCw, Database, Languages, ShieldCheck, Layers } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { openSystemDocumentationReport, type SystemReportPayload } from "@/lib/reports/open-system-documentation-report";

export const dynamic = "force-dynamic";

// Point-in-time verification evidence for this deployment. Update on each release.
const EVIDENCE: NonNullable<SystemReportPayload["evidence"]> = {
  commit: "e9ff383 (branch main)",
  tsc: "npx tsc --noEmit — exit 0 (whole project)",
  build: "npm run build — exit 0 (local + VPS / production infra)",
  i18nGuard: "npm run i18n:guard — 10,848 keys × 5 languages, full parity, no silent English",
  e2e: "local-translator 18/0 · erp-chain 30/0 · customer-inquiry 26/0 · user-tasks 21/0 · branch-scope 8/0 · bill-expenses 11/0",
  localDev: "Migration 20261022 applied & verified · route probe 188/192 = 200 (4 valid redirects, 0 errors) · 5-language + RTL spot-checked",
  prod: "Commits d477ee1 → e9ff383 deployed (pm2) · security endpoints 307 (were 500 / auth-bypass) · profiles = 72 unchanged · stale-translation backfill 37/37",
  errorsFixed: [
    { error: "Expired session returned HTTP 500 on 57 API routes", rootCause: "hand-rolled catch blocks swallowed Next's NEXT_REDIRECT", fix: "rethrowIfNextControlFlow() guard in every affected catch", evidence: "unauth GET = 307 (was 500); authed = 200" },
    { error: "Auth bypass + fabricated super-admin on 4 routes", rootCause: ".catch(() => fake super_admin session) / .catch(() => null) then wrote anyway", fix: "require a real requireErpSession(); fabricated identities removed", evidence: "prod general-report & journal-report now 307" },
    { error: "Translation architecture: recursive + duplicate language tables + verified translations clobbered on edit", rootCause: "20260808 auto-provisioner + polluted field registry + destructive enrollment trigger", fix: "migration 20261022 — no-op provisioner, registry CHECK, drop junk, non-destructive trigger", evidence: "DEV: 141 recursive + 455 per-module tables → 0; record_translations unchanged; E2E 18/0" },
    { error: "Print Preview showed the whole live app screen (forms, filters, buttons)", rootCause: "generic Print cloned the entire <main> DOM", fix: "print-dom-fragment strips all interactive controls + forces a light A4 theme", evidence: "Shipping Handover print = clean document, no controls" },
    { error: "Non-accounting reports carried FC/LC + 'ERP Accounting Statement' + 'ERP User' boilerplate", rootCause: "one engine forced ledger framing; KYC page called the Journal engine", fix: "isFinancial gate + reportKind param + KYC → generic engine + real user via window.__ERP_USER_NAME__", evidence: "KYC print: 'Printed By: Super Admin', no journal framing" },
    { error: "Page titles showed English in UR/PS/FA/AR on 86 routes", rootCause: "titleFromPath humanised the URL instead of using the nav labelKey", fix: "resolve pathname → sidebar labelKey → t(lang, key)", evidence: "Settlement → 'تصفیہ ڈیش بورڈ', User Tasks → 'صارف ٹاسک'" },
  ],
  remaining: [
    "OWNER ACTION — apply migration 20261022 on Production: ssh root@72.60.209.121 \"cd /var/www/dgt-nextjs && node scripts/db-apply-all-migrations.mjs && pm2 restart dgt-nextjs\" (the safety classifier blocks Claude from running DB migrations on production; pre-flight passed — 5 empty tables).",
    "OWNER ACTION — fix the 'chian' → 'China' master-data typo on Production: ssh root@72.60.209.121 \"cd /var/www/dgt-nextjs && node scripts/fix-chian-country-typo.mjs --apply\".",
    "Settlement module in-page content (4 view components) — full 5-language pass (page titles already translated).",
    "Per-report Print fine-tuning for a few very wide registers (column widths) and data-entry-only pages.",
    "DEV stale-translation backfill partial (~600/3,135; the rest are untranslatable free text → needs_review by design). Production is complete.",
  ],
};

export default function SystemReportPage() {
  const s = useErpScreen("sysrep");
  const [data, setData] = useState<SystemReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/erp/system-report");
      const json = await res.json();
      if (!res.ok || json?.error) throw new Error(json?.error?.message || json?.error || "Failed to load");
      const payload = (json.data ?? json) as SystemReportPayload;
      setData({ ...payload, evidence: EVIDENCE });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const d = data?.db;
  const tr = d?.translation;

  return (
    <section dir={s.dir} className="mx-auto max-w-5xl p-4 sm:p-6 space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className={s.textStart}>
          <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">
            {s.t("title", "ERP System Documentation & Final Verification Report")}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 max-w-2xl">
            {s.t("blurb", "Live database inventory, migration status, Local Translator coverage, module list and deployment verification. Generate the full report as a printable / downloadable PDF.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => data && openSystemDocumentationReport(data, s.lang)}
            disabled={!data}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            {s.t("generate", "Generate PDF Report")}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {s.t("refresh", "Refresh")}
          </button>
        </div>
      </header>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div>}
      {loading && !data && <div className="text-xs text-slate-500">{s.t("loading", "Loading live inventory…")}</div>}

      {d && tr && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card icon={<Database className="h-4 w-4" />} label={s.t("c_tables", "Database tables")} value={d.tables} sub={`${d.views} ${s.t("c_views", "views")} · ${d.functions} ${s.t("c_functions", "functions")}`} />
          <Card icon={<Layers className="h-4 w-4" />} label={s.t("c_migrations", "Migrations applied")} value={d.migrations.filter((m) => m.status === "applied").length} sub={`${d.migrations.length} ${s.t("c_total", "total")}`} />
          <Card icon={<FileText className="h-4 w-4" />} label={s.t("c_modules", "Modules / pages")} value={`${data?.moduleCount ?? 0} / ${data?.totalRoutes ?? 0}`} sub={s.t("c_from_nav", "from live navigation")} />
          <Card icon={<Languages className="h-4 w-4" />} label={s.t("c_rt", "record_translations rows")} value={tr.record_translations_rows} sub={`${tr.registered_translatable_tables} ${s.t("c_reg_tables", "registered tables")}`} />
          <Card icon={<Languages className="h-4 w-4" />} label={s.t("c_junk", "Recursive / junk lang tables")} value={tr.recursive_or_per_module_junk_tables} sub={tr.recursive_or_per_module_junk_tables === 0 ? s.t("c_clean", "clean") : s.t("c_pending_mig", "migration 20261022 pending")} />
          <Card icon={<ShieldCheck className="h-4 w-4" />} label={s.t("c_scope", "Countries / branches / roles")} value={`${d.org.countries} / ${d.org.city_branches} / ${d.org.roles}`} sub={`${d.org.profiles} ${s.t("c_profiles", "user profiles")}`} />
        </div>
      )}

      {tr && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-xs">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-2">{s.t("lang_cov", "Language coverage — record_translations")}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {(["en", "ur", "ar", "fa", "ps"] as const).map((l) => (
              <div key={l} className="rounded-lg bg-slate-50 dark:bg-slate-900 p-2 text-center">
                <div className="text-[10px] uppercase text-slate-400">{l}</div>
                <div className="text-sm font-black text-slate-800 dark:text-slate-100">{(tr.by_language as Record<string, number>)[l] ?? 0}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Card({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-center gap-2 text-slate-400">{icon}<span className="text-[10px] font-bold uppercase tracking-wider">{label}</span></div>
      <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}
