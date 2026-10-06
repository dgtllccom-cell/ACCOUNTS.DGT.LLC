-- Create money_exchange_entries table
CREATE TABLE money_exchange_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    serial_no VARCHAR(255) NOT NULL,
    branch_id VARCHAR(255) NOT NULL,
    entry_date DATE NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    account_no VARCHAR(255) NOT NULL,
    qty_currency VARCHAR(10) NOT NULL,
    ex_currency VARCHAR(10) NOT NULL,
    operation VARCHAR(20) NOT NULL,
    rate NUMERIC(15, 6) NOT NULL DEFAULT 1,
    quantity NUMERIC(15, 4) NOT NULL DEFAULT 0,
    final_amount NUMERIC(15, 4) NOT NULL DEFAULT 0,
    receipt_name VARCHAR(255),
    received_from VARCHAR(255),
    mobile VARCHAR(50),
    details TEXT,
    profit_base_currency NUMERIC(15, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID
);

CREATE INDEX idx_money_exchange_entries_serial ON money_exchange_entries(serial_no);
CREATE INDEX idx_money_exchange_entries_branch ON money_exchange_entries(branch_id);
CREATE INDEX idx_money_exchange_entries_account ON money_exchange_entries(account_no);
CREATE INDEX idx_money_exchange_entries_date ON money_exchange_entries(entry_date);

-- Add RLS
ALTER TABLE money_exchange_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access to money_exchange_entries" 
ON money_exchange_entries FOR ALL TO authenticated USING (deleted_at IS NULL);
