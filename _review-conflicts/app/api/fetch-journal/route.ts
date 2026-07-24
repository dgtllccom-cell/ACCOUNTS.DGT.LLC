import { NextResponse } from "next/server";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const apiUrl = `${url.origin}/api/erp/users/journal-report?limit=200`;
    
    // We will fetch the journal-report to see what it actually returns!
    // But we need to pass cookies
    const cookie = (await headers()).get("cookie") || "";
    
    const res = await fetch(apiUrl, {
      headers: { cookie }
    });
    
    const json = await res.json();
    return NextResponse.json(json);
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
