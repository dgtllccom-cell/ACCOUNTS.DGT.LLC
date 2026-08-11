import { describe, expect, it } from "vitest";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { hasHeaderTranslation, translateHeader } from "@/lib/i18n/table-headers";
import { resolveActiveText } from "@/lib/i18n/multilingual-translator";
import { t, type UiKey } from "@/lib/i18n/ui";

const nonEnglishLanguages: SupportedLanguage[] = ["ur", "ar", "fa", "ps"];

const reportDescriptionKeys: UiKey[] = [
  "report.desc_cash_entry",
  "report.desc_receipts",
  "report.desc_payments",
  "report.desc_customer_accounts",
  "report.desc_customer_companies",
  "report.desc_exchange_rates",
  "report.desc_branch_transactions",
  "report.desc_user_activity",
  "report.desc_audit_logs",
  "report.desc_approval_workflows",
  "report.desc_expenses",
  "report.desc_financial_summaries",
  "report.desc_purchase_booking_register",
  "report.desc_daily_comprehensive",
];

describe("report localization coverage", () => {
  it("provides localized descriptions for every Reports Hub report", () => {
    for (const key of reportDescriptionKeys) {
      const english = t("en", key, key);
      for (const lang of nonEnglishLanguages) {
        expect(t(lang, key, key)).not.toBe(english);
      }
    }
  });

  it("covers the shared Purchase Booking and Reports Hub labels", () => {
    const labels = [
      "Purchase Transfer Payment",
      "Booking Purchase Orders",
      "Purchase Status",
      "Payment Stages",
      "Shipment Status",
      "Report Actions",
      "Rows per page",
      "Status Legend",
      "Posted",
      "Bill Items Breakdown",
      "No purchase order records match the selected filters.",
    ];

    for (const label of labels) {
      expect(hasHeaderTranslation(label)).toBe(true);
      expect(translateHeader("ur", label)).not.toBe(label);
    }
  });

  it("uses stored record translations and safely falls back to English", () => {
    const values = { en: "English value", ur: "اردو قدر" };
    expect(resolveActiveText(values, "ur", "Fallback")).toBe("اردو قدر");
    expect(resolveActiveText(values, "fa", "Fallback")).toBe("English value");
    expect(values).toEqual({ en: "English value", ur: "اردو قدر" });
  });
});
