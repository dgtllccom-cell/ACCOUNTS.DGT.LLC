/**
 * Honest delivery for Customer Auto-Reply.
 *
 * Credentials are resolved from (in order):
 *   1. `resolveMailboxAccount()` — the same encrypted `erp_email_accounts`
 *      columns (`smtp_password_encrypted`) the corporate mailboxes and Titan
 *      integration use, so a real mailbox linked to the from-address works
 *      here exactly as it does everywhere else in the ERP.
 *   2. the country's `email_server_settings` (legacy fallback for countries
 *      with no linked `erp_email_accounts` row yet),
 *   3. `process.env.SMTP_*`.
 *
 * If none of those yield a usable host + user + pass, we DO NOT pretend the
 * reply was sent. The caller records the message with status `no_channel`
 * (nothing to deliver through) or `failed` (channel exists, transport errored),
 * never `sent`. WhatsApp has no configured provider in this deployment, so a
 * WhatsApp reply is always `no_channel` until one is wired.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmailDirect } from "@/lib/email/smtp-client";
import { resolveMailboxAccount } from "@/lib/email/resolve-mailbox-account";
import { resolveCountryEmailConfig } from "@/lib/email/country-email-config";
import { decrypt } from "@/lib/crypto";

export type ReplyChannel = "email" | "whatsapp";

export type CustomerReplyDelivery = {
  status: "sent" | "failed" | "no_channel";
  channel: ReplyChannel;
  /** Human-readable reason when not sent. Safe to store + show to operators. */
  detail: string | null;
  /** The from-address actually used (email only). */
  fromEmail: string | null;
};

type SendArgs = {
  channel: ReplyChannel;
  countryId: string | null;
  toEmail: string | null;
  toWhatsapp: string | null;
  subject: string;
  /** Plain-text body; newlines become <br> for the HTML part. */
  body: string;
  /** RTL languages get dir="rtl" on the HTML wrapper. */
  rtl: boolean;
};

function pick(...vals: Array<string | null | undefined>): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function htmlWrap(body: string, rtl: boolean): string {
  const esc = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  const dir = rtl ? "rtl" : "ltr";
  const align = rtl ? "right" : "left";
  return `<div dir="${dir}" style="text-align:${align};font-family:Arial,Tahoma,sans-serif;font-size:14px;line-height:1.7;color:#0f172a;white-space:normal">${esc}</div>`;
}

export async function sendCustomerReply(args: SendArgs): Promise<CustomerReplyDelivery> {
  if (args.channel === "whatsapp") {
    return {
      status: "no_channel",
      channel: "whatsapp",
      detail:
        "No WhatsApp Business provider is configured for this deployment. " +
        "The reply is saved and can be sent once a provider is connected.",
      fromEmail: null,
    };
  }

  const to = (args.toEmail || "").trim();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return {
      status: "failed",
      channel: "email",
      detail: "The customer has no valid email address on file.",
      fromEmail: null,
    };
  }

  const admin = createSupabaseAdminClient();

  // Country row (for from-address + server settings).
  let country: Record<string, any> | null = null;
  if (args.countryId) {
    const { data } = await admin
      .from("countries")
      .select("id, name, iso2, official_email, admin_email, email_domain, email_server_settings")
      .eq("id", args.countryId)
      .maybeSingle();
    country = data ?? null;
  }

  const emailConfig = resolveCountryEmailConfig(country as any, {});
  const fromEmail = pick(emailConfig.fromEmail, country?.official_email, process.env.SMTP_USER, process.env.SMTP_FROM);
  const fromName = pick(emailConfig.fromName, emailConfig.officeName, "Digital Dock ERP");

  // Preferred credential source: the real, encrypted mailbox record — same
  // resolver the corporate mailboxes and Titan integration use.
  const resolved = fromEmail ? await resolveMailboxAccount(fromEmail) : null;
  const countrySettings = (country?.email_server_settings ?? {}) as Record<string, any>;

  const host = pick(resolved?.smtpHost, countrySettings.smtpHost, process.env.SMTP_HOST);
  const portRaw = pick(
    resolved?.smtpPort != null ? String(resolved.smtpPort) : "",
    countrySettings.smtpPort != null ? String(countrySettings.smtpPort) : "",
    process.env.SMTP_PORT || "",
  );
  const port = Number(portRaw || 465);
  const secure = resolved ? resolved.smtpSecure : port === 465;
  const user = pick(resolved?.smtpUser, countrySettings.smtpUser, process.env.SMTP_USER, fromEmail);
  let pass = resolved?.smtpPass || "";
  if (!pass && countrySettings.smtpPass) {
    try {
      pass = decrypt(countrySettings.smtpPass);
    } catch {
      // legacy country settings held a non-encrypted value — use as-is
      pass = countrySettings.smtpPass;
    }
  }
  if (!pass) pass = process.env.SMTP_PASS || "";

  const missing: string[] = [];
  if (!host) missing.push("SMTP host");
  if (!user) missing.push("SMTP username / from-address");
  if (!pass) missing.push("SMTP password");
  if (!fromEmail) missing.push("from-address");

  if (missing.length > 0) {
    return {
      status: "no_channel",
      channel: "email",
      detail:
        "No email channel is configured for this scope (missing: " +
        missing.join(", ") +
        "). The reply is saved; it will send once an email account is connected.",
      fromEmail: fromEmail || null,
    };
  }

  try {
    await sendEmailDirect(
      {
        host,
        port,
        secure,
        auth: { user, pass },
      },
      {
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject: args.subject,
        text: args.body,
        html: htmlWrap(args.body, args.rtl),
      },
    );
    return { status: "sent", channel: "email", detail: null, fromEmail };
  } catch (err: any) {
    return {
      status: "failed",
      channel: "email",
      detail: `SMTP delivery failed: ${err?.message || "unknown error"}`,
      fromEmail,
    };
  }
}
