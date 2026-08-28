import fs from 'fs';

const filePath = 'features/currency/daily-exchange-rate-manager.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const anchor = `            {/* 3. Credit Dollar Price ($) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-black uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                {th("4. CREDIT DOLLAR PRICE ($)")}
              </Label>
              <div className="relative">
                <Input
                  type="number"`;

const anchorIdx = content.indexOf(anchor);
if (anchorIdx === -1) {
  console.error("Anchor not found");
  process.exit(1);
}

const endAnchor = `              {/* Branch Filter */}`;
const endAnchorIdx = content.indexOf(endAnchor, anchorIdx);

if (endAnchorIdx === -1) {
  console.error("End anchor not found");
  process.exit(1);
}

const fullFormAndHeader = `            {/* 3. Credit Dollar Price ($) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-black uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                {th("4. CREDIT DOLLAR PRICE ($)")}
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="e.g. 280.00"
                  value={creditPrice}
                  onChange={(e) => setCreditPrice(e.target.value)}
                  className="h-10 text-xs font-black font-mono text-emerald-700 dark:text-emerald-400 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 focus:border-emerald-500"
                />
                <span className="absolute right-3 top-2.5 text-[11px] font-mono font-bold text-slate-400">
                  {selectedCountry?.currency_code || "---"}
                </span>
              </div>
            </div>

            {/* 4. Debit Dollar Price ($) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-black uppercase text-blue-700 dark:text-blue-400 flex items-center gap-1">
                <ArrowDownLeft className="w-3.5 h-3.5" />
                {th("5. DEBIT DOLLAR PRICE ($)")}
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="e.g. 278.50"
                  value={debitPrice}
                  onChange={(e) => setDebitPrice(e.target.value)}
                  className="h-10 text-xs font-black font-mono text-blue-700 dark:text-blue-400 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 focus:border-blue-500"
                />
                <span className="absolute right-3 top-2.5 text-[11px] font-mono font-bold text-slate-400">
                  {selectedCountry?.currency_code || "---"}
                </span>
              </div>
            </div>

            {/* Save Button */}
            <Button
              type="submit"
              disabled={saving}
              className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2 pt-1"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? th("SAVING EXCHANGE RATE...") : th("SAVE EXCHANGE RATE")}
            </Button>
          </form>

          {message && (
            <div className={cn(
              "flex items-center gap-2 text-xs font-bold p-3 rounded-xl border animate-in fade-in duration-150",
              message.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                : "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
            )}>
              {message.type === "success" ? (
                <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" />
              )}
              <span>{message.text}</span>
            </div>
          )}
        </div>

        {/* ── Right Column (8 Cols): Expanded Super Admin Table with Header Search Filters ── */}
        <div className="lg:col-span-8 space-y-3">
          
          {/* Header Filter Controls Bar */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xs border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wide flex items-center gap-2 text-emerald-400">
                  <Clock className="w-4 h-4" />
                  {th("SUPER ADMIN LIVE EXCHANGE RATES TABLE")}
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">
                  Audited intra-day exchange rates recorded by users and branch terminals worldwide.
                </p>
              </div>
              <span className="text-[10px] font-mono font-black bg-slate-800 text-emerald-400 px-2.5 py-1 rounded-lg border border-slate-700 shadow-xs">
                TOTAL ENTRIES: {rates.length}
              </span>
            </div>

            {/* Filter Dropdowns Row */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-slate-800 dark:text-slate-100">
              
              {/* Country Filter */}
              <div>
                <select
                  value={filterCountryId}
                  onChange={(e) => setFilterCountryId(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg bg-slate-800 text-slate-100 border border-slate-700 text-[11px] font-bold outline-none uppercase"
                >
                  <option value="all">{th("ALL COUNTRIES")}</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.currency_code})
                    </option>
                  ))}
                </select>
              </div>

`;

content = content.substring(0, anchorIdx) + fullFormAndHeader + content.substring(endAnchorIdx);
fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully fixed daily-exchange-rate-manager.tsx cleanly!");
