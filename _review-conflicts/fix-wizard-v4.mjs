// fix-wizard-v4.mjs - Run with: node fix-wizard-v4.mjs
import { readFileSync, writeFileSync } from 'fs';

const file = 'features/sales/components/sales-order-wizard.jsx';
const raw = readFileSync(file, 'utf8');
const lines = raw.split('\n');
console.log(`Total lines: ${lines.length}`);

// ── Find the exact line with the broken `>` of the company button (line 895) ──
// The line before it is:  title={c.name}
// The broken line is:     >   (just a `>`)
// Then immediately garbage follows.

let brokenLineIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (
    lines[i].trim() === '>' &&
    i > 0 &&
    lines[i-1].trim().includes('title={c.name}')
  ) {
    brokenLineIdx = i;
    console.log(`Found broken company button > at line ${i+1}`);
    break;
  }
}

if (brokenLineIdx === -1) {
  console.error('Could not find the broken line. Dumping lines 890-910:');
  for (let i = 889; i < 910 && i < lines.length; i++) {
    console.log(`${i+1}: [${lines[i]}]`);
  }
  process.exit(1);
}

// Find the end of the corrupt block — the line BEFORE `ref={salesDropdownRef}`
let salesRefLine = -1;
for (let i = brokenLineIdx; i < lines.length; i++) {
  if (lines[i].includes('ref={salesDropdownRef}')) {
    salesRefLine = i;
    console.log(`Found salesDropdownRef at line ${i+1}`);
    break;
  }
}

if (salesRefLine === -1) {
  console.error('Could not find salesDropdownRef!');
  process.exit(1);
}

// The corrupt range is brokenLineIdx .. salesRefLine-1 (inclusive)
// We replace it with the correct company button body + map close + dropdown close
// + customer dropdown section
console.log(`\nReplacing lines ${brokenLineIdx+1} to ${salesRefLine} with correct content`);
console.log('--- Lines being replaced ---');
for (let i = brokenLineIdx; i < salesRefLine; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}

const replacement = [
  `                                 >`,
  `                                   {c.name} ({cCode})`,
  `                                 </button>`,
  `                               );`,
  `                             })`,
  `                           )}`,
  `                         </div>`,
  `                       </div>`,
  `                     )}`,
  `                   </div>`,
  ``,
  `                   <div className="relative" ref={customerDropdownRef}>`,
  `                     <label className="block text-[10px] font-bold text-foreground mb-1">Customer Account (DR)*</label>`,
  `                     <div className="relative flex items-center">`,
  `                       <input`,
  `                         type="text"`,
  `                         placeholder={form.customerAccountName ? formatAccountDisplayLabel(form.customerAccountName, form.customerAccountNo, form.customerAccountManualReferenceNumber) : "Search Code, Name, Branch, Manual A/C..."}`,
  `                         value={customerDropdownOpen ? customerSearch : (form.customerAccountName ? formatAccountDisplayLabel(form.customerAccountName, form.customerAccountNo, form.customerAccountManualReferenceNumber) : form.customerAccountNo || "")}`,
  `                         onChange={(e) => handleTextChange("purchase", e.target.value)}`,
  `                         onFocus={() => {`,
  `                           setPurchaseDropdownOpen(true);`,
  `                           setPurchasePinDropdownOpen(false);`,
  `                           setPurchaseSearch("");`,
  `                         }}`,
  `                         className="w-full bg-background border border-input rounded pl-2.5 pr-8 py-1.5 text-foreground font-semibold outline-none focus:border-primary text-xs h-9"`,
  `                       />`,
  `                       <button`,
  `                         type="button"`,
  `                         disabled={!form.customerId}`,
  `                         onClick={() => {`,
  `                           setPurchasePinDropdownOpen(prev => !prev);`,
  `                           setPurchaseDropdownOpen(false);`,
  `                         }}`,
  `                         className="absolute right-2 text-muted-foreground hover:text-primary transition-colors disabled:opacity-30"`,
  `                       >`,
  `                         <Pin className={\`h-3.5 w-3.5 \${customerPinDropdownOpen ? "text-primary rotate-45" : ""}\`} />`,
  `                       </button>`,
  `                     </div>`,
  `                     {customerDropdownOpen && (`,
  `                       <div className="absolute left-0 mt-1.5 w-full min-w-[290px] sm:min-w-[440px] md:min-w-[520px] rounded-2xl bg-card border-2 border-primary/40 shadow-2xl z-[80] p-2 overflow-hidden backdrop-blur-md">`,
  `                         <div className="flex justify-between items-center px-2.5 py-1.5 bg-primary/5 rounded-lg mb-1.5 border border-primary/10">`,
  `                           <span className="text-[10px] font-black uppercase text-primary tracking-wider">Select Customer Account (DR)</span>`,
  `                           <span className="text-[9px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">`,
  `                             {dbAccounts.filter(acc => accountMatchesScope(acc) && accountMatchesSearch(acc, customerSearch)).length} found`,
  `                           </span>`,
  `                         </div>`,
  `                         <div className="max-h-64 overflow-y-auto space-y-1.5 pr-0.5">`,
  `                           {dbAccounts.filter(acc => accountMatchesScope(acc) && accountMatchesSearch(acc, customerSearch)).map((acc) => {`,
  `                             const compName = acc.companyName || acc.company_name || (acc.companyId && dbCompanies.find(c => c.id === acc.companyId)?.name) || dbCompanies[0]?.name || "None";`,
  `                             return (`,
  `                               <button`,
  `                                 key={acc.accountCode}`,
  `                                 type="button"`,
  `                                 onClick={() => {`,
  `                                   applyAccountMaster("purchase", acc);`,
  `                                   setPurchaseDropdownOpen(false);`,
  `                                   setPurchaseSearch("");`,
  `                                 }}`,
  `                                 className="w-full text-left p-2.5 rounded-xl border border-border/60 hover:border-primary/50 hover:bg-primary/5 transition duration-150 group bg-background/60"`,
  `                               >`,
  `                                 <div className="flex justify-between items-start gap-2 mb-1">`,
  `                                   <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">{formatAccountDisplayLabel(acc.accountName, acc.accountCode, acc.manualReferenceNumber)}</span>`,
  `                                   <span className="font-mono text-[9.5px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">System: {acc.accountCode}</span>`,
  `                                 </div>`,
  `                                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-[9px] text-muted-foreground">`,
  `                                   <div><span className="font-semibold text-foreground/80">Branch:</span> {acc.cityBranchName || "Main Branch"}</div>`,
  `                                   <div>`,
  `                                     {acc.manualReferenceNumber && (`,
  `                                       <div className="mb-0.5"><span className="font-semibold text-foreground/80">Manual A/C:</span> <span className="font-bold text-slate-700 dark:text-slate-300">{acc.manualReferenceNumber}</span></div>`,
  `                                     )}`,
  `                                     <div><span className="font-semibold text-foreground/80">Curr:</span> <span className="font-bold text-emerald-600 dark:text-emerald-400">{acc.ledgerCurrency || "PKR"}</span></div>`,
  `                                   </div>`,
  `                                   <div><span className="font-semibold text-foreground/80">Company:</span> <span className="truncate inline-block max-w-[120px] align-bottom">{compName}</span></div>`,
  `                                 </div>`,
  `                               </button>`,
  `                             );`,
  `                           })}`,
  `                           {dbAccounts.filter(acc => accountMatchesScope(acc) && accountMatchesSearch(acc, customerSearch)).length === 0 && (`,
  `                             <div className="p-4 text-center text-muted-foreground text-xs italic">`,
  `                               No matching accounts found. Try searching by Code, Name, Currency, or Phone.`,
  `                             </div>`,
  `                           )}`,
  `                         </div>`,
  `                       </div>`,
  `                     )}`,
  `                   </div>`,
  ``,
];

lines.splice(brokenLineIdx, salesRefLine - brokenLineIdx, ...replacement);
console.log(`\nTotal lines after fix: ${lines.length}`);
writeFileSync(file, lines.join('\n'), 'utf8');
console.log('✅ Saved.');

// Verify result
const after = readFileSync(file, 'utf8').split('\n');
console.log('\n--- Result around fix ---');
for (let i = Math.max(0, brokenLineIdx - 2); i < brokenLineIdx + replacement.length + 3 && i < after.length; i++) {
  console.log(`${i+1}: ${after[i]}`);
}
