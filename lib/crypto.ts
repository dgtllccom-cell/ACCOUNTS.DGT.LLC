import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "dgt_default_secret_encryption_key_32_bytes"; // must be 32 chars
const IV_LENGTH = 16; // For AES, this is always 16

export function encrypt(text: string): string {
  if (!text) return "";
  // Pad/slice key to exactly 32 bytes
  const key = Buffer.concat([Buffer.from(ENCRYPTION_KEY), Buffer.alloc(32)], 32);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decrypt(text: string): string {
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
    console.error("Decryption failed:", error);
    return text; // fallback to plain if it wasn't encrypted or failed
  }
}
