import fs from 'fs';

const filePath = 'features/companies/components/company-incorporation-form.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update loading sister companies via 360-summary API
const oldLoad = `    (async () => {
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
    })();`;

const newLoad = `    (async () => {
      try {
        const [pRes, summaryRes, cRes] = await Promise.allSettled([
          apiGet<{ customer: any }>(\`/api/erp/customers/\${encodeURIComponent(ownerPersonId)}?lang=\${encodeURIComponent(lang)}\`),
          apiGet<{ summary: any }>(\`/api/erp/parties/360-summary?customerId=\${encodeURIComponent(ownerPersonId)}&lang=\${encodeURIComponent(lang)}\`),
          apiGet<{ companies: any[] }>("/api/erp/companies?limit=200")
        ]);

        let pName = "";
        if (pRes.status === "fulfilled" && pRes.value?.customer) {
          const cust = pRes.value.customer;
          pName = cust.customer_name || [cust.first_name, cust.last_name].filter(Boolean).join(" ") || "";
          if (pName) setOwnerName(pName);
        }

        let sisterComps: Array<{ id: string; name: string }> = [];
        if (summaryRes.status === "fulfilled" && summaryRes.value?.summary?.sister_companies?.length) {
          sisterComps = summaryRes.value.summary.sister_companies.map((s: any) => ({ id: s.id, name: s.name }));
        }

        if (!sisterComps.length && cRes.status === "fulfilled" && cRes.value?.companies) {
          const list = cRes.value.companies;
          const matched = list.filter((c: any) => 
            (c.owner_person_id && c.owner_person_id === ownerPersonId) ||
            (c.owner_id && c.owner_id === ownerPersonId) ||
            matchOwner(c.owner_name, pName)
          );
          sisterComps = matched.map((m: any) => ({ id: m.id, name: m.name || m.legal_name }));
        }

        setExistingCompaniesForOwner(sisterComps);
      } catch (err) {
        console.error("Failed to fetch owner details:", err);
      }
    })();`;

if (content.includes('const pRes = await apiGet<{ customer: any }>')) {
  content = content.replace(oldLoad, newLoad);
}

// 2. Add the "+ New Company" button in the owner card header
const oldCardHeader = `                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-600 text-white shadow-xs">
                      {existingCompaniesForOwner.length} {lang === "ur" ? "رجسٹرڈ کمپنیاں" : "Registered Companies"}
                    </span>
                  </div>`;

const newCardHeader = `                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800">
                        {existingCompaniesForOwner.length} {lang === "ur" ? "رجسٹرڈ کمپنیاں" : "Registered Companies"}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setCompanyName("");
                          setBusinessName("");
                          setSelectedCompanyId(null);
                          router.push("/dashboard/settings/company-setup" as Route);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 px-3 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{lang === "ur" ? "+ نئی کمپنی بنائیں" : "+ New Company"}</span>
                      </Button>
                    </div>
                  </div>`;

if (content.includes('{existingCompaniesForOwner.length} {lang === "ur" ? "رجسٹرڈ کمپنیاں" : "Registered Companies"}')) {
  content = content.replace(oldCardHeader, newCardHeader);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ company-incorporation-form.tsx updated with sister companies query and New Company button!');
