"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";

/** Shown when a login is opened in the wrong DGT.llc store app (Business vs Business Shipping). */
export function AppAccessNotice({ app }: { app: "b" | "bs" }) {
  const s = useErpScreen("appch");
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    setBusy(true);
    try { await fetch("/api/erp/auth/logout", { method: "POST" }); } catch { /* the login page below shows regardless */ }
    window.location.href = "/auth/login";
  };
  return (
    <main dir={s.dir} className="flex min-h-screen items-center justify-center bg-[#0a1f45] px-5 py-10 text-white">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-white/15 bg-white/10 p-6 text-center shadow-xl">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-300" aria-hidden />
        <h1 className="text-lg font-black">{s.t("title", "This login belongs to the other DGT.llc app")}</h1>
        <p className="text-sm leading-relaxed text-white/85">
          {app === "b"
            ? s.t("body_b", "You opened DGT.llc B (Business). This account is for shipping and clearing work — please use the DGT.llc BS app.")
            : s.t("body_bs", "You opened DGT.llc BS (Business Shipping). This account is for business modules — please use the DGT.llc B app.")}
        </p>
        <p className="text-xs text-white/65">{s.t("contact", "If you think this is a mistake, contact your administrator.")}</p>
        <Button type="button" onClick={signOut} disabled={busy} className="w-full">{s.t("sign_out", "Sign out")}</Button>
      </div>
    </main>
  );
}
