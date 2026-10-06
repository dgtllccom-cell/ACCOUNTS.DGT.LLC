-- Alter money_exchange_entries table to support new requirements
ALTER TABLE money_exchange_entries ALTER COLUMN account_no DROP NOT NULL;

ALTER TABLE money_exchange_entries ADD COLUMN IF NOT EXISTS received_type VARCHAR(50);
ALTER TABLE money_exchange_entries ADD COLUMN IF NOT EXISTS purchase_country VARCHAR(100);
ALTER TABLE money_exchange_entries ADD COLUMN IF NOT EXISTS purchase_city VARCHAR(100);
ALTER TABLE money_exchange_entries ADD COLUMN IF NOT EXISTS purchased_from VARCHAR(255);
ALTER TABLE money_exchange_entries ADD COLUMN IF NOT EXISTS received_country VARCHAR(100);
ALTER TABLE money_exchange_entries ADD COLUMN IF NOT EXISTS received_city VARCHAR(100);
ALTER TABLE money_exchange_entries ADD COLUMN IF NOT EXISTS received_office_name VARCHAR(255);
ALTER TABLE money_exchange_entries ADD COLUMN IF NOT EXISTS received_office_numbers VARCHAR(255);
