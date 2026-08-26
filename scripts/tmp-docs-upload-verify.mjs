import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const envPath = path.join(ROOT, ".env.local");
const envText = fs.readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const SESSION_SECRET = env.ERP_SESSION_SECRET;
if (!SESSION_SECRET) throw new Error("ERP_SESSION_SECRET missing from .env.local");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const COOKIE_NAME = "erp_session";
const LANG = process.env.LANG_CODE || "en";

const payload = {
  v: 1,
  kind: "temp",
  userId: "00000000-0000-4000-8000-000000000001",
  email: "superadmin@damaan.com",
  fullName: "Super Admin",
  roles: ["super_admin"],
  createdAt: Date.now()
};

const b64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
const sig = crypto.createHmac("sha256", SESSION_SECRET).update(b64).digest("base64url");

async function request(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Cookie", `${COOKIE_NAME}=${b64}.${sig}; erp_lang=${LANG}`);
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 180000;
  const timer = setTimeout(() => controller.abort(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs);
  try {
    return await fetch(url, { ...options, headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const uploadText = "DEV TEST document upload verification";
  const file = new File([uploadText], "docs-phase1-upload-verify.txt", { type: "text/plain" });
  const form = new FormData();
  form.set("title", "DEV TEST Document Phase 1 Upload");
  form.set("file_name", "docs-phase1-upload-verify.txt");
  form.set("file_type", "txt");
  form.set("file_size", String(Buffer.byteLength(uploadText)));
  form.set("country_id", "fb021716-a2e7-4141-9c1a-bd1ddd92eb14");
  form.set("country_name", "Pakistan");
  form.set("country_branch_id", "5269c1cb-92a1-4aa8-aad8-d4c7260badaa");
  form.set("main_branch_name", "Pakistan Main Branch");
  form.set("city_branch_id", "c7265408-2085-4e29-bcf2-1301eadc4e79");
  form.set("city_branch_name", "Quetta Main Branch");
  form.set("company_id", "9bba7c0b-457e-4e64-9010-0acc7ff0bca7");
  form.set("company_code", "1001001");
  form.set("company_name", "DAMAAN Trading Company LLC");
  form.set("account_id", "8322fb54-c24f-4314-a063-29a5a9e793cf");
  form.set("account_code", "ACC-000125");
  form.set("account_name", "Asmat");
  form.set("person_account_id", "08418e60-795f-4049-8769-5c8a66806b91");
  form.set("person_account_code", "CUS-0001");
  form.set("person_account_name", "Asmat");
  form.set("person_account_type", "customer");
  form.set("module_type", "Documents");
  form.set("document_type", "KYC Document");
  form.set("source_module", "general-office");
  form.set("source_record_id", "9bba7c0b-457e-4e64-9010-0acc7ff0bca7");
  form.set("source_record_no", "DEV-DOC-UP-001");
  form.set("document_path", "Documents/Pakistan/Quetta/DAMAAAN Trading Company LLC/Asmat/KYC Document");
  form.set("storage_key", "Documents/Pakistan/Quetta/dev-test/docs-phase1-upload-verify.txt");
  form.set("category", "General");
  form.set("tags", JSON.stringify(["DEV TEST", "upload"]));
  form.set("metadata", JSON.stringify({ source: "phase1", scanMode: "upload", language: LANG }));
  form.set("created_by", "Super Admin");
  form.set("scanner_device_name", "DEV SCANNER");
  form.set("scanner_bridge", "LOCAL BRIDGE");
  form.set("file", file);

  const postRes = await request(`${BASE}/api/documents`, {
    method: "POST",
    body: form,
    timeoutMs: 300000
  });
  const postText = await postRes.text();
  console.log("POST_STATUS", postRes.status, "CONTENT_TYPE", postRes.headers.get("content-type"));
  console.log("POST_BODY", postText.slice(0, 4000));
  if (!postRes.ok) throw new Error(`POST failed: ${postRes.status}`);

  const postJson = JSON.parse(postText);
  const doc = postJson.document;
  if (!doc?.id) throw new Error("No document id returned");

  const getRes = await request(`${BASE}/api/documents?sourceRecordId=9bba7c0b-457e-4e64-9010-0acc7ff0bca7`, { timeoutMs: 300000 });
  const getText = await getRes.text();
  console.log("GET_STATUS", getRes.status, "CONTENT_TYPE", getRes.headers.get("content-type"));
  console.log("GET_BODY", getText.slice(0, 2000));
  if (!getRes.ok) throw new Error(`GET failed: ${getRes.status}`);

  const deleteRes = await request(`${BASE}/api/documents?id=${encodeURIComponent(doc.id)}`, {
    method: "DELETE",
    timeoutMs: 300000
  });
  const deleteText = await deleteRes.text();
  console.log("DELETE_STATUS", deleteRes.status, deleteText.slice(0, 2000));
  if (!deleteRes.ok) throw new Error(`DELETE failed: ${deleteRes.status}`);

  console.log("DOCS UPLOAD VERIFY OK", doc.id);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
