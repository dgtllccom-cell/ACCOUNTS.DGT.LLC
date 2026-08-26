import { NextRequest, NextResponse } from "next/server";
import { setTempAgentSession } from "@/lib/auth/temp-session";

// DEV-ONLY: creates a fake clearing-agent temp session for E2E scope isolation testing.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  // which=a -> Pakistan city (SHIP-A-01/02), which=b -> UAE city (SHIP-B-01/02)
  const which = params.get("which") ?? "a";

  const cityBranchId = which === "b"
    ? "b5e94645-05c1-4420-8ecb-141ca7d84f12"
    : "322351af-732f-4351-a89b-ba34cfe598cf";

  const countryId = which === "b"
    ? "935dd0b9-8228-43b3-b53d-c06e9ae2882f"
    : "fb021716-a2e7-4141-9c1a-bd1ddd92eb14";

  await setTempAgentSession({
    userId: "00000000-0000-4000-8000-000000000091",
    email: "dev-ship-agent-" + which + "@test.local",
    fullName: "DEV Ship Agent " + which.toUpperCase(),
    roles: ["agent_user"],
    assignments: [
      {
        role: "agent_user",
        countryId,
        countryBranchId: null,
        cityBranchId,
        clearingAgentId: "00000000-0000-4000-8000-0000000000c1",
        ledgerVisibility: "shipping_only"
      }
    ],
    remember: false
  });

  const redirectTo = params.get("redirect") ?? "/dashboard/smart-due";
  return NextResponse.redirect(new URL(redirectTo, request.url));
}
