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

async function testMailbox(email: string, password: string) {
  try {
    const imap = new ImapFlow({
      host: "imap.titan.email",
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
    });
    await imap.connect();
    await imap.logout();
    
    const transporter = nodemailer.createTransport({
      host: "smtp.titan.email",
      port: 465,
      secure: true,
      auth: { user: email, pass: password },
    });
    await transporter.verify();
    
    return { email, status: "PASS" };
  } catch (err: any) {
    return { email, status: "FAIL", error: err.message };
  }
}

// Test Dubai and Chaman with hardcoded encrypted values from DB
const mailboxes = [
  { email: "dubai@dgt.llc", encrypted: "f06fd2f908ed4b0daf2189fb4d8ec5cf:7d0453e055faed9edcc2d79c1d295c66" },
  { email: "chaman@dgt.llc", encrypted: "f06fd2f908ed4b0daf2189fb4d8ec5cf:7d0453e055faed9edcc2d79c1d295c66" }
];

(async () => {
  console.log("Testing Dubai & Chaman...");
  for (const mb of mailboxes) {
    const pwd = decrypt(mb.encrypted);
    const result = await testMailbox(mb.email, pwd);
    console.log(JSON.stringify(result));
  }
})();
