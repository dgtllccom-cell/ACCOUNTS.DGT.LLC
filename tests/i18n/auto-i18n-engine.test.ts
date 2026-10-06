import { describe, expect, it } from "vitest";
import { generateFiveLanguages } from "@/lib/i18n/auto-i18n";

/**
 * ERP Auto-i18n engine — the "five languages by default" safety net.
 * Offline (no AI_TRANSLATE_* / no network) it must:
 *   • render curated ERP vocabulary,
 *   • keep every protected token (placeholders / codes / numbers / currency) verbatim,
 *   • NEVER fabricate — a string it cannot render cleanly stays English + unresolved.
 *
 * `translateErp` touches the DB-backed translation memory, so allow generous time.
 */

const RTL = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
const OFFLINE = { learn: false as const };
const T = 60_000;

describe("auto-i18n engine (offline / deterministic)", () => {
  it("translates a curated ERP term into all four target languages", async () => {
    const r = await generateFiveLanguages("Purchase", OFFLINE);
    for (const l of ["ur", "ar", "fa", "ps"] as const) {
      expect(r[l], `${l} should not be English`).not.toBe("Purchase");
      expect(RTL.test(r[l]), `${l} should be Perso-Arabic script`).toBe(true);
      expect(r.provenance[l]?.engine).toBeDefined();
    }
    expect(r.unresolved).toHaveLength(0);
  }, T);

  it("keeps an interpolation placeholder verbatim", async () => {
    const r = await generateFiveLanguages("Total for {branch}", OFFLINE);
    for (const l of ["ur", "ar", "fa", "ps"] as const) {
      expect(r[l]).toContain("{branch}");
    }
  }, T);

  it("never fabricates — an untranslatable sentence stays English and is reported", async () => {
    const r = await generateFiveLanguages(
      "Reconcile the quarterly variance workbook before Friday",
      OFFLINE,
    );
    for (const l of r.unresolved) expect(r[l]).toBe(r.en);
    expect(r.unresolved.length).toBeGreaterThan(0);
  }, T);

  it("returns masked codes / amounts / placeholders unchanged in every language", async () => {
    for (const v of ["USD 1,000", "TB-000123", "{count}", "#", "2026-09-09"]) {
      const r = await generateFiveLanguages(v, OFFLINE);
      for (const l of ["ur", "ar", "fa", "ps"] as const) expect(r[l]).toBe(v);
    }
  }, T);

  it("does not leave a half-translated Latin word in an RTL result", async () => {
    const r = await generateFiveLanguages("Bank Account", OFFLINE);
    for (const l of ["ur", "ar", "fa", "ps"] as const) {
      if (!r.unresolved.includes(l)) {
        expect(/[A-Za-z]{2,}/.test(r[l]), `${l}="${r[l]}" has leftover English`).toBe(false);
      }
    }
  }, T);
});
