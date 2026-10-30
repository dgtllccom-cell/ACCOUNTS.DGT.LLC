import { localizeRecordFields, wantsRawRecord } from "@/lib/i18n/localize-records";
import { getRequestLanguage } from "@/lib/i18n/server";
import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { apiOk, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";

export type TransferModeRow = {
  id: string;
  code: string;
  name: string;
  reference_label: string;
  reference_placeholder: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export async function GET(request: NextRequest) {
  try {
    await requireErpSession();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const includeInactive = searchParams.get("includeInactive") === "true";

    const rows = await withLocalPg(async (sql) => {
      const results = await sql<TransferModeRow[]>`
        SELECT
          id,
          code,
          name,
          reference_label,
          reference_placeholder,
          description,
          is_active,
          sort_order,
          created_at,
          updated_at
        FROM public.transfer_modes
        WHERE deleted_at IS NULL
          AND (${includeInactive ? sql`true` : sql`is_active = true`})
          AND (${search ? sql`(lower(name) LIKE ${`%${search}%`} OR lower(code) LIKE ${`%${search}%`})` : sql`true`})
        ORDER BY sort_order ASC, name ASC
      `;
      return results;
    });

    let paged = rows || [];
    if (paged.length > 0 && !wantsRawRecord(request)) {
      const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
      paged = await localizeRecordFields<any>(paged, "transfer_modes", ["name", "reference_label", "reference_placeholder", "description"], lang);
    }

    return apiOk({ data: paged, modes: paged });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireErpSession();
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return new Response(JSON.stringify({ error: "Transfer mode name is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const code = String(body.code || name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "mode").slice(0, 80);
    const referenceLabel = String(body.referenceLabel || "Transaction Reference").trim();
    const referencePlaceholder = String(body.referencePlaceholder || "Reference / number").trim();
    const description = body.description ? String(body.description).trim() : null;
    const sortOrder = Number(body.sortOrder || 0);
    const isActive = body.isActive !== false;

    const inserted = await withLocalPg(async (sql) => {
      const [existing] = await sql<TransferModeRow[]>`
        SELECT id FROM public.transfer_modes
        WHERE lower(name) = lower(${name}) AND deleted_at IS NULL
        LIMIT 1
      `;
      if (existing) {
        // Return existing if duplicate name
        const [updated] = await sql<TransferModeRow[]>`
          UPDATE public.transfer_modes
          SET
            reference_label = ${referenceLabel},
            reference_placeholder = ${referencePlaceholder},
            is_active = ${isActive},
            updated_at = now()
          WHERE id = ${existing.id}::uuid
          RETURNING *
        `;
        return updated;
      }

      const [row] = await sql<TransferModeRow[]>`
        INSERT INTO public.transfer_modes (
          code,
          name,
          reference_label,
          reference_placeholder,
          description,
          is_active,
          sort_order
        ) VALUES (
          ${code},
          ${name},
          ${referenceLabel},
          ${referencePlaceholder},
          ${description},
          ${isActive},
          ${sortOrder}
        )
        RETURNING *
      `;
      return row;
    });

    return apiOk({ data: inserted }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
