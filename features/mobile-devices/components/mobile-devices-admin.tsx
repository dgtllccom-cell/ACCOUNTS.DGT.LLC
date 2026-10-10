"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Smartphone, RefreshCw, Check, X, Ban, KeyRound, Copy, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";

type Device = {
  id: string; app: "b" | "bs"; platform: string | null; device_model: string | null; requested_name: string; requested_phone: string | null;
  requested_identifier: string; request_note: string | null; status: "pending" | "approved" | "active" | "rejected" | "revoked";
  requested_at: string; last_seen_at: string | null; bound_user_id: string | null; code_expires_at: string | null;
};
type Ev = { event: string; detail: string | null; created_at: string };

const FILTERS = ["all", "pending", "approved", "active", "rejected", "revoked"] as const;
const STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  approved: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  active: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  rejected: "bg-slate-500/15 text-slate-700 border-slate-500/30",
  revoked: "bg-rose-500/15 text-rose-700 border-rose-500/30",
};
const when = (d: string | null) => (d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

/** Super Admin: approve, block and track the phones that may open DGT.llc B and DGT.llc BS. */
export function MobileDevicesAdmin() {
  const s = useErpScreen("mdev");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("pending");
  const [rows, setRows] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [codeShown, setCodeShown] = useState<{ code: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [events, setEvents] = useState<{ id: string; list: Ev[] } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/erp/mobile-devices?status=${filter}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error?.message || "");
      setRows(j.data.devices);
    } catch (e: any) {
      setError(e?.message || s.t("err_load", "Could not load the devices."));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const act = async (d: Device, action: "approve" | "reject" | "revoke") => {
    setBusyId(d.id);
    setError("");
    try {
      const r = await fetch(`/api/erp/mobile-devices/${d.id}/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ note: note || undefined }) });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error?.message || s.t("err_load", "Could not load the devices."));
      if (action === "approve") { setCopied(false); setCodeShown({ code: j.data.code, name: d.requested_name }); }
      setNote("");
      await load();
    } catch (e: any) {
      setError(e?.message);
    } finally {
      setBusyId(null);
    }
  };

  const showHistory = async (d: Device) => {
    const r = await fetch(`/api/erp/mobile-devices/${d.id}`, { cache: "no-store" });
    const j = await r.json().catch(() => null);
    setEvents({ id: d.id, list: j?.data?.events ?? [] });
  };

  return (
    <div className="space-y-4" dir={s.dir}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black"><Smartphone className="h-5 w-5 text-primary" />{s.t("adm_title", "Mobile Devices")}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{s.t("adm_subtitle", "Approve, block and track the phones that may open DGT.llc B and DGT.llc BS.")}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} className="gap-1.5"><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />{s.t("refresh", "Refresh")}</Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full border px-3 py-1 text-xs font-semibold", filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground")}>
            {f === "all" ? s.t("f_all", "All") : s.t(`st_${f}`, f)}
          </button>
        ))}
      </div>

      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={s.t("note_ph", "Reason / note (optional)")} className="max-w-md text-xs" />
      {error && <p role="alert" className="text-xs font-semibold text-destructive">{error}</p>}

      <ul className="space-y-2">
        {rows.length === 0 && !loading && <li className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">{s.t("empty", "No devices in this list.")}</li>}
        {rows.map((d) => (
          <li key={d.id} className="space-y-2 rounded-xl border bg-card p-3 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-bold">{d.requested_name}</div>
                <div className="text-xs text-muted-foreground" dir="ltr">{d.requested_identifier}{d.requested_phone ? ` · ${d.requested_phone}` : ""}</div>
              </div>
              <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-bold", STATUS_CLASS[d.status])}>{s.t(`st_${d.status}`, d.status)}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-4">
              <div><dt className="font-bold uppercase text-muted-foreground">{s.t("col_app", "App")}</dt><dd>{d.app === "b" ? "DGT.llc B" : "DGT.llc BS"}</dd></div>
              <div><dt className="font-bold uppercase text-muted-foreground">{s.t("col_device", "Device")}</dt><dd dir="ltr">{[d.platform, d.device_model].filter(Boolean).join(" · ") || "—"}</dd></div>
              <div><dt className="font-bold uppercase text-muted-foreground">{s.t("col_requested", "Requested")}</dt><dd dir="ltr">{when(d.requested_at)}</dd></div>
              <div><dt className="font-bold uppercase text-muted-foreground">{s.t("last_seen", "Last seen")}</dt><dd dir="ltr">{d.last_seen_at ? when(d.last_seen_at) : s.t("never", "never")}</dd></div>
            </dl>
            {d.request_note && <p className="text-[11px] italic text-muted-foreground">{d.request_note}</p>}
            {d.bound_user_id && <p className="text-[11px] text-emerald-700">{s.t("bound", "Signed-in account is locked to this device")}</p>}
            <div className="flex flex-wrap gap-1.5">
              {(d.status === "pending" || d.status === "approved" || d.status === "active") && (
                <Button size="sm" disabled={busyId === d.id} onClick={() => void act(d, "approve")} className="h-8 gap-1 text-xs">
                  {d.status === "pending" ? <Check className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
                  {d.status === "pending" ? s.t("approve", "Approve & issue code") : s.t("new_code", "Issue new code")}
                </Button>
              )}
              {(d.status === "pending" || d.status === "approved") && (
                <Button size="sm" variant="outline" disabled={busyId === d.id} onClick={() => void act(d, "reject")} className="h-8 gap-1 text-xs"><X className="h-3.5 w-3.5" />{s.t("reject", "Decline")}</Button>
              )}
              {d.status !== "revoked" && d.status !== "rejected" && (
                <Button size="sm" variant="outline" disabled={busyId === d.id} onClick={() => void act(d, "revoke")} className="h-8 gap-1 text-xs text-rose-700"><Ban className="h-3.5 w-3.5" />{s.t("revoke", "Block device")}</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => void showHistory(d)} className="h-8 gap-1 text-xs"><History className="h-3.5 w-3.5" />{s.t("history", "History")}</Button>
            </div>
            {events?.id === d.id && (
              <ul className="space-y-0.5 border-t pt-2 text-[11px]">
                {events.list.map((e, i) => (
                  <li key={i} className="flex justify-between gap-2"><span className="font-semibold">{e.event}{e.detail ? ` · ${e.detail}` : ""}</span><span className="font-mono text-muted-foreground" dir="ltr">{when(e.created_at)}</span></li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {codeShown &&
        typeof document !== "undefined" &&
        createPortal(
          <div role="dialog" aria-modal="true" dir={s.dir} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm space-y-3 rounded-2xl bg-background p-5 text-center shadow-xl">
              <h2 className="flex items-center justify-center gap-2 text-base font-black"><KeyRound className="h-4 w-4" />{s.t("code_title", "Activation code")} — {codeShown.name}</h2>
              <div className="rounded-xl bg-muted py-4 text-4xl font-black tracking-[0.35em]" dir="ltr">{codeShown.code}</div>
              <p className="text-xs text-muted-foreground">{s.t("code_body", "Give this code to the user (phone call or message). It is shown only now, works for 48 hours and allows 5 attempts.")}</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1 gap-1" onClick={() => { void navigator.clipboard?.writeText(codeShown.code); setCopied(true); }}><Copy className="h-3.5 w-3.5" />{copied ? s.t("copied", "Copied") : s.t("copy", "Copy")}</Button>
                <Button type="button" className="flex-1" onClick={() => setCodeShown(null)}>{s.t("close", "Close")}</Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
