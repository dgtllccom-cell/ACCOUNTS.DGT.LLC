import { chromium } from "@playwright/test";

const baseURL = "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    await fetch("/api/erp/auth/preview", { method: "POST", credentials: "include" });
  });
  await page.waitForTimeout(500);

  const unique = `secure-doc-${Date.now()}`;
  const upload = await page.evaluate(async ({ unique }) => {
    const fd = new FormData();
    fd.append("title", `DEV TEST ${unique}`);
    fd.append("file_name", `${unique}.txt`);
    fd.append("file_type", "text/plain");
    fd.append("country_name", "Pakistan");
    fd.append("main_branch_name", "Quetta");
    fd.append("city_branch_name", "Quetta");
    fd.append("company_name", "DGT TEST COMPANY");
    fd.append("account_name", "DGT TEST ACCOUNT");
    fd.append("person_account_name", "DGT TEST PERSON");
    fd.append("person_account_type", "customer");
    fd.append("source_module", "Document Management");
    fd.append("source_record_id", unique);
    fd.append("source_record_no", unique);
    fd.append("document_type", "Phase 1");
    fd.append("category", "DEV TEST");
    fd.append("metadata", JSON.stringify({ scenario: "secure-storage-verification" }));
    fd.append("file", new File([new Blob([`hello ${unique}`], { type: "text/plain" })], `${unique}.txt`, { type: "text/plain" }));

    const res = await fetch("/api/documents", {
      method: "POST",
      credentials: "include",
      body: fd
    });
    const body = await res.json();
    return { status: res.status, body };
  }, { unique });

  const doc = upload.body?.document ?? null;
  const docId = doc?.id ?? null;
  const storageProvider = doc?.metadata?.storageProvider ?? null;
  const fileUrl = doc?.file_url ?? null;

  const lookup = await page.evaluate(async ({ unique }) => {
    const res = await fetch(`/api/documents?search=${encodeURIComponent(unique)}`, {
      credentials: "include"
    });
    const body = await res.json();
    return { status: res.status, body };
  }, { unique });

  let patch = null;
  let del = null;
  if (docId) {
    patch = await page.evaluate(async ({ docId, unique }) => {
      const res = await fetch("/api/documents", {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: docId, title: `DEV TEST ${unique} UPDATED` })
      });
      return { status: res.status, body: await res.json() };
    }, { docId, unique });

    del = await page.evaluate(async ({ docId }) => {
      const res = await fetch(`/api/documents?id=${encodeURIComponent(docId)}`, {
        method: "DELETE",
        credentials: "include"
      });
      return { status: res.status, body: await res.json() };
    }, { docId });
  }

  console.log(JSON.stringify({
    uploadStatus: upload.status,
    storageProvider,
    fileUrl,
    lookupStatus: lookup.status,
    lookupCount: lookup.body?.documents?.length ?? null,
    patchStatus: patch?.status ?? null,
    deleteStatus: del?.status ?? null,
    ok: upload.status === 200 && storageProvider === "supabase" && lookup.status === 200 && patch?.status === 200 && del?.status === 200
  }, null, 2));
} finally {
  await browser.close();
}
