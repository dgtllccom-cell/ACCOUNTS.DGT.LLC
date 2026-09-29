import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/local-postgres", () => ({ withLocalPg: vi.fn(), withReadPg: vi.fn() }));
vi.mock("@/lib/services/company-master-service", () => ({ companyInSessionScope: vi.fn(), loadCompanyScopeRow: vi.fn() }));
vi.mock("@/lib/services/hr-api", () => ({ assertEmployeeAccess: vi.fn() }));
vi.mock("@/lib/api/scope-middleware", () => ({ recordInSessionScope: vi.fn(), sessionSqlScope: vi.fn(), sqlScopeCondition: vi.fn() }));

import { buildSif, isEstablishmentId, isPersonId, isRoutingCode, isValidUaeIban } from "@/lib/services/hr-wps-service";

describe("UAE WPS format rules", () => {
  it("accepts the registry example UAE IBAN and rejects a broken checksum", () => {
    expect(isValidUaeIban("AE070331234567890123456")).toBe(true);
    expect(isValidUaeIban("AE07 0331 2345 6789 0123 456")).toBe(true);
    expect(isValidUaeIban("AE080331234567890123456")).toBe(false);
    expect(isValidUaeIban("AE07033123456789012345")).toBe(false);
    expect(isValidUaeIban("GB82WEST12345698765432")).toBe(false);
  });
  it("checks id lengths", () => {
    expect(isPersonId("10000012345678")).toBe(true);
    expect(isPersonId("1000001234567")).toBe(false);
    expect(isRoutingCode("803320101")).toBe(true);
    expect(isRoutingCode("80332010")).toBe(false);
    expect(isEstablishmentId("1000000123456")).toBe(true);
    expect(isEstablishmentId("100000012345a")).toBe(false);
  });
});

describe("SIF file", () => {
  const sif = buildSif({
    establishmentId: "1000000123456",
    employerRoutingCode: "803320101",
    employerReference: "PR-2026-0009",
    periodMonth: "2026-02",
    now: { date: "2026-03-01", hhmm: "0930", stamp: "260301093015" },
    lines: [
      { employeeId: "a", employeeCode: "E1", payrollLineId: "l1", personId: "10000012345678", routingCode: "803320101", account: "AE070331234567890123456", fixed: 5000, variable: 250.5, leaveDays: 2, net: 5250.5 },
      { employeeId: "b", employeeCode: "E2", payrollLineId: "l2", personId: "10000087654321", routingCode: "807010101", account: "12345678", fixed: 3200, variable: 0, leaveDays: 0, net: 3200 },
    ],
  });
  const rows = sif.content.split("\r\n").filter(Boolean);

  it("names the file <establishment><YYMMDDHHMMSS>.SIF", () => {
    expect(sif.fileName).toBe("1000000123456260301093015.SIF");
  });
  it("writes one EDR per employee with the pay period and days of the month", () => {
    expect(rows[0]).toBe("EDR,10000012345678,803320101,AE070331234567890123456,2026-02-01,2026-02-28,28,5000.00,250.50,2");
    expect(rows[1]).toBe("EDR,10000087654321,807010101,12345678,2026-02-01,2026-02-28,28,3200.00,0.00,0");
  });
  it("closes with an SCR control line whose count and total match the EDRs", () => {
    expect(rows).toHaveLength(3);
    expect(rows[2]).toBe("SCR,1000000123456,803320101,2026-03-01,0930,022026,2,8450.50,AED,PR-2026-0009");
    expect(sif.total).toBe(8450.5);
  });
  it("uses CRLF line endings and no commas inside the employer reference", () => {
    expect(sif.content.endsWith("\r\n")).toBe(true);
    const s2 = buildSif({ establishmentId: "1000000123456", employerRoutingCode: "803320101", employerReference: "A,B", periodMonth: "2024-02", now: { date: "2024-03-01", hhmm: "0000", stamp: "240301000000" }, lines: [] });
    expect(s2.content.trim().split(",")).toHaveLength(10);
    expect(s2.days).toBe(29);
  });
});
