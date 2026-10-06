# Master Forms Integration Guide

> **Rule**: Data is entered **once** in a Master Form and **reused everywhere**. Never create a free-text input for Country, Company, Customer, or Bank — always use the corresponding picker from this guide.

---

## The Four Master Forms

| Master Form | Table | Picker Component | API Endpoint |
|---|---|---|---|
| **Location Master** | locations/countries/states/cities/areas | `LocationHierarchySelect` | `/api/erp/locations/countries` |
| **Company Master** | companies | `CompanyPicker` | `/api/erp/companies` |
| **Customer Master** | customers | `CustomerPicker` | `/api/erp/customers` |
| **Bank Master** | **banks** (dedicated table) | `BankPicker` | `/api/erp/banks` |

> **Note**: Bank Master has its own dedicated `banks` table — it is **not** a sub-type of companies.
> Banks are searchable by: Bank Name, Account Title, Account Number, Branch Name, Branch Code, Short Name, IBAN, SWIFT/BIC.

---

## Quick Start — Import Everything

```typescript
import {
  LocationHierarchySelect,
  CustomerPicker,
  CompanyPicker,
  BankPicker,
  listCountries,
  listStates,
  listCities,
  listAreas,
} from "@/features/master-forms";
```

---

## Location Fields

Use `LocationHierarchySelect` whenever a form needs Country → State → City → Area.

```tsx
import { LocationHierarchySelect } from "@/features/master-forms";

<LocationHierarchySelect
  value={{ countryId, stateId, cityId, areaId }}
  onChange={(v) => {
    setCountryId(v.countryId);
    setStateId(v.stateId);
    setCityId(v.cityId);
    setAreaId(v.areaId);
  }}
/>
```

For a simple country-only dropdown, load countries from the API:

```tsx
import { listCountries } from "@/features/master-forms";

const [countries, setCountries] = useState([]);
useEffect(() => {
  listCountries().then(setCountries);
}, []);

<select value={selectedCountryId} onChange={(e) => setSelectedCountryId(e.target.value)}>
  <option value="">Select Country</option>
  {countries.map((c) => (
    <option key={c.id} value={c.id}>{c.name}</option>
  ))}
</select>
```

---

## Company Fields

```tsx
import { CompanyPicker } from "@/features/master-forms";

<CompanyPicker
  label="Company (Master)"
  value={companyId}
  onValueChange={(id) => setCompanyId(id)}
  placeholder="Search companies..."
  createButtonPlacement="both"
/>
```

- `createButtonPlacement="both"` shows a **+ New Company** button both in the dropdown and below the field.
- Creating a new company opens `CompanyIncorporationForm` in a modal, saves it, and immediately makes it selectable.

---

## Customer Fields

```tsx
import { CustomerPicker } from "@/features/master-forms";

<CustomerPicker
  label="Customer"
  value={customerId}
  onValueChange={(id) => setCustomerId(id)}
  placeholder="Search customers..."
  createButtonPlacement="both"
/>
```

---

## Bank Fields

Banks are stored as companies in this ERP. Use `BankPicker` to filter by bank.

```tsx
import { BankPicker } from "@/features/master-forms";

<BankPicker
  label="Bank (Master)"
  value={bankId}
  onValueChange={(id) => setBankId(id)}
  placeholder="Search banks..."
  createButtonPlacement="both"
/>
```

---

## Where Each Picker Is Used

| Module | Location | Company | Customer | Bank |
|---|---|---|---|---|
| Branch Setup (City) | ✅ `LocationHierarchySelect` | ✅ `CompanyPicker` | ✅ `BranchOwnerPicker` | — |
| Branch Setup (Country) | ✅ `LocationHierarchySelect` | ✅ `CompanyPicker` | — | — |
| Branch Setup (Super Admin) | ✅ `LocationHierarchySelect` | ✅ `CompanyPicker` | — | — |
| Customer Form | ✅ `LocationHierarchySelect` | — | — | — |
| Company Form | ✅ `LocationHierarchySelect` | — | — | — |
| Account Setup (Step 2) | — | — | ✅ `CustomerPicker` | — |
| Account Setup (Step 3) | — | ✅ `CompanyPicker` | — | — |
| Account Setup (Step 4) | — | — | — | ✅ `BankPicker` |
| Purchase Order Wizard | ✅ Master Countries | — | ✅ `CustomerPicker` (Supplier + Buyer) | — |

---

## The "+ New" Pattern

Every picker includes a **+ New** button. When clicked:
1. A `SimpleModal` opens with the relevant Master Form (e.g. `CustomerForm`, `CompanyIncorporationForm`).
2. The user fills out and saves the new record.
3. The new record is immediately saved to the master database.
4. The picker auto-selects the newly created record.
5. The new record is immediately available in **all other forms** that use the same picker.

This means: **create once, available everywhere instantly**.

---

## Rules for Future Modules

1. **Never add a free-text country input** — always use `listCountries()` or `LocationHierarchySelect`.
2. **Never add a company name text field** — use `CompanyPicker`.
3. **Never add a customer name text field** — use `CustomerPicker`.
4. **Never add a bank name text field** — use `BankPicker`.
5. **Import everything from `@/features/master-forms`** — this is the single entry point.
6. **The `createButtonPlacement="both"` prop** adds the "+ New" button both in the dropdown and below — always use it for maximum discoverability.
