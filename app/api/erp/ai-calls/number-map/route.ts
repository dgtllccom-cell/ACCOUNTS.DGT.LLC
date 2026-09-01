import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { listNumberMap, upsertNumberMap, mapCallError } from "@/lib/ai-receptionist/service";
import { aiCallStatusReport } from "@/lib/ai-receptionist/config";

const schema = z.object({
  id: z.string().uuid().optional(),
  phone_e164: z.string().trim().min(6).max(20),
  label: z.string().trim().max(120).nullable().optional(),
  country_id: z.string().uuid().nullable().optional(),
  country_branch_id: z.string().uuid().nullable().optional(),
  city_branch_id: z.string().uuid().nullable().optional(),
  purpose: z.enum(["reception", "sales", "support", "collections", "outbound"]).optional(),
  default_language: z.enum(["en", "ur", "ps", "fa", "ar"]).optional(),
  greeting_override: z.string().trim().max(600).nullable().optional(),
  announce_recording: z.boolean().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "customers", action: "read" });
    try {
      const rows = await listNumberMap(session);
      return apiOk({ rows, telephony: aiCallStatusReport() });
    } catch (err) {
      const mapped = mapCallError(err);
      if (mapped.setupPending) return apiOk({ rows: [], setupPending: true, telephony: aiCallStatusReport() });
      throw err;
    }
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "customers", action: "update" });
    const body = schema.parse(await request.json());
    const result = await upsertNumberMap(session, body as any);
    return apiCreated(result);
  } catch (error) {
    return handleApiError(error);
  }
}
