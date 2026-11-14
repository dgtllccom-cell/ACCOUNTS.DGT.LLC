import { describe, expect, it } from "vitest";
import { getUiDictionaries, t } from "@/lib/i18n/ui";
import { ERP_PERMISSION_HIERARCHY } from "@/lib/permissions/rbac-matrix-builder";

const LANGS = ["en", "ur", "ar", "fa", "ps"] as const;
const dicts = getUiDictionaries();

/** every key the rights list, the report, the profile modal and the device allotment use: the static ones and the hierarchy ones */
function hierarchyKeys() {
  const modules = ERP_PERMISSION_HIERARCHY.map((m) => `udr.mod.${m.key}`);
  const sections = ERP_PERMISSION_HIERARCHY.flatMap((m) => m.sections.map((s) => `udr.sec.${s.key}`));
  const forms = ERP_PERMISSION_HIERARCHY.flatMap((m) => m.sections.flatMap((s) => s.forms.map((f) => `udr.form.${f.key}`)));
  return [...modules, ...sections, ...forms];
}

describe("user rights & device access: five-language coverage", () => {
  it("every udr.* key is present in all five language blocks, with a non-empty value", () => {
    const keys = Object.keys(dicts.en).filter((k) => k.startsWith("udr."));
    expect(keys.length).toBeGreaterThan(150);
    for (const key of keys) {
      for (const lang of LANGS) {
        expect(dicts[lang][key], `${lang} ${key}`).toBeTruthy();
      }
    }
  });

  it("every permission module, section and form name is translated into ur / ar / fa / ps (not English)", () => {
    for (const key of hierarchyKeys()) {
      const english = dicts.en[key];
      expect(english, key).toBeTruthy();
      for (const lang of ["ur", "ar", "fa", "ps"] as const) {
        const value = dicts[lang][key];
        expect(value, `${lang} ${key}`).toBeTruthy();
        expect(value, `${lang} ${key} must not stay English`).not.toBe(english);
      }
    }
  });

  it("the lookup returns the language's own text for a known key", () => {
    expect(t("ur", "udr.r.sec_rights", "x")).toBe(dicts.ur["udr.r.sec_rights"]);
    expect(t("ps", "udr.tier.country", "x")).toBe(dicts.ps["udr.tier.country"]);
    expect(t("fa", "udr.form.bank_accounts", "x")).toBe(dicts.fa["udr.form.bank_accounts"]);
  });

  it("the login refusal message exists in all five languages", () => {
    for (const lang of LANGS) {
      expect(t(lang, "udr.login_device_denied", "")).toBeTruthy();
    }
    expect(t("ar", "udr.login_device_denied", "")).not.toBe(dicts.en["udr.login_device_denied"]);
  });
});
