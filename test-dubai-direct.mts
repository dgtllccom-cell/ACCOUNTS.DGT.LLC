import { createClient } from "@supabase/supabase-js";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import * as crypto from "crypto";

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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

(async () => {
  const { data: dubai } = await supabase
    .from("erp_email_accounts")
    .select("imap_password_encrypted")
    .eq("email_address", "dubai@dgt.llc")
    .single();

  if (!dubai?.imap_password_encrypted) {
    console.error("❌ Dubai password not found");
    return;
  }

  const pwd = decrypt(dubai.imap_password_encrypted);
  if (!pwd) {
    console.error("❌ Cannot decrypt Dubai password");
    return;
  }

  console.log("Testing Dubai with decrypted password from database...");
  console.log("Email: dubai@dgt.llc");
  console.log("Password length: " + pwd.length);

  try {
    console.log("\n1. Testing IMAP...");
    const imap = new ImapFlow({
      host: "imap.titan.email",
      port: 993,
      secure: true,
      auth: { user: "dubai@dgt.llc", pass: pwd },
    });
    await imap.connect();
    console.log("✅ IMAP authenticated successfully");
    await imap.logout();
    console.log("✅ IMAP logout successful");

    console.log("\n2. Testing SMTP...");
    const transporter = nodemailer.createTransport({
      host: "smtp.titan.email",
      port: 465,
      secure: true,
      auth: { user: "dubai@dgt.llc", pass: pwd },
    });
    await transporter.verify();
    console.log("✅ SMTP verified successfully");

    console.log("\n✅ DUBAI: ALL TESTS PASSED");
  } catch (err: any) {
    console.error("\n❌ Dubai test failed:", err.message);
    if (err.response) console.error("Response:", err.response);
  }
})();
