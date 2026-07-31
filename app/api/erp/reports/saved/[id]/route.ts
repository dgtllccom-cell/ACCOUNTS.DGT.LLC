import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { savedReports } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const id = (await params).id;
    const body = await req.json();
    const { name, config, isPublic } = body;

    const [existing] = await db
      .select()
      .from(savedReports)
      .where(and(eq(savedReports.id, id), eq(savedReports.userId, session.userId)));

    if (!existing) {
      return NextResponse.json({ error: "Report not found or permission denied" }, { status: 404 });
    }

    const [updatedReport] = await db
      .update(savedReports)
      .set({
        name: name || existing.name,
        config: config || existing.config,
        isPublic: isPublic !== undefined ? isPublic : existing.isPublic,
        updatedAt: new Date(),
      })
      .where(eq(savedReports.id, id))
      .returning();

    return NextResponse.json({ success: true, data: updatedReport });
  } catch (error: any) {
    console.error("Failed to update saved report:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const id = (await params).id;

    const [existing] = await db
      .select()
      .from(savedReports)
      .where(and(eq(savedReports.id, id), eq(savedReports.userId, session.userId)));

    if (!existing) {
      return NextResponse.json({ error: "Report not found or permission denied" }, { status: 404 });
    }

    await db.delete(savedReports).where(eq(savedReports.id, id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete saved report:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
