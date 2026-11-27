import { ApiClientError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { isDemoBankAccountNumber } from "@/lib/services/demo-bank-identity";

type BankQuery = (parts: TemplateStringsArray, id: string) => PromiseLike<Array<{ account_number?: unknown }>>;

const BANK_ID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;

export function assertBankRecordNotDemo(bank: { account_number?: unknown }): void {
  if (isDemoBankAccountNumber(bank.account_number)) {
    throw new ApiClientError("Demo banks are for account details only and cannot be used for payments or settlement.", {status: 422, code: "DEMO_BANK_NOT_PAYABLE"});
  }
}

/** Check the actual master record, not the caller's label, before making a financial write. */
export async function assertPayableBankId(bankId: unknown, sql?: BankQuery): Promise<void> {
  if (bankId == null || bankId === "") return;
  if (typeof bankId !== "string" || !BANK_ID.test(bankId.trim())) {
    throw new ApiClientError("Select a valid Bank Master record.", {status: 422, code: "INVALID_PAYMENT_BANK"});
  }
  const check = async (connection: BankQuery) => {
    const [bank] = await connection`select account_number from public.banks where id = ${bankId.trim()}::uuid and deleted_at is null limit 1`;
    if (!bank) throw new ApiClientError("The selected Bank Master record was not found.", {status: 422, code: "INVALID_PAYMENT_BANK"});
    assertBankRecordNotDemo(bank);
    return true;
  };
  if (sql) await check(sql);
  else if (!await withLocalPg(check)) {
    throw new ApiClientError("Bank payment eligibility could not be verified.", {status: 503, code: "BANK_ELIGIBILITY_UNAVAILABLE"});
  }
}
