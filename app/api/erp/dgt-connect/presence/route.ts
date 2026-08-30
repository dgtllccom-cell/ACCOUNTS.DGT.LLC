import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk } from "@/lib/api/response";
import { requireDgtSession, dgtErrorResponse } from "@/lib/dgt-connect/route-helpers";
import { heartbeat } from "@/lib/dgt-connect/service";

export const dynamic = "force-dynamic";

const schema = z.object({ status: z.enum(["online", "away"]).default("online") });

export async function POST(request: NextRequest) {
  const auth = await requireDgtSession();
  if ("response" in auth) return auth.response;
  try {
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    await heartbeat(auth.session, parsed.success ? parsed.data.status : "online");
    return apiOk({ ok: true });
  } catch (error) {
    return dgtErrorResponse(error);
  }
}
