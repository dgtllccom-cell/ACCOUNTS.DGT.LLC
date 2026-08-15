import { localizeRecordNames, getPhraseTranslator } from "../lib/i18n/localize-records.ts";

async function test() {
  console.log("Starting test...");
  try {
    const rows = [
      { id: "11111111-1111-1111-1111-111111111111", accountId: "11111111-1111-1111-1111-111111111111", accountName: "Test Account" }
    ];
    console.log("Calling localizeRecordNames...");
    const res = await localizeRecordNames(rows, "enterprise_accounts", "accountName", "ur");
    console.log("localizeRecordNames result:", res);

    console.log("Calling getPhraseTranslator...");
    const tp = await getPhraseTranslator("ur");
    console.log("tp result:", tp("Quetta Main Branch (QTA)"));
  } catch (err) {
    console.error("Test error:", err);
  }
}

test();
