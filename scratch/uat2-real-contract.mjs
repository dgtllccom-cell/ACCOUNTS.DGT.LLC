import { withLocalPg } from "@/lib/db/local-postgres";

const PO = "1d7f69ef-0b3c-4aa7-b02a-3e3928c18a2e";      // AE-001-0022 / DSA2025-0908
const ACTOR = "c68e6b08-5b18-4ae1-ba23-99d5825961a9";
const DR_PURCHASE = "7b2c589f-9924-40c1-af78-6c9fc30630ed"; // AE Purchase (AED)
const CR_DALIAN = "fd7a5f86-d45c-4c55-8685-e0c08b1b0909";   // DALIAN SUNSHINE (existing, USD-denominated)
const AE_BANK = "6b24ea23-9514-4311-aba3-94ba99a993f8";     // AE Bank (AED)
const RATE = 3.675;

let P = 0, F = 0;
const ok = (n, c, d = "") => { if (c) { P++; console.log(`  ✓ ${n}${d ? " — " + d : ""}`); } else { F++; console.log(`  ✗ ${n}${d ? " — " + d : ""}`); } };
const near = (a, b, e = 0.01) => Math.abs(Number(a) - Number(b)) <= e;

await withLocalPg(async (sql) => {
  const dalian0 = Number((await sql`SELECT current_balance FROM ledgers WHERE id=${CR_DALIAN}`)[0].current_balance);
  const purch0 = Number((await sql`SELECT current_balance FROM ledgers WHERE id=${DR_PURCHASE}`)[0].current_balance);
  const bank0 = Number((await sql`SELECT current_balance FROM ledgers WHERE id=${AE_BANK}`)[0].current_balance);
  console.log(`start: DALIAN ${dalian0}  Purchase ${purch0}  Bank ${bank0}`);

  const pay = async (kind, amount, dr, cr) => {
    const r = await sql`SELECT post_purchase_booking_transfer(
      ${ACTOR}::uuid, ${PO}::uuid, ${kind}::purchase_order_payment_kind, ${"2025-10-03"}::date,
      ${amount}, ${"USD"}, ${RATE}, ${dr}::uuid, ${cr}::uuid,
      ${"AE-001-0022 / DSA2025-0908"}, ${"Real-contract UAT re-run — " + kind}) AS pid`;
    return String(r[0].pid);
  };
  const prow = async (pid) => (await sql`SELECT kind, amount, currency_code, exchange_rate, base_currency_amount, original_currency_code, roznamcha_entry_id FROM purchase_order_payments WHERE id=${pid}`)[0];
  const lines = async (eid) => await sql`SELECT l.payment_entry_type, l.debit, l.credit, l.currency, g.currency lc, g.name led FROM roznamcha_lines l JOIN ledgers g ON g.id=l.ledger_id WHERE l.roznamcha_entry_id=${eid} ORDER BY l.payment_entry_type`;

  console.log("\n--- booking transfer: USD 220,500 @ 3.675 ---");
  const bk = await pay("booking", 220500, DR_PURCHASE, CR_DALIAN);
  let p = await prow(bk);
  ok("booking: original USD 220,500 preserved", p.currency_code === "USD" && near(p.amount, 220500), `${p.currency_code} ${p.amount}`);
  ok("booking: historical rate frozen = 3.675", near(p.exchange_rate, 3.675, 1e-6), `${p.exchange_rate}`);
  ok("booking: base (AED) = 810,337.50", near(p.base_currency_amount, 810337.50), `${p.base_currency_amount}`);
  ok("booking: INVARIANT base = amount × rate", near(p.base_currency_amount, Number(p.amount) * Number(p.exchange_rate)));
  let rl = await lines(p.roznamcha_entry_id);
  const dr = rl.find(x => x.payment_entry_type === "debit"), cr = rl.find(x => x.payment_entry_type === "credit");
  ok("booking: DR = CR = 810,337.50 (balanced)", near(dr.debit, cr.credit) && near(dr.debit, 810337.50), `DR ${dr.debit} CR ${cr.credit}`);
  ok("booking: BOTH roznamcha lines labelled AED (base) — DALIAN's USD ledger line is NOT tagged USD",
     dr.currency === "AED" && cr.currency === "AED", `DR ${dr.currency} (ledger ${dr.lc}) / CR ${cr.currency} (ledger ${cr.lc})`);
  const e = (await sql`SELECT original_currency_code, base_currency_amount, narration FROM roznamcha_entries WHERE id=${p.roznamcha_entry_id}`)[0];
  ok("booking: entry keeps original USD + base AED 810,337.50 + FX note",
     e.original_currency_code === "USD" && near(e.base_currency_amount, 810337.50) && /Orig: USD 220500.00 @ 3.675/.test(e.narration), e.narration.slice(0, 90));
  ok("booking: DALIAN ledger moved by AED 810,337.50 (the base amount), NOT 220,500",
     near(Number((await sql`SELECT current_balance FROM ledgers WHERE id=${CR_DALIAN}`)[0].current_balance) - dalian0, -810337.50),
     `Δ ${(Number((await sql`SELECT current_balance FROM ledgers WHERE id=${CR_DALIAN}`)[0].current_balance) - dalian0).toFixed(2)}`);

  console.log("\n--- advance payment: USD 20,050 @ 3.675 (Mashreq 033DBFC252760922) ---");
  const adv = await pay("advance", 20050, CR_DALIAN, AE_BANK);
  p = await prow(adv);
  ok("advance: USD 20,050 @ 3.675 -> base AED 73,683.75", p.currency_code === "USD" && near(p.amount, 20050) && near(p.exchange_rate, 3.675, 1e-6) && near(p.base_currency_amount, 73683.75));
  let po = (await sql`SELECT advance_paid, remaining_due, payment_status FROM purchase_orders WHERE id=${PO}`)[0];
  ok("recalc: advance_paid = 20,050 USD (purchase ccy), NOT 5,455", near(po.advance_paid, 20050), `${po.advance_paid}`);
  ok("recalc: remaining_due = 200,450 USD", near(po.remaining_due, 200450), `${po.remaining_due}`);

  console.log("\n--- final settlement: USD 200,450 @ 3.675 ---");
  const fin = await pay("remaining", 200450, CR_DALIAN, AE_BANK);
  p = await prow(fin);
  ok("final: USD 200,450 @ 3.675 -> base AED 736,653.75", near(p.base_currency_amount, 736653.75) && near(p.exchange_rate, 3.675, 1e-6));
  po = (await sql`SELECT advance_paid, remaining_paid, remaining_due, payment_status FROM purchase_orders WHERE id=${PO}`)[0];
  ok("recalc: fully paid (advance 20,050 + remaining 200,450 = 220,500 USD)", near(Number(po.advance_paid) + Number(po.remaining_paid), 220500), `${po.advance_paid}+${po.remaining_paid}`);
  ok("recalc: remaining_due = 0, status completed", near(po.remaining_due, 0) && po.payment_status === "completed", `${po.remaining_due}/${po.payment_status}`);

  // ---- reverse everything, keep the PO + doc link as evidence ----
  console.log("\n--- reverse all UAT postings (evidence retained: PO + linked job) ---");
  for (const pid of [fin, adv, bk]) {
    const rp = await prow(pid);
    await sql`SELECT reverse_roznamcha_entry(${rp.roznamcha_entry_id}::uuid, ${"Real-contract UAT re-run — reverse after verification"}, NULL::uuid)`;
    await sql`UPDATE purchase_order_payments SET status='cancelled', deleted_at=now() WHERE id=${pid}`;
  }
  await sql`UPDATE purchase_orders SET ledger_posting_status='draft', status='Draft' WHERE id=${PO}`;
  await sql`SELECT recalc_purchase_order_payment_totals(${PO}::uuid)`;

  const d1 = Number((await sql`SELECT current_balance FROM ledgers WHERE id=${CR_DALIAN}`)[0].current_balance);
  const p1 = Number((await sql`SELECT current_balance FROM ledgers WHERE id=${DR_PURCHASE}`)[0].current_balance);
  const b1 = Number((await sql`SELECT current_balance FROM ledgers WHERE id=${AE_BANK}`)[0].current_balance);
  ok("reversal: DALIAN ledger restored to pre-UAT", near(d1, dalian0, 0.01), `${d1} vs ${dalian0}`);
  ok("reversal: Purchase ledger restored", near(p1, purch0, 0.01), `${p1} vs ${purch0}`);
  ok("reversal: Bank ledger restored", near(b1, bank0, 0.01), `${b1} vs ${bank0}`);
  const act = Number((await sql`SELECT count(*)::int n FROM purchase_order_payments WHERE purchase_order_id=${PO} AND deleted_at IS NULL AND status='posted'`)[0].n);
  ok("evidence: 0 active postings; PO + linked job DI-2026-00001 retained", act === 0);
  po = (await sql`SELECT ledger_posting_status, advance_paid, remaining_due FROM purchase_orders WHERE id=${PO}`)[0];
  ok("PO back to unposted, advance_paid 0", po.ledger_posting_status === "draft" && near(po.advance_paid, 0), JSON.stringify(po));

  console.log(`\n=== REAL-CONTRACT UAT (post-fix): ${P} passed / ${F} failed ===`);
  if (F) process.exit(1);
});
