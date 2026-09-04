import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit test for the write-status / write-engine decision inside
 * `saveVerifiedEnterpriseRecordTranslations` (lib/services/enterprise-multilingual-service.ts):
 *
 *   - a value that resolves cleanly (dictionary / manual)  → status "complete"
 *   - a value that only the unverified word-substitution guess could fill
 *     → status "needs_review", engine "auto_unverified"
 *
 * The translation tiers themselves (verified-record-translations, erp-translator,
 * multilingual-translator) are mocked so this test stays deterministic and only
 * exercises the flagging logic — the tiers have their own tests, and the
 * Local/AI translator legitimately issues extra `erp_translation_memory` DB
 * calls that must not couple to this assertion.
 */

const upsertCalls: any[][] = [];

function templateText(strings: TemplateStringsArray): string {
  return strings.join(" ? ");
}

vi.mock("@/lib/db/local-postgres", () => ({
  withLocalPg: vi.fn(async (fn: (sql: any) => Promise<unknown>) => {
    const sql: any = (strings: TemplateStringsArray, ...values: any[]) => {
      if (templateText(strings).includes("upsert_record_translation")) upsertCalls.push(values);
      return Promise.resolve([]);
    };
    sql.json = (value: unknown) => value;
    await fn(sql);
    return true;
  }),
}));

vi.mock("@/lib/i18n/localize-records", () => ({
  lookupApprovedDictionary: vi.fn(async () => null),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

const LANGS = ["en", "ur", "ar", "fa", "ps"] as const;

/** A phrase the curated Business Dictionary is treated as fully covering. */
const DICTIONARY_PHRASE = "Walnut Kernel";

vi.mock("@/lib/i18n/verified-record-translations", () => ({
  buildVerifiedTranslationSet: vi.fn(
    async (input: { value: string; originalLanguage: string; supplied?: Record<string, string> }) => {
      const value = String(input.value).trim();
      // Human-supplied manual translation → verified, engine "manual".
      if (input.supplied && Object.keys(input.supplied).length) {
        return {
          translations: { [input.originalLanguage]: value, ...input.supplied },
          missingLanguages: [],
          status: "complete",
          engine: "manual",
        };
      }
      // Curated dictionary phrase → all five languages resolved.
      if (value === DICTIONARY_PHRASE) {
        return {
          translations: { en: value, ur: "اخروٹ کی گری", ar: "لب الجوز", fa: "مغز گردو", ps: "د اخروټ زړی" },
          missingLanguages: [],
          status: "complete",
          engine: "local_dictionary",
        };
      }
      // Anything else → nothing resolved beyond the original language.
      return {
        translations: { [input.originalLanguage]: value },
        missingLanguages: LANGS.filter((l) => l !== input.originalLanguage),
        status: "pending",
        engine: "pending",
      };
    },
  ),
}));

// Local + AI translator tier returns "identity" (no machine resolution), so an
// unresolved field stays unresolved and falls through to the guess.
vi.mock("@/lib/i18n/erp-translator", () => ({
  translateErp: vi.fn(async (text: string, _src: string, opts: { targetLang: string }) => ({
    text,
    lang: opts.targetLang,
    engine: "identity",
    confidence: 0.1,
  })),
}));

// The last-resort guess returns Latin text for non-English targets, which the
// service rejects as "mixed" and replaces with the verbatim original — the exact
// path that must be flagged needs_review.
vi.mock("@/lib/i18n/multilingual-translator", () => ({
  detectScriptType: vi.fn(() => "latin"),
  autoTranslate5Languages: vi.fn((input: string) => ({
    en: input,
    ur: input,
    ar: input,
    fa: input,
    ps: input,
  })),
}));

import { saveVerifiedEnterpriseRecordTranslations } from "@/lib/services/enterprise-multilingual-service";

// Positional args of the upsert_record_translation() SQL template
// (see upsertRecordTranslationRpc): 0 recordTable · 1 recordId · 2 fieldName ·
// 3 originalText · 4 originalLanguageCode · 5-9 en/ur/ar/fa/ps · 10 languageTexts ·
// 11 source · 12 status · 13 engine · 14 actorId
const ARG = { field: 2, source: 11, status: 12, engine: 13 };

function upsertFor(fieldName: string): any[] {
  const call = upsertCalls.find((v) => v[ARG.field] === fieldName);
  if (!call) throw new Error(`no upsert_record_translation call for "${fieldName}" (${upsertCalls.length} upsert call(s) seen)`);
  return call;
}

describe("saveVerifiedEnterpriseRecordTranslations — needs_review flagging", () => {
  beforeEach(() => {
    upsertCalls.length = 0;
  });

  it("marks a field needs_review when no genuine dictionary hit exists and it falls to the unverified auto-translate guess", async () => {
    await saveVerifiedEnterpriseRecordTranslations({
      recordTable: "roznamcha_entries",
      recordId: "11111111-1111-1111-1111-111111111111",
      originalLanguage: "en",
      fields: [{ fieldName: "narration", value: "ZXQ custom free text", mode: "translate" }],
    });

    expect(upsertCalls.filter((v) => v[ARG.field] === "narration")).toHaveLength(1);
    const call = upsertFor("narration");
    expect(call[ARG.status]).toBe("needs_review");
    expect(call[ARG.engine]).toBe("auto_unverified");
  });

  it("keeps status complete when the value resolves from the local dictionary", async () => {
    await saveVerifiedEnterpriseRecordTranslations({
      recordTable: "roznamcha_entries",
      recordId: "22222222-2222-2222-2222-222222222222",
      originalLanguage: "en",
      fields: [{ fieldName: "narration", value: DICTIONARY_PHRASE, mode: "translate" }],
    });

    expect(upsertCalls.filter((v) => v[ARG.field] === "narration")).toHaveLength(1);
    const call = upsertFor("narration");
    expect(call[ARG.status]).toBe("complete");
    expect(call[ARG.engine]).toBe("local_dictionary");
  });

  it("keeps status complete for a fully human-supplied manual translation", async () => {
    await saveVerifiedEnterpriseRecordTranslations({
      recordTable: "roznamcha_entries",
      recordId: "33333333-3333-3333-3333-333333333333",
      originalLanguage: "en",
      fields: [{
        fieldName: "narration",
        value: "Handed over to the branch cashier",
        mode: "translate",
        translations: {
          ur: "برانچ کیشیئر کے حوالے کیا گیا",
          ar: "تم تسليمه لأمين الصندوق بالفرع",
          fa: "به صندوقدار شعبه تحویل داده شد",
          ps: "د څانګې پیسو ساتونکي ته وسپارل شو",
        },
      }],
      actorId: "44444444-4444-4444-4444-444444444444",
    });

    expect(upsertCalls.filter((v) => v[ARG.field] === "narration")).toHaveLength(1);
    const call = upsertFor("narration");
    expect(call[ARG.status]).toBe("complete");
    expect(call[ARG.engine]).toBe("manual");
  });
});
