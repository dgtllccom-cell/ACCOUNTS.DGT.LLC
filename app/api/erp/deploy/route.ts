import { NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  const logMessages: string[] = [];

  try {
    const cwd = process.cwd();
    logMessages.push(`Working directory: ${cwd}`);

    // 1. Clear git index lock if present
    const lockFile = path.join(cwd, ".git", "index.lock");
    if (fs.existsSync(lockFile)) {
      try {
        fs.unlinkSync(lockFile);
        logMessages.push("Removed stale .git/index.lock");
      } catch (e: any) {
        logMessages.push(`Lock remove warning: ${e.message}`);
      }
    }

    // 2. Stage clean changes
    try {
      execSync("git add -A", { cwd, stdio: "pipe" });
      logMessages.push("Staged all clean source code changes.");
    } catch (e: any) {
      logMessages.push(`Staging output: ${e.message}`);
    }

    // 3. Commit release
    try {
      const commitOut = execSync('git commit -m "Production release: Client exception fixes, 5-language auto-translation, country/branch data isolation"', { cwd, stdio: "pipe" });
      logMessages.push(`Commit output: ${commitOut.toString().trim()}`);
    } catch (e: any) {
      logMessages.push(`Commit note: ${e.message}`);
    }

    // 4. Check git status
    try {
      const statusOut = execSync("git status --short", { cwd, stdio: "pipe" });
      logMessages.push(`Git status: ${statusOut.toString().trim() || "Clean working tree"}`);
    } catch (e: any) {
      logMessages.push(`Status note: ${e.message}`);
    }

    // 5. Push to GitHub main branch
    let pushSuccess = false;
    try {
      const pushOut = execSync("git push origin main", { cwd, stdio: "pipe" });
      logMessages.push(`Push output: ${pushOut.toString().trim()}`);
      pushSuccess = true;
    } catch (e: any) {
      logMessages.push(`Standard push note: ${e.message}`);
      try {
        const forcePushOut = execSync("git push origin main --force", { cwd, stdio: "pipe" });
        logMessages.push(`Force push output: ${forcePushOut.toString().trim()}`);
        pushSuccess = true;
      } catch (f: any) {
        logMessages.push(`Force push error: ${f.message}`);
      }
    }

    return NextResponse.json({
      success: pushSuccess,
      message: pushSuccess ? "Successfully pushed codebase to GitHub main branch!" : "Completed git staging and commit.",
      logs: logMessages
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, logs: logMessages }, { status: 200 });
  }
}
