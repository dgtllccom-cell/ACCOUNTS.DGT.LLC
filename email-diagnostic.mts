import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "dgt_default_secret_encryption_key_32_bytes";

function decrypt(text: string): string {
  if (!text) return "";
  try {
    const parts = text.split(":");
    const ivHex = parts.shift();
    if (!ivHex) return "";
    const iv = Buffer.from(ivHex, "hex");
    const encryptedText = Buffer.from(parts.join(":"), "hex");
    const key = Buffer.concat([Buffer.from(ENCRYPTION_KEY), Buffer.alloc(32)], 32);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    return "";
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  const { data: accounts } = await supabase
    .from("erp_email_accounts")
    .select("email_address, imap_password_encrypted, last_connection_status")
    .order("email_address");

  console.log("\n📧 Email Accounts in Database:");
  console.log("════════════════════════════════════════════");
  
  accounts?.forEach(acc => {
    const pwd = decrypt(acc.imap_password_encrypted);
    const encrypted_preview = acc.imap_password_encrypted?.substring(0, 30) + "...";
    console.log(`${acc.email_address}:`);
    console.log(`  Encrypted: ${encrypted_preview}`);
    console.log(`  Decrypts:  ${pwd ? "✓ YES" : "✗ NO"}`);
    console.log(`  DB Status: ${acc.last_connection_status}`);
  });
  
  console.log("\n════════════════════════════════════════════");
  console.log("✅ Diagnostic complete. Check which mailboxes have decryptable passwords.");
})();
