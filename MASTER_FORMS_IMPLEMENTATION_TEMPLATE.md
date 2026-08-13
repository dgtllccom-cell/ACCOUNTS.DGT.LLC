# Master Forms Implementation Template & Guide

**Status:** Phase 1 Complete ✅ | Phase 2-3 Ready for Implementation

---

## Phase 1 ✅ COMPLETE

| Form | Registry | API | Pages | Status |
|------|----------|-----|-------|--------|
| Location Management | ✅ | ✅ | ✅ | IMPLEMENTED |
| Bank Form | ✅ | ✅ | ⏳ Forms pending | IMPLEMENTED |
| Contact Type | ✅ | ✅ | ⏳ Forms pending | IMPLEMENTED |

---

## Phase 2 - Ready to Implement (Copy-Paste Template Pattern)

**Forms to implement in Phase 2:**
1. Document Type
2. Account Type
3. Company Registration Type

### Template: Copy this pattern for each Phase 2 form

**Step 1: Create Registry Component**
```
features/[form-name]/components/[form-name]-registry.tsx
```
Copy `features/banks/components/bank-registry.tsx` as template
- Change data type name (BankRecord → DocumentTypeRecord)
- Update table columns based on master form schema
- Update API endpoint path (`/api/erp/banks` → `/api/erp/[resource]`)
- Update router.push paths (`/dashboard/settings/bank` → `/dashboard/settings/[form-name]`)
- Update search fields based on record properties

**Step 2: Create API Endpoints**
```
app/api/erp/[resource]/route.ts          (GET list, POST create)
app/api/erp/[resource]/[id]/route.ts     (GET, PUT, DELETE individual)
```
Copy `app/api/erp/banks/route.ts` and `app/api/erp/banks/[id]/route.ts` as templates
- Change table name (`banks` → `contact_types`, `document_types`, etc.)
- Change select fields based on database schema
- Update resource name for authorization
- Keep scope enforcement pattern intact

**Step 3: Update Settings Page**
```
app/dashboard/settings/[form-name]/page.tsx
```
```typescript
import { [FormName]Registry } from "@/features/[form-name]/components/[form-name]-registry";

export default function [FormName]SettingsPage() {
  return <[FormName]Registry />;
}
```

### Document Type Template (Phase 2.1)

**Database columns:**
- id, code, name, category, description, is_active, created_at

**Registry columns:**
- #, Code, Name, Category, Status, Actions

**API path:** `/api/erp/document-types`

**Page path:** `/dashboard/settings/document-type`

### Account Type Template (Phase 2.2)

**Database columns:**
- id, code, name, ledger_group, description, is_active, created_at

**Registry columns:**
- #, Code, Name, Ledger Group, Status, Actions

**API path:** `/api/erp/account-types`

**Page path:** `/dashboard/settings/account-type`

### Company Registration Type Template (Phase 2.3)

**Database columns:**
- id, code, name, country_id, description, is_active, created_at

**Registry columns:**
- #, Code, Name, Country, Status, Actions

**API path:** `/api/erp/company-registration-types`

**Page path:** `/dashboard/settings/company-registration-type`

---

## Phase 3 - Extended Implementation

**Forms to implement in Phase 3:**

### 3.1 Employee Management
- **Columns:** Employee Code, Name, Designation, Department, Country, Branch, Status
- **API:** `/api/erp/employees`
- **Page:** `/dashboard/settings/employees`
- **Special:** Branch/country scope enforcement

### 3.2 Goods Master
- **Columns:** CHS Code, Goods Name, Category, Origin Country, Brand, Sizes, Status
- **API:** `/api/erp/goods-master`
- **Page:** `/dashboard/settings/goods-master`
- **Special:** Category and brand relationships

### 3.3 Warehouse
- **Columns:** Code, Name, Owner, Company, Country, Branch, Location, Status
- **API:** `/api/erp/warehouses`
- **Page:** `/dashboard/settings/warehouse`
- **Special:** Linked to company, location, branch

### 3.4 Port / Boundary Master
- **Columns:** Code, Port/Border Name, Country, Border Type, Status
- **API:** `/api/erp/ports`
- **Page:** `/dashboard/settings/port`
- **Special:** Linked to countries

### 3.5 Company (Enhance Existing)
- Already has registry via CompanyRegistry
- **Verify:** All features working (search, filter, print, multilingual)
- **Check:** Scope enforcement for country-level admin

### 3.6 Customer / Person (Separate from Company)
- **Columns:** Customer Code, Name, Type, Country, Email, Phone, Status
- **API:** `/api/erp/customers`
- **Page:** `/dashboard/settings/customers`
- **Note:** May share structure with Company registry

---

## Quick Copy-Paste Instructions for Each Form

### For Document Type:

**1. Create registry:**
```bash
cp features/banks/components/bank-registry.tsx features/document-types/components/document-type-registry.tsx
# Then edit:
# - Replace BankRecord with DocumentTypeRecord
# - Replace bank_name with name
# - Replace bank_code with code
# - Replace /api/erp/banks with /api/erp/document-types
# - Update table columns: Code, Name, Category, Status
```

**2. Create API:**
```bash
cp app/api/erp/banks/route.ts app/api/erp/document-types/route.ts
# Then edit:
# - Replace "banks" table with "document_types"
# - Replace "BankRecord" with response structure
# - Keep authorization pattern
```

**3. Create individual endpoint:**
```bash
cp app/api/erp/banks/[id]/route.ts app/api/erp/document-types/[id]/route.ts
# Edit table name and field mappings
```

**4. Update page:**
```bash
# Edit: app/dashboard/settings/document-type/page.tsx
import { DocumentTypeRegistry } from "@/features/document-types/components/document-type-registry";

export default function DocumentTypeSettingsPage() {
  return <DocumentTypeRegistry />;
}
```

---

## Database Schema Reference

Ensure these tables exist before implementing:

```sql
-- Document Types
CREATE TABLE document_types (
  id UUID PRIMARY KEY,
  code VARCHAR UNIQUE,
  name VARCHAR NOT NULL,
  category VARCHAR,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP
);

-- Account Types  
CREATE TABLE account_types (
  id UUID PRIMARY KEY,
  code VARCHAR UNIQUE,
  name VARCHAR NOT NULL,
  ledger_group VARCHAR,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- Company Registration Types
CREATE TABLE company_registration_types (
  id UUID PRIMARY KEY,
  code VARCHAR UNIQUE,
  name VARCHAR NOT NULL,
  country_id UUID,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- Employee
CREATE TABLE employees (
  id UUID PRIMARY KEY,
  employee_code VARCHAR UNIQUE,
  name VARCHAR NOT NULL,
  designation VARCHAR,
  department VARCHAR,
  country_id UUID,
  branch_id UUID,
  status VARCHAR DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT now()
);

-- Goods Master
CREATE TABLE goods_master (
  id UUID PRIMARY KEY,
  chs_code VARCHAR UNIQUE,
  name VARCHAR NOT NULL,
  category VARCHAR,
  origin_country VARCHAR,
  brand VARCHAR,
  sizes TEXT,
  status VARCHAR DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT now()
);

-- Warehouse
CREATE TABLE warehouses (
  id UUID PRIMARY KEY,
  code VARCHAR UNIQUE,
  name VARCHAR NOT NULL,
  owner_id UUID,
  company_id UUID,
  country_id UUID,
  branch_id UUID,
  location_id UUID,
  status VARCHAR DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT now()
);

-- Port / Boundary Master
CREATE TABLE ports (
  id UUID PRIMARY KEY,
  code VARCHAR UNIQUE,
  name VARCHAR NOT NULL,
  country_id UUID,
  border_type VARCHAR,
  status VARCHAR DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT now()
);
```

---

## Testing Checklist (For Each Form)

After implementing each master form, test:

- [ ] **Load Registry:** Navigate to settings page → Registry loads without errors
- [ ] **Show Records:** Table displays all database records (no sample data)
- [ ] **Search:** Search by code/name filters results correctly
- [ ] **Status Filter:** Filter by Active/Inactive works
- [ ] **Pagination:** If >50 records, pagination appears and works
- [ ] **Summary Stats:** Total/Active/Inactive counts accurate
- [ ] **Print:** Print button generates report with current filtered data
- [ ] **New Button:** Creates new form (if form pages implemented)
- [ ] **Edit:** Edit button opens record (if form pages implemented)
- [ ] **Delete:** Delete removes record and confirms
- [ ] **Refresh:** After creating/editing/deleting, reload confirms persistence
- [ ] **Scope:** Country admin sees only their country's data
- [ ] **Multilingual:** Headers in selected language (test with UR/AR/FA/PS)
- [ ] **RTL:** For RTL languages, table layout correct

---

## Performance Notes

- Default limit: 100 records per query
- Pagination: 50 records per page
- Search: Uses ilike for case-insensitive matching
- No sample/demo data (return empty if no records found)
- All scope filters applied server-side, not client-side

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Scope enforcement not working | Ensure session.countryIds is checked in API route |
| Search not finding records | Check field names match database columns |
| Pagination shows wrong total | Use count from Supabase response |
| Multilingual headers blank | Verify translateHeader function for language |
| Delete button doesn't work | Check authorization level (admin might be required) |
| Print exports wrong data | Verify paginated data is used, not all filtered data |

---

## Next Developer Instructions

1. **For Phase 2:** Copy bank + contact-type pattern for Document Type, Account Type, Company Registration Type
2. **For Phase 3:** Follow same pattern for Employee, Goods, Warehouse, Ports
3. **Testing:** Use checklist above for each form before marking complete
4. **Multilingual:** No need to add translations—use existing Th component
5. **Database:** Ensure tables exist and columns match registry component

**Expected time per form:** 30-45 minutes (API + Registry + Page)

---

## File Structure Summary

```
For each master form:

app/dashboard/settings/[form-name]/
└─ page.tsx                    (Imports registry component)

app/api/erp/[resource]/
├─ route.ts                    (GET list, POST create)
└─ [id]/route.ts              (GET, PUT, DELETE)

features/[form-name]/components/
└─ [form-name]-registry.tsx   (Main table component)
```

---

## Commit Message Template

```
feat(master-forms): implement [Form Name] registry

- Create [FormName]Registry component with search, filter, pagination
- Create API endpoints for [resource] with scope enforcement
- Add professional table layout with [specific columns]
- Include print functionality
- Real database-backed data (no sample rows)
```

---

## Ready to Go 🚀

All code patterns tested and working. Follow this template to complete all remaining Master Forms quickly and consistently.
