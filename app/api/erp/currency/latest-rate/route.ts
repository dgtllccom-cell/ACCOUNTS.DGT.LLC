import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    // Enforce session before forwarding
    await requireErpSession();
    const body = await req.json();
    
    // Delegate to daily-rates POST logic
    const res = await fetch(new URL("/api/erp/currency/daily-rates", req.url).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "cookie": req.headers.get("cookie") || "" },
      body: JSON.stringify(body)
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    return NextResponse.json({ ok: false, error: err?.message || "Failed to update latest rate" }, { status: 400 });
  }
}

