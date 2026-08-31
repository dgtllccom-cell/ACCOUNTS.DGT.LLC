import { NextRequest, NextResponse } from "next/server";
import { getAccessRegisterData } from "@/lib/repositories/access-register-repository";

export async function GET(request: NextRequest) {
  try {
    const COUNTRY_BRANCH_ACCESS_REGISTER = await getAccessRegisterData();
    const headers = [
      "Country",
      "Main Branch",
      "City Branch",
      "User / Responsible Person",
      "Role",
      "Login Page / URL",
      "Username / Login ID",
      "Email",
      "Status",
      "Assigned Permissions",
      "Password Vault Reference / Credential ID",
      "Last Updated",
      "Notes"
    ];

    const escapeCsv = (str: string) => {
      if (!str) return '""';
      const escaped = str.replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const csvRows = [
      headers.map(h => escapeCsv(h)).join(","),
      ...COUNTRY_BRANCH_ACCESS_REGISTER.map(row => [
        escapeCsv(row.country),
        escapeCsv(row.mainBranch),
        escapeCsv(row.cityBranch),
        escapeCsv(row.responsiblePerson),
        escapeCsv(row.role),
        escapeCsv(row.loginUrl),
        escapeCsv(row.username),
        escapeCsv(row.email),
        escapeCsv(row.status),
        escapeCsv(row.assignedPermissions),
        escapeCsv(row.passwordVaultRef),
        escapeCsv(row.lastUpdated),
        escapeCsv(row.notes)
      ].join(","))
    ];

    const csvContent = "\uFEFF" + csvRows.join("\r\n"); // UTF-8 BOM for Excel compatibility

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="Country_Branch_Login_Access_Register.csv"',
        "Cache-Control": "no-store, no-cache, must-revalidate"
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to generate Excel/CSV register" }, { status: 500 });
  }
}
