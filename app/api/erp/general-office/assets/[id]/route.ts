/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { requireOfficeSession } from "@/lib/api/office-hr";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  assetTag: z.string().max(80).nullable().optional(),
  assetName: z.string().max(200).optional(),
  category: z.string().max(80).nullable().optional(),
  assignedEmployeeId: z.string().uuid().nullable().optional(),
  serialNumber: z.string().max(120).nullable().optional(),
  purchaseDate: z.string().nullable().optional(),
  assetValue: z.number().nullable().optional(),
  currency: z.string().max(10).nullable().optional(),
  status: z.string().optional(),
  notes: z.string().max(1000).nullable().optional()
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireOfficeSession(true);
    const { id } = await ctx.params;
    const b = patchSchema.parse(await request.json());
    await withLocalPg(async (sql) => {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if ("assetTag" in b) patch.asset_tag = b.assetTag ?? null;
      if ("assetName" in b) patch.asset_name = b.assetName;
      if ("category" in b) patch.category = b.category ?? null;
      if ("assignedEmployeeId" in b) patch.assigned_employee_id = b.assignedEmployeeId ?? null;
      if ("serialNumber" in b) patch.serial_number = b.serialNumber ?? null;
      if ("purchaseDate" in b) patch.purchase_date = b.purchaseDate || null;
      if ("assetValue" in b) patch.asset_value = b.assetValue ?? null;
      if ("currency" in b) patch.currency = b.currency ?? null;
      if ("status" in b) patch.status = b.status;
      if ("notes" in b) patch.notes = b.notes ?? null;
      await sql`update office_assets set ${sql(patch)} where id = ${id} and deleted_at is null`;
      return true;
    });
    return apiOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireOfficeSession(true);
    const { id } = await ctx.params;
    await withLocalPg(async (sql) => sql`update office_assets set deleted_at = now() where id = ${id}`);
    return apiOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
