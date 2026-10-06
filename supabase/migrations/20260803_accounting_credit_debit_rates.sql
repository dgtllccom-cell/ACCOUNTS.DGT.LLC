-- Accounting Daily Exchange Rate: two rates (Credit + Debit) per currency.
-- Reuses the existing append-only `currency_rates` table (NO new table, NO
-- change to the Purchase manual exchange-rate logic — that is separate).
-- Country Admin enters credit_rate + debit_rate each morning; a rate change
-- during the day is a NEW row (append-only, effective time = created_at).
-- Additive + idempotent.

alter table currency_rates add column if not exists credit_rate numeric(18, 8);
alter table currency_rates add column if not exists debit_rate numeric(18, 8);

-- Backfill: existing single-rate rows use their rate for both sides.
update currency_rates
   set credit_rate = coalesce(credit_rate, rate),
       debit_rate  = coalesce(debit_rate, rate)
 where deleted_at is null
   and (credit_rate is null or debit_rate is null);

-- Fast lookup of the rate active at a point in time (append-only history).
create index if not exists currency_rates_lookup_idx
  on currency_rates (from_currency, country_id, created_at desc)
  where deleted_at is null;

notify pgrst, 'reload schema';
