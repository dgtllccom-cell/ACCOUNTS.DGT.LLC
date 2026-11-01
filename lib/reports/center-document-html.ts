/**
 * Reports Center - the official A4 document of one record, as a SELF-CONTAINED html string.
 *
 * The same string is what the centered preview shows (in a sandboxed iframe), what the existing universal print / PDF-preview system prints
 * and what the PDF download / PDF e-mail attachment is rendered from - so the preview, the print-out and the PDF can never disagree.
 * Chrome (labels) is translated by the caller's `tr` (five languages, RTL aware); business data (names, numbers, references) is printed exactly
 * as saved. Read-only by construction: it contains no form, no button and no script.
 */

import type { RecordDoc } from "@/lib/reports/center-record";

export type DocLabeler = (key: string, fallback: string) => string;

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

export function buildRecordDocumentHtml(input: {
  doc: RecordDoc;
  tr: DocLabeler;
  lang: string;
  rtl: boolean;
  generatedAt: string;
  /** translate a stored status / kind word (Posted, advance, …) - never the business data itself */
  word?: (v: string) => string;
  orientation?: "portrait" | "landscape";
}): string {
  const { doc, tr, lang, rtl, generatedAt } = input;
  const word = input.word ?? ((v: string) => v);
  const dir = rtl ? "rtl" : "ltr";
  const orient = input.orientation ?? "portrait";
  const title = `${tr(doc.typeKey, doc.typeLabel)} — ${doc.entryNo}`;

  const fields = (list: typeof doc.general, cols = 2) =>
    `<div class="grid c${cols}">${list
      .map((f) => `<div class="kv"><span class="k">${esc(tr(f.key, f.label))}</span><span class="v${f.strong ? " strong" : ""}" dir="auto">${esc(f.key === "rcd.f.status" ? word(f.value) : f.value)}</span></div>`)
      .join("")}</div>`;

  const amounts = doc.amounts.length
    ? `<h3>${esc(tr("rcd.sec.amounts", "Amounts"))}</h3><div class="grid c3">${doc.amounts
        .map((a) => `<div class="amt${a.strong ? " strong" : ""}"><span class="k">${esc(tr(a.key, a.label))}</span><span class="num" dir="ltr">${esc(a.value)}</span></div>`)
        .join("")}</div>`
    : "";

  const party = doc.party ? `<h3>${esc(tr(doc.party.titleKey, doc.party.title))}</h3>${fields(doc.party.fields)}` : "";

  const tables = doc.tables
    .map((t) => {
      const head = t.columns.map((c) => `<th class="${c.num ? "r" : ""}">${esc(tr(c.labelKey, c.label))}</th>`).join("");
      const body = t.rows
        .map(
          (r) =>
            `<tr>${t.columns
              .map((c) => {
                const raw = r[c.key] ?? "";
                const shown = c.key === "status" || c.key === "kind" ? word(raw) : raw;
                return `<td class="${c.num ? "r num" : ""}"${c.num ? ' dir="ltr"' : ' dir="auto"'}>${esc(shown)}</td>`;
              })
              .join("")}</tr>`
        )
        .join("");
      const foot = t.totals
        ? `<tfoot><tr>${t.columns.map((c, i) => `<td class="${c.num ? "r num" : ""}"${c.num ? ' dir="ltr"' : ""}>${i === 0 ? esc(tr("rcd.total", "Total")) : esc(t.totals?.[c.key] ?? "")}</td>`).join("")}</tr></tfoot>`
        : "";
      return `<h3>${esc(tr(t.titleKey, t.title))}</h3><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table>`;
    })
    .join("");

  const audit = doc.audit.length
    ? `<h3>${esc(tr("rcd.sec.audit", "Audit trail"))}</h3><table><thead><tr><th>${esc(tr("rcd.col.date", "Date"))}</th><th>${esc(tr("rcd.col.user", "User"))}</th><th>${esc(tr("rcd.col.action", "Action"))}</th></tr></thead><tbody>${doc.audit
        .map((a) => `<tr><td dir="ltr">${esc(String(a.at).replace("T", " ").slice(0, 16))}</td><td dir="auto">${esc(a.actor)}</td><td dir="auto">${esc(a.action)}</td></tr>`)
        .join("")}</tbody></table>`
    : "";

  return `<!DOCTYPE html>
<html lang="${esc(lang)}" dir="${dir}">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  @page { size: A4 ${orient}; margin: 8mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; color: #0f172a; }
  body { font-family: "Segoe UI", "Noto Naskh Arabic", "Noto Nastaliq Urdu", Tahoma, Arial, sans-serif; font-size: 11px; line-height: 1.45; direction: ${dir}; }
  .page { width: ${orient === "landscape" ? "1123px" : "794px"}; max-width: 100%; margin: 0 auto; padding: 18px 22px 24px; background: #ffffff; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 2px solid #0f172a; padding-bottom: 8px; }
  header h1 { margin: 0; font-size: 18px; letter-spacing: .2px; }
  header .sub { color: #475569; margin-top: 2px; font-size: 11px; }
  .badge { display: inline-block; border: 1px solid #94a3b8; border-radius: 4px; padding: 1px 8px; font-weight: 700; font-size: 10px; text-transform: uppercase; background: #f8fafc; }
  h3 { margin: 14px 0 6px; font-size: 11.5px; text-transform: uppercase; letter-spacing: .4px; color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; }
  .grid { display: grid; gap: 4px 18px; }
  .c2 { grid-template-columns: 1fr 1fr; } .c3 { grid-template-columns: 1fr 1fr 1fr; }
  .kv { display: flex; justify-content: space-between; gap: 8px; border-bottom: 1px dotted #e2e8f0; padding: 2px 0; }
  .k { color: #64748b; } .v { font-weight: 600; text-align: end; } .strong { font-weight: 800; }
  .amt { border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; display: flex; flex-direction: column; gap: 2px; background: #f8fafc; }
  .amt.strong { border-color: #1e3a8a; background: #eff6ff; } .amt .num { font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums; }
  table { width: 100%; border-collapse: collapse; margin-top: 2px; font-size: 10.5px; }
  th { background: #f1f5f9; color: #334155; font-weight: 700; border: 1px solid #cbd5e1; padding: 4px 6px; text-align: start; }
  td { border: 1px solid #e2e8f0; padding: 3px 6px; vertical-align: top; }
  tfoot td { font-weight: 800; background: #f8fafc; }
  .r { text-align: end; } .num { font-variant-numeric: tabular-nums; }
  tr { page-break-inside: avoid; }
  footer { margin-top: 18px; padding-top: 6px; border-top: 1px solid #cbd5e1; color: #64748b; font-size: 9.5px; display: flex; justify-content: space-between; gap: 10px; }
</style>
</head>
<body>
<div class="page">
  <header>
    <div>
      <h1>${esc(tr(doc.typeKey, doc.typeLabel))}</h1>
      <div class="sub" dir="auto">${esc(doc.entryNo)}</div>
    </div>
    <div><span class="badge">${esc(word(doc.status) || "—")}</span></div>
  </header>
  <h3>${esc(tr("rcd.sec.details", "Details"))}</h3>
  ${fields(doc.general)}
  ${party}
  ${amounts}
  ${tables}
  ${audit}
  <footer><span>${esc(tr("rc.readonly_copy", "Read-only copy of the saved ERP record"))}</span><span dir="ltr">${esc(generatedAt)}</span></footer>
</div>
</body>
</html>`;
}
