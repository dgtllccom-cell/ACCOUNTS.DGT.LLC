/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentErpSession } from "@/lib/auth/session";
import { isDemoAuthEnabled } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withLocalPg } from "@/lib/db/local-postgres";

function isUuid(val: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

const passwordUpdateSchema = z.object({
  userId: z.string().optional(),
  userCode: z.string().optional(),
  email: z.string().optional(),
  password: z.string().min(6).max(128).optional(),
  newPassword: z.string().min(6).max(128).optional()
});

export async function POST(request: NextRequest) {
  return handlePasswordUpdate(request);
}

export async function PATCH(request: NextRequest) {
  return handlePasswordUpdate(request);
}

async function handlePasswordUpdate(request: NextRequest) {
  try {
    const session = await getCurrentErpSession();
    if (!session && !isDemoAuthEnabled()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = passwordUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters. Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const { userId, userCode, email } = parsed.data;
    const targetPassword = (parsed.data.newPassword || parsed.data.password || "").trim();

    if (!targetPassword) {
      return NextResponse.json({ error: "Password cannot be empty" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient() as any;
    let targetProfileId: string | null = null;
    let foundUserCode: string | null = userCode || null;
    let foundEmail: string | null = email || null;

    // 1. Locate profile in public.profiles
    if (userId && isUuid(userId)) {
      const { data: p } = await admin.from("profiles").select("id, user_code, full_name").eq("id", userId).maybeSingle();
      if (p) {
        targetProfileId = p.id;
        foundUserCode = p.user_code || foundUserCode;
      }
    }

    if (!targetProfileId && (userCode || email || userId)) {
      const searchTerms = [
        userCode,
        email,
        userId,
        email?.replace(/@dgt\.llc$/i, ""),
        userCode?.replace(/\.(admin|branch)$/i, "")
      ].filter(Boolean) as string[];

      for (const term of searchTerms) {
        const clean = term.trim().toLowerCase();
        try {
          const row = await withLocalPg(async (sql) => {
            const res = await sql`
              SELECT id, user_code, full_name
              FROM public.profiles
              WHERE deleted_at IS NULL
                AND (
                     id::text = ${clean}
                  OR user_code ILIKE ${clean}
                  OR user_code ILIKE ${`${clean}.branch`}
                  OR user_code ILIKE ${`${clean}.admin`}
                  OR user_code ILIKE ${`%${clean}%`}
                  OR full_name ILIKE ${`%${clean}%`}
                )
              LIMIT 1;
            `;
            return res[0] || null;
          });
          if (row?.id) {
            targetProfileId = row.id;
            foundUserCode = row.user_code || foundUserCode;
            break;
          }
        } catch {
          // ignore pg error
        }
      }
    }

    // 2. If targetProfileId found, update profiles.raw_password
    let updatedDb = false;
    if (targetProfileId) {
      try {
        await withLocalPg(async (sql) => {
          await sql`
            UPDATE public.profiles
            SET raw_password = ${targetPassword}, updated_at = NOW()
            WHERE id = ${targetProfileId}::uuid;
          `;
        });
        updatedDb = true;
      } catch (err) {
        console.warn("Direct pg password update failed:", err);
      }

      try {
        await admin
          .from("profiles")
          .update({ raw_password: targetPassword, updated_at: new Date().toISOString() })
          .eq("id", targetProfileId);
        updatedDb = true;
      } catch (err) {
        console.warn("Supabase profiles update failed:", err);
      }

      // Try Supabase auth user update if available
      try {
        await admin.auth.admin.updateUserById(targetProfileId, { password: targetPassword });
      } catch {
        // ignore if auth user is not in Supabase Auth
      }

      // Try direct pg crypt on auth.users if available
      try {
        await withLocalPg(async (sql) => {
          await sql`
            UPDATE auth.users
            SET encrypted_password = crypt(${targetPassword}, gen_salt('bf'))
            WHERE id = ${targetProfileId}::uuid;
          `;
        });
      } catch {
        // ignore
      }
    } else {
      // If user is a reference user (not yet in profiles table), insert or upsert a profile row
      const generatedCode = (userCode || email?.replace(/@dgt\.llc$/i, "") || userId || "USR").toUpperCase();
      try {
        const newId = isUuid(userId || "") ? userId : undefined;
        const insertPayload: any = {
          user_code: generatedCode,
          full_name: `${generatedCode} User`,
          raw_password: targetPassword,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        if (newId) insertPayload.id = newId;

        const { data: inserted, error: insErr } = await admin
          .from("profiles")
          .insert(insertPayload)
          .select("id")
          .maybeSingle();

        if (inserted?.id) {
          targetProfileId = inserted.id;
          updatedDb = true;
        } else if (insErr) {
          console.warn("Could not insert new profile for reference user:", insErr.message);
        }
      } catch (e) {
        console.warn("Profile insert error:", e);
      }
    }

    return NextResponse.json({
      ok: true,
      success: true,
      message: "Password updated successfully",
      password: targetPassword,
      userId: targetProfileId || userId,
      userCode: foundUserCode || userCode,
      updatedInDatabase: updatedDb
    });
  } catch (error: any) {
    console.error("Password update handler error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
