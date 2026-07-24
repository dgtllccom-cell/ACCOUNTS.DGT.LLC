-- Create expenses_bills table
CREATE TABLE expenses_bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    serial_no VARCHAR(255) NOT NULL,
    branch_id VARCHAR(255) NOT NULL,
    bill_date DATE NOT NULL,
    bill_mode VARCHAR(50) NOT NULL,
    bill_title VARCHAR(255) NOT NULL,
    reference_no VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_expenses_bills_serial_no ON expenses_bills(serial_no);
CREATE INDEX idx_expenses_bills_branch_id ON expenses_bills(branch_id);

-- Create expenses_bill_lines table
CREATE TABLE expenses_bill_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_id UUID NOT NULL REFERENCES expenses_bills(id) ON DELETE CASCADE,
    row_serial INTEGER NOT NULL,
    details TEXT NOT NULL,
    qty NUMERIC(15, 4) NOT NULL DEFAULT 0,
    unit_price NUMERIC(15, 4) NOT NULL DEFAULT 0,
    amount NUMERIC(15, 4) NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL,
    operation VARCHAR(5) NOT NULL,
    exchange_rate NUMERIC(15, 6) NOT NULL DEFAULT 1,
    final_amount NUMERIC(15, 4) NOT NULL DEFAULT 0,
    tax_on BOOLEAN NOT NULL DEFAULT FALSE,
    tax_pct NUMERIC(15, 4) NOT NULL DEFAULT 0,
    tax_amt NUMERIC(15, 4) NOT NULL DEFAULT 0,
    grand_amount NUMERIC(15, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_expenses_bill_lines_bill_id ON expenses_bill_lines(bill_id);

-- Add row level security
ALTER TABLE expenses_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses_bill_lines ENABLE ROW LEVEL SECURITY;

-- Create basic policies (using same as roznamcha or generic authenticated access)
CREATE POLICY "Allow authenticated full access to expenses_bills" ON expenses_bills FOR ALL TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "Allow authenticated full access to expenses_bill_lines" ON expenses_bill_lines FOR ALL TO authenticated USING (true);
