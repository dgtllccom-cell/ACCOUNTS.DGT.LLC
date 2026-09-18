import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";
import * as crypto from "crypto";

export interface MailboxCreationRequest {
  emailAddress: string;
  displayName: string;
  purpose: "public_registration" | "entity_email";
  linkedEntityId?: string;
  linkedEntityType?: "country" | "branch" | "user" | "agent";
}

export interface MailboxCreationResult {
  success: boolean;
  emailAddress?: string;
  password?: string; // Only returned to client once, encrypted in DB
  error?: string;
}

/**
 * Create a real mailbox:
 * 1. Encrypt password
 * 2. Create database record
 * 3. Link to entity if applicable
 * 4. Provision on mail server (via API call)
 */
export async function createMailbox(
  req: MailboxCreationRequest
): Promise<MailboxCreationResult> {
  try {
    const admin = createSupabaseAdminClient() as any;
    const normalizedEmail = req.emailAddress.toLowerCase();

    // Check existence
    const { data: existing } = await admin
      .from("erp_email_accounts")
      .select("id")
      .eq("email_address", normalizedEmail)
      .single();

    if (existing) {
      return { success: false, error: "Email already exists" };
    }

    // Generate secure password
    const password = generateSecurePassword();
    const encryptedPassword = encrypt(password);

    // Get provider
    const { data: provider } = await admin
      .from("erp_email_providers")
      .select("id")
      .eq("domain", "dgt.llc")
      .single();

    if (!provider) {
      return { success: false, error: "Mail provider not configured" };
    }

    // Create database record
    const { data: mailbox, error: createError } = await admin
      .from("erp_email_accounts")
      .insert({
        provider_id: provider.id,
        email_address: normalizedEmail,
        display_name: req.displayName,
        scope: "global", // Public mailboxes are global
        is_active: true,
        imap_password_encrypted: encryptedPassword,
        smtp_password_encrypted: encryptedPassword,
        storage_quota_mb: req.purpose === "public_registration" ? 1000 : 5000,
        plan_type: req.purpose === "public_registration" ? "free" : "standard",
      })
      .select("id, email_address")
      .single();

    if (createError) {
      return { success: false, error: createError.message };
    }

    // Link to entity
    if (req.linkedEntityId && req.linkedEntityType) {
      const tableMap: Record<string, string> = {
        country: "countries",
        branch: "city_branches",
        user: "profiles",
        agent: "agents"
      };

      const table = tableMap[req.linkedEntityType];
      if (table) {
        await admin
          .from(table)
          .update({ email_account_id: mailbox.id })
          .eq("id", req.linkedEntityId);
      }
    }

    // Provision on mail server (webhook call)
    try {
      await fetch("http://localhost:3000/api/erp/mail-provisioning/maildir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailAddress: normalizedEmail,
          mailboxId: mailbox.id,
          password: password // Used only for initial provisioning
        })
      });
    } catch (err) {
      console.error("Mail server provisioning failed:", err);
      // Continue - database record created, mailbox will be provisioned later
    }

    // Audit
    await admin.from("erp_email_account_audit").insert({
      account_id: mailbox.id,
      action: "mailbox_created",
      notes: `Created for ${req.purpose}${req.linkedEntityId ? ` (${req.linkedEntityType})` : ""}`,
      new_values: {
        email_address: normalizedEmail,
        display_name: req.displayName,
        purpose: req.purpose,
        linked_entity: req.linkedEntityId
          ? { type: req.linkedEntityType, id: req.linkedEntityId }
          : null
      }
    });

    return {
      success: true,
      emailAddress: normalizedEmail,
      password: password // Return once to client for setup
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Generate a secure password
 * Requirements: 16+ chars, mixed case, numbers, symbols
 */
export function generateSecurePassword(): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";

  const all = upper + lower + numbers + symbols;
  let password = "";

  // Ensure at least one of each type
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Fill rest randomly
  for (let i = password.length; i < 20; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

/**
 * Check if email is available
 */
export async function checkEmailAvailable(email: string): Promise<boolean> {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("erp_email_accounts")
    .select("id")
    .eq("email_address", email.toLowerCase())
    .single();

  return !data;
}

/**
 * Suggest unique email from name
 */
export async function suggestEmail(baseName: string): Promise<string> {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, "")
      .substring(0, 32);

  let suggested = normalize(baseName) + "@dgt.llc";
  let counter = 1;

  while (!(await checkEmailAvailable(suggested))) {
    suggested = `${normalize(baseName)}${counter}@dgt.llc`;
    counter++;
  }

  return suggested;
}
