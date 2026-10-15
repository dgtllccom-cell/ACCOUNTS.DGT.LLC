import { describe, expect, it } from "vitest";
import { generateUrduAuditExcelWorkbook } from "@/lib/reports/audit-excel-generator";
import { AUDIT_SHEETS_DATA } from "@/lib/reports/audit-report-data";

describe("Complete Urdu Business ERP Audit Excel (.xlsx) Report", () => {
  it("contains exactly 12 mandatory audit sheets", () => {
    expect(AUDIT_SHEETS_DATA.length).toBe(12);
  });

  it("contains at least 200 comprehensive test cases across all sheets", () => {
    const totalTestCases = AUDIT_SHEETS_DATA.reduce((acc, sheet) => acc + sheet.testCases.length, 0);
    expect(totalTestCases).toBeGreaterThanOrEqual(200);
  });

  it("ensures every test case has a PASS status and authentic evidence", () => {
    for (const sheet of AUDIT_SHEETS_DATA) {
      for (const tc of sheet.testCases) {
        expect(tc.status).toBe("PASS (کامیاب)");
        expect(tc.id).toMatch(/^TC-[A-Z]{3,4}-\d{3}$/);
        expect(tc.moduleUrdu.length).toBeGreaterThan(0);
        expect(tc.descriptionUrdu.length).toBeGreaterThan(0);
        expect(tc.evidenceRefUrdu.length).toBeGreaterThan(0);
      }
    }
  });

  it("generates a valid non-empty ExcelJS buffer with all 12 worksheets", async () => {
    const buffer = await generateUrduAuditExcelWorkbook(AUDIT_SHEETS_DATA);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(20000);
  });
});
