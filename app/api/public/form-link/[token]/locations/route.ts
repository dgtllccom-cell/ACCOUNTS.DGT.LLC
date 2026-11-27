import { NextRequest, NextResponse } from "next/server";
import { externalLocationQuery, listExternalAddressChoices } from "@/lib/services/external-form-address";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordNames } from "@/lib/i18n/localize-records";

export const dynamic = "force-dynamic";
const noCache = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length > 128) return NextResponse.json({ ok: false }, { status: 404, headers: noCache });
  const q = request.nextUrl.searchParams;
  const query = externalLocationQuery.safeParse({
    kind: q.get("kind"), countryId: q.get("countryId"), stateProvinceId: q.get("stateProvinceId"),
  });
  if (!query.success) return NextResponse.json({ ok: false }, { status: 400, headers: noCache });

  try {
    const rows = await listExternalAddressChoices(token, query.data);
    if (!rows) return NextResponse.json({ ok: false }, { status: 404, headers: noCache });
    const lang = await getRequestLanguage(q.get("lang"));
    const table = query.data.kind === "country" ? "countries" : query.data.kind === "state" ? "states_provinces" : "cities";
    const localized = await localizeRecordNames(rows, table, "name", lang);
    const choices = localized.map(({ id, name, postalCode }) => ({ id, name, ...(query.data.kind === "city" ? { postalCode } : {}) }));
    return NextResponse.json({ ok: true, choices }, { headers: noCache });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: noCache });
  }
}
