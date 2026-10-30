import { localizeRecordFields, wantsRawRecord } from "@/lib/i18n/localize-records";
import { getRequestLanguage } from "@/lib/i18n/server";
import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { apiOk, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import type { TransferModeRow } from "../route";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireErpSession();
    const { id } = await context.params;

    const row = await withLocalPg(async (sql) => {
      const [item] = await sql<TransferModeRow[]>`
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
        WHERE id = ${id}::uuid AND deleted_at IS NULL
        LIMIT 1
      `;
      return item ?? null;
    });

    if (!row) {
      return new Response(JSON.stringify({ error: "Transfer mode not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    let item = row;
    if (item && !wantsRawRecord(_request)) {
      const lang = await getRequestLanguage(_request.nextUrl.searchParams.get("lang"));
      const [localized] = await localizeRecordFields<any>([item], "transfer_modes", ["name", "reference_label", "reference_placeholder", "description"], lang);
      item = localized;
    }

    return apiOk({ data: item, mode: item });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireErpSession();
    const { id } = await context.params;
    const body = await request.json();

    const name = String(body.name || "").trim();
    if (!name) {
      return new Response(JSON.stringify({ error: "Transfer mode name is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const referenceLabel = String(body.referenceLabel || "Transaction Reference").trim();
    const referencePlaceholder = String(body.referencePlaceholder || "Reference / number").trim();
    const description = body.description !== undefined ? (body.description ? String(body.description).trim() : null) : undefined;
    const sortOrder = body.sortOrder !== undefined ? Number(body.sortOrder) : undefined;
    const isActive = body.isActive !== undefined ? Boolean(body.isActive) : undefined;

    const updated = await withLocalPg(async (sql) => {
      const [row] = await sql<TransferModeRow[]>`
        UPDATE public.transfer_modes
        SET
          name = ${name},
          reference_label = ${referenceLabel},
          reference_placeholder = ${referencePlaceholder},
          description = COALESCE(${description ?? null}, description),
          sort_order = COALESCE(${sortOrder ?? null}, sort_order),
          is_active = COALESCE(${isActive ?? null}, is_active),
          updated_at = now()
        WHERE id = ${id}::uuid AND deleted_at IS NULL
        RETURNING *
      `;
      return row ?? null;
    });

    if (!updated) {
      return new Response(JSON.stringify({ error: "Transfer mode not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return apiOk({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireErpSession();
    const { id } = await context.params;

    const deleted = await withLocalPg(async (sql) => {
      const [row] = await sql<TransferModeRow[]>`
        UPDATE public.transfer_modes
        SET
          deleted_at = now(),
          is_active = false,
          updated_at = now()
        WHERE id = ${id}::uuid AND deleted_at IS NULL
        RETURNING id
      `;
      return row ? true : false;
    });

    if (!deleted) {
      return new Response(JSON.stringify({ error: "Transfer mode not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return apiOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
