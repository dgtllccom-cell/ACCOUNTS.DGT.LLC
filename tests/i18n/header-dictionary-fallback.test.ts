import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n/ui";
import { translateHeader } from "@/lib/i18n/table-headers";

// translateHeader() (menu labels, table headings) falls back to the central dictionary for a label its own table does not know.
describe("translateHeader central dictionary fallback", () => {
  it("a menu label known only to the central dictionary is translated in every RTL language", () => {
    for (const lang of ["ur", "ar", "fa", "ps"] as const) {
      const out = translateHeader(lang, "Master Data");
      expect(out).not.toBe("Master Data");
      expect(out).toMatch(/[؀-ۿ]/);
    }
  });
  it("uses the same translation the central dictionary gives for that entry", () => {
    expect(translateHeader("ur", "All Branches")).toBe(t("ur", "common.all_branches", "All Branches"));
  });
  it("English and unknown text stay unchanged", () => {
    expect(translateHeader("en", "Master Data")).toBe("Master Data");
    expect(translateHeader("ur", "Hamid Sharif MVPN9K36")).toBe("Hamid Sharif MVPN9K36");
    expect(translateHeader("ur", "")).toBe("");
  });
});
