import fs from 'fs';

const filePath = 'features/general-office/components/general-office-dashboard-view-clean.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
if (!content.includes('Party360Modal')) {
  content = content.replace(
    'import { transliterateProperNoun } from "@/lib/i18n/transliteration";',
    `import { transliterateProperNoun } from "@/lib/i18n/transliteration";\nimport { Party360Modal } from "@/features/customers/components/party-360-modal";\nimport { UniversalPartyDirectoryReport } from "@/features/customers/components/universal-party-directory-report";\nimport { Layers } from "lucide-react";`
  );
}

// 2. Add state
if (!content.includes('selected360Party')) {
  content = content.replace(
    'const [statusFilter, setStatusFilter] = useState("");',
    `const [statusFilter, setStatusFilter] = useState("");\n  const [selected360Party, setSelected360Party] = useState<{ id?: string; employeeId?: string; name: string } | null>(null);\n  const [showUniversalDirectory, setShowUniversalDirectory] = useState(false);`
  );
}

// 3. Add 360 directory button in header of Employees List
if (!content.includes('Universal Parties Directory')) {
  content = content.replace(
    `<div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 font-sans">
          <Users className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-bold tracking-wider text-slate-700 dark:text-slate-300 uppercase">{tr("EMPLOYEES LIST")}</span>
        </div>`,
    `<div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 font-sans">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-bold tracking-wider text-slate-700 dark:text-slate-300 uppercase">{tr("EMPLOYEES LIST")}</span>
          </div>
          <Button
            type="button"
            onClick={() => setShowUniversalDirectory(true)}
            className="gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold shadow-xs h-8.5 px-3 rounded-xl text-xs cursor-pointer"
          >
            <Layers className="h-3.5 w-3.5" />
            {lang === "ur" ? "360° ماسٹر پارٹیز ڈائریکٹری رپورٹ" : "360° Universal Parties Directory"}
          </Button>
        </div>`
  );
}

// 4. Add (+) button next to employee name
if (!content.includes('setSelected360Party')) {
  content = content.replace(
    `<div className="font-bold text-slate-900 dark:text-slate-100">
                          {localizeVisibleName(personFullName(emp.person || {}) || emp.name)}
                        </div>`,
    `<div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                          <span>{localizeVisibleName(personFullName(emp.person || {}) || emp.name)}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected360Party({ employeeId: emp.id, name: personFullName(emp.person || {}) || emp.name });
                            }}
                            className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black text-xs shadow-xs transition hover:scale-105 cursor-pointer"
                            title={lang === "ur" ? "360° تمام لنکس اور ریکارڈز دیکھیں" : "View 360° cross-system profile"}
                          >
                            +
                          </button>
                        </div>`
  );
}

// 5. Add modals before the closing div
if (!content.includes('<Party360Modal')) {
  content = content.replace(
    `{/* Loan/Advance Modal */}
      {selectedEmployeeForLoan && (`,
    `{/* 360 Degree Cross-System Party Modal */}
      {selected360Party && (
        <Party360Modal
          employeeId={selected360Party.employeeId}
          name={selected360Party.name}
          lang={lang as any}
          onClose={() => setSelected360Party(null)}
        />
      )}

      {/* Universal 360 Parties Directory Report Modal */}
      {showUniversalDirectory && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-3 sm:p-6 backdrop-blur-xs">
          <div className="relative w-full max-w-7xl max-h-[94vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 overflow-y-auto">
            <UniversalPartyDirectoryReport
              lang={lang as any}
              onClose={() => setShowUniversalDirectory(false)}
            />
          </div>
        </div>
      )}

      {/* Loan/Advance Modal */}
      {selectedEmployeeForLoan && (`
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Successfully patched general-office-dashboard-view-clean.tsx with 360 features!');
