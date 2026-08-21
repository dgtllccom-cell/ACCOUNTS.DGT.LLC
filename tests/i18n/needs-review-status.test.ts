import { beforeEach, describe, expect, it, vi } from "vitest";

const capturedCalls: any[][] = [];

vi.mock("@/lib/db/local-postgres", () => ({
  withLocalPg: vi.fn(async (fn: (sql: any) => Promise<unknown>) => {
    const sql: any = (_strings: TemplateStringsArray, ...values: any[]) => {
      capturedCalls.push(values);
      return Promise.resolve([]);
    };
    sql.json = (value: unknown) => value;
    await fn(sql);
    return true;
  })
}));

vi.mock("@/lib/i18n/localize-records", () => ({
  lookupApprovedDictionary: vi.fn(async () => null)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn()
}));

import { saveVerifiedEnterpriseRecordTranslations } from "@/lib/services/enterprise-multilingual-service";

// Positional index of each argument inside the upsert_record_translation() SQL template
// (see upsertRecordTranslationRpc in lib/services/enterprise-multilingual-service.ts).
const ARG = { source: 11, status: 12, engine: 13 };

describe("saveVerifiedEnterpriseRecordTranslations — needs_review flagging", () => {
  beforeEach(() => {
    capturedCalls.length = 0;
  });

  it("marks a field needs_review when no genuine dictionary hit exists and it falls to the unverified auto-translate guess", async () => {
    await saveVerifiedEnterpriseRecordTranslations({
      recordTable: "roznamcha_entries",
      recordId: "11111111-1111-1111-1111-111111111111",
      originalLanguage: "en",
      fields: [{ fieldName: "narration", value: "ZXQ custom free text", mode: "translate" }]
    });

    expect(capturedCalls).toHaveLength(1);
    expect(capturedCalls[0][ARG.status]).toBe("needs_review");
    expect(capturedCalls[0][ARG.engine]).toBe("auto_unverified");
  });

  it("keeps status complete when the value resolves from the local dictionary", async () => {
    await saveVerifiedEnterpriseRecordTranslations({
      recordTable: "roznamcha_entries",
      recordId: "22222222-2222-2222-2222-222222222222",
      originalLanguage: "en",
      fields: [{ fieldName: "narration", value: "Walnut Kernel", mode: "translate" }]
    });

    expect(capturedCalls).toHaveLength(1);
    expect(capturedCalls[0][ARG.status]).toBe("complete");
    expect(capturedCalls[0][ARG.engine]).toBe("local_dictionary");
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
          ps: "د څانګې پیسو ساتونکي ته وسپارل شو"
        }
      }],
      actorId: "44444444-4444-4444-4444-444444444444"
    });

    expect(capturedCalls).toHaveLength(1);
    expect(capturedCalls[0][ARG.status]).toBe("complete");
    expect(capturedCalls[0][ARG.engine]).toBe("manual");
  });
});
