import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";
import * as crypto from "crypto";

export interface MailboxCreationRequest {
  emailAddress: string;
  displayName: string;
  purpose: "public_registration" | "entity_email";
  linkedEntityId?: string;
  linkedEntityType?: "country" | "main_branch" | "city_branch" | "branch" | "user" | "agent";
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
    let { data: provider } = await admin
      .from("erp_email_providers")
      .select("id")
      .eq("domain", "dgt.llc")
      .maybeSingle();

    if (!provider) {
      const { data: newProv } = await admin
        .from("erp_email_providers")
        .insert({
          name: "DGT Mail",
          domain: "dgt.llc",
          imap_host: "mail.dgt.llc",
          imap_port: 993,
          imap_secure: true,
          smtp_host: "mail.dgt.llc",
          smtp_port: 587,
          smtp_secure: true,
          is_active: true
        })
        .select("id")
        .single();
      provider = newProv;
    }

    // Create database record
    const { data: mailbox, error: createError } = await admin
      .from("erp_email_accounts")
      .insert({
        provider_id: provider.id,
        email_address: normalizedEmail,
        display_name: req.displayName,
        scope: "country", // Public mailboxes scoped to country
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
        main_branch: "country_branches",
        city_branch: "city_branches",
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

    // Sync with public_mail_users for Webmail access
    try {
      const username = normalizedEmail.replace(/@dgt\.llc$/, "");
      const { hashPassword } = await import("@/lib/public-mail/crypto");
      const passwordHash = hashPassword(password);
      
      const { data: existingUser } = await admin
        .from("public_mail_users")
        .select("id")
        .eq("username", username)
        .single();

      if (!existingUser) {
        await admin.from("public_mail_users").insert({
          username,
          domain: "dgt.llc",
          password_hash: passwordHash,
          display_name: req.displayName,
          plan_id: "pro_10gb",
          quota_bytes: 5368709120, // 5GB default
          used_bytes: 0,
          status: "active",
        });
      }
    } catch (syncErr) {
      console.warn("Sync to public_mail_users skipped/failed:", syncErr);
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
