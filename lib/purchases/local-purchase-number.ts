/**
 * The ONE rule for a Local Purchase's bill number, used by every page, report and API.
 *
 * A bill is identified by its system journal serial (journal_serial_no, e.g. "LP-JRN-00000052"), issued once from the global
 * serial when the purchase is accepted; before that, by its booking serial (manual_bill_no); before that, by its record id.
 * contract_no is the supplier contract reference the user TYPES (it repeats: two bills typed "0" both read "LP-0"), so it is
 * never the bill number; it is shown beside the number as the contract reference.
 */
export type LocalPurchaseNumberSource = {
  id?: string | null;
  journal_serial_no?: string | null;
  manual_bill_no?: string | null;
  contract_no?: string | number | null;
  journalSerialNo?: string | null;
  manualBillNo?: string | null;
  contractNo?: string | number | null;
};

const s = (v: unknown) => (v == null ? "" : String(v).trim());

export function localPurchaseBillNo(lp: LocalPurchaseNumberSource): string {
  return s(lp.journal_serial_no ?? lp.journalSerialNo) || s(lp.manual_bill_no ?? lp.manualBillNo) || `LP-${s(lp.id).slice(0, 8)}`;
}

/** The user-typed supplier contract reference, as typed ("" when none). */
export function localPurchaseContractRef(lp: LocalPurchaseNumberSource): string {
  return s(lp.contract_no ?? lp.contractNo);
}
