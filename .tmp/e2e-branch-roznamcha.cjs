/* eslint-disable no-console */
// End-to-end test:
// 1) Ensure Pakistan has a city branch (Quetta) under its main branch
// 2) Create two enterprise accounts + ledgers for that city branch
// 3) Validate + Post a Branch Roznamcha entry (cash payment) and confirm it is persisted

function pickSetCookies(res) {
  const h = res.headers;
  if (typeof h.getSetCookie === "function") {
    const list = h.getSetCookie();
    return Array.isArray(list) ? list.filter(Boolean) : [String(list || "")].filter(Boolean);
  }
  const single = res.headers.get("set-cookie") || "";
  return single ? [single] : [];
}

function cookieHeaderFromSetCookies(setCookies) {
  if (!Array.isArray(setCookies) || !setCookies.length) return "";
  // Extract "name=value" from each Set-Cookie string and join into a Cookie header.
  return setCookies
    .map((c) => String(c || "").split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

async function json(res) {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    return { _nonJson: true, text: t };
  }
}

function normalizeName(v) {
  return String(v || "").trim().toLowerCase();
}

async function main() {
  const base = process.env.ERP_BASE_URL || "http://localhost:3000";
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

  // Login (real Supabase auth)
  const loginRes = await fetch(`${base}/api/erp/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ identifier: "superadmin@damaan.com", password: "admin123" }).toString(),
    redirect: "manual"
  });
  const cookie = cookieHeaderFromSetCookies(pickSetCookies(loginRes));
  if (!cookie) throw new Error("Login failed: no session cookie set.");
  console.log("login_status", loginRes.status);

  const authHeaders = { cookie };

  // Countries: find Pakistan
  const countriesRes = await fetch(`${base}/api/erp/locations/countries`, { headers: authHeaders });
  const countriesJson = await json(countriesRes);
  const countries =
    countriesJson?.data?.countries ||
    countriesJson?.countries ||
    countriesJson?.data ||
    [];
  const pakistan = Array.isArray(countries)
    ? countries.find((c) => normalizeName(c?.name) === "pakistan") ||
      countries.find((c) => normalizeName(c?.name).includes("pakistan"))
    : null;
  if (!pakistan?.id) throw new Error("Pakistan country not found in Location Settings.");
  const countryId = pakistan.id;
  const currency = String(pakistan.currency_code || "PKR").toUpperCase();
  console.log("pakistan_countryId", countryId, "currency", currency);

  // Main branch: find Pakistan main branch
  const mainsRes = await fetch(`${base}/api/branch-management/country-branches?countryId=${encodeURIComponent(countryId)}`, { headers: authHeaders });
  const mainsJson = await json(mainsRes);
  const mains = mainsJson?.countryBranches || [];
  const main = Array.isArray(mains) ? mains.find((b) => b?.is_main) : null;
  if (!main?.id) throw new Error("Pakistan main branch not found (is_main=true).");
  const countryBranchId = main.id;
  console.log("pakistan_mainBranchId", countryBranchId, "main_currency", main.local_currency);

  // State: ensure Balochistan exists
  const statesRes = await fetch(`${base}/api/erp/locations/states?countryId=${encodeURIComponent(countryId)}&q=${encodeURIComponent("Baloch")}`, { headers: authHeaders });
  const statesJson = await json(statesRes);
  const states = statesJson?.data?.states || statesJson?.states || [];
  let balochistan = Array.isArray(states) ? states.find((s) => normalizeName(s?.name) === "balochistan") : null;
  if (!balochistan?.id) {
    const createStateRes = await fetch(`${base}/api/erp/locations/states`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders },
      body: JSON.stringify({ countryId, name: "Balochistan", code: "BAL" })
    });
    const createStateJson = await json(createStateRes);
    if (!createStateRes.ok) throw new Error(`Create state failed: ${createStateRes.status} ${JSON.stringify(createStateJson)}`);
    balochistan = createStateJson?.data?.state || createStateJson?.state;
  }
  if (!balochistan?.id) throw new Error("Failed to ensure Balochistan state.");
  const stateProvinceId = balochistan.id;
  console.log("stateProvinceId", stateProvinceId);

  // City: ensure Quetta exists under Balochistan
  const citiesRes = await fetch(
    `${base}/api/erp/locations/cities?countryId=${encodeURIComponent(countryId)}&stateProvinceId=${encodeURIComponent(stateProvinceId)}&q=${encodeURIComponent("Quetta")}`,
    { headers: authHeaders }
  );
  const citiesJson = await json(citiesRes);
  const cities = citiesJson?.data?.cities || citiesJson?.cities || [];
  let quetta = Array.isArray(cities) ? cities.find((c) => normalizeName(c?.name) === "quetta") : null;
  if (!quetta?.id) {
    const createCityRes = await fetch(`${base}/api/erp/locations/cities`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders },
      body: JSON.stringify({ countryId, stateProvinceId, name: "Quetta", code: "QTA", zipCode: "87300" })
    });
    const createCityJson = await json(createCityRes);
    if (!createCityRes.ok) throw new Error(`Create city failed: ${createCityRes.status} ${JSON.stringify(createCityJson)}`);
    quetta = createCityJson?.data?.city || createCityJson?.city;
  }
  if (!quetta?.id) throw new Error("Failed to ensure Quetta city.");
  const cityId = quetta.id;
  console.log("cityId", cityId);

  // City branch: ensure Quetta City Branch exists under Pakistan main branch
  const existingCityRes = await fetch(
    `${base}/api/branch-management/city-branches?countryId=${encodeURIComponent(countryId)}&countryBranchId=${encodeURIComponent(countryBranchId)}`,
    { headers: authHeaders }
  );
  const existingCityJson = await json(existingCityRes);
  const cityBranches = existingCityJson?.cityBranches || [];
  let quettaBranch = Array.isArray(cityBranches)
    ? cityBranches.find((b) => String(b?.city_id || "") === cityId) ||
      cityBranches.find((b) => normalizeName(b?.city_name) === "quetta")
    : null;

  if (!quettaBranch?.id) {
    const code = `PAK-QTA-001`;
    const createBranchRes = await fetch(`${base}/api/branch-management/city-branches`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders },
      body: JSON.stringify({
        countryId,
        countryBranchId,
        cityName: "Quetta",
        stateProvinceId,
        cityId,
        name: "Quetta City Branch",
        code,
        currencyCode: String(main.local_currency || currency || "PKR").toUpperCase(),
        address: "Quetta (Test Branch)",
        ownerName: "Test Owner",
        contacts: [{ type: "Mobile", value: "+92 300 0000000" }]
      })
    });
    const createBranchJson = await json(createBranchRes);
    if (!(createBranchRes.status === 201 || createBranchRes.status === 200)) {
      throw new Error(`Create city branch failed: ${createBranchRes.status} ${JSON.stringify(createBranchJson)}`);
    }
    const newId = createBranchJson?.id;

    const reloadRes = await fetch(
      `${base}/api/branch-management/city-branches?countryId=${encodeURIComponent(countryId)}&countryBranchId=${encodeURIComponent(countryBranchId)}`,
      { headers: authHeaders }
    );
    const reloadJson = await json(reloadRes);
    const reloadList = reloadJson?.cityBranches || [];
    quettaBranch = Array.isArray(reloadList)
      ? reloadList.find((b) => b?.id === newId) ||
        reloadList.find((b) => String(b?.city_id || "") === cityId) ||
        reloadList.find((b) => normalizeName(b?.city_name) === "quetta")
      : null;
  }

  if (!quettaBranch?.id) throw new Error("Failed to ensure Quetta city branch.");
  const cityBranchId = quettaBranch.id;
  console.log("quetta_cityBranchId", cityBranchId);

  // Create two enterprise accounts (auto creates ledgers)
  async function createAccount(code, name, kind) {
    const res = await fetch(`${base}/api/erp/accounting/accounts`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders },
      body: JSON.stringify({
        scope: "city_branch",
        countryId,
        countryBranchId,
        cityBranchId,
        parentId: null,
        code,
        name,
        kind,
        currency: String(main.local_currency || currency || "PKR").toUpperCase(),
        openingBalance: 0,
        isControlAccount: false
      })
    });
    const j = await json(res);
    if (!res.ok) throw new Error(`Create account failed: ${res.status} ${JSON.stringify(j)}`);
    return j?.data || j;
  }

  const cashCode = `CASH-QTA-${stamp}`;
  const contraCode = `SUSP-QTA-${stamp}`;

  const cashAcc = await createAccount(cashCode, `Cash - Quetta (${stamp})`, "asset");
  const contraAcc = await createAccount(contraCode, `Suspense - Quetta (${stamp})`, "liability");
  console.log("created_cash", cashAcc);
  console.log("created_counter", contraAcc);

  if (!cashAcc?.accountId || !cashAcc?.ledgerId) throw new Error("Cash account/ledger not created.");
  if (!contraAcc?.accountId || !contraAcc?.ledgerId) throw new Error("Counter account/ledger not created.");

  // Validate branch roznamcha (should pass now)
  const journalNo = `BR-JRN-${stamp}`;
  const voucherNo = `BR-VCH-${stamp}`;

  const validateBranchRes = await fetch(`${base}/api/erp/roznamcha`, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders },
    body: JSON.stringify({
      mode: "validate",
      type: "branch",
      entryDate: now.toISOString().slice(0, 10),
      journalNo,
      voucherNo,
      narration: `E2E Branch Cash Entry Validate (${stamp})`,
      countryId,
      countryBranchId,
      cityBranchId,
      paymentMethodId: null,
      lines: [
        {
          enterpriseAccountId: cashAcc.accountId,
          ledgerId: cashAcc.ledgerId,
          description: "Cash debit",
          debit: 100,
          credit: 0,
          currency: String(main.local_currency || currency || "PKR").toUpperCase(),
          exchangeRate: 1,
          paymentEntryType: "cash_payment"
        },
        {
          enterpriseAccountId: contraAcc.accountId,
          ledgerId: contraAcc.ledgerId,
          description: "Counter credit",
          debit: 0,
          credit: 100,
          currency: String(main.local_currency || currency || "PKR").toUpperCase(),
          exchangeRate: 1,
          paymentEntryType: "cash_payment"
        }
      ]
    })
  });
  const validateBranchJson = await json(validateBranchRes);
  console.log("branch_validate_status", validateBranchRes.status);
  console.log("branch_validate_response", validateBranchJson);
  if (validateBranchJson?.error?.details?.fieldErrors) {
    console.log("branch_validate_fieldErrors", JSON.stringify(validateBranchJson.error.details.fieldErrors, null, 2));
  }

  // Post branch roznamcha (DB write)
  const postBranchRes = await fetch(`${base}/api/erp/roznamcha`, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders },
    body: JSON.stringify({
      mode: "post",
      type: "branch",
      entryDate: now.toISOString().slice(0, 10),
      journalNo,
      voucherNo,
      narration: `E2E Branch Cash Entry Post (${stamp})`,
      countryId,
      countryBranchId,
      cityBranchId,
      paymentMethodId: null,
      lines: [
        {
          enterpriseAccountId: cashAcc.accountId,
          ledgerId: cashAcc.ledgerId,
          description: "Cash debit",
          debit: 100,
          credit: 0,
          currency: String(main.local_currency || currency || "PKR").toUpperCase(),
          exchangeRate: 1,
          paymentEntryType: "cash_payment"
        },
        {
          enterpriseAccountId: contraAcc.accountId,
          ledgerId: contraAcc.ledgerId,
          description: "Counter credit",
          debit: 0,
          credit: 100,
          currency: String(main.local_currency || currency || "PKR").toUpperCase(),
          exchangeRate: 1,
          paymentEntryType: "cash_payment"
        }
      ]
    })
  });
  const postBranchJson = await json(postBranchRes);
  console.log("branch_post_status", postBranchRes.status);
  console.log("branch_post_response", postBranchJson);
  if (postBranchJson?.error?.details?.fieldErrors) {
    console.log("branch_post_fieldErrors", JSON.stringify(postBranchJson.error.details.fieldErrors, null, 2));
  }

  // Confirm entry exists in list (branch scope)
  const listRes = await fetch(
    `${base}/api/erp/roznamcha?countryId=${encodeURIComponent(countryId)}&countryBranchId=${encodeURIComponent(countryBranchId)}&cityBranchId=${encodeURIComponent(cityBranchId)}`,
    { headers: authHeaders }
  );
  const listJson = await json(listRes);
  console.log("roznamcha_list_status", listRes.status);
  const entries = listJson?.data?.entries || listJson?.entries || [];
  const found = Array.isArray(entries) ? entries.find((e) => e?.voucher_no === voucherNo) : null;
  console.log("roznamcha_entry_found", Boolean(found), found ? { id: found.id, voucher: found.voucher_no, journal: found.journal_no, type: found.type } : null);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
