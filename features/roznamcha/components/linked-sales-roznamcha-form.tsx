"use client";

import type { ReactNode } from "react";
import { BookOpen, Coins, FileText, Layers, MapPin, Pencil, Phone, CreditCard, Plus, RotateCcw, Save, Search, Target, User, X } from "lucide-react";
import { TransferDetailsSection, type BankItem } from "./transfer-details-section";
import { t } from "@/lib/i18n/ui";
import { translateHeader } from "@/lib/i18n/table-headers";
import type { SupportedLanguage } from "@/lib/i18n/languages";

const field = "h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const section = "rounded-xl border border-slate-200/80 p-2.5 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs";
const neutral = "flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 disabled:opacity-50 sm:flex-none";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="min-w-0"><span className="mb-0.5 block text-[10px] font-semibold text-slate-500 dark:text-slate-400">{label}</span>{children}</label>;
}
function Value({ value }: { value?: string }) {
  return <input className={field} value={value || "—"} readOnly />;
}
function Step({ number, icon, title, children }: { number: number; icon: ReactNode; title: string; children: ReactNode }) {
  return <section className={section}>
    <div className="mb-2 flex items-center gap-1.5 text-xs font-bold">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">{number}</span>
      <span className="text-blue-600 dark:text-blue-400">{icon}</span>{title}
    </div>{children}
  </section>;
}
function Detail({ icon, title, entries }: { icon: ReactNode; title: string; entries: [string, string][] }) {
  return <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
    <div className="mb-3 flex items-center gap-2 text-xs font-bold"><span className="text-blue-600 dark:text-blue-400">{icon}</span>{title}</div>
    <dl className="space-y-2 text-xs">{entries.map(([label, value]) => (
      <div key={label} className="flex justify-between gap-2 border-b border-slate-100 py-1 last:border-0 dark:border-slate-800">
        <dt className="text-slate-500">{label}</dt><dd className="min-w-0 break-words text-right font-semibold">{value || "—"}</dd>
      </div>
    ))}</dl>
  </section>;
}

type Props = {
  lang: SupportedLanguage;
  bill: string; country: string; branch: string; city: string; currency: string; originalCurrency: string;
  party: string; approvedRate: number | null;
  approvedFinal: number | null; paidOriginal: number | null; remainingOriginal: number | null;
  accounts: { id: string; name: string; code: string; type: string; parent: string }[];
  ledgerId: string; reference: string; amount: string; date: string; remarks: string;
  onLedger: (value: string) => void; onReference: (value: string) => void; onAmount: (value: string) => void;
  onDate: (value: string) => void; onRemarks: (value: string) => void;
  onClear: () => void; onClose: () => void; onSave: (startNew: boolean) => void;
  disabled: boolean; busy: boolean; canSave: boolean; notice?: ReactNode;
  countryId?: string;
  method: "cash" | "bank";
  methodLocked: boolean;
  cash: { name: string; mobile: string; idDocument: string };
  bank: { id: string; label: string; account: string; mode: string };
  onMethod: (value: "cash" | "bank") => void;
  onCash: (field: "name" | "mobile" | "idDocument", value: string) => void;
  onBankRecord: (bank: BankItem | null, label?: string) => void;
  onBankMode: (value: string) => void;
};
export function LinkedSalesRoznamchaForm(p: Props) {
  const h = (label: string) => translateHeader(p.lang, label);
  const tr = (key: Parameters<typeof t>[1], fallback: string) => t(p.lang, key, fallback);
  const account = p.accounts.find(x => x.id === p.ledgerId);
  const lock = p.disabled || p.busy;
  const financial = (value: number | null, currency: string) =>
    value !== null && Number.isFinite(value) && currency ? `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
  const moneyEntered = Number(p.amount);
  return <>
    {p.notice}
    <section className="mt-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold"><Target className="h-4 w-4 text-blue-600" />{tr("cj.mStep1", "Entry Scope & Branch")}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label={h("Country")}><Value value={p.country}/></Field>
        <Field label={h("Branch")}><Value value={p.branch}/></Field>
        <Field label={h("City / Location")}><Value value={p.city}/></Field>
        <Field label={h("Entry Date")}><input className={field} type="date" disabled={lock} value={p.date} onChange={e => p.onDate(e.target.value)}/></Field>
      </div>
    </section>
    <div className="mt-2.5 grid grid-cols-1 items-start gap-3 lg:grid-cols-12">
      <div className="space-y-2 lg:col-span-8">
        <Step number={1} icon={<Layers className="h-4 w-4"/>} title={tr("cef.step1_setup", "Category & Entry Setup")}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field label={h("Category")}><Value value={h("Sales Payments")}/></Field>
            <Field label={tr("cef.reference_voucher", "Reference / Voucher No.")}>
              {p.method === "bank" ? <Value value={p.reference}/> : <input className={field} disabled={lock} aria-label={h("Receipt Reference")} maxLength={140} value={p.reference} onChange={e => p.onReference(e.target.value)}/>}
            </Field>
            <Field label={tr("cef.entry_type", "Entry Type")}>
              <select className={field} disabled={lock || p.methodLocked} value={p.method} onChange={e => p.onMethod(e.target.value === "bank" ? "bank" : "cash")}>
                {(p.method === "cash" || !p.methodLocked) && <option value="cash">{h("Cash Roznamcha")}</option>}
                {(p.method === "bank" || !p.methodLocked) && <option value="bank">{h("Bank")} / {tr("cef.opt_cheque", "Cheque")}</option>}
              </select>
            </Field>
            <Field label={h("Currency")}><Value value={p.currency}/></Field>
          </div>
        </Step>
        <Step number={2} icon={<Search className="h-4 w-4"/>} title={h("Account Selection")}>
          <Field label={h("Receiving Account")}><select className={field} aria-label={h("Receiving Account")} disabled={lock} value={p.ledgerId} onChange={e => p.onLedger(e.target.value)}>
            <option value="">—</option>{p.accounts.map(x => <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}
          </select></Field>
        </Step>
        <Step number={3} icon={<User className="h-4 w-4"/>} title={p.method === "bank" ? tr("cj.mBankDetails", "Bank Details") : tr("rvp.party_details", "Party / Payee Details")}>
          {p.method === "cash" ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Field label={tr("cef.party_name", "Party Name")}>
                <div className="relative"><User className="pointer-events-none absolute start-2 top-2 h-3.5 w-3.5 text-slate-400"/>
                  <input className={`${field} ps-7`} disabled={lock} maxLength={120} required value={p.cash.name} onChange={e => p.onCash("name", e.target.value)} placeholder={tr("cef.enter_name_ph", "Enter name")}/>
                </div>
              </Field>
              <Field label={tr("cef.mobile_no", "Mobile No.")}>
                <div className="relative"><Phone className="pointer-events-none absolute start-2 top-2 h-3.5 w-3.5 text-slate-400"/>
                  <input className={`${field} ps-7`} dir="ltr" inputMode="tel" disabled={lock} maxLength={32} required value={p.cash.mobile} onChange={e => p.onCash("mobile", e.target.value)}/>
                </div>
              </Field>
              <Field label={tr("cef.download_id", "Download ID")}>
                <div className="relative"><CreditCard className="pointer-events-none absolute start-2 top-2 h-3.5 w-3.5 text-slate-400"/>
                  <input className={`${field} ps-7`} disabled={lock} maxLength={80} value={p.cash.idDocument} onChange={e => p.onCash("idDocument", e.target.value)} placeholder={tr("cef.enter_id_ph", "Enter ID (Optional)")}/>
                </div>
              </Field>
            </div>
          ) : (
            <fieldset disabled={lock} className="min-w-0 space-y-2">
              <TransferDetailsSection countryId={p.countryId} lang={p.lang} allowMasterChanges={false}
                bankName={p.bank.label} onBankNameChange={() => undefined}
                onBankRecordChange={(bank, label) => p.onBankRecord(bank, label)}
                transferMode={p.bank.mode} onTransferModeChange={p.onBankMode}
                transactionReference={p.reference} onTransactionReferenceChange={p.onReference}/>
              <Field label={h("Bank Account")}><Value value={p.bank.account}/></Field>
            </fieldset>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Field label={h("Sales No.")}><Value value={p.bill}/></Field>
            <Field label={h("Customer Account")}><Value value={p.party}/></Field>
          </div>
        </Step>
        <Step number={4} icon={<Coins className="h-4 w-4"/>} title={tr("cef.amount_posting", "Amount & Posting")}>
          <div className="grid items-end gap-2 sm:grid-cols-3">
            <Field label={`${h("Receipt Amount")} ${p.currency}`}><input className={field} type="number" step="0.01" min="0.01" disabled={lock} value={p.amount} onChange={e => p.onAmount(e.target.value)}/></Field>
            <Field label={h("Exchange Rate")}><Value value={p.approvedRate === null ? "" : String(Number(p.approvedRate.toFixed(6)))}/></Field>
            <div className="row-span-2 flex min-h-[72px] flex-col justify-between rounded-xl border border-sky-200 bg-sky-50 p-2.5 text-right dark:border-sky-800 dark:bg-sky-950/30">
              <span className="text-[10px] font-bold uppercase text-slate-500">{tr("cj.mFinalAmount", "Final Amount")}</span>
              <strong className="font-mono text-xl text-sky-700 dark:text-sky-300" dir="ltr">{financial(Number.isFinite(moneyEntered) ? moneyEntered : null,p.currency)}</strong>
            </div>
            <div className="sm:col-span-2">
              <div className="mb-0.5 text-[10px] font-semibold text-slate-500">{tr("cef.posting_side", "Posting Side")}</div>
              <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-200 bg-slate-100/80 p-1 text-center text-[11px] font-bold dark:border-slate-700 dark:bg-slate-950/70">
                <span className="rounded bg-sky-600 px-2 py-1 text-white">{tr("cef.debit_dr", "Debit (DR)")}</span>
                <span className="px-2 py-1 text-slate-600 dark:text-slate-300">{tr("cef.credit_cr", "Credit (CR)")}</span>
              </div>
            </div>
          </div>
        </Step>
        <Step number={5} icon={<Pencil className="h-4 w-4"/>} title={tr("rvp.remarks", "Remarks")}>
          <textarea className={`${field} h-auto p-2`} aria-label={h("Remarks")} rows={2} maxLength={500} disabled={lock} value={p.remarks} onChange={e => p.onRemarks(e.target.value)}/>
        </Step>
      </div>
      <aside className="space-y-2 lg:col-span-4">
        <Detail icon={<BookOpen className="h-4 w-4"/>} title={tr("cj.mAcctDetails", "Selected Account Details")} entries={[[h("Account Name"), account?.name || ""],[h("Account No."), account?.code || ""],[tr("asr.col_parent_account", "Parent Account"), account?.parent || ""],[h("Account Type"), account?.type || ""]]}/>
        <Detail icon={<MapPin className="h-4 w-4"/>} title={tr("locedit.details", "Location Details")} entries={[[h("Country"),p.country],[h("Branch"),p.branch],[h("City / Location"),p.city]]}/>
        <Detail icon={<FileText className="h-4 w-4"/>} title={tr("cj.mSnapshot", "Financial Snapshot")} entries={[[h("Sales No."),p.bill],[tr("cj.mFinalAmount","Final Amount"),financial(p.approvedFinal,p.currency)],[h("Amount Paid"),financial(p.paidOriginal,p.originalCurrency)],[h("Outstanding Balance"),financial(p.remainingOriginal,p.originalCurrency)]]}/>
      </aside>
    </div>
    <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row">
      <div className="flex w-full gap-2.5 sm:w-auto">
        <button className={neutral} type="button" disabled={lock} onClick={p.onClear}><RotateCcw className="h-3.5 w-3.5"/>{tr("common.clear", "Clear")}</button>
        <button className={neutral} type="button" disabled={p.busy} onClick={p.onClose}><X className="h-3.5 w-3.5"/>{tr("common.cancel", "Cancel")}</button>
      </div>
      <div className="flex w-full gap-2.5 sm:w-auto">
        <button className={`${neutral} border-2 border-blue-600 text-blue-600`} type="button" disabled={lock || !p.canSave} onClick={() => p.onSave(true)}><Plus className="h-3.5 w-3.5"/>{tr("common.save_and_new", "+ Save & New")}</button>
        <button className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 sm:flex-none" type="button" disabled={lock || !p.canSave} onClick={() => p.onSave(false)}><Save className="h-3.5 w-3.5"/>{tr("cef.save_entry", "Save Entry")}</button>
      </div>
    </div>
  </>;
}
