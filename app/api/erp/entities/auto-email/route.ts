import { NextRequest, NextResponse } from "next/server";
import { provisionEntityEmail } from "@/lib/mail-provisioning/entity-auto-email";

/**
 * POST /api/erp/entities/auto-email
 * Provision auto-email for Country/Branch/User/Agent after entity creation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entityType, entityId, entityData, shouldCreate } = body;

    if (!entityType || !entityId || !entityData) {
      return NextResponse.json(
        { error: "entityType, entityId, entityData required" },
        { status: 400 }
      );
    }

    const result = await provisionEntityEmail(
      entityType as "country" | "branch" | "user" | "agent",
      entityId,
      entityData,
      shouldCreate === true
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Provisioning failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        emailAddress: result.emailAddress,
        entityId,
        entityType,
        provisioned: true
      }
    }, { status: 201 });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
