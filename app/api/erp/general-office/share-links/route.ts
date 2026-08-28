/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Internal authenticated API: /api/erp/general-office/share-links
 *
 * GET    → List all share links for the current user (or all, for admins)
 * POST   → Create a new share link
 * DELETE → Revoke a link by ID
 */

import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";

const VALID_FORM_TYPES = ["customer", "employee", "company", "agent"] as const;
const VALID_EXPIRY_HOURS = [24, 48, 72, 168, 336, 720, 0] as const; // 0 = never

function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}
function err(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const params = request.nextUrl.searchParams;
    const allLinks = session.isSuperAdmin || params.get("all") === "true";

    const links = await withLocalPg(async (sql) => {
      if (allLinks) {
        return sql<any[]>`
          select * from external_form_links
          order by created_at desc
          limit 200
        `;
      }
      return sql<any[]>`
        select * from external_form_links
        where created_by = ${session.userId}
        order by created_at desc
        limit 200
      `;
    });

    // Auto-expire stale links without a separate job
    const now = new Date();
    const processed = links.map((link) => {
      if (
        link.status === "active" &&
        link.expires_at &&
        new Date(link.expires_at) < now
      ) {
        return { ...link, status: "expired" };
      }
      return link;
    });

    return ok({ links: processed });
  } catch (e: any) {
    console.error("[Share Links GET]", e);
    return err(e?.message ?? "Server error", 500);
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = await request.json().catch(() => null);
    if (!body) return err("Invalid request body", 400);

    const formType = body.formType as string;
    if (!VALID_FORM_TYPES.includes(formType as any)) {
      return err(`Invalid form type. Must be one of: ${VALID_FORM_TYPES.join(", ")}`, 400);
    }

    const expiryHours: number = typeof body.expiryHours === "number" ? body.expiryHours : 168; // 7 days default

    const expiresAt: string | null =
      expiryHours > 0
        ? new Date(Date.now() + expiryHours * 3_600_000).toISOString()
        : null;

    const link = await withLocalPg(async (sql) => {
      // Ensure table exists (idempotent — migration may not have run yet)
      await sql`
        create table if not exists external_form_links (
          id             uuid        primary key default gen_random_uuid(),
          token          text        unique not null default replace(gen_random_uuid()::text, '-', ''),
          form_type      text        not null,
          status         text        not null default 'active',
          created_by     uuid,
          created_by_name text,
          country_id     uuid,
          country_branch_id uuid,
          city_branch_id uuid,
          created_at     timestamptz not null default now(),
          expires_at     timestamptz,
          submitted_at   timestamptz,
          submitted_record_id uuid,
          submission_data jsonb,
          notes          text,
          updated_at     timestamptz not null default now()
        )
      `.catch(() => null); // ignore if already exists

      const [row] = await sql<any[]>`
        insert into external_form_links
          (form_type, status, created_by, created_by_name,
           country_id, country_branch_id, city_branch_id, expires_at, notes)
        values (
          ${formType}, 'active', ${session.userId}, ${session.userFullName ?? session.userId},
          ${session.countryIds?.[0] ?? null},
          ${session.countryBranchIds?.[0] ?? null},
          ${session.cityBranchIds?.[0] ?? null},
          ${expiresAt}, ${body.notes ?? null}
        )
        returning *
      `;
      return row;
    });

    // Build the public URL
    const host = request.nextUrl.origin;
    const publicUrl = `${host}/ext/form/${link.token}`;

    return ok({ link, publicUrl }, 201);
  } catch (e: any) {
    console.error("[Share Links POST]", e);
    return err(e?.message ?? "Failed to create link", 500);
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { id } = await request.json().catch(() => ({ id: null }));
    if (!id) return err("Missing id", 400);

    await withLocalPg(async (sql) => {
      // Only the creator or super admin can revoke
      if (session.isSuperAdmin) {
        await sql`
          update external_form_links
          set status = 'revoked', updated_at = now()
          where id = ${id}
        `;
      } else {
        await sql`
          update external_form_links
          set status = 'revoked', updated_at = now()
          where id = ${id} and created_by = ${session.userId}
        `;
      }
    });

    return ok({ revoked: true });
  } catch (e: any) {
    console.error("[Share Links DELETE]", e);
    return err(e?.message ?? "Failed to revoke link", 500);
  }
}
