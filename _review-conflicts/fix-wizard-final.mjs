// fix-wizard-final.mjs - Run with: node fix-wizard-final.mjs
// Precisely replaces lines 941-1002 with correct customer + sales account sections.
import { readFileSync, writeFileSync } from 'fs';

const file = 'features/sales/components/sales-order-wizard.jsx';
const raw = readFileSync(file, 'utf8');
const lines = raw.split('\n');
console.log(`Total lines: ${lines.length}`);

// ── Find line 941: first `max-h-64` inside customerDropdownOpen block ────────
// Unique anchor: line 940 is `</div>` closing the header, line 941 is the first max-h-64
// We identify it as the max-h-64 that comes after "Select Customer Account (DR)"

let customerListDivLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Select Customer Account (DR)')) {
    // The max-h-64 div is 3 lines later (after </span> </div>)
    for (let j = i + 1; j < i + 6; j++) {
      if (lines[j].includes('max-h-64')) {
        customerListDivLine = j;
        break;
      }
    }
    if (customerListDivLine !== -1) break;
  }
}

if (customerListDivLine === -1) {
  console.error('Could not find customer list div!');
  process.exit(1);
}
console.log(`Customer list div at line ${customerListDivLine + 1}: ${lines[customerListDivLine].trim()}`);

// ── Find the fieldset closing line ──────────────────────────────────────────
// We know </fieldset> is the boundary - find it after customerListDivLine
let fieldsetCloseLine = -1;
for (let i = customerListDivLine; i < lines.length; i++) {
  if (lines[i].trim() === '</fieldset>') {
    fieldsetCloseLine = i;
    console.log(`</fieldset> at line ${i + 1}`);
    break;
  }
}

if (fieldsetCloseLine === -1) {
  console.error('Could not find </fieldset>!');
  process.exit(1);
}

// ── Replace lines customerListDivLine .. fieldsetCloseLine-1 ─────────────────
// (we keep </fieldset> itself)
const replaceStart = customerListDivLine;    // line with first max-h-64 (0-indexed)
const replaceEnd   = fieldsetCloseLine;      // stop BEFORE </fieldset>

console.log(`\nReplacing lines ${replaceStart + 1} to ${replaceEnd} (${replaceEnd - replaceStart} lines)`);
console.log('--- Lines being replaced ---');
for (let i = replaceStart; i < replaceEnd; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}

const indent = '                          '; // 26 spaces - matches surrounding context
const replacement = [
  `                          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-0.5">`,
  `                            {dbAccounts.filter(acc => accountMatchesScope(acc) && accountMatchesSearch(acc, customerSearch)).map((acc) => {`,
  `                              const compName = acc.companyName || acc.company_name || (acc.companyId && dbCompanies.find(c => c.id === acc.companyId)?.name) || dbCompanies[0]?.name || "None";`,
  `                              return (`,
  `                                <button`,
  `                                  key={acc.accountCode}`,
  `                                  type="button"`,
  `                                  onClick={() => {`,
  `                                    applyAccountMaster("purchase", acc);`,
  `                                    setPurchaseDropdownOpen(false);`,
  `                                    setPurchaseSearch("");`,
  `                                  }}`,
  `                                  className="w-full text-left p-2.5 rounded-xl border border-border/60 hover:border-primary/50 hover:bg-primary/5 transition duration-150 group bg-background/60"`,
  `                                >`,
  `                                  <div className="flex justify-between items-start gap-2 mb-1">`,
  `                                    <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">{formatAccountDisplayLabel(acc.accountName, acc.accountCode, acc.manualReferenceNumber)}</span>`,
  `                                    <span className="font-mono text-[9.5px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">System: {acc.accountCode}</span>`,
  `                                  </div>`,
  `                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-[9px] text-muted-foreground">`,
  `                                    <div><span className="font-semibold text-foreground/80">Branch:</span> {acc.cityBranchName || "Main Branch"}</div>`,
  `                                    <div>`,
  `                                      {acc.manualReferenceNumber && (`,
  `                                        <div className="mb-0.5"><span className="font-semibold text-foreground/80">Manual A/C:</span> <span className="font-bold text-slate-700 dark:text-slate-300">{acc.manualReferenceNumber}</span></div>`,
  `                                      )}`,
  `                                      <div><span className="font-semibold text-foreground/80">Curr:</span> <span className="font-bold text-emerald-600 dark:text-emerald-400">{acc.ledgerCurrency || "PKR"}</span></div>`,
  `                                    </div>`,
  `                                    <div><span className="font-semibold text-foreground/80">Company:</span> <span className="truncate inline-block max-w-[120px] align-bottom">{compName}</span></div>`,
  `                                  </div>`,
  `                                </button>`,
  `                              );`,
  `                            })}`,
  `                            {dbAccounts.filter(acc => accountMatchesScope(acc) && accountMatchesSearch(acc, customerSearch)).length === 0 && (`,
  `                              <div className="p-4 text-center text-muted-foreground text-xs italic">`,
  `                                No matching accounts found. Try searching by Code, Name, Currency, or Phone.`,
  `                              </div>`,
  `                            )}`,
  `                          </div>`,
  `                        </div>`,
  `                      )}`,
  `                    </div>`,
  ``,
  `                    <div className="relative" ref={salesDropdownRef}>`,
  `                      <label className="block text-[10px] font-bold text-foreground mb-1">Sales Account (CR)*</label>`,
  `                      <div className="relative flex items-center">`,
  `                        <input`,
  `                          type="text"`,
  `                          placeholder={form.salesAccountName ? formatAccountDisplayLabel(form.salesAccountName, form.salesAccountNo, form.salesAccountManualReferenceNumber) : "Search Code, Name, Branch, Manual A/C..."}`,
  `                          value={salesDropdownOpen ? salesSearch : (form.salesAccountName ? formatAccountDisplayLabel(form.salesAccountName, form.salesAccountNo, form.salesAccountManualReferenceNumber) : form.salesAccountNo || "")}`,
  `                          onChange={(e) => handleTextChange("sales", e.target.value)}`,
  `                          onFocus={() => {`,
  `                            setSalesDropdownOpen(true);`,
  `                            setSalesPinDropdownOpen(false);`,
  `                            setSalesSearch("");`,
  `                          }}`,
  `                          className="w-full bg-background border border-input rounded pl-2.5 pr-8 py-1.5 text-foreground font-semibold outline-none focus:border-primary text-xs h-9"`,
  `                        />`,
  `                        <button`,
  `                          type="button"`,
  `                          disabled={!form.salesId}`,
  `                          onClick={() => {`,
  `                            setSalesPinDropdownOpen(prev => !prev);`,
  `                            setSalesDropdownOpen(false);`,
  `                          }}`,
  `                          className="absolute right-2 text-muted-foreground hover:text-primary transition-colors disabled:opacity-30"`,
  `                        >`,
  `                          <Pin className={\`h-3.5 w-3.5 \${salesPinDropdownOpen ? "text-primary rotate-45" : ""}\`} />`,
  `                        </button>`,
  `                      </div>`,
  `                      {salesDropdownOpen && (`,
  `                        <div className="absolute left-0 mt-1.5 w-full min-w-[290px] sm:min-w-[440px] md:min-w-[520px] rounded-2xl bg-card border-2 border-primary/40 shadow-2xl z-[80] p-2 overflow-hidden backdrop-blur-md">`,
  `                          <div className="flex justify-between items-center px-2.5 py-1.5 bg-primary/5 rounded-lg mb-1.5 border border-primary/10">`,
  `                            <span className="text-[10px] font-black uppercase text-primary tracking-wider">Select Sales Account (CR)</span>`,
  `                            <span className="text-[9px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">`,
  `                              {dbAccounts.filter(acc => accountMatchesScope(acc) && accountMatchesSearch(acc, salesSearch)).length} found`,
  `                            </span>`,
  `                          </div>`,
  `                          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-0.5">`,
  `                            {dbAccounts.filter(acc => accountMatchesScope(acc) && accountMatchesSearch(acc, salesSearch)).map((acc) => {`,
  `                              const compName = acc.companyName || acc.company_name || (acc.companyId && dbCompanies.find(c => c.id === acc.companyId)?.name) || dbCompanies[0]?.name || "None";`,
  `                              return (`,
  `                                <button`,
  `                                  key={acc.accountCode}`,
  `                                  type="button"`,
  `                                  onClick={() => {`,
  `                                    applyAccountMaster("sales", acc);`,
  `                                    setSalesDropdownOpen(false);`,
  `                                    setSalesSearch("");`,
  `                                  }}`,
  `                                  className="w-full text-left p-2.5 rounded-xl border border-border/60 hover:border-primary/50 hover:bg-primary/5 transition duration-150 group bg-background/60"`,
  `                                >`,
  `                                  <div className="flex justify-between items-start gap-2 mb-1">`,
  `                                    <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">{formatAccountDisplayLabel(acc.accountName, acc.accountCode, acc.manualReferenceNumber)}</span>`,
  `                                    <span className="font-mono text-[9.5px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">System: {acc.accountCode}</span>`,
  `                                  </div>`,
  `                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-[9px] text-muted-foreground">`,
  `                                    <div><span className="font-semibold text-foreground/80">Branch:</span> {acc.cityBranchName || "Main Branch"}</div>`,
  `                                    <div>`,
  `                                      {acc.manualReferenceNumber && (`,
  `                                        <div className="mb-0.5"><span className="font-semibold text-foreground/80">Manual A/C:</span> <span className="font-bold text-slate-700 dark:text-slate-300">{acc.manualReferenceNumber}</span></div>`,
  `                                      )}`,
  `                                      <div><span className="font-semibold text-foreground/80">Curr:</span> <span className="font-bold text-emerald-600 dark:text-emerald-400">{acc.ledgerCurrency || "PKR"}</span></div>`,
  `                                    </div>`,
  `                                    <div><span className="font-semibold text-foreground/80">Company:</span> <span className="truncate inline-block max-w-[120px] align-bottom">{compName}</span></div>`,
  `                                  </div>`,
  `                                </button>`,
  `                              );`,
  `                            })}`,
  `                            {dbAccounts.filter(acc => accountMatchesScope(acc) && accountMatchesSearch(acc, salesSearch)).length === 0 && (`,
  `                              <div className="p-4 text-center text-muted-foreground text-xs italic">`,
  `                                No matching accounts found. Try searching by Code, Name, Currency, or Phone.`,
  `                              </div>`,
  `                            )}`,
  `                          </div>`,
  `                        </div>`,
  `                      )}`,
  `                    </div>`,
  `                  </div>`,
];

lines.splice(replaceStart, replaceEnd - replaceStart, ...replacement);
console.log(`\nTotal lines after fix: ${lines.length}`);
writeFileSync(file, lines.join('\n'), 'utf8');
console.log('✅ Saved.');

// Verify: show the full replaced section
const after = readFileSync(file, 'utf8').split('\n');
console.log('\n--- Final structure (lines around fix) ---');
for (let i = Math.max(0, replaceStart - 3); i < replaceStart + replacement.length + 4 && i < after.length; i++) {
  console.log(`${i+1}: ${after[i]}`);
}
