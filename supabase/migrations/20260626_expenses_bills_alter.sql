-- Clean up test records to allow type casting
TRUNCATE TABLE expenses_bill_lines;
TRUNCATE TABLE expenses_bills CASCADE;

-- Add created_by and Roznamcha linkage
ALTER TABLE expenses_bills 
ADD COLUMN created_by UUID REFERENCES profiles(id),
ADD COLUMN transferred_to_roznamcha BOOLEAN DEFAULT FALSE,
ADD COLUMN roznamcha_entry_id UUID REFERENCES roznamcha_entries(id);

-- Alter branch_id to be UUID and reference city_branches
ALTER TABLE expenses_bills 
ALTER COLUMN branch_id TYPE UUID USING branch_id::UUID;

ALTER TABLE expenses_bills 
ADD CONSTRAINT expenses_bills_branch_id_fkey 
FOREIGN KEY (branch_id) REFERENCES city_branches(id);
