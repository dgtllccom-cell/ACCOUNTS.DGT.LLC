"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { Th } from "@/components/ui/translated-th";
import type { SupportedLanguage } from "@/lib/i18n/languages";

type HistoryRow = { to_status: string; note: string | null; created_at: string; actor_name: string | null };
type ApprovalRequest = {
  id: string;
  requestNo: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  accountCode: string;
  accountName: string;
  cityBranchName: string | null;
  requestedByName: string | null;
  createdAt: string;
  stage: number;
  stageLabel: string | null;
  totalStages: number;
  canDecide: boolean;
  history: HistoryRow[];
};

type Tab = "pending" | "approved" | "rejected" | "all";

/**
 * Shipping Line account approval queue (Country Admin -> Operations Country Admin). Reads /api/erp/accounting/account-approvals
 * and decides through the EXISTING approvals endpoint (PATCH /api/erp/approvals/{id}); no second approval system.
 */
export function ShippingAccountApprovalsView({ lang: langProp }: { lang?: SupportedLanguage }) {
  const s = useErpScreen("sacct", langProp);
  const [tab, setTab] = useState<Tab>("pending");
  const [rows, setRows] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/erp/accounting/account-approvals?status=${tab}`, { cache: "no-store" });
      const json = await res.json();
      setRows((json?.data?.requests ?? []) as ApprovalRequest[]);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { void load(); }, [load]);

  async function decide(row: ApprovalRequest, action: "approve" | "reject") {
    setBusy(row.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/erp/approvals/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...(notes[row.id] ? { note: notes[row.id] } : {}) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ kind: "err", text: json?.error?.message ?? s.t("error", "The decision could not be saved.") });
      } else if (action === "reject") {
        setMessage({ kind: "ok", text: s.t("rejected_done", "Account request rejected.") });
      } else if (json?.data?.status === "approved") {
        setMessage({ kind: "ok", text: s.t("activated", "Account approved and now Active.") });
      } else {
        setMessage({ kind: "ok", text: s.t("stage_done", "Stage approved. Waiting for the next approver.") });
      }
      await load();
    } catch {
      setMessage({ kind: "err", text: s.t("error", "The decision could not be saved.") });
    } finally {
      setBusy(null);
    }
  }

  const tabs: Array<[Tab, string]> = [
    ["pending", s.t("tab_pending", "Pending")],
    ["approved", s.t("tab_approved", "Approved")],
    ["rejected", s.t("tab_rejected", "Rejected")],
    ["all", s.t("tab_all", "All")],
  ];
  const fmt = (v: string) => new Date(v).toLocaleString(s.lang === "en" ? undefined : s.lang);

  return (
    <section dir={s.dir} className="space-y-4 p-4">
      <header className="space-y-1">
        <h1 className="text-lg font-black text-slate-800 dark:text-slate-100">{s.t("title", "Shipping Account Approvals")}</h1>
        <p className="text-xs text-slate-500">
          {s.t("subtitle", "Two-stage approval: Country Admin first, then Operations Country Admin. An account stays Pending until both have approved it.")}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {tabs.map(([key, label]) => (
          <Button key={key} size="sm" variant={tab === key ? "default" : "outline"} onClick={() => setTab(key)}>{label}</Button>
        ))}
      </div>

      {message && (
        <div role="status" className={`rounded border px-3 py-2 text-xs ${message.kind === "ok" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-red-300 bg-red-50 text-red-800"}`}>
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">{tabs.find(([k]) => k === tab)?.[1]}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-xs text-slate-500">{s.t("loading", "Loading approval requests...")}</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-slate-500">{s.t("empty", "No account approval requests.")}</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className={`border-b ${s.textStart}`}>
                  <Th className={s.textStart}>{s.t("col_request", "Request")}</Th>
                  <Th className={s.textStart}>{s.t("col_account", "Account")}</Th>
                  <Th className={s.textStart}>{s.t("col_branch", "Branch")}</Th>
                  <Th className={s.textStart}>{s.t("col_requested_by", "Requested by")}</Th>
                  <Th className={s.textStart}>{s.t("col_stage", "Stage")}</Th>
                  <Th className={s.textStart}>{s.t("col_status", "Status")}</Th>
                  <Th className={s.textStart}>{s.t("col_created", "Created")}</Th>
                  <Th className={s.textStart}>{s.t("col_actions", "Actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <>
                    <tr key={r.id} className="border-b align-top">
                      <td className="py-2 pe-2 font-mono">{r.requestNo}</td>
                      <td className="py-2 pe-2"><div className="font-semibold">{r.accountName}</div><div className="font-mono text-[10px] text-slate-500">{r.accountCode}</div></td>
                      <td className="py-2 pe-2">{r.cityBranchName ?? "-"}</td>
                      <td className="py-2 pe-2">{r.requestedByName ?? "-"}</td>
                      <td className="py-2 pe-2">
                        <div>{s.t("stage_of", "Stage {n} of {total}").replace("{n}", String(r.stage)).replace("{total}", String(r.totalStages))}</div>
                        {r.status === "pending" && r.stageLabel && (
                          <div className="flex items-center gap-1 text-[10px] text-amber-700"><Clock className="h-3 w-3" />{s.t("waiting_for", "Waiting for {role}").replace("{role}", r.stageLabel)}</div>
                        )}
                      </td>
                      <td className="py-2 pe-2">
                        <span className="inline-flex items-center gap-1">
                          {r.status === "approved" ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : r.status === "rejected" ? <XCircle className="h-3 w-3 text-red-600" /> : <Clock className="h-3 w-3 text-amber-600" />}
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2 pe-2 whitespace-nowrap">{fmt(r.createdAt)}</td>
                      <td className="py-2">
                        {r.status === "pending" && r.canDecide ? (
                          <div className="flex flex-col gap-1">
                            <Input className="h-7 text-xs" placeholder={s.t("note_ph", "Note (optional)")} value={notes[r.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} />
                            <div className="flex gap-1">
                              <Button size="sm" disabled={busy === r.id} onClick={() => decide(r, "approve")}>{s.t("approve", "Approve")}</Button>
                              <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => decide(r, "reject")}>{s.t("reject", "Reject")}</Button>
                            </div>
                          </div>
                        ) : r.status === "pending" ? (
                          <span className="text-[10px] text-slate-400">{s.t("not_your_stage", "Not your stage")}</span>
                        ) : null}
                        <Button size="sm" variant="ghost" className="mt-1 h-6 px-1 text-[10px]" onClick={() => setOpen(open === r.id ? null : r.id)}>{s.t("history", "Approval history")}</Button>
                      </td>
                    </tr>
                    {open === r.id && (
                      <tr key={`${r.id}-h`} className="border-b bg-slate-50 dark:bg-slate-900/40">
                        <td colSpan={8} className="p-2">
                          <ol className="space-y-1">
                            {r.history.map((h, i) => (
                              <li key={i} className="flex flex-wrap gap-2">
                                <span className="font-mono text-[10px] text-slate-500">{fmt(h.created_at)}</span>
                                <span className="font-semibold">{h.actor_name ?? "-"}</span>
                                <span>{h.to_status}</span>
                                {h.note && <span className="text-slate-500">— {h.note}</span>}
                              </li>
                            ))}
                          </ol>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
