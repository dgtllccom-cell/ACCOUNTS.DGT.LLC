"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Smartphone, Clock, KeyRound, Ban, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";

type Summary = { status: "none" | "pending" | "approved" | "active" | "rejected" | "revoked"; app?: "b" | "bs"; name?: string; attemptsLeft?: number };

/** First screen of the DGT.llc B / BS store apps: request activation, wait for the Super Admin, type the one-time code, then sign in. */
export function DeviceActivation() {
  const s = useErpScreen("mdev");
  const [state, setState] = useState<Summary>({ status: "none" });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", identifier: "", note: "" });
  const [code, setCode] = useState("");

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/erp/auth/device/status", { cache: "no-store" });
      const j = await r.json();
      if (j?.ok) setState(j.data);
    } catch {
      /* offline: keep the last state */
    }
    setLoaded(true);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (state.status !== "pending" && state.status !== "approved") return;
    const h = setInterval(() => void refresh(), 6000);
    return () => clearInterval(h);
  }, [state.status, refresh]);

  const post = async (url: string, body: unknown) => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        setError(j?.error?.message || s.t("err_generic", "Something went wrong. Please try again."));
        await refresh();
        return false;
      }
      setState(j.data);
      return true;
    } catch {
      setError(s.t("err_generic", "Something went wrong. Please try again."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const platform = /android/i.test(ua) ? "android" : /iphone|ipad|ipod/i.test(ua) ? "ios" : "";
  const model = (ua.match(/;\s*([^;)]*?)\s+Build\//)?.[1] ?? "").slice(0, 60);

  const Card = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/15 bg-white/10 p-6 shadow-xl">
      <div className="flex items-center gap-3">
        {icon}
        <h1 className="text-lg font-black">{title}</h1>
      </div>
      {children}
    </div>
  );

  const needsForm = state.status === "none" || state.status === "rejected" || state.status === "revoked";

  return (
    <main dir={s.dir} className="flex min-h-screen items-center justify-center bg-[#0a1f45] px-5 py-10 text-white">
      {!loaded ? null : needsForm ? (
        <Card
          icon={state.status === "none" ? <Smartphone className="h-6 w-6 text-teal-300" /> : <Ban className="h-6 w-6 text-amber-300" />}
          title={state.status === "none" ? s.t("title", "Activate this device") : state.status === "rejected" ? s.t("rejected_title", "Request declined") : s.t("revoked_title", "Device blocked")}
        >
          <p className="text-sm text-white/85">
            {state.status === "none"
              ? s.t("subtitle", "This phone must be approved by the administrator before it can open the ERP.")
              : state.status === "rejected"
                ? s.t("rejected_body", "The administrator did not approve this device. Contact them if this is a mistake.")
                : s.t("revoked_body", "This device is no longer allowed to open the ERP. Contact the administrator.")}
          </p>
          <form
            className="space-y-3 text-slate-900"
            onSubmit={(e) => {
              e.preventDefault();
              void post("/api/erp/auth/device/request", { ...form, platform, model });
            }}
          >
            <div className="space-y-1">
              <Label className="text-white/90">{s.t("name", "Full name")}</Label>
              <Input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-white/90">{s.t("phone", "Mobile number")}</Label>
              <Input type="tel" inputMode="tel" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-white/90">{s.t("identifier", "ERP e-mail or user code")}</Label>
              <Input required dir="ltr" autoCapitalize="none" autoCorrect="off" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} className="bg-white" />
              <p className="text-[11px] text-white/60">{s.t("identifier_hint", "The account you will sign in with.")}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-white/90">{s.t("note", "Note for the administrator (optional)")}</Label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="bg-white" />
            </div>
            {error && <p role="alert" className="text-xs font-semibold text-amber-300">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? s.t("submitting", "Sending…") : state.status === "none" ? s.t("submit", "Request activation") : s.t("request_again", "Request again")}
            </Button>
          </form>
        </Card>
      ) : state.status === "pending" ? (
        <Card icon={<Clock className="h-6 w-6 text-amber-300" />} title={s.t("pending_title", "Waiting for approval")}>
          <p className="text-sm text-white/85">{s.t("pending_body", "Your request was sent. The Super Admin will approve it and give you a 6-digit activation code.")}</p>
          <Button type="button" variant="secondary" onClick={() => void refresh()} className="w-full">{s.t("check_now", "Check status")}</Button>
        </Card>
      ) : state.status === "approved" ? (
        <Card icon={<KeyRound className="h-6 w-6 text-teal-300" />} title={s.t("approved_title", "Enter the activation code")}>
          <p className="text-sm text-white/85">{s.t("approved_body", "Your device was approved. Type the 6-digit code you received from the administrator.")}</p>
          <form
            className="space-y-3 text-slate-900"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await post("/api/erp/auth/device/activate", { code })) setCode("");
            }}
          >
            <Label className="text-white/90">{s.t("code_label", "Activation code")}</Label>
            <Input required dir="ltr" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="bg-white text-center text-2xl tracking-[0.4em]" />
            {typeof state.attemptsLeft === "number" && <p className="text-[11px] text-white/60">{state.attemptsLeft} {s.t("attempts_left", "attempts left")}</p>}
            {error && <p role="alert" className="text-xs font-semibold text-amber-300">{error}</p>}
            <Button type="submit" disabled={busy || code.length !== 6} className="w-full">{busy ? s.t("activating", "Checking…") : s.t("activate", "Activate")}</Button>
          </form>
        </Card>
      ) : (
        <Card icon={<CheckCircle2 className="h-6 w-6 text-emerald-300" />} title={s.t("active_title", "Device activated")}>
          <p className="text-sm text-white/85">{s.t("active_body", "Now sign in with your normal ERP account.")}</p>
          <Button type="button" onClick={() => { window.location.href = "/auth/login"; }} className="w-full">
            <ShieldCheck className="me-2 h-4 w-4" />
            {s.t("continue_login", "Continue to sign in")}
          </Button>
        </Card>
      )}
    </main>
  );
}
