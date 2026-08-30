import { apiOk } from "@/lib/api/response";
import { dgtDirectory } from "@/lib/dgt-connect/access";
import { requireDgtSession, dgtErrorResponse } from "@/lib/dgt-connect/route-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireDgtSession();
  if ("response" in auth) return auth.response;
  try {
    const directory = await dgtDirectory(auth.session);
    return apiOk(directory);
  } catch (error) {
    return dgtErrorResponse(error, {
      scopeLabel: "unknown",
      self: { id: auth.session.userId, name: auth.session.fullName || "You", lang: auth.session.preferredLanguage || "en" },
      globalUsers: [],
      countries: [],
    });
  }
}
