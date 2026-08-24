import fs from 'fs';

let filePath = 'features/companies/components/company-registry.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Imports
if (!content.includes('Party360Modal')) {
  content = content.replace(
    'import { transliterateProperNoun } from "@/lib/i18n/transliteration";',
    `import { transliterateProperNoun } from "@/lib/i18n/transliteration";\nimport { Party360Modal } from "@/features/customers/components/party-360-modal";\nimport { Mail, Phone, MessageSquare, MoreHorizontal, Globe } from "lucide-react";`
  );
}

// 2. State
if (!content.includes('selected360Party')) {
  content = content.replace(
    'const [previewCompany, setPreviewCompany] = useState<CompanyRegistryItem | null>(null);',
    `const [previewCompany, setPreviewCompany] = useState<CompanyRegistryItem | null>(null);\n  const [selected360Party, setSelected360Party] = useState<{ id?: string; name: string } | null>(null);\n  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);`
  );
}

// 3. Table Header
content = content.replace(
  `<th className="p-3.5 text-center">{tt("creg.col_contracts", "Contracts")}</th>
                <th className="p-3.5">{tt("creg.col_primary_contact", "Primary Contact (Mobile)")}</th>
                <th className="p-3.5">{tt("creg.col_email", "E-Mail")}</th>
                <th className="p-3.5 text-center">{tt("creg.col_preview", "Preview")}</th>
                <th className="p-3.5 text-center">{tt("common.actions", "Actions")}</th>`,
  `<th className="p-3.5 text-center">{tt("creg.col_contracts", "Contracts")}</th>
                <th className="p-3.5 text-center">{lang === "ur" ? "رابطہ / کنٹیکٹ" : "Contacts"}</th>
                <th className="p-3.5 text-center">{tt("common.actions", "Actions")}</th>`
);

// 4. Consortium cell with (+) 360 button
content = content.replace(
  `<td className="p-3.5 font-bold text-slate-800 dark:text-slate-200">
                      {localizeTerm(c.consortium, lang)}
                    </td>`,
  `<td className="p-3.5 font-bold text-slate-800 dark:text-slate-200">
                      <div className="flex items-center gap-2">
                        <span>{localizeTerm(c.consortium, lang)}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected360Party({ name: c.raw?.owner_name || c.consortium });
                          }}
                          className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black text-xs shadow-xs transition hover:scale-105 cursor-pointer"
                          title={lang === "ur" ? "360° تمام لنکس اور ریکارڈز دیکھیں" : "View 360° Profile"}
                        >
                          +
                        </button>
                      </div>
                    </td>`
);

// 5. Contacts and Action menu row replacement
const oldRowTail = `{/* Primary Contact */}
                    <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400" dir="ltr">
                      {c.primaryContact}
                    </td>

                    {/* Email */}
                    <td className="p-3.5 font-mono text-blue-600 dark:text-blue-400" dir="ltr">
                      {c.email}
                    </td>

                    {/* Preview Button */}
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => setPreviewCompany(c)}
                        className="h-7 w-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 inline-flex items-center justify-center cursor-pointer transition"
                        title={tt("creg.crtr_preview_details", "Preview Details")}
                      >
                        <Eye className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => router.push(\`/dashboard/settings/company-setup?companyId=\${c.id}\` as Route)}
                          className="h-7 w-7 rounded-lg border border-slate-200 hover:bg-blue-50 text-blue-600 flex items-center justify-center"
                          title={tt("branch.edit", "Edit")}
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrint(c)}
                          className="h-7 w-7 rounded-lg border border-slate-200 hover:bg-emerald-50 text-emerald-600 flex items-center justify-center"
                          title={tt("creg.crtr_duplicate_print", "Duplicate / Print")}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(\`\${tt("creg.crtr_confirm_delete_prefix", "Are you sure you want to delete")} \${c.accountName}?\`)) {
                              setCompanies((prev) => prev.filter((item) => item.id !== c.id));
                            }
                          }}
                          className="h-7 w-7 rounded-lg border border-slate-200 hover:bg-rose-50 text-rose-600 flex items-center justify-center"
                          title={tt("common.delete", "Delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>`;

const newRowTail = `{/* Compact Contacts Column */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {c.email && (
                          <a
                            href={\`mailto:\${c.email}\`}
                            className="flex h-6.5 w-6.5 items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 text-blue-600 transition"
                            title={\`\${lang === "ur" ? "ای میل:" : "Email:"} \${c.email}\`}
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {c.primaryContact && c.primaryContact !== "—" && (
                          <a
                            href={\`tel:\${c.primaryContact.replace(/[^0-9+]/g, "")}\`}
                            className="flex h-6.5 w-6.5 items-center justify-center rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 text-emerald-600 transition"
                            title={\`\${lang === "ur" ? "موبائل:" : "Mobile:"} \${c.primaryContact}\`}
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {c.primaryContact && c.primaryContact !== "—" && (
                          <a
                            href={\`https://wa.me/\${c.primaryContact.replace(/[^0-9]/g, "")}\`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-6.5 w-6.5 items-center justify-center rounded-lg bg-green-50 hover:bg-green-100 dark:bg-green-950 text-green-600 transition"
                            title={\`WhatsApp: \${c.primaryContact}\`}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Single 3-Dots Action Menu */}
                    <td className="p-3.5 text-center relative">
                      <div className="inline-block text-left">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenActionMenuId(openActionMenuId === c.id ? null : c.id);
                          }}
                          className="h-7 w-7 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer transition shadow-2xs"
                          title={tt("common.actions", "Actions")}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>

                        {openActionMenuId === c.id && (
                          <div 
                            className="absolute right-3 top-10 z-50 min-w-[160px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionMenuId(null);
                                setPreviewCompany(c);
                              }}
                              className="w-full px-3 py-2 text-left rtl:text-right flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5 text-blue-500" />
                              <span>{tt("creg.crtr_preview_details", "Preview Details")}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionMenuId(null);
                                router.push(\`/dashboard/settings/company-setup?companyId=\${c.id}\` as Route);
                              }}
                              className="w-full px-3 py-2 text-left rtl:text-right flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-indigo-600"
                            >
                              <PencilLine className="h-3.5 w-3.5" />
                              <span>{tt("branch.edit", "Edit Company")}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionMenuId(null);
                                handlePrint(c);
                              }}
                              className="w-full px-3 py-2 text-left rtl:text-right flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-emerald-600"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              <span>{tt("creg.crtr_duplicate_print", "Duplicate / Print")}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionMenuId(null);
                                setSelected360Party({ name: c.raw?.owner_name || c.consortium });
                              }}
                              className="w-full px-3 py-2 text-left rtl:text-right flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-purple-600"
                            >
                              <Globe className="h-3.5 w-3.5" />
                              <span>{lang === "ur" ? "360° پارٹی ریکارڈز" : "Party 360° Profile"}</span>
                            </button>
                            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionMenuId(null);
                                if (confirm(\`\${tt("creg.crtr_confirm_delete_prefix", "Are you sure you want to delete")} \${c.accountName}?\`)) {
                                  setCompanies((prev) => prev.filter((item) => item.id !== c.id));
                                }
                              }}
                              className="w-full px-3 py-2 text-left rtl:text-right flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>{tt("common.delete", "Delete")}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>`;

if (content.includes('{/* Primary Contact */}')) {
  content = content.replace(oldRowTail, newRowTail);
}

// 6. Party 360 modal render
if (!content.includes('<Party360Modal')) {
  content = content.replace(
    '      {/* ── PREVIEW DETAIL MODAL ── */}',
    `      {/* ── PARTY 360 MODAL ── */}
      {selected360Party && (
        <Party360Modal
          name={selected360Party.name}
          lang={lang as any}
          onClose={() => setSelected360Party(null)}
        />
      )}

      {/* ── PREVIEW DETAIL MODAL ── */}`
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ company-registry.tsx updated successfully!');
