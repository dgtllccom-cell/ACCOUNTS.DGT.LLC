import { NextRequest, NextResponse } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { testSmtpConnection } from "@/lib/email/smtp-client";
import { resolveMailboxAccount } from "@/lib/email/resolve-mailbox-account";
import { decrypt } from "@/lib/crypto";
import { canAccessCityBranch } from "@/lib/permissions/middleware";

export const dynamic = "force-dynamic";

function safeDecrypt(value: string): string {
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = await request.json();
    const admin = createSupabaseAdminClient() as any;

    let smtpConfig: any = null;

    // The branch wizard submits unsaved values under `settings`; never silently
    // replace them with country/global defaults when testing this form.
    if (body.host || body.settings) {
      const settings = body.settings;
      smtpConfig = {
        host: settings ? settings.smtpHost : body.host,
        port: Number(settings ? settings.smtpPort : body.port),
        secure: settings ? settings.smtpSecure : Boolean(body.secure),
        auth: {
          user: settings ? settings.smtpUser : body.user,
          pass: settings ? settings.smtpPass : body.pass
        }
      };

      // Passwords are not returned to the edit form. Reuse only the saved
      // credential for this exact branch and mailbox when the field is blank.
      if (settings && !smtpConfig.auth.pass && body.cityBranchId) {
        if (!canAccessCityBranch(session, body.cityBranchId)) {
          return NextResponse.json({ success: false, error: "Branch access denied." }, { status: 403 });
        }
        const { data: account, error } = await admin
          .from("erp_email_accounts")
          .select("id")
          .eq("city_branch_id", body.cityBranchId)
          .eq("email_address", smtpConfig.auth.user)
          .eq("is_active", true)
          .is("deleted_at", null)
          .maybeSingle();
        if (error) throw error;
        const saved = account ? await resolveMailboxAccount(account.id) : null;
        smtpConfig.auth.pass = saved?.smtpPass || "";
      }
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

      // Real, encrypted mailbox record takes priority — same resolver the
      // corporate mailboxes/Titan integration use — before falling back to
      // the legacy `settings` JSON (which the real mailboxes don't populate).
      const resolved = emailAccount?.id ? await resolveMailboxAccount(emailAccount.id) : null;
      const smtpPass = settings.smtpPass || settings.password || settings.appPassword || "";

      smtpConfig = {
        host: resolved?.smtpHost || settings.smtpHost || (emailAccount?.email_address?.includes("gmail") ? "smtp.gmail.com" : "smtp.office365.com"),
        port: Number(resolved?.smtpPort || settings.smtpPort || 465),
        secure: resolved ? resolved.smtpSecure : (settings.smtpSecure !== undefined ? settings.smtpSecure : true),
        auth: {
          user: resolved?.smtpUser || settings.smtpUser || emailAccount?.email_address || "",
          pass: resolved?.smtpPass || safeDecrypt(smtpPass)
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
