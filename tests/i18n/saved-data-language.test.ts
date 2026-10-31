import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/i18n/ui";
import { isApprovedStoredTranslation, isLegalName, trustedStoredTranslation, trustedTranslationMap } from "@/lib/i18n/localize-records";
import { lookupVocabulary, translateValue, vocabularyFor } from "@/lib/i18n/table-values";
import { suggestLatinName } from "@/lib/i18n/transliteration";
import { translateOptionLabel } from "@/lib/i18n/option-labels";
import { isOtherScriptValue, savedValueLanguage } from "@/components/i18n/saved-text";

/**
 * Issue #36 — saved data in the viewer's language. Rows are shaped like record_translations; the values are the ones found on
 * Production (2026-10-27): Urdu account names with consonant-skeleton "English", half-translated category text, truck owners.
 */

const machine = (original: string, en: string, extra: Record<string, string> = {}) => ({
  original_text: original, english_text: en, urdu_text: extra.ur ?? original, arabic_text: extra.ar ?? original,
  persian_text: extra.fa ?? original, pashto_text: extra.ps ?? original,
  translation_status: "complete", translated_by_engine: "local_dictionary", source: "auto", corrected_by: null
});
const manual = (original: string, en: string) => ({
  original_text: original, english_text: en, urdu_text: original, arabic_text: original, persian_text: original, pashto_text: original,
  translation_status: "complete", translated_by_engine: "manual", source: "manual", corrected_by: "00000000-0000-4000-8000-000000000001"
});

describe("stored translations: only approved versions are shown", () => {
  it("an Urdu account name never shows its machine re-spelling in English", () => {
    const row = machine("نعمت اللہ بروکر", "Namt Allah Brwkr");
    expect(trustedStoredTranslation("ledgers", "name", "نعمت اللہ بروکر", row, "en")).toBeNull();
    expect(trustedStoredTranslation("enterprise_accounts", "name", "نعمت اللہ بروکر", row, "en")).toBeNull();
  });

  it("an approved English name is shown in English and nowhere replaces the saved name in other languages", () => {
    const row = manual("نعمت اللہ بروکر", "Naimatullah Broker");
    expect(isApprovedStoredTranslation(row)).toBe(true);
    expect(trustedStoredTranslation("ledgers", "name", "نعمت اللہ بروکر", row, "en")).toBe("Naimatullah Broker");
    expect(trustedStoredTranslation("ledgers", "name", "نعمت اللہ بروکر", row, "ar")).toBeNull();
  });

  it("free text typed in Urdu: a machine rendering is not shown, even when it is 'complete'", () => {
    const row = machine("گودام کیٹگری", "Warehouse کیٹگری", { ar: "مستودع کیٹگری" });
    expect(trustedStoredTranslation("account_categories", "description", "گودام کیٹگری", row, "en")).toBeNull();
    expect(trustedStoredTranslation("account_categories", "description", "گودام کیٹگری", row, "ar")).toBeNull();
  });

  it("free text typed in English keeps a clean dictionary rendering, but never a half-English one or a needs_review guess", () => {
    const clean = { ...machine("Warehouse", "Warehouse"), urdu_text: "گودام", arabic_text: "مستودع" };
    expect(trustedStoredTranslation("account_categories", "name", "Warehouse", clean, "ur")).toBe("گودام");
    const mixed = { ...machine("Warehouse Category", "Warehouse Category"), urdu_text: "گودام Category" };
    expect(trustedStoredTranslation("account_categories", "name", "Warehouse Category", mixed, "ur")).toBeNull();
    const review = { ...clean, translation_status: "needs_review", translated_by_engine: "auto_unverified" };
    expect(trustedStoredTranslation("account_categories", "name", "Warehouse", review, "ur")).toBeNull();
  });

  it("a machine row stamped 'verified' by an automatic save is still not an approval", () => {
    const stamped = { ...machine("نعمت اللہ بروکر", "Namt Allah Brwkr"), translation_status: "verified", translated_by_engine: "local_dictionary" };
    expect(isApprovedStoredTranslation(stamped)).toBe(false);
    expect(trustedStoredTranslation("ledgers", "name", stamped.original_text, stamped, "en")).toBeNull();
    // curated rows (human / verified engine) stay approved
    expect(isApprovedStoredTranslation({ ...stamped, translated_by_engine: "verified" })).toBe(true);
  });

  it("the DB enrolment copy (imported + pending) is not a translation; an admin import (imported + complete) is", () => {
    const enrol = { ...machine("مغٹ استاز", "مغٹ استاز"), source: "imported", translation_status: "pending", translated_by_engine: "trigger_enroll" };
    expect(isApprovedStoredTranslation(enrol)).toBe(false);
    expect(isApprovedStoredTranslation({ ...enrol, translation_status: "complete" })).toBe(true);
  });

  it("an API translation map keeps approved languages only", () => {
    const row = manual("تین بوری بادام وصول", "Three bags of almonds received");
    expect(trustedTranslationMap("roznamcha_entries", "narration", row.original_text, row)).toEqual({ en: "Three bags of almonds received" });
    expect(trustedTranslationMap("roznamcha_entries", "narration", "سیرم", machine("سیرم", "Syrm"))).toEqual({});
  });
});

describe("person names in every module follow the saved-name rule", () => {
  it.each([
    ["trucks", "owner_name"], ["trucks", "driver_name"], ["clearing_customer_orders", "truck_driver_name"],
    ["clearing_customer_order_parties", "party_customer_name"], ["roznamcha_entries", "payment.receiver_sender_name"],
    ["shipping_lines", "contact_person"], ["customers", "customer_name"], ["employees", "full_name"], ["ledgers", "name"]
  ])("%s.%s is a name", (table, field) => expect(isLegalName(table, field)).toBe(true));

  it.each([
    ["customers", "address"], ["customers", "notes"], ["account_categories", "description"], ["roznamcha_entries", "narration"],
    ["clearing_customer_order_legs", "from_location_text"], ["cities", "name"]
  ])("%s.%s is not a person name", (table, field) => expect(isLegalName(table, field)).toBe(false));

  it("a truck owner's machine rendering is not shown", () => {
    const row = { ...machine("نصراللہ استاد", "NsrAllah Astad"), translation_status: "needs_review", translated_by_engine: "auto_unverified" };
    expect(trustedStoredTranslation("trucks", "owner_name", row.original_text, row, "en")).toBeNull();
  });
});

describe("a term saved in Urdu / Pashto reads in the viewer's language (approved dictionaries)", () => {
  // the vocabulary index is built once from the five dictionaries (about a second; longer on a busy machine)
  beforeAll(() => { lookupVocabulary("گودام"); }, 120000);

  it("contact types saved as Urdu labels", () => {
    expect(translateValue("en", "موبائل فون")).toBe("Mobile Phone");
    expect(translateValue("en", "واٹس ایپ نمبر")).toBe("WhatsApp Number");
    expect(translateValue("ar", "موبائل فون")).not.toBe("موبائل فون");
  });

  it("category words saved in Urdu", () => {
    expect(vocabularyFor("en", "گودام")).toBe("Warehouse");
    expect(vocabularyFor("en", "ملازم")).toBe("Employee");
    expect(vocabularyFor("en", "ٹرانسپورٹ")).toBe("Transport");
  });

  it("a Pashto term reads in English", () => {
    expect(vocabularyFor("en", "ډرایور")).toBe("Driver");
  });

  it("names, initials and unknown phrases stay exactly as saved", () => {
    expect(translateValue("en", "نعمت اللہ")).toBe("نعمت اللہ");
    expect(translateValue("en", "پ ش")).toBe("پ ش");
    expect(translateValue("en", "از")).toBe("از");
    expect(translateValue("en", "گودام کیٹگری")).toBe("گودام کیٹگری");
    expect(translateValue("en", "مال روڈ چمن")).toBe("مال روڈ چمن");
  });

  it("the viewer's own language is unchanged", () => {
    expect(translateValue("ur", "گودام")).toBe("گودام");
  });

  it("customer contact types: the stored value and an old Urdu label both read in the viewer's language", () => {
    expect(translateOptionLabel("en", "Mobile")).toBe("Mobile");
    expect(translateOptionLabel("ur", "Mobile")).not.toBe("Mobile");
    expect(translateOptionLabel("en", "موبائل فون")).toBe("Mobile Phone");
    expect(translateOptionLabel("en", "Custom label")).toBe("Custom label");
  });
});

describe("the 'not in your language' marker", () => {
  it("marks only a script the viewer cannot read; digits never decide", () => {
    expect(isOtherScriptValue("نعمت اللہ", "en")).toBe(true);
    expect(isOtherScriptValue("Naimatullah", "en")).toBe(false);
    expect(isOtherScriptValue("Bilal Traders ۱۲", "en")).toBe(false);
    expect(isOtherScriptValue("Bilal Traders", "ur")).toBe(true);
    expect(isOtherScriptValue("نعمت اللہ", "ps")).toBe(false);
    expect(isOtherScriptValue("PK-QTA-AC-0001", "ur")).toBe(false);
    expect(savedValueLanguage("ګل محمد")).toBe("ps");
  });
});

describe("review-queue name suggestions (never shown as the name)", () => {
  it.each([
    ["نعمت اللہ عبدالباقی زیرہ والا", "Naimatullah Abdul Baqi Zeera Wala"],
    ["کلیم اللہ عصمت اللہ", "Kaleemullah Asmatullah"],
    ["حاجی امان الدین زیرہ والا", "Haji Amanuddin Zeera Wala"],
    ["بسم اللہ واھگہ والا", "Bismillah Wahga Wala"],
    ["فدامحمد کندھار کمیشن کار", "Fida Muhammad Kandahar Commission Kar"],
    ["نصیب آللہ", "Naseebullah"]
  ])("%s → %s", (saved, expected) => expect(suggestLatinName(saved)).toBe(expected));
});
