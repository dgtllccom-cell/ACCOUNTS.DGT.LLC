"use client";

import { printStore } from "@/lib/store/print-store";
import { escapeHtml } from "@/lib/reports/erp-report-template-builder";
import { t } from "@/lib/i18n/ui";

export type SystemReportPayload = {
  generatedAt: string;
  environment: string;
  moduleCount: number;
  totalRoutes: number;
  modules: Array<{ label: string; routes: number }>;
  db: {
    tables: number;
    views: number;
    functions: number;
    tableGroups: Array<{ grp: string; n: number }>;
    migrations: Array<{ name: string; status: string; applied_at: string }>;
    translation: {
      record_translations_rows: number;
      by_language: Record<string, number>;
      by_engine: Array<{ engine: string; n: number }>;
      translation_memory_rows: number;
      translation_memory_by_status: Array<{ status: string; n: number }>;
      registered_translatable_tables: number;
      recursive_or_per_module_junk_tables: number;
    };
    org: { countries: number; country_branches: number; city_branches: number; roles: number; permissions: number; profiles: number };
  };
  /** deployment evidence supplied by the page (build/test results, commit) */
  evidence?: {
    commit?: string;
    tsc?: string;
    build?: string;
    i18nGuard?: string;
    e2e?: string;
    prod?: string;
    localDev?: string;
    errorsFixed?: Array<{ error: string; rootCause: string; fix: string; evidence: string }>;
    remaining?: string[];
  };
};

const LANG_LABEL: Record<string, string> = { en: "English", ur: "اردو (Urdu)", ar: "العربية (Arabic)", fa: "فارسی (Farsi)", ps: "پښتو (Pashto)" };

function section(title: string, body: string): string {
  return `<section class="sd-sec"><h2>${escapeHtml(title)}</h2>${body}</section>`;
}
function kv(rows: Array<[string, string | number]>): string {
  return `<table class="sd-kv"><tbody>${rows.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(String(v))}</td></tr>`).join("")}</tbody></table>`;
}
function grid(headers: string[], rows: Array<Array<string | number>>): string {
  return `<table class="sd-grid"><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(String(c))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

export function buildSystemDocumentationHtml(p: SystemReportPayload, lang = "en"): string {
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (k: string, f: string) => t(lang, k as never, f);
  const d = p.db;
  const tr = d.translation;
  const bl = tr.by_language;
  const appliedMig = d.migrations.filter((m) => m.status === "applied").length;

  const ev = p.evidence ?? {};
  const now = new Date(p.generatedAt);

  const body = `
  ${section(tt("sysrep.overview", "1. ERP Overview"), kv([
    [tt("sysrep.generated", "Generated"), now.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })],
    [tt("sysrep.environment", "Environment"), p.environment],
    [tt("sysrep.modules", "Top-level modules"), p.moduleCount],
    [tt("sysrep.routes", "Dashboard routes / pages"), p.totalRoutes],
    [tt("sysrep.db_tables", "Database tables"), d.tables],
    [tt("sysrep.db_views", "Database views"), d.views],
    [tt("sysrep.db_functions", "Database functions"), d.functions],
    ...(ev.commit ? [[tt("sysrep.commit", "Deployed commit"), ev.commit] as [string, string]] : []),
  ]))}

  ${section(tt("sysrep.table_groups", "2. Database — table groups"),
    grid([tt("sysrep.group", "Group"), tt("sysrep.count", "Tables")], d.tableGroups.map((g) => [g.grp, g.n])))}

  ${section(tt("sysrep.migrations", "3. Migrations"), kv([
    [tt("sysrep.mig_total", "Total registered"), d.migrations.length],
    [tt("sysrep.mig_applied", "Applied"), appliedMig],
    [tt("sysrep.mig_pending", "Not applied"), d.migrations.length - appliedMig],
  ]) + grid([tt("sysrep.mig_name", "Migration"), tt("sysrep.status", "Status"), tt("sysrep.applied_at", "Applied")],
    d.migrations.slice(-30).map((m) => [m.name, m.status, m.applied_at ? new Date(m.applied_at).toLocaleDateString("en-GB") : "-"])))}

  ${section(tt("sysrep.translator", "4. Local Translator + Business Dictionary"), `
    <p class="sd-p">${escapeHtml(tt("sysrep.translator_desc",
      "Central 5-language pipeline: approved translation memory → curated ERP business glossary → contextual phrase substitution → local phrase engine. External machine translation (Google) is OFF. The single source of truth is record_translations, a VIEW over translations_english / _urdu / _arabic / _persian / _pashto, written only through upsert_record_translation()."))}</p>
    ${kv([
      [tt("sysrep.rt_rows", "record_translations rows"), tr.record_translations_rows],
      [tt("sysrep.registered_tables", "Registered translatable tables"), tr.registered_translatable_tables],
      [tt("sysrep.tm_rows", "Translation-memory / dictionary rows"), tr.translation_memory_rows],
      [tt("sysrep.junk_tables", "Recursive / per-module junk tables"), tr.recursive_or_per_module_junk_tables],
    ])}
    <h3>${escapeHtml(tt("sysrep.lang_coverage", "Language coverage (record_translations)"))}</h3>
    ${grid([tt("sysrep.language", "Language"), tt("sysrep.populated", "Populated rows")],
      (["en", "ur", "ar", "fa", "ps"] as const).map((l) => [LANG_LABEL[l], bl[l] ?? 0]))}
    <h3>${escapeHtml(tt("sysrep.tr_status", "Translation status"))}</h3>
    ${grid([tt("sysrep.status", "Status"), tt("sysrep.count", "Count")], [
      ["complete", bl.complete ?? 0], ["needs_review", bl.needs_review ?? 0], ["pending", bl.pending ?? 0],
    ])}
    <h3>${escapeHtml(tt("sysrep.tr_engine", "By engine"))}</h3>
    ${grid([tt("sysrep.engine", "Engine"), tt("sysrep.count", "Count")], tr.by_engine.map((e) => [e.engine, e.n]))}
    ${tr.translation_memory_by_status.length
      ? `<h3>${escapeHtml(tt("sysrep.tm_status", "Dictionary / memory by status"))}</h3>${grid([tt("sysrep.status", "Status"), tt("sysrep.count", "Count")], tr.translation_memory_by_status.map((s) => [s.status, s.n]))}`
      : ""}
  `)}

  ${section(tt("sysrep.org", "5. Organisation, roles & scope"), kv([
    [tt("sysrep.countries", "Countries"), d.org.countries],
    [tt("sysrep.country_branches", "Country branches"), d.org.country_branches],
    [tt("sysrep.city_branches", "City branches"), d.org.city_branches],
    [tt("sysrep.roles", "Roles"), d.org.roles],
    [tt("sysrep.permissions", "Permissions"), d.org.permissions],
    [tt("sysrep.profiles", "User profiles"), d.org.profiles],
  ]) + `<p class="sd-p">${escapeHtml(tt("sysrep.scope_desc",
    "Access is enforced Super Admin → Country Admin → Branch Admin → User. Every list, report and API filters by the caller's country / branch scope; cross-scope ids return 403."))}</p>`)}

  ${section(tt("sysrep.module_list", "6. Modules & pages"),
    grid([tt("sysrep.module", "Module"), tt("sysrep.pages", "Pages / routes")], p.modules.map((m) => [tt(m.label, m.label), m.routes])))}

  ${ev.errorsFixed?.length ? section(tt("sysrep.errors", "7. Errors found → Root cause → Fix → Evidence"),
    grid([tt("sysrep.error", "Error"), tt("sysrep.root_cause", "Root cause"), tt("sysrep.fix", "Fix applied"), tt("sysrep.evidence", "Test evidence")],
      ev.errorsFixed.map((e) => [e.error, e.rootCause, e.fix, e.evidence]))) : ""}

  ${section(tt("sysrep.verification", "8. Verification"), kv([
    ...(ev.tsc ? [[tt("sysrep.tsc", "TypeScript (tsc --noEmit)"), ev.tsc] as [string, string]] : []),
    ...(ev.build ? [[tt("sysrep.build", "Production build"), ev.build] as [string, string]] : []),
    ...(ev.i18nGuard ? [[tt("sysrep.i18n_guard", "i18n guard"), ev.i18nGuard] as [string, string]] : []),
    ...(ev.e2e ? [[tt("sysrep.e2e", "E2E / regression"), ev.e2e] as [string, string]] : []),
    ...(ev.localDev ? [[tt("sysrep.local", "Local / DEV"), ev.localDev] as [string, string]] : []),
    ...(ev.prod ? [[tt("sysrep.prod", "EPS / Production"), ev.prod] as [string, string]] : []),
    [tt("sysrep.dev_errors", "Developer-actionable errors remaining"), ev.remaining?.length ? String(ev.remaining.length) : "0"],
  ]) + (ev.remaining?.length
    ? `<h3>${escapeHtml(tt("sysrep.remaining", "Remaining / owner action"))}</h3><ul class="sd-ul">${ev.remaining.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`
    : ""))}
  `;

  return `<!doctype html><html lang="${lang}" dir="${isRtl ? "rtl" : "ltr"}"><head><meta charset="utf-8" />
  <title>${escapeHtml(tt("sysrep.title", "ERP System Documentation & Final Verification Report"))}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    :root { color-scheme: light; }
    body { font-family: ${isRtl ? "'Noto Naskh Arabic', 'Segoe UI', Tahoma, sans-serif" : "'Segoe UI', Roboto, Arial, sans-serif"};
      color: #111; background: #fff; font-size: 11px; margin: 0; }
    .sd-head { border-bottom: 3px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 16px; }
    .sd-head h1 { font-size: 18px; margin: 0 0 2px; color: #1e3a8a; }
    .sd-head .sub { color: #475569; font-size: 11px; }
    .sd-sec { margin: 14px 0; break-inside: avoid; }
    .sd-sec h2 { font-size: 13px; color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin: 0 0 6px; }
    .sd-sec h3 { font-size: 11px; color: #334155; margin: 8px 0 3px; }
    .sd-p { margin: 4px 0 8px; color: #334155; line-height: 1.45; }
    table { border-collapse: collapse; width: 100%; margin: 3px 0 8px; }
    .sd-kv th { text-align: ${isRtl ? "right" : "left"}; width: 42%; background: #f1f5f9; }
    th, td { border: 1px solid #d1d5db; padding: 3px 6px; text-align: ${isRtl ? "right" : "left"}; vertical-align: top; }
    .sd-grid thead th { background: #1e3a8a; color: #fff; font-weight: 700; }
    .sd-grid tbody tr:nth-child(even) { background: #f8fafc; }
    .sd-ul { margin: 4px 0; padding-${isRtl ? "right" : "left"}: 16px; }
    .sd-foot { margin-top: 18px; border-top: 1px solid #cbd5e1; padding-top: 6px; color: #64748b; font-size: 9px; }
  </style></head>
  <body>
    <div class="sd-head">
      <h1>${escapeHtml(tt("sysrep.title", "ERP System Documentation & Final Verification Report"))}</h1>
      <div class="sub">Digital Dock ERP • ${escapeHtml(p.environment)} • ${escapeHtml(now.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" }))}</div>
    </div>
    ${body}
    <div class="sd-foot">${escapeHtml(tt("sysrep.footer", "Auto-generated from the live database. Figures reflect the environment above at generation time."))}</div>
  </body></html>`;
}

export function openSystemDocumentationReport(payload: SystemReportPayload, lang = "en") {
  const html = buildSystemDocumentationHtml(payload, lang);
  const title = t(lang, "sysrep.title" as never, "ERP System Documentation Report");
  try {
    printStore.openPrint(html, title, {
      lang,
      rebuild: ({ lang: l }) => buildSystemDocumentationHtml(payload, l),
    });
  } catch {
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (w) { w.document.open(); w.document.write(html); w.document.close(); }
  }
}
