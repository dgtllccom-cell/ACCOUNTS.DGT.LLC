/* eslint-disable no-console */
// HTTP-only verification (no real browser) to confirm routes render and key UI strings exist.

function pickSetCookie(res) {
  // Node fetch (undici) exposes set-cookie in a non-standard way sometimes.
  const anyHeaders = res.headers;
  if (typeof anyHeaders.getSetCookie === "function") {
    const list = anyHeaders.getSetCookie();
    return Array.isArray(list) ? list.join(", ") : String(list || "");
  }
  return res.headers.get("set-cookie") || "";
}

function cookieHeaderFromSetCookie(setCookie) {
  if (!setCookie) return "";
  // take first cookie only; ERP session should be first.
  const first = setCookie.split(",")[0];
  return first.split(";")[0];
}

async function getText(url, cookie) {
  const res = await fetch(url, {
    headers: cookie ? { cookie } : undefined,
    redirect: "manual"
  });
  const text = await res.text();
  return { status: res.status, text, headers: res.headers };
}

async function main() {
  const base = process.env.ERP_BASE_URL || "http://localhost:3000";

  // Login to get cookie
  const loginRes = await fetch(`${base}/api/erp/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ identifier: "superadmin", password: "admin123" }).toString(),
    redirect: "manual"
  });
  const setCookie = pickSetCookie(loginRes);
  const cookie = cookieHeaderFromSetCookie(setCookie);
  console.log("login_status", loginRes.status);
  console.log("cookie_set", Boolean(cookie));

  // Session API
  const session = await fetch(`${base}/api/erp/auth/session`, { headers: cookie ? { cookie } : undefined });
  console.log("session_status", session.status);
  const sessionJson = await session.json().catch(() => null);
  console.log("session_json", sessionJson);

  async function check(path, expectations) {
    const { status, text } = await getText(`${base}${path}`, cookie);
    const result = { path, status };
    for (const [key, needle, should] of expectations) {
      result[key] = should ? text.includes(needle) : !text.includes(needle);
    }
    console.log(JSON.stringify(result));
    return { status, text };
  }

  const reg = await check("/dashboard/new-entry/users/registration", [
    ["has_select_permissions", "Select Permissions", true],
    ["no_company_name_label", "Company Name</label>", false]
  ]);
  if (reg.text.includes("Company Name")) {
    const idx = reg.text.indexOf("Company Name");
    console.log("registration_company_name_snippet", reg.text.slice(Math.max(0, idx - 80), idx + 120).replace(/\\s+/g, " "));
  }

  await check("/dashboard/roznamcha/cash-entry", [
    ["has_title", "Roznamcha Entry Payment", true],
    ["has_company_picker", "Company", true]
  ]);

  await check("/dashboard/new-entry/branches/super-admin", [
    ["has_zip", "Zip Code", true],
    ["has_full_address", "Full Address", true]
  ]);

  await check("/dashboard/new-entry/branch-entry/country-branch", [
    ["has_zip", "Zip / Postal Code", true],
    ["has_full_address", "Full Address", true]
  ]);

  await check("/dashboard/new-entry/branch-entry/city-branch", [
    ["has_zip", "Zip / Postal Code", true],
    ["has_full_address", "Full Address", true]
  ]);

  // Roznamcha validate call (no DB write)
  // Try to find a real branch scope so validate passes branch-scope rules.
  const countriesRes = await fetch(`${base}/api/erp/locations/countries`, { headers: cookie ? { cookie } : undefined });
  const countriesJson = await countriesRes.json().catch(() => null);
  const countryList =
    (Array.isArray(countriesJson?.countries) && countriesJson.countries) ||
    (Array.isArray(countriesJson?.data?.countries) && countriesJson.data.countries) ||
    (Array.isArray(countriesJson?.data) && countriesJson.data) ||
    [];
  const firstCountryId = countryList[0]?.id || null;
  console.log("countries_status", countriesRes.status, "firstCountryId", firstCountryId, "countries_shape", Object.keys(countriesJson || {}));

  let scope = { countryId: null, countryBranchId: null, cityBranchId: null };
  if (firstCountryId) {
    const mainsRes = await fetch(`${base}/api/branch-management/country-branches?countryId=${encodeURIComponent(firstCountryId)}`, {
      headers: cookie ? { cookie } : undefined
    });
    const mainsJson = await mainsRes.json().catch(() => null);
    const main = Array.isArray(mainsJson?.countryBranches) ? mainsJson.countryBranches.find((b) => b?.is_main) : null;
    console.log("main_branches_status", mainsRes.status, "hasMain", Boolean(main?.id));
    if (main?.id) {
      const cityRes = await fetch(
        `${base}/api/branch-management/city-branches?countryId=${encodeURIComponent(firstCountryId)}&countryBranchId=${encodeURIComponent(main.id)}`,
        { headers: cookie ? { cookie } : undefined }
      );
      const cityJson = await cityRes.json().catch(() => null);
      const firstCity = Array.isArray(cityJson?.cityBranches) ? cityJson.cityBranches[0] : null;
      console.log("city_branches_status", cityRes.status, "hasCity", Boolean(firstCity?.id));
      if (firstCity?.id) {
        scope = { countryId: firstCountryId, countryBranchId: main.id, cityBranchId: firstCity.id };
      }
    }
  }

  const validateRes = await fetch(`${base}/api/erp/roznamcha`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({
      mode: "validate",
      type: "branch",
      entryDate: "2026-05-24",
      journalNo: "TEST-JRN-VALIDATE",
      voucherNo: "TEST-VCH-VALIDATE",
      narration: "validate only",
      ...scope,
      lines: [
        {
          accountId: "00000000-0000-0000-0000-000000000000",
          ledgerId: null,
          debit: 100,
          credit: 0,
          currency: "USD",
          exchangeRate: 1,
          paymentEntryType: "cash_payment"
        },
        {
          accountId: "00000000-0000-0000-0000-000000000000",
          ledgerId: null,
          debit: 0,
          credit: 100,
          currency: "USD",
          exchangeRate: 1,
          paymentEntryType: "cash_payment"
        }
      ]
    })
  });
  const validateJson = await validateRes.json().catch(() => null);
  console.log("roznamcha_validate_status", validateRes.status);
  console.log("roznamcha_validate_response", validateJson);

  // Also validate Super Admin roznamcha (should not require branch scope).
  const validateSuperRes = await fetch(`${base}/api/erp/roznamcha`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({
      mode: "validate",
      type: "super_admin",
      entryDate: "2026-05-24",
      journalNo: "TEST-SUPER-JRN-VALIDATE",
      voucherNo: "TEST-SUPER-VCH-VALIDATE",
      narration: "validate only (super admin)",
      countryId: null,
      countryBranchId: null,
      cityBranchId: null,
      lines: [
        {
          accountId: "00000000-0000-0000-0000-000000000000",
          ledgerId: null,
          debit: 100,
          credit: 0,
          currency: "USD",
          exchangeRate: 1,
          paymentEntryType: "cash_payment"
        },
        {
          accountId: "00000000-0000-0000-0000-000000000000",
          ledgerId: null,
          debit: 0,
          credit: 100,
          currency: "USD",
          exchangeRate: 1,
          paymentEntryType: "cash_payment"
        }
      ]
    })
  });
  const validateSuperJson = await validateSuperRes.json().catch(() => null);
  console.log("roznamcha_validate_super_status", validateSuperRes.status);
  console.log("roznamcha_validate_super_response", validateSuperJson);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
