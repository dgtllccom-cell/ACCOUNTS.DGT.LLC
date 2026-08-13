# Master Forms Registry Implementation Plan
**Scope:** Transform all Master Forms from data-entry only to full CRUD list views  
**Priority:** HIGH - User can only see records after entry through List/Registry view  
**Estimated Effort:** 16-20 hours for complete implementation + testing

---

## Current State Assessment

### ✅ Existing Implementation
- **Company Form:** Has professional registry component (CompanyRegistry)
- **Companies API:** `/api/erp/companies` with GET support
- Pattern established: Page → Registry Component → API → Database

### ❌ Missing Implementations
1. Location Management
2. Employee Management  
3. Bank Form
4. Contact Type
5. Document Type
6. Account Type
7. Company Registration No Type
8. Goods Master
9. Warehouses
10. Port / Boundary Master
11. Location Management (separate from Company location)

---

## Implementation Pattern (Proven by Company Registry)

### 1. Page Component
```typescript
// app/dashboard/settings/[form]/page.tsx
import { [FormName]Registry } from "@/features/[form]/components/[form]-registry";

export default function [FormName]SettingsPage() {
  return <[FormName]Registry />;
}
```

### 2. Registry Component
```typescript
// features/[form]/components/[form]-registry.tsx
// Structure:
// - useState for data, loading, pagination, filters, search
// - useEffect to load data from API
// - useMemo for filtering and pagination
// - handleDelete, handlePrint, handleExport
// - Multilingual header translation
// - Professional table with actions
```

### 3. API Endpoint
```typescript
// app/api/erp/[resource]/route.ts
// GET handler:
// - Scope authorization
// - Filter by country/branch/date range
// - Search support
// - Pagination
// - Return real database records only
```

### 4. Repository (if needed)
```typescript
// lib/repositories/[form]-repository.ts
// Database query methods with scope enforcement
```

---

## Prioritized Implementation Queue

### Phase 1 (IMMEDIATE - 4-5 hours)
**Critical forms that block workflows:**

1. **Location Management** (3 dependencies)
   - Used by: Company, Warehouse, Branch
   - Columns: Country, State, City, District, Tehsil, Status
   - Database: locations table

2. **Bank Form** (2 dependencies)
   - Used by: Company, Payments
   - Columns: Bank Code, Bank Name, Branch, Account Title, IBAN, Currency, Status
   - Database: banks table

3. **Contact Type** (1 dependency)
   - Columns: Type Code, Type Name, Category, Status
   - Database: contact_types table

### Phase 2 (SECONDARY - 5-6 hours)
**Standard parameter forms:**

4. **Document Type**
   - Columns: Code, Name, Category, Status
   - Database: document_types table

5. **Account Type**
   - Columns: Code, Name, Category, Ledger Group, Status
   - Database: account_types table

6. **Company Registration Type**
   - Columns: Code, Name, Country, Description, Status
   - Database: company_registration_types table

### Phase 3 (EXTENDED - 5-6 hours)
**Inventory & master goods:**

7. **Goods Master**
   - Columns: CHS Code, Goods Name, Origin Country, Category, Sizes, Brands, Status
   - Database: goods_master table

8. **Warehouses**
   - Columns: Code, Name, Owner, Company, Country, Branch, Location, Status
   - Database: warehouses table

9. **Port / Boundary Master**
   - Columns: Code, Port Name, Country, Border Type, Status
   - Database: ports table

10. **Employee Management**
    - Columns: Employee Code, Name, Department, Designation, Country, Branch, Status
    - Database: employees table

11. **Location Management (Secondary)**
    - Columns: Country, State, City, District, Status
    - Database: locations table (hierarchical)

---

## Reusable Registry Component Template

### Standard Features (All Registries)

```typescript
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Eye, PencilLine, Trash2, Download, Printer, Plus, Search } from "lucide-react";
import { apiGet, apiDelete } from "@/lib/api/client";
import { ReportFilterBar, type ReportFilterValues } from "@/features/reports/components/report-filter-bar";
import { ReportPagination } from "@/features/reports/components/report-pagination";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";

export function [FormName]Registry() {
  const router = useRouter();
  const lang = useActiveLanguage();
  
  // State
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [filters, setFilters] = useState<ReportFilterValues>({...});
  
  // Load from API
  async function loadRecords() {
    setLoading(true);
    try {
      const res = await apiGet<{ records: any[] }>(`/api/erp/[resource]?limit=${pageSize}`);
      setRecords(res.records || []);
    } catch (err) {
      console.error("Failed to load records:", err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }
  
  useEffect(() => {
    loadRecords();
  }, []);
  
  // Filter and paginate
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return records;
    return records.filter(r => 
      r.name?.toLowerCase().includes(q) ||
      r.code?.toLowerCase().includes(q)
    );
  }, [searchQuery, records]);
  
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);
  
  // Actions
  async function handleDelete(id: string) {
    if (!window.confirm("Delete this record?")) return;
    try {
      await apiDelete(`/api/erp/[resource]/${id}`);
      loadRecords();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  }
  
  // Render table with actions
  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <ReportFilterBar filters={filters} setFilters={setFilters} />
      
      {/* Search & Actions */}
      <div className="flex gap-2">
        <Input 
          placeholder="Search..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Button onClick={() => router.push('new')}>+ New</Button>
      </div>
      
      {/* Table */}
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <Th>Code</Th>
              <Th>Name</Th>
              <Th>Status</Th>
              <Th>Created</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(record => (
              <tr key={record.id} className="border-t">
                <td className="p-2">{record.code}</td>
                <td className="p-2">{record.name}</td>
                <td className="p-2">
                  <span className={`px-2 py-1 rounded text-sm ${
                    record.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {record.status}
                  </span>
                </td>
                <td className="p-2">{new Date(record.created_at).toLocaleDateString()}</td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button onClick={() => router.push(`${record.id}/view`)}>
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => router.push(`${record.id}/edit`)}>
                      <PencilLine className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(record.id)}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <ReportPagination 
        page={page} 
        pageSize={pageSize}
        total={filtered.length}
        onPageChange={setPage}
      />
      
      {/* Summary */}
      <div className="text-sm text-slate-600">
        Total Records: {filtered.length}
      </div>
    </div>
  );
}
```

---

## API Endpoint Template

```typescript
// app/api/erp/[resource]/route.ts
import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    
    // Authorize scope
    authorizeApiScope(session, {
      resource: "[resource]",
      action: "read",
    });
    
    // Parse filters
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
    const search = request.nextUrl.searchParams.get("search") || "";
    const status = request.nextUrl.searchParams.get("status") || "";
    const countryId = request.nextUrl.searchParams.get("countryId");
    
    // Query database (REAL DATA ONLY - NO SAMPLE ROWS)
    let query = db.from("[table_name]");
    
    // Apply scope filters
    if (!session.isSuperAdmin && session.countryIds.length > 0) {
      query = query.whereIn("country_id", session.countryIds);
    }
    
    // Apply search
    if (search) {
      query = query.orWhere("code", "like", `%${search}%`)
                   .orWhere("name", "like", `%${search}%`);
    }
    
    // Apply status filter
    if (status) {
      query = query.where("status", status);
    }
    
    // Apply country filter
    if (countryId) {
      query = query.where("country_id", countryId);
    }
    
    // Execute (return real data only)
    const records = await query.limit(limit);
    
    // If empty, return empty array (NOT sample data)
    if (!records || records.length === 0) {
      return apiOk({ records: [], summary: { total: 0 } });
    }
    
    return apiOk({ records });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  // Create new record
  // Validate input
  // Apply scope enforcement
  // Insert to database
  // Return created record
}

export async function PUT(request: NextRequest) {
  // Update record
  // Validate scope
  // Update database
  // Return updated record
}
```

---

## Testing Checklist (Per Master Form)

### ✅ Data Loading
- [ ] Page loads without errors
- [ ] API returns real database records (not sample/demo data)
- [ ] Record count matches database count
- [ ] Scope filters applied (user sees only their scope)

### ✅ List View
- [ ] Table displays with correct columns
- [ ] Records show all required fields
- [ ] Status indicators (Active/Inactive) display correctly
- [ ] Pagination works (navigate between pages)
- [ ] Total record count shown at bottom

### ✅ Search & Filter
- [ ] Search by code/name returns matching records
- [ ] Country filter limits records to selected country
- [ ] Status filter shows only selected status
- [ ] Date range filter works
- [ ] Filters can be combined

### ✅ Actions
- [ ] "New" button opens creation form
- [ ] "View" (eye icon) shows record details
- [ ] "Edit" (pencil icon) opens edit form
- [ ] "Delete" (trash icon) removes record with confirmation
- [ ] Deleted record disappears from list

### ✅ Full Workflow
1. Click "New" → Form opens
2. Enter data → Submit → Record saves
3. Record appears in table immediately
4. Can search for new record
5. Can edit record from table
6. Can delete record from table
7. After refresh → Record still persists

### ✅ Multilingual
- [ ] Headers show in selected language (not English fallback)
- [ ] Missing translation shows "Translation pending"
- [ ] RTL/LTR renders correctly for RTL languages
- [ ] No English appears when language is changed to UR/AR/FA/PS

### ✅ Scope Enforcement
- [ ] Country Admin sees only their country's records
- [ ] City Branch Admin sees only assigned branch
- [ ] Cannot see other user's scope via URL parameter
- [ ] Super Admin sees filtered view (respects scope filters)

---

## File Structure (Per Master Form)

```
app/dashboard/settings/[form-name]/
├─ page.tsx                              # Page component
├─ new/
│  └─ page.tsx                          # New form page
├─ [id]/
│  ├─ view/
│  │  └─ page.tsx                       # View details page
│  └─ edit/
│     └─ page.tsx                       # Edit form page

app/api/erp/[resource]/
├─ route.ts                              # GET (list), POST (create)
└─ [id]/
   ├─ route.ts                          # GET, PUT (read, update)
   └─ delete/
      └─ route.ts                       # DELETE

features/[form-name]/
├─ components/
│  ├─ [form-name]-registry.tsx          # List/Table component
│  ├─ [form-name]-form.tsx              # Entry/Edit form
│  └─ [form-name]-detail.tsx            # View detail page
└─ hooks/
   └─ use-[form-name].ts                # Data fetching hook

lib/repositories/
└─ [form-name]-repository.ts            # Database queries
```

---

## Known Challenges & Solutions

### Challenge 1: Scope Enforcement
**Problem:** Users might see data outside their scope via direct URL or API
**Solution:** Enforce scope in all API queries, use session to filter

### Challenge 2: Real Data Requirement
**Problem:** Temptation to add sample/demo data when database is empty
**Solution:** Return empty state instead; user must enter data via form first

### Challenge 3: Multilingual Translation Missing
**Problem:** Not all forms have translation entries yet
**Solution:** Show "Translation pending" instead of English fallback

### Challenge 4: Performance with Large Datasets
**Problem:** Loading thousands of records might be slow
**Solution:** Implement pagination (default 50 per page), lazy loading if needed

### Challenge 5: Complex Relationships
**Problem:** Some forms have nested data (Bank → Country, Location → hierarchical)
**Solution:** Load relationships via separate queries or JOIN in database

---

## Success Criteria (Session End)

✅ **Minimum Viable** (Phase 1 complete):
- [ ] Location Management has working registry
- [ ] Bank Form has working registry  
- [ ] Contact Type has working registry
- [ ] All three tested end-to-end (Create → Save → List → View → Edit → Delete)
- [ ] Multilingual support verified
- [ ] Scope enforcement verified

✅ **Extended** (Phase 1 + 2):
- [ ] All Phase 2 forms have registries
- [ ] 5 forms tested end-to-end
- [ ] Search/filter verified across registries

✅ **Complete** (All phases):
- [ ] All 11 Master Forms have registries
- [ ] All forms tested
- [ ] Multilingual across all
- [ ] Scope enforcement verified across all
- [ ] Print/Export working where applicable

---

## Next Steps

1. **Confirm this plan** with user
2. **Start Phase 1** implementation (Location, Bank, Contact Type)
3. **Build API endpoints** for data fetching
4. **Create registry components** using template pattern
5. **Test end-to-end** for each form
6. **Verify multilingual** support
7. **Verify scope enforcement** across all forms
8. **Document any blocking issues**

Ready to begin implementation on your confirmation. ✅
