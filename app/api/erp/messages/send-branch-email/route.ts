import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendBranchEmail, getBranchEmailLogs } from "@/lib/email/titan-smtp-service";

export async function POST(request: Request) {
  try {
    const session = await requireErpSession();
    const body = await request.json();

    const { branchId, countryId, recipientEmail, recipientCustomerId, subject, bodyHtml, bodyText } = body;

    if (!branchId || !recipientEmail || !subject || !bodyHtml) {
      return NextResponse.json(
        { error: "Missing required fields: branchId, recipientEmail, subject, bodyHtml are required." },
        { status: 400 }
      );
    }

    // Role-based Multi-Tenant Security Checks
    if (!session.isSuperAdmin) {
      const allowedBranches = [...(session.cityBranchIds || []), ...(session.countryBranchIds || [])];
      if (allowedBranches.length > 0) {
        if (!allowedBranches.includes(branchId)) {
          return NextResponse.json(
            { error: "Access Denied: Branch Admin/Staff can send emails only from their assigned branch mailbox." },
            { status: 403 }
          );
        }
      } else if (session.countryIds && session.countryIds.length > 0) {
        if (countryId && !session.countryIds.includes(countryId)) {
          return NextResponse.json(
            { error: "Access Denied: Country Admin can send emails only for branches within their country." },
            { status: 403 }
          );
        }
      }
    }

    const supabase = createSupabaseAdminClient() as any;

    // Fetch the branch email for the given branchId
    let branchEmail = "";
    let resolvedCountryId = countryId || "";

    const { data: cityBranch } = await supabase
      .from("city_branches")
      .select("id, country_id, email, name")
      .eq("id", branchId)
      .maybeSingle();

    if (cityBranch?.email) {
      branchEmail = cityBranch.email;
      resolvedCountryId = resolvedCountryId || cityBranch.country_id;
    } else {
      const { data: countryBranch } = await supabase
        .from("country_branches")
        .select("id, country_id, email, name")
        .eq("id", branchId)
        .maybeSingle();

      if (countryBranch?.email) {
        branchEmail = countryBranch.email;
        resolvedCountryId = resolvedCountryId || countryBranch.country_id;
      }
    }

    if (!branchEmail) {
      return NextResponse.json(
        { error: "No Branch Email found for this branch. Please configure the Branch Email in Branch Setup first." },
        { status: 404 }
      );
    }

    // Dispatch email securely using Hostinger Titan Email SMTP
    const result = await sendBranchEmail({
      countryId: resolvedCountryId,
      branchId: branchId,
      senderUserId: session.userId,
      senderEmail: branchEmail,
      recipientEmail: recipientEmail,
      recipientCustomerId: recipientCustomerId || null,
      subject: subject,
      bodyHtml: bodyHtml,
      bodyText: bodyText
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Email delivery failed via Titan SMTP." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Email sent successfully from ${branchEmail} via Hostinger Titan SMTP.`,
      messageId: result.messageId,
      senderEmail: branchEmail
    });
  } catch (err: any) {
    console.error("[Send Branch Email API Error]:", err);
    return NextResponse.json({ error: err?.message || "Internal server error." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireErpSession();
    const url = new URL(request.url);

    const branchId = url.searchParams.get("branchId");
    const countryId = url.searchParams.get("countryId");
    const customerId = url.searchParams.get("customerId");
    const userId = url.searchParams.get("userId");

    const logs = await getBranchEmailLogs({
      session,
      branchId,
      countryId,
      customerId,
      userId,
      limit: 100
    });

    return NextResponse.json({ logs });
  } catch (err: any) {
    console.error("[Get Branch Email Logs API Error]:", err);
    return NextResponse.json({ error: err?.message || "Internal server error." }, { status: 500 });
  }
}
