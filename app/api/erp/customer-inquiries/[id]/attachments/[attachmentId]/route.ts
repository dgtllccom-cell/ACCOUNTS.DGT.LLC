import { NextRequest, NextResponse } from "next/server";
import { requireInquirySession, inquiryErrorResponse } from "@/lib/customer-inquiry/route-helpers";
import { getAttachmentUrl } from "@/lib/customer-inquiry/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string; attachmentId: string }> }) {
  const auth = await requireInquirySession();
  if ("response" in auth) return auth.response;
  try {
    const { id, attachmentId } = await ctx.params;
    const url = await getAttachmentUrl(auth.session, id, attachmentId);
    return NextResponse.redirect(url, 302);
  } catch (error) {
    return inquiryErrorResponse(error);
  }
}
