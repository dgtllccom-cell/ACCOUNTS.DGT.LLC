const root = "http://localhost:3000";
const login = await fetch(`${root}/api/erp/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ identifier: "superadmin", password: "Admin@123" }),
});
const cookie = login.headers.get("set-cookie")?.split(";")[0];
if (!cookie) {
  console.error("No session cookie returned from login");
  process.exit(1);
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort("timeout"), 120000);
const started = Date.now();
try {
  const res = await fetch(`${root}/api/erp/kyc/reports`, {
    headers: { cookie },
    signal: controller.signal,
  });
  const body = await res.text();
  console.log(JSON.stringify({
    status: res.status,
    ms: Date.now() - started,
    body: body.slice(0, 4000),
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
    ms: Date.now() - started,
  }, null, 2));
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
