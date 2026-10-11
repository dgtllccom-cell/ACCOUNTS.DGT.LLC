"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BadgeCheck, Ban, Copy, KeyRound, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";

type Pass = {
  id: string; app: "b" | "bs"; label: string; identifier: string; max_devices: number; used_devices: number; failed_attempts: number;
  expires_at: string; revoked_at: string | null; created_at: string;
};

const when = (d: string | null) => (d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

/** Super Admin: passes that let Apple / Google / Samsung reviewers activate their own phones for ONE limited reviewer login. */
export function ReviewPassesPanel() {
  const s = useErpScreen("mdev");
  const [rows, setRows] = useState<Pass[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ app: "b" as "b" | "bs", label: "", identifier: "", days: 30, maxDevices: 6 });
  const [shown, setShown] = useState<{ code: string; label: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/erp/mobile-devices/review-passes", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error?.message || "");
      setRows(j.data.passes);
    } catch (e: any) {
      setError(e?.message || s.t("err_load", "Could not load the devices."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/erp/mobile-devices/review-passes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error?.message || s.t("err_generic", "Something went wrong. Please try again."));
      setCopied(false);
      setShown({ code: j.data.code, label: form.label });
      setForm({ ...form, label: "" });
      await load();
    } catch (e2: any) {
      setError(e2?.message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (p: Pass) => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/erp/mobile-devices/review-passes/${p.id}/revoke`, { method: "POST" });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error?.message || s.t("err_generic", "Something went wrong. Please try again."));
      await load();
    } catch (e: any) {
      setError(e?.message);
    } finally {
      setBusy(false);
    }
  };

  const stateOf = (p: Pass) =>
    p.revoked_at ? { k: "rp_revoked", en: "Revoked", cls: "bg-rose-500/15 text-rose-700 border-rose-500/30" }
    : new Date(p.expires_at).getTime() < Date.now() ? { k: "rp_expired", en: "Expired", cls: "bg-slate-500/15 text-slate-700 border-slate-500/30" }
    : p.failed_attempts >= 10 ? { k: "rp_locked", en: "Locked (too many wrong codes)", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" }
    : { k: "st_active", en: "active", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" };

  return (
    <section className="space-y-3 border-t pt-5" dir={s.dir}>
      <div>
        <h2 className="flex items-center gap-2 text-lg font-black"><BadgeCheck className="h-5 w-5 text-primary" />{s.t("rp_title", "Store review passes")}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{s.t("rp_subtitle", "Let Apple, Google or Samsung reviewers activate their own phones for one limited reviewer login — for a limited time and number of devices.")}</p>
      </div>

      <form onSubmit={create} className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="space-y-1 lg:col-span-2">
          <Label className="text-[11px]">{s.t("rp_name", "Pass name (e.g. Apple App Review)")}</Label>
          <Input required minLength={2} maxLength={80} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="text-xs" />
        </div>
        <div className="space-y-1 lg:col-span-2">
          <Label className="text-[11px]">{s.t("rp_identifier", "Reviewer ERP login")}</Label>
          <Input required dir="ltr" autoCapitalize="none" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} className="text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">{s.t("col_app", "App")}</Label>
          <select value={form.app} onChange={(e) => setForm({ ...form, app: e.target.value as "b" | "bs" })} className="h-9 w-full rounded-md border bg-background px-2 text-xs">
            <option value="b">DGT.llc B</option>
            <option value="bs">DGT.llc BS</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[11px]">{s.t("rp_days", "Valid for (days)")}</Label>
            <Input type="number" min={1} max={90} dir="ltr" value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) })} className="text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">{s.t("rp_max", "Max devices")}</Label>
            <Input type="number" min={1} max={20} dir="ltr" value={form.maxDevices} onChange={(e) => setForm({ ...form, maxDevices: Number(e.target.value) })} className="text-xs" />
          </div>
        </div>
        <div className="sm:col-span-2 lg:col-span-6">
          <Button type="submit" size="sm" disabled={busy} className="h-8 gap-1 text-xs"><Plus className="h-3.5 w-3.5" />{s.t("rp_create", "Create pass")}</Button>
        </div>
      </form>

      {error && <p role="alert" className="text-xs font-semibold text-destructive">{error}</p>}

      <ul className="space-y-2">
        {rows.length === 0 && <li className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">{s.t("rp_empty", "No review passes yet.")}</li>}
        {rows.map((p) => {
          const st = stateOf(p);
          const live = st.k === "st_active";
          return (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3 shadow-sm">
              <div className="min-w-0">
                <div className="text-sm font-bold">{p.label} <span className="font-normal text-muted-foreground">· {p.app === "b" ? "DGT.llc B" : "DGT.llc BS"}</span></div>
                <div className="text-xs text-muted-foreground" dir="ltr">{p.identifier}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {s.t("rp_used", "Devices used")}: <span dir="ltr">{p.used_devices}/{p.max_devices}</span> · {s.t("rp_expires", "Expires")}: <span dir="ltr">{when(p.expires_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-bold", st.cls)}>{s.t(st.k, st.en)}</span>
                {!p.revoked_at && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void revoke(p)} className={cn("h-8 gap-1 text-xs", live && "text-rose-700")}><Ban className="h-3.5 w-3.5" />{s.t("rp_revoke", "Revoke & block devices")}</Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {shown &&
        typeof document !== "undefined" &&
        createPortal(
          <div role="dialog" aria-modal="true" dir={s.dir} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm space-y-3 rounded-2xl bg-background p-5 text-center shadow-xl">
              <h2 className="flex items-center justify-center gap-2 text-base font-black"><KeyRound className="h-4 w-4" />{s.t("rp_code_title", "Review code")} — {shown.label}</h2>
              <div className="rounded-xl bg-muted py-4 font-mono text-2xl font-black tracking-[0.2em]" dir="ltr">{shown.code}</div>
              <p className="text-xs text-muted-foreground">{s.t("rp_code_body", "Copy this code into the store’s review notes now. It is shown only once and cannot be recovered.")}</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1 gap-1" onClick={() => { void navigator.clipboard?.writeText(shown.code); setCopied(true); }}><Copy className="h-3.5 w-3.5" />{copied ? s.t("copied", "Copied") : s.t("copy", "Copy")}</Button>
                <Button type="button" className="flex-1" onClick={() => setShown(null)}>{s.t("close", "Close")}</Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}
