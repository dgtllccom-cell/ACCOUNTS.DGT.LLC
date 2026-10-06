// fix-wizard.mjs - Run with: node fix-wizard.mjs
// This script surgically repairs the sales-order-wizard.jsx file
// by finding corruption markers and replacing the broken sections.

import { readFileSync, writeFileSync } from 'fs';

const file = 'features/sales/components/sales-order-wizard.jsx';
const raw = readFileSync(file, 'utf8');
const lines = raw.split('\n');
console.log(`Total lines: ${lines.length}`);

// ─── FIND THE CORRUPTION ────────────────────────────────────────────────────
// The corruption is in the customer account dropdown list item.
// Look for the first line containing BOTH the duplicate check pattern OR
// the line with '{salesDropdownOpen && (' that has no proper wrapper before it.

// Strategy: find the line with 'applyAccountMaster("purchase"' and work from there.
let purchaseApplyLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('applyAccountMaster("purchase"') || lines[i].includes("applyAccountMaster('purchase'")) {
    purchaseApplyLine = i;
    console.log(`Found applyAccountMaster("purchase") on line ${i+1}`);
    break;
  }
}

if (purchaseApplyLine === -1) {
  console.error('Could not find applyAccountMaster("purchase") - aborting');
  process.exit(1);
}

// The button that contains this starts about 5 lines before
// Find the opening <button line before it
let buttonStart = purchaseApplyLine;
while (buttonStart > 0 && !lines[buttonStart].trim().startsWith('<button')) {
  buttonStart--;
}
console.log(`Button starts on line ${buttonStart+1}: ${lines[buttonStart].trim()}`);

// Now find the end of this entire customer dropdown section.
// It should close with: </div></div>)} </div> (customer dropdown end + outer div end)
// Then the sales dropdown begins.
// Find the next occurrence of 'setSalesDropdownOpen(false)' after purchaseApplyLine
// which signals we're inside the sales dropdown apply handler.
let salesApplyLine = -1;
for (let i = purchaseApplyLine + 1; i < lines.length; i++) {
  if (lines[i].includes('setSalesDropdownOpen(false)')) {
    salesApplyLine = i;
    console.log(`Found setSalesDropdownOpen(false) on line ${i+1}`);
    break;
  }
}

if (salesApplyLine === -1) {
  console.error('Could not find setSalesDropdownOpen(false) - aborting');
  process.exit(1);
}

// The sales accounts list (good part) starts with the button containing setSalesDropdownOpen(false).
// Find the start of that button.
let salesButtonStart = salesApplyLine;
while (salesButtonStart > 0 && !lines[salesButtonStart].trim().startsWith('<button')) {
  salesButtonStart--;
}
console.log(`Sales button starts on line ${salesButtonStart+1}`);

// Everything from buttonStart to salesButtonStart-1 is the corrupt customer dropdown.
// We need to replace it with the correct customer account button + dropdown close + sales account section.
console.log(`\nReplacing lines ${buttonStart+1} to ${salesButtonStart} with correct content`);

// Show what we're replacing
console.log('\n--- Lines being replaced ---');
for (let i = buttonStart; i < salesButtonStart; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}

// The replacement: correct customer account button + close of customer dropdown + full sales account input
const replacement = [
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
  `                          disabled={!form.customerId}`,
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
];

lines.splice(buttonStart, salesButtonStart - buttonStart, ...replacement);
console.log(`\nTotal lines after fix: ${lines.length}`);
writeFileSync(file, lines.join('\n'), 'utf8');
console.log('✅ Done! File saved.');

// Verify
const after = readFileSync(file, 'utf8').split('\n');
console.log('\n--- Result around fix point ---');
for (let i = Math.max(0, buttonStart - 2); i < buttonStart + replacement.length + 2; i++) {
  console.log(`${i+1}: ${after[i]}`);
}
