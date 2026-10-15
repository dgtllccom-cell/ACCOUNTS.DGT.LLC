import ExcelJS from "exceljs";

export interface AuditTestCase {
  id: string; // TC-XXX
  moduleUrdu: string;
  testTitleUrdu: string;
  descriptionUrdu: string;
  expectedResultUrdu: string;
  actualResultUrdu: string;
  status: "PASS (کامیاب)" | "FAIL (ناکام)" | "BLOCKED (مسدود)" | "NOT TESTED (غیر آزمودہ)";
  evidenceRefUrdu: string;
}

export interface AuditSheetDef {
  sheetName: string;
  titleUrdu: string;
  subtitleUrdu: string;
  testCases: AuditTestCase[];
}

export async function generateUrduAuditExcelWorkbook(sheets: AuditSheetDef[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DGT ERP Business Super Admin Audit System";
  workbook.lastModifiedBy = "Antigravity AI Autonomous Engineer";
  workbook.created = new Date();
  workbook.modified = new Date();

  for (const sheetDef of sheets) {
    const ws = workbook.addWorksheet(sheetDef.sheetName, {
      views: [{ rightToLeft: true, showGridLines: true }]
    });

    // 1. Title Banner
    ws.mergeCells("A1:G1");
    const titleCell = ws.getCell("A1");
    titleCell.value = `ڈی جی ٹی بزنس ای آر پی — ${sheetDef.titleUrdu}`;
    titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF071329" } // Dark corporate navy
    };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    ws.getRow(1).height = 36;

    // 2. Subtitle / Summary info
    ws.mergeCells("A2:G2");
    const subCell = ws.getCell("A2");
    subCell.value = `${sheetDef.subtitleUrdu} | آڈٹ کی تاریخ: ${new Date().toLocaleDateString("ur-PK")} | ماحول: لائیو پروڈکشن تصدیق شدہ`;
    subCell.font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF38BDF8" } };
    subCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0C1F42" }
    };
    subCell.alignment = { vertical: "middle", horizontal: "center" };
    ws.getRow(2).height = 24;

    // Empty separator row
    ws.getRow(3).height = 10;

    // 3. Table Headers
    const headers = [
      "ٹیسٹ کوڈ",
      "کاروباری ماڈیول",
      "ٹیسٹ کی تفصیل / مقصد",
      "طریقہ کار اور ان پٹ ڈیٹا",
      "متوقع کاروباری نتیجہ",
      "اصل مشاہدہ کردہ نتیجہ",
      "حیثیت (Status)",
      "ثبوت / حوالہ جات (Evidence)"
    ];

    const headerRow = ws.getRow(4);
    headerRow.values = headers;
    headerRow.height = 28;

    headerRow.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E3A8A" } // Deep Blue
      };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FF94A3B8" } },
        left: { style: "thin", color: { argb: "FF94A3B8" } },
        bottom: { style: "medium", color: { argb: "FF0284C7" } },
        right: { style: "thin", color: { argb: "FF94A3B8" } }
      };
    });

    // 4. Data Rows
    let currentRowIdx = 5;
    for (const tc of sheetDef.testCases) {
      const row = ws.getRow(currentRowIdx);
      row.values = [
        tc.id,
        tc.moduleUrdu,
        tc.testTitleUrdu,
        tc.descriptionUrdu,
        tc.expectedResultUrdu,
        tc.actualResultUrdu,
        tc.status,
        tc.evidenceRefUrdu
      ];
      row.height = 28;

      row.eachCell((cell, colNumber) => {
        cell.font = { name: "Calibri", size: 10 };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } }
        };

        // Alignments
        if (colNumber === 1 || colNumber === 7) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        } else {
          cell.alignment = { vertical: "middle", horizontal: "right", wrapText: true };
        }

        // Status highlight
        if (colNumber === 7) {
          if (tc.status.includes("PASS") || tc.status.includes("کامیاب")) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFE8F5E9" }
            };
            cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1B5E20" } };
          } else if (tc.status.includes("FAIL") || tc.status.includes("ناکام")) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFEBEE" }
            };
            cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFB71C1C" } };
          } else {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFF9C4" }
            };
            cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFF57F17" } };
          }
        }
      });

      currentRowIdx++;
    }

    // Set Column Widths for readability
    ws.columns = [
      { width: 14 }, // Test ID
      { width: 22 }, // Module
      { width: 34 }, // Test Title
      { width: 44 }, // Steps / Inputs
      { width: 36 }, // Expected Result
      { width: 36 }, // Actual Result
      { width: 18 }, // Status
      { width: 28 }  // Evidence
    ];
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
