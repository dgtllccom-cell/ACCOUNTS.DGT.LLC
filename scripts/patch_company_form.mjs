import fs from 'fs';

// 1. Patch company-incorporation-form.tsx
let formFile = 'features/companies/components/company-incorporation-form.tsx';
let formContent = fs.readFileSync(formFile, 'utf8');

// Update owner companies loader to query 360-summary
const oldLoader = `  // Load existing companies when owner is selected
  useEffect(() => {
    if (!ownerPersonId) {
      setExistingCompaniesForOwner([]);
      return;
    }
    (async () => {
      try {
        const pRes = await apiGet<{ customer: any }>(\`/api/erp/customers/\${encodeURIComponent(ownerPersonId)}?lang=\${encodeURIComponent(lang)}\`);
        const pName = pRes.customer?.customer_name || [pRes.customer?.first_name, pRes.customer?.last_name].filter(Boolean).join(" ") || "";
        if (pName) {
          setOwnerName(pName);
        }
        const cRes = await apiGet<{ companies: any[] }>("/api/erp/companies?limit=200");
        const list = cRes.companies || [];
        const matched = list.filter((c: any) => 
          (c.owner_person_id && c.owner_person_id === ownerPersonId) ||
          (c.owner_id && c.owner_id === ownerPersonId) ||
          matchOwner(c.owner_name, pName)
        );
        setExistingCompaniesForOwner(matched.map((m: any) => ({ id: m.id, name: m.name || m.legal_name })));
      } catch (err) {
        console.error("Failed to fetch owner details:", err);
      }
    })();
  }, [ownerPersonId, lang]);`;

const newLoader = `  // Load existing companies when owner is selected using Party 360 summary API
  useEffect(() => {
    if (!ownerPersonId) {
      setExistingCompaniesForOwner([]);
      return;
    }
    (async () => {
      try {
        const pRes = await apiGet<{ customer: any }>(\`/api/erp/customers/\${encodeURIComponent(ownerPersonId)}?lang=\${encodeURIComponent(lang)}\`);
        const pName = pRes.customer?.customer_name || [pRes.customer?.first_name, pRes.customer?.last_name].filter(Boolean).join(" ") || "";
        if (pName) {
          setOwnerName(pName);
        }
        // Fetch 360 summary
        const summaryRes = await apiGet<{ companies: Array<{ id: string; name: string }> }>(
          \`/api/erp/parties/360-summary?customerId=\${encodeURIComponent(ownerPersonId)}&lang=\${encodeURIComponent(lang)}\`
        );
        if (summaryRes?.companies && summaryRes.companies.length > 0) {
          setExistingCompaniesForOwner(summaryRes.companies.map((c) => ({ id: c.id, name: c.name })));
        } else {
          const cRes = await apiGet<{ companies: any[] }>("/api/erp/companies?limit=200");
          const list = cRes.companies || [];
          const matched = list.filter((c: any) => 
            (c.owner_person_id && c.owner_person_id === ownerPersonId) ||
            (c.owner_id && c.owner_id === ownerPersonId) ||
            matchOwner(c.owner_name, pName)
          );
          setExistingCompaniesForOwner(matched.map((m: any) => ({ id: m.id, name: m.name || m.legal_name })));
        }
      } catch (err) {
        console.error("Failed to fetch owner details:", err);
      }
    })();
  }, [ownerPersonId, lang]);`;

if (formContent.includes('const pRes = await apiGet<{ customer: any }>')) {
  formContent = formContent.replace(oldLoader, newLoader);
}

// Update the owner card UI to be compact with the "+ نئی کمپنی بنائیں" button
const oldCardUi = `              {ownerName && (
                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/70 dark:bg-indigo-950/40 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">👑</span>
                      <div>
                        <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-bold uppercase tracking-wider">
                          {lang === "ur" ? "منتخب مالک / پروپرائیٹر:" : "Selected Owner / Proprietor:"}
                        </p>
                        <p className="text-sm font-extrabold text-indigo-950 dark:text-indigo-100">
                          {transliterateProperNoun(ownerName, lang)}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-600 text-white shadow-xs">
                      {existingCompaniesForOwner.length} {lang === "ur" ? "رجسٹرڈ کمپنیاں" : "Registered Companies"}
                    </span>
                  </div>

                  {existingCompaniesForOwner.length > 0 ? (
                    <div className="space-y-2 pt-2 border-t border-indigo-200 dark:border-indigo-900/50">
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-bold">
                        {lang === "ur" 
                          ? \`اس مالک کے نام پر پہلے سے \${existingCompaniesForOwner.length} سسٹر کمپنیاں رجسٹرڈ ہیں:\` 
                          : \`This owner already has \${existingCompaniesForOwner.length} sister companies registered:\`}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {existingCompaniesForOwner.map((co, idx) => (
                          <div key={co.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/30 text-xs shadow-xs">
                            <div className="flex items-center gap-2 truncate">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-800">
                                {idx + 1}
                              </span>
                              <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                                {localizeTerm(co.name, lang)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                router.push(\`/dashboard/settings/company-setup?companyId=\${co.id}\` as Route);
                              }}
                              className="shrink-0 text-[11px] text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-bold underline cursor-pointer"
                            >
                              {lang === "ur" ? "تفصیل دیکھیں" : "View"}
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 p-2.5 flex items-center justify-between gap-2">
                        <p className="text-xs text-amber-900 dark:text-amber-200 font-medium">
                          {lang === "ur"
                            ? \`💡 آپ اسی مالک کے تحت نئی سسٹر کمپنی #\${existingCompaniesForOwner.length + 1} درج کر رہے ہیں۔ نیچے نیا نام درج کریں۔\`
                            : \`💡 Registering Sister Company #\${existingCompaniesForOwner.length + 1} under this owner. Enter company name below.\`}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">
                      {lang === "ur" ? "اس مالک کے لیے یہ پہلی کمپنی درج کی جا رہی ہے۔" : "This is the first company being registered for this owner."}
                    </p>
                  )}
                </div>
              )}`;

const newCardUi = `              {ownerName && (
                <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/70 dark:bg-indigo-950/40 space-y-2.5 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">👑</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-indigo-700 dark:text-indigo-300 font-bold uppercase">
                          {lang === "ur" ? "مالک:" : "Owner:"}
                        </span>
                        <span className="text-xs font-black text-indigo-950 dark:text-indigo-100">
                          {transliterateProperNoun(ownerName, lang)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-600 text-white shadow-xs">
                        {existingCompaniesForOwner.length} {lang === "ur" ? "رجسٹرڈ کمپنیاں" : "Registered Companies"}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setSelectedCompanyId(null);
                          setCompanyName("");
                          setBusinessName("");
                          setRegistrations([newRow()]);
                          setMessage("");
                          router.push("/dashboard/settings/company-setup" as Route);
                        }}
                        className="h-7 px-2.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs cursor-pointer gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        {lang === "ur" ? "نئی کمپنی بنائیں" : "+ New Company"}
                      </Button>
                    </div>
                  </div>

                  {existingCompaniesForOwner.length > 0 ? (
                    <div className="space-y-1.5 pt-1.5 border-t border-indigo-200/80 dark:border-indigo-900/50">
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 font-bold">
                        {lang === "ur" 
                          ? \`منسلک سسٹر کمپنیاں (\${existingCompaniesForOwner.length}):\` 
                          : \`Sister Companies (\${existingCompaniesForOwner.length}):\`}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {existingCompaniesForOwner.map((co, idx) => (
                          <div 
                            key={co.id} 
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-[11px] shadow-xs"
                          >
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-800">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-100">
                              {localizeTerm(co.name, lang)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                router.push(\`/dashboard/settings/company-setup?companyId=\${co.id}\` as Route);
                              }}
                              className="ml-1 text-[10px] text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-bold underline cursor-pointer"
                              title={lang === "ur" ? "ترمیم یا سیٹ اپ دیکھیں" : "Edit / View Setup"}
                            >
                              {lang === "ur" ? "ترمیم" : "Edit"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">
                      {lang === "ur" ? "اس مالک کے لیے یہ پہلی کمپنی درج کی جا رہی ہے۔" : "This is the first company being registered for this owner."}
                    </p>
                  )}
                </div>
              )}`;

if (formContent.includes('{ownerName && (')) {
  formContent = formContent.replace(oldCardUi, newCardUi);
}

fs.writeFileSync(formFile, formContent, 'utf8');
console.log('✅ Form updated successfully!');
