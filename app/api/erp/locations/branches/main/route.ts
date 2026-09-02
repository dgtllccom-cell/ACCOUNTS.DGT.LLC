import { NextResponse } from "next/server";
import { ErpAuthError, requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields } from "@/lib/i18n/localize-records";

const selectColumns =
  "id,country_id,name,code,local_currency,is_main,status,state_province_id,district_id,city_id,address,phone,email,created_at,updated_at";

export async function GET(request: Request) {
  try {
    const session = await requireErpSession();
    const url = new URL(request.url);
    const countryId = url.searchParams.get("countryId");

    const supabase = createSupabaseAdminClient() as any;
    let query = supabase
      .from("country_branches")
      .select(selectColumns)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (countryId) {
      if (!session.isSuperAdmin && !session.countryIds.includes(countryId)) {
        return NextResponse.json({ ok: true, data: { branches: [] } });
      }
      query = query.eq("country_id", countryId);
    } else if (!session.isSuperAdmin) {
      query = query.in(
        "country_id",
        session.countryIds.length ? session.countryIds : ["00000000-0000-0000-0000-000000000000"]
      );
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ ok: false, error: { message: error.message } }, { status: 500 });
    }

    // Branch names / addresses follow the active language (country_branches is a registered
    // translatable table); codes / currency / ids stay canonical.
    const lang = await getRequestLanguage(url.searchParams.get("lang") || url.searchParams.get("language"));
    const localized = await localizeRecordFields<any>(
      (data ?? []) as any[],
      "country_branches",
      ["name", "address"],
      lang,
    ).catch(() => data ?? []);

    return NextResponse.json({
      ok: true,
      data: {
        branches: (localized as any[]).map((branch: any) => ({
          ...branch,
          countryId: branch.country_id,
          localCurrency: branch.local_currency
        }))
      }
    });
  } catch (error) {
    if (typeof (error as any)?.digest === "string" && (error as any).digest.startsWith("NEXT_REDIRECT")) throw error;
    if (error instanceof ErpAuthError) {
      return NextResponse.json({ ok: false, error: { message: error.message } }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, error: { message: error instanceof Error ? error.message : "Server error" } },
      { status: 500 }
    );
  }
}
