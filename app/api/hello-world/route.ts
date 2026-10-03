import { NextResponse } from "next/server";

// Retired debug endpoint (RBAC audit 2026-10): it carried no authorization of its own. Kept as 404 like the other retired stubs.
export async function GET() {
  return new NextResponse("Not Found", { status: 404 });
}
