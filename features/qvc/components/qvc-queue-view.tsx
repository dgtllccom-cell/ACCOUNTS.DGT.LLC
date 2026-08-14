"use client";
import { useEffect, useState, useCallback } from "react";
import { Loader2, CheckCircle2, AlertTriangle, Search } from "lucide-react";
import { Th } from "@/components/ui/translated-th";

type QvcRow = {
  id: string; manualNumber: string; accountCode: string; accountName: string;
  companyName: string; businessName: string; country: string; branch: string;
  category: string; subcategory: string; city: string; address: string;
  mobile: string; whatsapp: string; phone: string; email: string;
  qvcStatus: string; qvcNotes: string;
  translations: { en: string; ur: string; ps: string; fa: string; ar: string };
};

const FILTERS = [
  { key: "qvc_pending", label: "Pending" },
  { key: "needs_review", label: "Needs Review" },
  { key: "qvc_approved", label: "Approved" },
  { key: "error", label: "Error" },
  { key: "", label: "All" }
];

function LangChip({ lang, status }: { lang: string; status: string }) {
  const ok = status === "translated" || status === "present";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`} title={`${lang}: ${status}`}>
      {lang.toUpperCase()}
    </span>
  );
}

export function QvcQueueView() {
  const [rows, setRows] = useState<QvcRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("qvc_pending");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/erp/qvc/accounts?status=${filter}&q=${encodeURIComponent(q)}`, { credentials: "include" }).then(r => r.json());
      setRows(res?.accounts || []);
      setCounts(res?.counts || {});
    } catch { setRows([]); } finally { setLoading(false); }
  }, [filter, q]);

  useEffect(() => { load(); }, [load]);

  async function setStatus(id: string, qvc_status: string) {
    await fetch("/api/erp/qvc/accounts", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ id, qvc_status }) });
    load();
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">QVC Review Queue</h1>
          <p className="text-xs text-slate-500">Excel → Import Completed → QVC Pending → Manual Review → QVC Approved. Review each account, complete translations, then approve.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search manual # / name / code" className="w-64 rounded-lg border border-slate-200 py-1.5 pl-7 pr-2 text-xs dark:border-slate-700 dark:bg-slate-900" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === f.key ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"}`}>
            {f.label}{f.key && counts[f.key] != null ? ` (${counts[f.key]})` : ""}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[1400px] text-xs">
          <thead className="bg-slate-50/80 text-left font-bold uppercase text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <Th className="px-3 py-3">Manual #</Th>
              <Th className="px-3 py-3">Account Name</Th>
              <Th className="px-3 py-3">Company</Th>
              <Th className="px-3 py-3">Business</Th>
              <Th className="px-3 py-3">Country</Th>
              <Th className="px-3 py-3">Branch</Th>
              <Th className="px-3 py-3">Category</Th>
              <Th className="px-3 py-3">City</Th>
              <Th className="px-3 py-3">Mobile</Th>
              <Th className="px-3 py-3">WhatsApp</Th>
              <Th className="px-3 py-3">Phone</Th>
              <Th className="px-3 py-3">Email</Th>
              <Th className="px-3 py-3">EN/UR/PS/FA/AR</Th>
              <Th className="px-3 py-3">QVC Status</Th>
              <Th className="px-3 py-3 text-center">Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={15} className="px-3 py-12 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={15} className="px-3 py-12 text-center text-slate-400">No accounts in this queue.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-3 py-2.5 font-mono font-bold text-blue-600">{r.manualNumber}</td>
                <td className="px-3 py-2.5 font-semibold">{r.accountName}</td>
                <td className="px-3 py-2.5">{r.companyName || "-"}</td>
                <td className="px-3 py-2.5">{r.businessName || "-"}</td>
                <td className="px-3 py-2.5">{r.country || "-"}</td>
                <td className="px-3 py-2.5">{r.branch || "-"}</td>
                <td className="px-3 py-2.5">{r.category} / {r.subcategory}</td>
                <td className="px-3 py-2.5">{r.city || "-"}</td>
                <td className="px-3 py-2.5 font-mono">{r.mobile || "-"}</td>
                <td className="px-3 py-2.5 font-mono">{r.whatsapp || "-"}</td>
                <td className="px-3 py-2.5 font-mono">{r.phone || "-"}</td>
                <td className="px-3 py-2.5">{r.email || "-"}</td>
                <td className="px-3 py-2.5"><div className="flex gap-1"><LangChip lang="en" status={r.translations.en} /><LangChip lang="ur" status={r.translations.ur} /><LangChip lang="ps" status={r.translations.ps} /><LangChip lang="fa" status={r.translations.fa} /><LangChip lang="ar" status={r.translations.ar} /></div></td>
                <td className="px-3 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.qvcStatus === "qvc_approved" ? "bg-emerald-100 text-emerald-700" : r.qvcStatus === "error" ? "bg-rose-100 text-rose-700" : r.qvcStatus === "needs_review" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>{r.qvcStatus}</span>
                </td>
                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                  <button onClick={() => setStatus(r.id, "qvc_approved")} className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-500 mr-1" title="Approve"><CheckCircle2 className="h-3 w-3" /> Approve</button>
                  <button onClick={() => setStatus(r.id, "error")} className="inline-flex items-center gap-1 rounded bg-rose-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-rose-500" title="Flag error"><AlertTriangle className="h-3 w-3" /> Error</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
