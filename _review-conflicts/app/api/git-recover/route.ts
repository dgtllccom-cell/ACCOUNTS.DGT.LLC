import { execSync } from "child_process";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const cwd = "c:\\Users\\dgtll\\OneDrive\\Documents\\ACCOUNTS.DGT.LLC";
    // Just run tsc to check for syntax errors in this specific file
    const stdout = execSync("npx tsc --noEmit features/roznamcha/components/super-admin-roznamcha-report-view.tsx", { cwd, stdio: 'pipe' });
    return NextResponse.json({ success: true, stdout: stdout.toString() });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: String(err), message: err.message, stdout: err.stdout?.toString(), stderr: err.stderr?.toString() }, { status: 200 });
  }
}
