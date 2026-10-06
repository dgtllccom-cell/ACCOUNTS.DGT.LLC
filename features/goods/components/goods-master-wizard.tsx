"use client";

import React, { useState } from "react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { VoiceFormFill } from "@/components/voice-form-fill";

export function GoodsMasterWizard({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved?: (goodsId: string) => void;
}) {
  const lang = useActiveLanguage();
  const tr = (key: Parameters<typeof t>[1], fallback: string) => t(lang, key, fallback);
  const [form, setForm] = useState({ goodsName: "", chsCode: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!form.goodsName.trim() || !form.chsCode.trim()) {
      setError(tr("goods_wizard.required_error", "Goods Name and HS Code are required."));
      return;
    }
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/erp/goods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goodsName: form.goodsName.trim().toUpperCase(),
          chsCode: form.chsCode.trim(),
          originalLanguage: "en",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload?.error?.message || payload?.error || "Failed to create good.");
      }

      onSaved?.(payload.data?.goodsId || payload.goodsId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save Goods Master.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-foreground">{tr("goods_wizard.title", "Add Goods Master")}</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">{tr("goods_wizard.subtitle", "Creates a new master item")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-[11px] rounded px-3 py-2">
              {error}
            </div>
          )}
          <VoiceFormFill
            context="goods"
            lang={lang}
            compact
            onApply={(f) => setForm((p) => ({
              ...p,
              goodsName: f.goodsName ? String(f.goodsName).toUpperCase() : p.goodsName,
              chsCode: f.chsCode ? String(f.chsCode) : p.chsCode,
            }))}
          />
          <div className="grid gap-3">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">{tr("goods_wizard.goods_name", "Goods Name")} *</label>
              <input
                type="text"
                value={form.goodsName}
                onChange={(e) => setForm((p) => ({ ...p, goodsName: e.target.value.toUpperCase() }))}
                placeholder={tr("goods_wizard.goods_name_placeholder", "e.g. WALNUT")}
                className="w-full bg-background border border-input rounded px-3 py-2 text-foreground text-sm outline-none focus:border-primary uppercase font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">{tr("goods_wizard.hs_code", "HS Code")} *</label>
              <input
                type="text"
                value={form.chsCode}
                onChange={(e) => setForm((p) => ({ ...p, chsCode: e.target.value }))}
                placeholder={tr("goods_wizard.hs_code_placeholder", "0802.32")}
                className="w-full bg-background border border-input rounded px-3 py-2 text-foreground text-sm outline-none focus:border-primary font-mono"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 pb-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded border border-input text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {tr("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 text-xs rounded bg-blue-600 text-white font-bold shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {loading ? tr("goods_wizard.saving", "Saving...") : tr("goods_wizard.save", "Save Goods Master")}
          </button>
        </div>
      </div>
    </div>
  );
}
