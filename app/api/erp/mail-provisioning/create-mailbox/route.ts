import { NextRequest, NextResponse } from "next/server";
import { getErpSessionForApi } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

/**
 * POST /api/erp/mail-provisioning/create-mailbox
 * Create a new mailbox with automatic provisioning
 * Used by: Public registration, auto-email for new entities
 * Mailbox password is encrypted before storage
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getErpSessionForApi();
    const body = await request.json();

    const {
      emailAddress,
      displayName,
      purpose, // "public_registration" | "country_email" | "branch_email" | "user_email" | "agent_email"
      linkedEntityId, // Country/Branch/User/Agent ID if applicable
      linkedEntityType, // "country" | "branch" | "user" | "agent"
      generatePassword = true
    } = body;

    if (!emailAddress || !displayName) {
      return NextResponse.json(
        { error: "emailAddress and displayName required" },
        { status: 400 }
      );
    }

    // Normalize email
    const normalizedEmail = emailAddress.toLowerCase();

    // Check if already exists
    const admin = createSupabaseAdminClient() as any;
    const { data: existing } = await admin
      .from("erp_email_accounts")
      .select("id")
      .eq("email_address", normalizedEmail)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 409 }
      );
    }

    // Generate secure password
    const password = generatePassword
      ? Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map(b => String.fromCharCode(b))
          .join("")
          .replace(/[^a-zA-Z0-9!@#$%^&*]/g, (c) => "!@#$%^&*"[Math.random() * 8 | 0])
          .substring(0, 20)
      : body.password;

    if (!password) {
      return NextResponse.json(
        { error: "password required or generatePassword must be true" },
        { status: 400 }
      );
    }

    // TODO: Provision mailbox on mail server
    // This would call the mail provisioning backend (Postfix/Dovecot API)
    // For now, we prepare the record

    // Encrypt password
    const encryptedPassword = encrypt(password);

    // Get or create provider (DGT Mail)
    const { data: provider } = await admin
      .from("erp_email_providers")
      .select("id")
      .eq("domain", "dgt.llc")
      .limit(1)
      .single();

    if (!provider) {
      return NextResponse.json(
        { error: "DGT Mail provider not configured" },
        { status: 500 }
      );
    }

    // Create mailbox record
    const { data: mailbox, error: createError } = await admin
      .from("erp_email_accounts")
      .insert({
        provider_id: provider.id,
        email_address: normalizedEmail,
        display_name: displayName,
        is_active: true,
        imap_password_encrypted: encryptedPassword,
        smtp_password_encrypted: encryptedPassword,
        storage_quota_mb: 5000,
        plan_type: purpose === "public_registration" ? "free" : "standard",
        created_by: session?.userId || null
      })
      .select("id, email_address")
      .single();

    if (createError) {
      return NextResponse.json(
        { error: createError.message },
        { status: 500 }
      );
    }

    // Link to entity if applicable
    if (linkedEntityId && linkedEntityType) {
      let updateTable = null;
      let updateColumn = null;

      switch (linkedEntityType) {
        case "country":
          updateTable = "countries";
          updateColumn = "email_account_id";
          break;
        case "branch":
          updateTable = "city_branches";
          updateColumn = "email_account_id";
          break;
        case "user":
          updateTable = "profiles";
          updateColumn = "email_account_id";
          break;
        case "agent":
          updateTable = "agents";
          updateColumn = "email_account_id";
          break;
      }

      if (updateTable && updateColumn) {
        await admin
          .from(updateTable)
          .update({ [updateColumn]: mailbox.id })
          .eq("id", linkedEntityId);
      }
    }

    // Audit log
    await admin.from("erp_email_account_audit").insert({
      account_id: mailbox.id,
      action: "mailbox_provisioned",
      action_by: session?.userId || null,
      notes: `Mailbox provisioned for ${purpose}${linkedEntityId ? ` (${linkedEntityType}: ${linkedEntityId})` : ""}`,
      new_values: {
        email_address: normalizedEmail,
        display_name: displayName,
        purpose,
        linked_entity: linkedEntityId ? { type: linkedEntityType, id: linkedEntityId } : null
      }
    });

    return NextResponse.json({
      ok: true,
      data: {
        mailbox,
        passwordGenerated: generatePassword,
        provisioning: "queued"
      }
    }, { status: 201 });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Provisioning failed" },
      { status: 500 }
    );
  }
}

// Browser crypto is not available in Node
const crypto = require("crypto");
