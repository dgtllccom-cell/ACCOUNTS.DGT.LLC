import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  try {
    const rootDir = "c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC";
    const file = path.join(rootDir, "lib/i18n/ui.ts");

    if (!fs.existsSync(file)) {
      return NextResponse.json({ ok: false, error: "File not found" });
    }

    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");

    const matches = lines
      .map((line, index) => ({ line: line.trim(), lineNum: index + 1 }))
      .filter(item => item.line.toLowerCase().includes("roznamcha"));

    return NextResponse.json({ ok: true, matches });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message });
  }
}
