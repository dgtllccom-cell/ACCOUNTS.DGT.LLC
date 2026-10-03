import { NextResponse } from "next/server";

// Retired (2026-10): the "template preview" cookie let an anonymous visitor render the ERP shell without a session.
export async function POST() {
  return new NextResponse("Not Found", { status: 404 });
}
