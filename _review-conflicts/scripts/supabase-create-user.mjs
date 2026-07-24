import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

const email = (process.argv[2] || "").trim();
const password = (process.argv[3] || "").trim();

if (!email || !password) {
  console.error("Usage: node scripts/supabase-create-user.mjs <email> <password>");
  process.exit(1);
}

if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error("NEXT_PUBLIC_SUPABASE_URL is missing in .env.local");
  process.exit(1);
}

if (!secretKey) {
  console.error("SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is missing in .env.local");
  process.exit(1);
}

const admin = createClient(supabaseUrl, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

try {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (error) {
    console.error(`Failed to create user: ${error.message}`);
    process.exit(1);
  }

  console.log(`Created user: ${data.user?.id ?? "unknown"}`);
} catch (error) {
  console.error("Failed to create user:");
  console.error(error?.message || error);
  process.exit(1);
}

