import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";

function getDb() {
  const url = process.env.DATABASE_URL || "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";
  return postgres(url, { max: 1, prepare: false, connect_timeout: 10 });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = req.cookies.get("dgt_mail_user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const sql = getDb();
  try {
    const [msg] = await sql`
      SELECT * FROM public.public_mail_messages
      WHERE id = ${id} AND user_id = ${userId}
      LIMIT 1
    `;

    if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });

    // Mark read
    if (!msg.is_read) {
      await sql`
        UPDATE public.public_mail_messages
        SET is_read = TRUE
        WHERE id = ${id}
      `;
    }

    return NextResponse.json({ message: msg });
  } finally {
    await sql.end();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = req.cookies.get("dgt_mail_user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const sql = getDb();

  try {
    const updates: Record<string, unknown> = {};
    if (typeof body.is_read === "boolean") updates.is_read = body.is_read;
    if (typeof body.is_starred === "boolean") updates.is_starred = body.is_starred;
    if (typeof body.folder === "string") updates.folder = body.folder;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const [updated] = await sql`
      UPDATE public.public_mail_messages
      SET ${sql(updates)}
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `;

    return NextResponse.json({ message: updated });
  } finally {
    await sql.end();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = req.cookies.get("dgt_mail_user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const sql = getDb();

  try {
    const [msg] = await sql`
      SELECT size_bytes, folder FROM public.public_mail_messages
      WHERE id = ${id} AND user_id = ${userId}
      LIMIT 1
    `;

    if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });

    // If already in trash, delete permanently and free up storage
    if (msg.folder === "trash") {
      await sql`
        DELETE FROM public.public_mail_messages
        WHERE id = ${id} AND user_id = ${userId}
      `;

      // Subtract from used_bytes
      await sql`
        UPDATE public.public_mail_users
        SET used_bytes = GREATEST(0, used_bytes - ${Number(msg.size_bytes || 0)})
        WHERE id = ${userId}
      `;
    } else {
      // Move to trash
      await sql`
        UPDATE public.public_mail_messages
        SET folder = 'trash'
        WHERE id = ${id} AND user_id = ${userId}
      `;
    }

    return NextResponse.json({ success: true });
  } finally {
    await sql.end();
  }
}
