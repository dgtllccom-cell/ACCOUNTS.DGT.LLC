import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const root = process.cwd();
    const scriptPath = path.join(root, "scripts", "deploy-prod-vps.mjs");
    
    const output = execSync(`node "${scriptPath}"`, {
      cwd: root,
      encoding: "utf8",
      timeout: 600000
    });

    return NextResponse.json({
      success: true,
      message: "Production deployment & location DB population completed successfully.",
      output
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error?.message || String(error),
      stdout: error?.stdout,
      stderr: error?.stderr
    }, { status: 500 });
  }
}
