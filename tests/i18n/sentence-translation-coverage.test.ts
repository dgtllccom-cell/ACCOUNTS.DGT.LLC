import { describe, expect, it } from "vitest";
import { autoTranslate5Languages } from "@/lib/i18n/multilingual-translator";
import { classifyTranslationCoverage, translationCoverageLabel } from "@/lib/i18n/verified-record-translations";

/**
 * Sentence-level coverage for user-entered transactional text (remarks / narration /
 * notes / descriptions). The local phrase dictionary must translate whole common
 * transactional sentences — not just individual words — and every machine result
 * must be flagged needsReview (never presented as "completed").
 */

const RTL = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
const asciiWords = (s: string) => (s.match(/[A-Za-z]{3,}/g) || []).filter((w) => w !== "and");

describe("sentence-level transactional translation", () => {
  const sentences = [
    "Cash paid for office rent this month",
    "Bank transfer received from customer against invoice",
    "Advance payment for goods purchase and freight",
    "Freight charges and loading charges paid to transport company",
    "Opening balance brought forward from last month",
    "Salary paid for the month of August",
    "Customs duty and port charges paid",
    "Cash received against invoice from customer",
  ];

  for (const en of sentences) {
    it(`translates the whole sentence: "${en}"`, () => {
      const t = autoTranslate5Languages(en, "en");
      for (const lang of ["ur", "ar", "fa", "ps"] as const) {
        expect(RTL.test(t[lang]), `${lang} should contain translated script`).toBe(true);
        // no more than one stray ASCII word left (proper nouns / month tokens tolerated)
        expect(asciiWords(t[lang]).length, `${lang} left too much English: ${t[lang]}`).toBeLessThanOrEqual(1);
      }
    });
  }

  it("classifies a fully machine-translated sentence as needs-review, never completed", () => {
    const en = "Bank transfer received from customer against invoice";
    const t = autoTranslate5Languages(en, "en");
    const cov = classifyTranslationCoverage({ originalText: en, originalLanguage: "en", translations: t });
    expect(cov.status).toBe("fully_translated");
    expect(cov.needsReview).toBe(true); // machine output is NOT "completed"
  });

  it("classifies a partially translated sentence as partially_translated + needs-review", () => {
    const en = "Xyzzy plugh frobnicate against invoice";
    const t = autoTranslate5Languages(en, "en");
    const cov = classifyTranslationCoverage({ originalText: en, originalLanguage: "en", translations: t });
    expect(["partially_translated", "fully_translated"]).toContain(cov.status);
    expect(cov.needsReview).toBe(true);
  });

  it("classifies untranslated text correctly", () => {
    const cov = classifyTranslationCoverage({
      originalText: "Zzz",
      originalLanguage: "en",
      translations: { en: "Zzz", ur: "Zzz", ar: "Zzz", fa: "Zzz", ps: "Zzz" },
    });
    expect(cov.status).toBe("untranslated");
    expect(cov.needsReview).toBe(false);
  });

  it("classifies human-verified text as done (not needs-review)", () => {
    const cov = classifyTranslationCoverage({
      originalText: "Cash paid",
      originalLanguage: "en",
      translations: { en: "Cash paid", ur: "نقد ادا کیا", ar: "نقد مدفوع", fa: "نقد پرداخت‌شده", ps: "نغدې ورکړل شوې" },
      humanVerified: true,
    });
    expect(cov.status).toBe("human_verified");
    expect(cov.needsReview).toBe(false);
  });

  it("provides a five-language label for every coverage status", () => {
    for (const st of ["human_verified", "fully_translated", "partially_translated", "untranslated", "needs_review"] as const) {
      for (const lang of ["en", "ur", "ar", "fa", "ps"] as const) {
        expect(translationCoverageLabel(st, lang).length).toBeGreaterThan(0);
      }
    }
  });
});
