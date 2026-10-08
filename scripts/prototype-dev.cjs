const { spawn } = require("node:child_process");

process.env.DGT_PROTOTYPE_MODE = "1";
process.env.NEXT_PUBLIC_DGT_PROTOTYPE_MODE = "1";
process.env.APP_ENV = "development";
process.env.NEXT_PUBLIC_APP_ENV = "development";
process.env.ALLOW_DEMO_AUTH = "true";

// Deliberately blank database endpoints in the prototype process.
// The prototype branch supplies local no-write clients instead.
delete process.env.DATABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
delete process.env.SUPABASE_SECRET_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(npm, ["run", "dev"], {
  stdio: "inherit",
  env: process.env,
  shell: false,
});
child.on("exit", (code) => process.exit(code ?? 0));
