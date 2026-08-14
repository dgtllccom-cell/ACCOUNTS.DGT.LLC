import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function GET(request: NextRequest) {
  try {
    const pdfPath = path.join(process.cwd(), "public", "reports", "COUNTRY_BRANCH_LOGIN_ACCESS_REGISTER.pdf");
    const rootPdfPath = path.join(process.cwd(), "COUNTRY_BRANCH_LOGIN_ACCESS_REGISTER.pdf");

    let finalPath = pdfPath;
    if (!fs.existsSync(finalPath) && fs.existsSync(rootPdfPath)) {
      finalPath = rootPdfPath;
    }

    if (!fs.existsSync(finalPath)) {
      return NextResponse.json({ error: "Access Register PDF not found. Please generate the report first." }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(finalPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Country_Branch_Login_Access_Register.pdf"',
        "Cache-Control": "no-store, no-cache, must-revalidate"
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to serve Access Register PDF" }, { status: 500 });
  }
}
