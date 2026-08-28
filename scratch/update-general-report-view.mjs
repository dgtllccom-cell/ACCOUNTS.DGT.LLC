import fs from 'fs';

const filePath = 'features/reports/ledger-report/components/ledger-general-report-view.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace the panel section
const oldStart = '<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">';
const oldEnd = '{/* Account Details section was moved to header area per user request */}';

const startIdx = content.indexOf(oldStart);
const endIdx = content.indexOf(oldEnd);

if (startIdx === -1 || endIdx === -1) {
  console.error("Could not find panel boundary in ledger-general-report-view.tsx");
  process.exit(1);
}

const replacement = `<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Panel 1: Branch & User Details */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-blue-50/50 dark:bg-blue-900/10">
            <div className="bg-blue-600 p-1 rounded-full text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-400">
              {th("1. BRANCH & USER DETAILS")}
            </h4>
          </div>
          <div className="p-4 flex flex-col gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>{th("COUNTRY:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{(sessionInfo as any)?.scopes?.summary?.countryName || "United Arab Emirates"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{th("BRANCH NAME:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{(sessionInfo as any)?.scopes?.summary?.branchDisplayName || (sessionInfo as any)?.scopes?.summary?.branchName || "UNITED ARAB EMIRATES MAIN BRANCH"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{th("USER ID:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[9px] font-mono">{sessionInfo?.user?.id || "9B9D24D9-5532-47A1-B612-3E95F2285AB6"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{th("USER NAME:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{sessionInfo?.user?.fullName || sessionInfo?.user?.email || "SUPER ADMIN"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{th("ROLE:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{(sessionInfo as any)?.roles?.[0]?.replace(/_/g, " ") || "SUPER ADMIN"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{th("DATE & TIME:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}, {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
            </div>
            <div className="flex justify-between items-center mt-auto pt-1">
              <span>{th("STATUS:")}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded text-[10px]">{th("ACTIVE")}</span>
            </div>
          </div>
        </div>

        {/* Panel 2: Global Financial Summary */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-900/10">
            <div className="bg-emerald-600 p-1 rounded-full text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              {th("2. GLOBAL FINANCIAL SUMMARY")}
            </h4>
          </div>
          <div className="p-4 flex flex-col gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>{th("TOTAL GLOBAL ENTRIES:")}</span>
              <span className="font-black text-slate-800 dark:text-slate-200">{summary?.entries || displayRows.reduce((acc, r) => acc + (r.entries || 0), 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{th("TOTAL CREDIT (AED):")}</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">{fmtNumber(summary?.credit || displayRows.reduce((acc, r) => acc + (r.credit || 0), 0))}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-rose-600 dark:text-rose-400">{th("TOTAL DEBIT (AED):")}</span>
              <span className="font-black text-rose-600 dark:text-rose-400 font-mono">{fmtNumber(summary?.debit || displayRows.reduce((acc, r) => acc + (r.debit || 0), 0))}</span>
            </div>
            <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-700 dark:text-slate-300 font-bold">{th("BALANCE (AED):")}</span>
              <span className="font-black text-blue-600 dark:text-blue-400 font-mono text-sm">{fmtNumber(summary?.balance || displayRows.reduce((acc, r) => acc + (r.balance || 0), 0))}</span>
            </div>
            {displayRows.length === 0 && !loading && (
              <div className="mt-1 rounded bg-emerald-50/60 dark:bg-emerald-950/30 p-1.5 text-[10px] text-emerald-800 dark:text-emerald-300 font-medium text-center">
                {th("NO FINANCIAL ENTRIES AVAILABLE FOR THE SELECTED DATE RANGE.")}
              </div>
            )}
          </div>
        </div>

        {/* Panel 3: Bill Entries Summary */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-purple-50/50 dark:bg-purple-900/10">
            <div className="bg-purple-600 p-1 rounded-full text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider text-purple-800 dark:text-purple-400">
              {th("3. BILL ENTRIES SUMMARY")}
            </h4>
          </div>
          <div className="p-4 flex flex-col gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>{th("TOTAL BILL ENTRIES:")}</span>
              <span className="font-black text-slate-800 dark:text-slate-200">{displayRows.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{th("CLEARED ENTRIES:")}</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-rose-600">{th("REMAINING ENTRIES:")}</span>
              <span className="font-black text-rose-600">{displayRows.length}</span>
            </div>
            <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px]">
              <span>{th("STATUS:")}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{th("ACTIVE")}</span>
            </div>
            {displayRows.length === 0 && !loading && (
              <div className="mt-1 rounded bg-purple-50/60 dark:bg-purple-950/30 p-1.5 text-[10px] text-purple-800 dark:text-purple-300 font-medium text-center">
                {th("NO FINANCIAL ENTRIES AVAILABLE FOR THE SELECTED DATE RANGE.")}
              </div>
            )}
          </div>
        </div>

        {/* Panel 4: All Countries Report */}
        <div
          className={cn(
            "flex flex-col rounded-xl border transition-all duration-200 text-left overflow-hidden h-full",
            showAllCountries
              ? "border-orange-500 bg-orange-50/30 shadow-md dark:border-orange-500/50 dark:bg-orange-950/20"
              : "border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
          )}
        >
          <div className={cn(
            "flex items-center justify-between px-4 py-3 border-b w-full",
            showAllCountries
              ? "border-orange-200 bg-orange-100/50 dark:border-orange-900/50 dark:bg-orange-900/30"
              : "border-slate-100 bg-orange-50/50 dark:border-slate-800 dark:bg-orange-900/10"
          )}>
            <div className="flex items-center gap-2">
              <div className="bg-orange-600 p-1 rounded-full text-white">
                <Globe className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-xs font-black uppercase tracking-wider text-orange-800 dark:text-orange-400">
                {th("4. ALL COUNTRIES REPORT")}
              </h4>
            </div>
          </div>
          <div className="p-4 flex flex-col justify-between flex-1 w-full gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>{th("TOTAL COUNTRIES:")}</span>
              <span className="font-black text-slate-800 dark:text-slate-200">{countryDashboardData.length || countryOptions.length || 1}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{th("TOTAL ENTRIES:")}</span>
              <span className="font-black text-slate-800 dark:text-slate-200">{countryDashboardData.reduce((acc, c) => acc + c.entries, 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{th("TOTAL CREDIT (AED):")}</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">{fmtNumber(countryDashboardData.reduce((acc, c) => acc + c.credit, 0))}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-rose-600 dark:text-rose-400">{th("TOTAL DEBIT (AED):")}</span>
              <span className="font-black text-rose-600 dark:text-rose-400 font-mono">{fmtNumber(countryDashboardData.reduce((acc, c) => acc + c.debit, 0))}</span>
            </div>
            <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAllCountries(!showAllCountries)}
                className="w-full text-center text-[10.5px] uppercase font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 py-0.5 hover:underline flex items-center justify-center gap-1 cursor-pointer"
              >
                {showAllCountries ? th("HIDE ALL ENTRIES REPORT") : th("SHOW ALL ENTRIES REPORT")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Country & Branch Breakdown Accordion */}
      {showAllCountries && (
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden p-4 animate-in fade-in slide-in-from-top-2 duration-200 mb-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {countryDashboardData.map((item) => (
              <details key={item.name} className="group/card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900" open>
                <summary className="cursor-pointer list-none">
                  <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 text-white flex justify-between items-center">
                    <span className="font-black tracking-wide text-sm flex items-center gap-2">
                      <span className="transition-transform group-open/card:rotate-90">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                      </span>
                      {getFlag(item.name)} {item.name}
                    </span>
                    <span className="bg-white/20 text-[10px] font-bold px-2 py-0.5 rounded-full">{item.entries} {th("ENTRIES")}</span>
                  </div>
                  <div className="p-4 space-y-3 bg-white dark:bg-slate-950">
                    <div className="flex justify-between items-end border-b border-slate-100 dark:border-slate-800 pb-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{th("CURRENCY")}</span>
                      <span className="text-base font-black text-slate-800 dark:text-slate-200">{item.currency}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500">{th("TOTAL CREDIT")}</span>
                      <span className="font-black text-emerald-600">{fmtNumber(item.credit)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500">{th("TOTAL DEBIT")}</span>
                      <span className="font-black text-rose-600">{fmtNumber(item.debit)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-500 uppercase">{th("BALANCE")}</span>
                      <span className="text-lg font-black text-slate-900 dark:text-slate-100">{fmtNumber(item.balance)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px]">
                      <span className="font-semibold text-slate-500">{item.activeAccounts} {th("ACTIVE ACCOUNTS")}</span>
                      <span className="font-semibold text-slate-500">{item.branches.size} {th("BRANCHES")}</span>
                    </div>
                  </div>
                </summary>

                {/* Branch Details Expanded Content */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 border-t border-slate-100 dark:border-slate-800 max-h-[300px] overflow-y-auto space-y-2">
                  <div className="text-[10px] font-bold uppercase text-slate-500 mb-1 pl-1">{th("BRANCH BREAKDOWN")}</div>
                  {Array.from(item.branchData.values()).map((b) => (
                    <div key={b.name} className="bg-white dark:bg-slate-950 rounded-lg p-2.5 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase truncate pr-2">{b.name}</span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 rounded">{b.entries} {th("ENTRIES")}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] mb-1">
                        <span className="font-semibold text-slate-500">{th("CREDIT")}:</span>
                        <span className="font-bold text-emerald-600">{fmtNumber(b.credit)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] mb-1">
                        <span className="font-semibold text-slate-500">{th("DEBIT")}:</span>
                        <span className="font-bold text-rose-600">{fmtNumber(b.debit)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="font-semibold text-slate-500">{th("BALANCE")}:</span>
                        <span className="font-bold text-blue-600">{fmtNumber(b.balance)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      `;

const newContent = content.substring(0, startIdx) + replacement + content.substring(endIdx);
fs.writeFileSync(filePath, newContent, 'utf8');
console.log("Successfully updated ledger-general-report-view.tsx panels with th(...)");
