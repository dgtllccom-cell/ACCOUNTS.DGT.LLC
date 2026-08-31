import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { savedReports } from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(req.url);
    const moduleName = searchParams.get("module");

    if (!moduleName) {
      return NextResponse.json({ error: "module parameter is required" }, { status: 400 });
    }

    const reports = await db
      .select()
      .from(savedReports)
      .where(
        and(
          eq(savedReports.module, moduleName),
          or(
            eq(savedReports.userId, session.userId),
            eq(savedReports.isPublic, true)
          )
        )
      )
      .orderBy(savedReports.createdAt);

    return NextResponse.json({ success: true, data: reports });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    console.error("Failed to fetch saved reports:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireErpSession();
    const body = await req.json();
    const { name, module, config, isPublic } = body;

    if (!name || !module || !config) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [newReport] = await db
      .insert(savedReports)
      .values({
        userId: session.userId,
        name,
        module,
        config,
        isPublic: isPublic || false,
      })
      .returning();

    return NextResponse.json({ success: true, data: newReport });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    console.error("Failed to save report:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
