import { describe, expect, it } from "vitest";
import { autoLocalizeName, autoNameSource, localizeName } from "@/lib/i18n/transliteration";

// Owner decision 28-Nov (replaces Issue #36 "saved name only"): names follow the viewer's language. The saved name in the
// database never changes; a curated variant wins, otherwise the local dictionary / translator converts it, flagged `auto`.
describe("localizeName / autoLocalizeName — names follow the viewer's language", () => {
  it("an English name is shown in Urdu, Arabic, Persian and Pashto script, marked auto", () => {
    const r = autoLocalizeName("Manish kumar", "ur");
    expect(r).toEqual({ text: "منیش کمار", auto: true, saved: "Manish kumar" });
    expect(localizeName("Kamal Waqas", "ur")).toBe("کمال وقاص");
    expect(localizeName("Goods purchase Quetta office", "ur")).toBe("گڈز پرچیز کوئٹہ آفس");
    expect(localizeName("Purchase and sales Dubai office", "fa")).toBe("خرید و فروش دبی دفتر");
    expect(localizeName("NAJEEB ULLAH ABDULLAH", "ar")).toBe("نجيب الله عبد الله");
    for (const lang of ["ur", "ar", "fa", "ps"]) expect(autoLocalizeName("Haji abdullah chaman", lang).auto).toBe(true);
  });

  it("an Urdu name is shown in Latin for English viewers and with their own letters for Arabic / Persian / Pashto", () => {
    expect(localizeName("حاجی نجیب اللہ برنس خریداری اکاونٹ کوئٹہ", "en")).toBe("Haji Najibullah Business Purchase Account Quetta");
    expect(localizeName("نصراللہ استاد", "en")).toBe("Nasrullah Ustad");
    expect(localizeName("نصراللہ استاد", "ar")).toBe("نصرالله استاد");
    expect(localizeName("اکاونٹ کوئٹہ", "fa")).toBe("اکاونت کوئته");
    expect(localizeName("اکاونٹ کوئٹہ", "ps")).toBe("اکاونټ کوئټه");
  });

  it("the name already in the viewer's own script stays exactly as saved, not marked", () => {
    expect(autoLocalizeName("Manish kumar", "en")).toEqual({ text: "Manish kumar", auto: false, saved: "Manish kumar" });
    expect(autoLocalizeName("نصراللہ استاد", "ur").auto).toBe(false);
  });

  it("a curated whole-name entry is the approved variant (not marked auto)", () => {
    expect(autoLocalizeName("Asmatullah", "ur")).toEqual({ text: "عصمت اللہ", auto: false, saved: "Asmatullah" });
    expect(localizeName("asmatullah", "ar")).toBe("عصمت الله");
    expect(localizeName("Pakistan", "ps")).toBe("پاکستان");
    expect(localizeName("Asmatullah", "en")).toBe("Asmatullah");
  });

  it("codes and references inside a name are kept; all-caps words are still names", () => {
    expect(localizeName("DEMO Omar Nujaym AE-006", "ur")).toBe("ڈیمو عمر نوجایم AE-006");
    expect(localizeName("Al Ras General Trading LLC", "ur")).toContain("LLC");
    expect(localizeName("JOY GUO (CHIN)", "ur")).toBe("جوی گوو (چین)");
  });

  it("remembers which saved name an automatic conversion came from (for the 'auto' mark)", () => {
    const shown = localizeName("Adam Mama", "ur");
    expect(autoNameSource(shown, "ur")).toBe("Adam Mama");
    expect(autoNameSource("Adam Mama", "en")).toBeUndefined();
  });

  it("empty input stays empty", () => {
    expect(localizeName("", "ur")).toBe("");
    expect(localizeName(null, "ur")).toBe("");
    expect(localizeName(undefined, "fa")).toBe("");
  });
});
