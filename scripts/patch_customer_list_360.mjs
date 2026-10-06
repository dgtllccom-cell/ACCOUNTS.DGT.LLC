import fs from 'fs';

const filePath = 'features/customers/components/customer-list.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update loadCustomers to use party directory or customers endpoint
const oldLoad = `  // Fetch all customers from DB
  const loadCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      // Query limit=250 to get a large set for stats & registry calculation
      const res = await apiGet<{ customers: CustomerRow[] }>(\`/api/erp/customers?limit=250&lang=\${encodeURIComponent(lang || "en")}\`);
      setCustomers(res.customers ?? []);
    } catch (e: any) {
      setError(e.message || "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  };`;

const newLoad = `  // Fetch unified master party directory from DB
  const [partiesDirectory, setPartiesDirectory] = useState<any[]>([]);
  const loadCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load both customers and unified party 360 directory
      const [resCust, resDir] = await Promise.allSettled([
        apiGet<{ customers: CustomerRow[] }>(\`/api/erp/customers?limit=250&lang=\${encodeURIComponent(lang || "en")}\`),
        apiGet<{ parties: any[]; total: number }>(\`/api/erp/parties/directory?limit=250&lang=\${encodeURIComponent(lang || "en")}\`)
      ]);
      if (resCust.status === "fulfilled" && resCust.value?.customers) {
        setCustomers(resCust.value.customers);
      }
      if (resDir.status === "fulfilled" && resDir.value?.parties) {
        setPartiesDirectory(resDir.value.parties);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  };`;

if (content.includes('const res = await apiGet<{ customers: CustomerRow[] }>')) {
  content = content.replace(oldLoad, newLoad);
}

// 2. Enhance parsedCustomers to merge with party 360 directory details
const oldParsed = `      return {
        ...c,
        meta
      };
    });
  }, [customers]);`;

const newParsed = `      // Find matching entry in partiesDirectory
      const dirMatch = partiesDirectory.find((p) => p.id === c.id || p.full_name?.toLowerCase() === c.customer_name?.toLowerCase());

      return {
        ...c,
        meta,
        partiesDir: dirMatch || {
          companies_count: 0,
          company_names: [],
          employees_count: 0,
          employee_codes: [],
          banks_count: 0,
          bank_names: []
        }
      };
    });
  }, [customers, partiesDirectory]);`;

if (content.includes('return {\n        ...c,\n        meta\n      };\n    });\n  }, [customers]);')) {
  content = content.replace(oldParsed, newParsed);
}

// 3. Update table columns header
content = content.replace(
  `<Th className="px-5 py-3.5">#</Th>
                  <Th className="px-5 py-3.5">{getLabel("customerCode", lang)}</Th>
                  <Th className="px-5 py-3.5">{getLabel("customerName", lang)}</Th>
                  <Th className="px-5 py-3.5">{getLabel("customerType", lang)}</Th>
                  <Th className="px-5 py-3.5">{getLabel("country", lang)}</Th>
                  <Th className="px-5 py-3.5">{getLabel("stateProvince", lang)}</Th>
                  <Th className="px-5 py-3.5">{getLabel("city", lang)}</Th>
                  <Th className="px-5 py-3.5">{getLabel("contacts", lang)}</Th>
                  <Th className="px-5 py-3.5">{getLabel("documents", lang)}</Th>
                  <Th className="px-5 py-3.5">{getLabel("status", lang)}</Th>
                  <Th className="px-5 py-3.5">{getLabel("createdDate", lang)}</Th>
                  <Th className="px-5 py-3.5 text-center">{getLabel("actions", lang)}</Th>`,
  `<Th className="px-4 py-3.5 text-center w-12">#</Th>
                  <Th className="px-4 py-3.5">{getLabel("customerCode", lang)}</Th>
                  <Th className="px-4 py-3.5">{lang === "ur" ? "مکمل نام و ولدیت" : "Full Name & Father's Name"}</Th>
                  <Th className="px-4 py-3.5">{lang === "ur" ? "سسٹم میں کردار و استعمال" : "System Roles & Usages"}</Th>
                  <Th className="px-4 py-3.5">{getLabel("country", lang)} / {getLabel("city", lang)}</Th>
                  <Th className="px-4 py-3.5 text-center">{getLabel("contacts", lang)}</Th>
                  <Th className="px-4 py-3.5 text-center">{getLabel("status", lang)}</Th>
                  <Th className="px-4 py-3.5 text-center">{getLabel("actions", lang)}</Th>`
);

// 4. Update table row rendering
const oldRow = `                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustomerId(c.id)}
                      className="cursor-pointer hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-semibold text-slate-500">{i + 1}</td>
                      <td className="px-5 py-3.5 font-bold text-slate-900 font-mono">
                        {c.meta.customerAccountNumber}
                      </td>
                      <td className="px-5 py-3.5 font-extrabold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{translateCustomerText(c.customer_name, lang)}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected360Party({ id: c.id, name: c.customer_name });
                            }}
                            className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black text-xs shadow-xs transition hover:scale-105 cursor-pointer"
                            title={lang === "ur" ? "360° تمام لنکس اور ریکارڈز دیکھیں" : "View 360° cross-system profile"}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-800">{translateCustomerText(c.meta.customerType, lang)}</td>
                      <td className="px-5 py-3.5 text-slate-600 font-medium">
                        {translateCustomerText(c.meta.country, lang)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 font-medium">
                        {translateCustomerText(c.meta.stateProvince, lang)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 font-medium">
                        {translateCustomerText(c.meta.city, lang)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">
                        <div className="group relative flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1 items-center">
                            {c.meta.contacts.map((cn, idx) => {
                              if (cn.type === "Email") {
                                return (
                                  <a
                                    key={idx}
                                    href={\`mailto:\${cn.value}\`}
                                    className="p-1 rounded hover:bg-slate-100 text-teal-600 transition"
                                    title={\`\${getLabel("emailAddress", lang)}: \${cn.value}\`}
                                  >
                                    <Mail className="h-3.5 w-3.5" />
                                  </a>
                                );
                              }
                              if (cn.type === "Mobile" || cn.type === "Office") {
                                return (
                                  <a
                                    key={idx}
                                    href={\`tel:\${cn.value}\`}
                                    className="p-1 rounded hover:bg-slate-100 text-slate-600 transition"
                                    title={\`\${cn.type}: \${cn.value}\`}
                                  >
                                    <Phone className="h-3.5 w-3.5" />
                                  </a>
                                );
                              }
                              if (cn.type === "WhatsApp") {
                                return (
                                  <a
                                    key={idx}
                                    href={\`https://wa.me/\${cn.value.replace(/[^0-9]/g, "")}\`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 rounded hover:bg-slate-100 text-emerald-600 transition"
                                    title={\`WhatsApp: \${cn.value}\`}
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                  </a>
                                );
                              }
                              return null;
                            })}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 font-mono">
                        <div className="flex items-center gap-1">
                          <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                          <span>{c.meta.documents.length}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={\`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold \${
                            c.meta.status === "Active"
                              ? "bg-teal-50 text-teal-700 border border-teal-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }\`}
                        >
                          {c.meta.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-mono">
                        {new Date(c.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric"
                        })}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {openMenuId === c.id && (
                            <div className="absolute right-0 mt-1 w-44 rounded-xl bg-white border border-slate-100 shadow-xl py-1 z-30 text-xs font-semibold animate-in fade-in zoom-in-95">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCustomerId(c.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                              >
                                👁️ {getLabel("profile", lang)}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditCustomerId(c.id);
                                  setShowFormModal(true);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                              >
                                ✏️ {getLabel("editDetails", lang)}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handlePrint(c);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                              >
                                🖨️ {getLabel("printProfile", lang)}
                              </button>
                              <div className="my-1 border-t border-slate-100" />
                              <button
                                type="button"
                                onClick={() => {
                                  handleDelete(c.id, c.customer_name);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer"
                              >
                                🗑️ {getLabel("deleteParty", lang)}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>`;

const newRow = `                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustomerId(c.id)}
                      className="cursor-pointer hover:bg-slate-50/70 transition-colors font-sans"
                    >
                      {/* # Index */}
                      <td className="px-4 py-3.5 text-center font-bold text-slate-400">{i + 1}</td>

                      {/* Customer Code */}
                      <td className="px-4 py-3.5 font-bold text-slate-900 font-mono">
                        {c.meta.customerAccountNumber}
                      </td>

                      {/* Full Name & Father Name */}
                      <td className="px-4 py-3.5 font-extrabold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div>
                            <span className="font-extrabold text-slate-900 dark:text-slate-100">
                              {translateCustomerText(c.customer_name, lang)}
                            </span>
                            {(c.contact_person || c.meta.fatherName) && (
                              <p className="text-[11px] font-normal text-slate-500">
                                {lang === "ur" ? "ولدیت: " : "S/O: "}
                                {translateCustomerText(c.contact_person || c.meta.fatherName, lang)}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected360Party({ id: c.id, name: c.customer_name });
                            }}
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black text-xs shadow-xs transition hover:scale-105 cursor-pointer"
                            title={lang === "ur" ? "360° تمام لنکس اور ریکارڈز دیکھیں" : "View 360° cross-system profile"}
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* System Roles & Usages */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {c.partiesDir?.companies_count > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              🏢 {c.partiesDir.companies_count} {lang === "ur" ? "کمپنیاں" : "Companies"}
                            </span>
                          )}
                          {c.partiesDir?.employees_count > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              👔 {lang === "ur" ? "ملازم" : "Emp"}: {c.partiesDir.employee_codes.join(", ")}
                            </span>
                          )}
                          {c.partiesDir?.banks_count > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              🏦 {c.partiesDir.banks_count} {lang === "ur" ? "بینک" : "Banks"}
                            </span>
                          )}
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            👥 {translateCustomerText(c.meta.customerType || "Customer", lang)}
                          </span>
                        </div>
                      </td>

                      {/* Country & City */}
                      <td className="px-4 py-3.5 text-slate-600 font-medium">
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {translateCustomerText(c.meta.country || "—", lang)}
                          </span>
                          {c.meta.city && (
                            <span className="text-[11px] text-slate-500 block">
                              {translateCustomerText(c.meta.city, lang)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Contacts (Icons) */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {c.email && (
                            <a
                              href={\`mailto:\${c.email}\`}
                              className="p-1 rounded-md hover:bg-blue-50 text-blue-600 transition"
                              title={\`\${getLabel("emailAddress", lang)}: \${c.email}\`}
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {c.mobile && (
                            <a
                              href={\`tel:\${c.mobile}\`}
                              className="p-1 rounded-md hover:bg-emerald-50 text-emerald-600 transition"
                              title={\`\${lang === "ur" ? "فون:" : "Phone:"} \${c.mobile}\`}
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {c.whatsapp && (
                            <a
                              href={\`https://wa.me/\${c.whatsapp.replace(/[^0-9]/g, "")}\`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded-md hover:bg-green-50 text-green-600 transition"
                              title={\`WhatsApp: \${c.whatsapp}\`}
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={\`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold \${
                            c.meta.status === "Active"
                              ? "bg-teal-50 text-teal-700 border border-teal-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }\`}
                        >
                          {c.meta.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {openMenuId === c.id && (
                            <div className="absolute right-0 mt-1 w-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 z-30 text-xs font-semibold animate-in fade-in zoom-in-95">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCustomerId(c.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left rtl:text-right px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer"
                              >
                                👁️ {getLabel("profile", lang)}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelected360Party({ id: c.id, name: c.customer_name });
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left rtl:text-right px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-indigo-600 flex items-center gap-2 cursor-pointer"
                              >
                                🌐 {lang === "ur" ? "360° تمام لنکس دیکھیں" : "View 360° Profile"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditCustomerId(c.id);
                                  setShowFormModal(true);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left rtl:text-right px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer"
                              >
                                ✏️ {getLabel("editDetails", lang)}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handlePrint(c);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left rtl:text-right px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer"
                              >
                                🖨️ {getLabel("printProfile", lang)}
                              </button>
                              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                              <button
                                type="button"
                                onClick={() => {
                                  handleDelete(c.id, c.customer_name);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left rtl:text-right px-3.5 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer"
                              >
                                🗑️ {getLabel("deleteParty", lang)}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>`;

if (content.includes('filteredCustomers.map((c, i) => (')) {
  content = content.replace(oldRow, newRow);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ customer-list.tsx updated with Master Party 360 table and linkages!');
