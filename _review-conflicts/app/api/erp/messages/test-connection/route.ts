import { NextRequest, NextResponse } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { testSmtpConnection } from "@/lib/email/smtp-client";
import { decrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = await request.json();
    const admin = createSupabaseAdminClient() as any;

    let smtpConfig: any = null;

    if (body.host) {
      smtpConfig = {
        host: body.host,
        port: Number(body.port),
        secure: Boolean(body.secure),
        auth: {
          user: body.user,
          pass: body.pass
        }
      };
    } else {
      const countryId = body.countryId || null;
      const countryBranchId = body.countryBranchId || null;
      const cityBranchId = body.cityBranchId || null;

      let emailAccount: any = null;

      // 1. Try city branch
      if (cityBranchId) {
        const acc = await admin
          .from("erp_email_accounts")
          .select("*, provider:erp_email_providers(*)")
          .eq("city_branch_id", cityBranchId)
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("is_default", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (acc.data) emailAccount = acc.data;
      }

      // 2. Try country branch
      if (!emailAccount && countryBranchId) {
        const acc = await admin
          .from("erp_email_accounts")
          .select("*, provider:erp_email_providers(*)")
          .eq("country_branch_id", countryBranchId)
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("is_default", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (acc.data) emailAccount = acc.data;
      }

      // 3. Try country
      if (!emailAccount && countryId) {
        const acc = await admin
          .from("erp_email_accounts")
          .select("*, provider:erp_email_providers(*)")
          .eq("country_id", countryId)
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("is_default", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (acc.data) emailAccount = acc.data;
      }

      // 4. Try global
      if (!emailAccount) {
        const acc = await admin
          .from("erp_email_accounts")
          .select("*, provider:erp_email_providers(*)")
          .eq("scope", "super_admin")
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("is_default", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (acc.data) emailAccount = acc.data;
      }

      let settings = emailAccount?.settings || {};

      if (!emailAccount && countryId) {
        const countryRes = await admin
          .from("countries")
          .select("id, name, official_email, email_server_settings")
          .eq("id", countryId)
          .maybeSingle();
        if (countryRes.data) {
          emailAccount = {
            email_address: countryRes.data.official_email,
            settings: countryRes.data.email_server_settings || {}
          };
          settings = countryRes.data.email_server_settings || {};
        }
      }

      const smtpPass = settings.smtpPass || settings.password || settings.appPassword || "";

      smtpConfig = {
        host: settings.smtpHost || (emailAccount?.email_address?.includes("gmail") ? "smtp.gmail.com" : "smtp.office365.com"),
        port: Number(settings.smtpPort || 465),
        secure: settings.smtpSecure !== undefined ? settings.smtpSecure : true,
        auth: {
          user: settings.smtpUser || emailAccount?.email_address || "",
          pass: decrypt(smtpPass)
        }
      };
    }

    if (!smtpConfig.host || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
      return NextResponse.json({
        success: false,
        error: "SMTP parameters missing. Please check that Host, Username, and Password are configured."
      }, { status: 400 });
    }

    try {
      await testSmtpConnection(smtpConfig);
      return apiOk({ success: true, message: "SMTP connection verified successfully!" });
    } catch (testErr: any) {
      return NextResponse.json({
        success: false,
        error: testErr.message || "Failed to establish SMTP connection."
      }, { status: 500 });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
