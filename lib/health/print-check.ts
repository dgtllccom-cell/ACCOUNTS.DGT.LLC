"use client";

import { buildGenericErpReportHtml } from "@/lib/reports/open-generic-erp-report";
import type { HealthFinding } from "./types";

const LANGS = ["en", "ur", "ps", "fa", "ar"] as const;

/**
 * Print / PDF engine health — run in the browser only (the report engine imports
 * a client-only print store). Exercises the universal report builder in all five
 * languages with an empty and a populated dataset and asserts it returns valid
 * HTML containing a table, without throwing.
 */
export function runPrintPdfCheck(): HealthFinding[] {
  const out: HealthFinding[] = [];
  let id = 0;
  const now = new Date().toISOString();
  const columns = [
    { key: "name", label: "Name", align: "left" as const },
    { key: "amount", label: "Amount", align: "right" as const, format: "number" as const },
  ];
  const cases: { name: string; rows: Record<string, unknown>[] }[] = [
    { name: "empty dataset", rows: [] },
    { name: "populated dataset", rows: [{ name: "Test Row", amount: 1234.5 }] },
  ];
  let failures = 0;
  for (const lang of LANGS) {
    for (const c of cases) {
      try {
        const { html } = buildGenericErpReportHtml({
          title: "Health Check Report",
          lang,
          columns,
          rows: c.rows,
          summary: { Total: c.rows.length },
          filters: [{ label: "Scope", value: "health" }],
        });
        const ok = typeof html === "string" && html.length > 200 && html.includes("<table");
        if (!ok) {
          failures++;
          out.push({
            id: `pc${++id}`,
            category: "print_pdf",
            module: "Universal report engine",
            target: `buildGenericErpReportHtml [${lang} / ${c.name}]`,
            status: "failed",
            title: "Report builder produced no usable HTML",
            expected: "an HTML document containing a <table>",
            actual: `${html?.length ?? 0} chars, has <table>: ${html?.includes("<table")}`,
            language: { [lang]: "fail" } as any,
            checkedAt: now,
          });
        }
      } catch (e) {
        failures++;
        out.push({
          id: `pc${++id}`,
          category: "print_pdf",
          module: "Universal report engine",
          target: `buildGenericErpReportHtml [${lang} / ${c.name}]`,
          status: "failed",
          title: "Report builder threw an exception",
          expected: "no exception",
          actual: e instanceof Error ? e.message : String(e),
          language: { [lang]: "fail" } as any,
          checkedAt: now,
        });
      }
    }
  }
  if (failures === 0) {
    out.push({
      id: `pc${++id}`,
      category: "print_pdf",
      module: "Universal report engine",
      target: "buildGenericErpReportHtml",
      status: "healthy",
      title: "Report builder renders in all 5 languages (empty + populated)",
      expected: "valid HTML + <table>, no exception",
      actual: "10 / 10 cases passed",
      language: Object.fromEntries(LANGS.map((l) => [l, "pass"])) as any,
      checkedAt: now,
    });
  }
  return out;
}
