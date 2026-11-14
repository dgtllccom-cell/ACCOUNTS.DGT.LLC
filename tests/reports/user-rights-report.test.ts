import { describe, expect, it } from "vitest";
import { buildUserRightsReportHtml, type UserRightsReportInput } from "@/lib/reports/user-rights-report";
import { buildUserRightsList, rightsFormName } from "@/lib/permissions/user-rights-list";
import { ERP_ACTION_KEYS, ERP_PERMISSION_HIERARCHY, buildHierarchicalMatrixState } from "@/lib/permissions/rbac-matrix-builder";
import { enterpriseRolePermissions } from "@/lib/permissions/enterprise-roles";
import { t } from "@/lib/i18n/ui";

const PERMS = enterpriseRolePermissions["staff_user"] ?? [];

function input(overrides: Partial<UserRightsReportInput> = {}): UserRightsReportInput {
  return {
    lang: "en",
    identity: { userCode: "USR-4321", fullName: "Test <User> & Co", username: "test.user", email: "test.user@dgt.llc", status: "Active" },
    scope: { domain: "business", countryName: "Pakistan", mainBranchName: "Quetta Main", mainBranchCode: "PK-QTA", warehouseNames: ["Central Store"] },
    deviceAccess: ["mobile"],
    registeredDevices: [{ app: "b", platform: "android", model: "Pixel 9", status: "active", requestedAt: "2026-11-01T08:00:00Z" }],
    roleLabel: "City Normal User / Staff",
    rights: buildUserRightsList({ role: "staff_user", permissions: PERMS }),
    generatedAt: new Date("2026-11-15T10:00:00Z"),
    ...overrides,
  };
}

describe("complete user rights A4 report", () => {
  it("escapes user data (no raw markup from a name)", () => {
    const html = buildUserRightsReportHtml(input());
    expect(html).toContain("Test &lt;User&gt; &amp; Co");
    expect(html).not.toContain("Test <User>");
  });

  it("prints EVERY granted form as a row, with its granted actions ticked", () => {
    const rights = buildUserRightsList({ role: "staff_user", permissions: PERMS });
    const html = buildUserRightsReportHtml(input({ rights }));
    const formRows = (html.match(/<td class="form">/g) ?? []).length;
    // every granted form in the modules table + the four expense bill types (always printed in their own table)
    const grantedInModules = rights.modules
      .flatMap((m) => m.sections.filter((s) => s.key !== "sec_expense_bills").flatMap((s) => s.forms)).length;
    expect(formRows).toBe(grantedInModules + rights.expenseBillTypes.length);
    expect(html).toContain('class="act on"');
  });

  it("prints every granted form's translated name (no truncation of the list)", () => {
    const rights = buildUserRightsList({ role: "staff_user", permissions: PERMS });
    const html = buildUserRightsReportHtml(input({ rights }));
    for (const mod of rights.modules) {
      for (const sec of mod.sections.filter((s) => s.key !== "sec_expense_bills")) {
        for (const form of sec.forms) {
          expect(html).toContain(rightsFormName("en", form.key, form.name).replace(/&/g, "&amp;"));
        }
      }
    }
  });

  it("sets the document direction: rtl for ur / ar / fa / ps, ltr for English", () => {
    expect(buildUserRightsReportHtml(input({ lang: "en" }))).toContain('dir="ltr"');
    for (const lang of ["ur", "ar", "fa", "ps"]) {
      const html = buildUserRightsReportHtml(input({ lang }));
      expect(html).toContain('dir="rtl"');
      expect(html).toContain(`lang="${lang}"`);
    }
  });

  it("uses the five-language labels, so an Urdu report carries the Urdu headings", () => {
    const html = buildUserRightsReportHtml(input({ lang: "ur" }));
    expect(html).toContain(t("ur", "udr.r.sec_rights", "x"));
    expect(html).toContain(t("ur", "udr.r.sec_expense", "x"));
    expect(html).not.toContain(">Granted module rights (every form)<");
  });

  it("shows the allotment: chips for the allowed devices, 'any device' when not restricted", () => {
    const mobileOnly = buildUserRightsReportHtml(input({ deviceAccess: ["mobile"] }));
    expect(mobileOnly).toContain(t("en", "udr.r.dev_mobile", "x"));
    expect(mobileOnly).not.toContain(`chip-on">${t("en", "udr.r.dev_computer", "x")}`);
    const unrestricted = buildUserRightsReportHtml(input({ deviceAccess: null }));
    expect(unrestricted).toContain(t("en", "udr.r.dev_any", "x"));
  });

  it("lists the registered mobile devices of the login", () => {
    const html = buildUserRightsReportHtml(input());
    expect(html).toContain("Pixel 9");
    expect(html).toContain("<td>B</td>");
    expect(html).toContain(t("en", "udr.dst.active", "x"));
  });

  it("keeps table rows from splitting across pages and keeps headers on each page", () => {
    const html = buildUserRightsReportHtml(input());
    expect(html).toContain("break-inside: avoid");
    expect(html).toContain("display: table-header-group");
  });

  it("lists the full-authority case and the restricted modules explicitly", () => {
    const full = buildUserRightsReportHtml(input({ rights: buildUserRightsList({ role: "super_admin", permissions: ["*:*"] }) }));
    expect(full).toContain(t("en", "udr.r.full_authority", "x"));
    const restricted = buildUserRightsReportHtml(input({ rights: buildUserRightsList({ role: "staff_user", permissions: [] }) }));
    for (const mod of ERP_PERMISSION_HIERARCHY) {
      expect(restricted).toContain(mod.name.replace(/&/g, "&amp;"));
    }
  });

  it("the matrix in the report and the matrix state agree on every granted action", () => {
    const state = buildHierarchicalMatrixState("staff_user", PERMS);
    const rights = buildUserRightsList({ role: "staff_user", permissions: PERMS });
    const grantedActions = rights.modules.flatMap((m) => m.sections.flatMap((s) => s.forms.flatMap((f) => f.granted)))
      .concat(rights.expenseBillTypes.flatMap((f) => f.granted));
    const expected = ERP_PERMISSION_HIERARCHY.flatMap((m) => m.sections.flatMap((s) => s.forms.flatMap((f) => ERP_ACTION_KEYS.filter((a) => state[f.key][a]))));
    expect(grantedActions.sort()).toEqual(expected.sort());
  });
});
