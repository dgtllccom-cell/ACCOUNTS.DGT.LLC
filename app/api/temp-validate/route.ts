import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "features/purchases/components/purchase-loading-records-view.tsx");
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    const issues: Array<{ line: number; text: string; reason: string }> = [];

    let braceDepth = 0;
    let parenDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === "{") braceDepth++;
        else if (char === "}") braceDepth--;
        else if (char === "(") parenDepth++;
        else if (char === ")") parenDepth--;

        if (braceDepth < 0) {
          issues.push({ line: i + 1, text: line.trim(), reason: `Negative brace depth at col ${j + 1}` });
          braceDepth = 0;
        }
        if (parenDepth < 0) {
          issues.push({ line: i + 1, text: line.trim(), reason: `Negative paren depth at col ${j + 1}` });
          parenDepth = 0;
        }
      }

      if (line.trim() === "}}" || line.trim() === "}}}") {
        issues.push({ line: i + 1, text: line.trim(), reason: "Stray closing braces" });
      }
    }

    return NextResponse.json({
      success: true,
      totalLines: lines.length,
      finalBraceDepth: braceDepth,
      finalParenDepth: parenDepth,
      issues
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
