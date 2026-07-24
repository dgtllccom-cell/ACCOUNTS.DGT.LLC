import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const res = await fetch("http://localhost:3000/api/erp/debug/fix-roznamcha2");
  const text = await res.text();
  return new NextResponse(text, { status: 200, headers: { "Content-Type": "text/html" } });
}
