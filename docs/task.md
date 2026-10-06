# ERP System Enhancement Progress Checklist

- [ ] Component: Frontend Customer Profiles & Forms
  - [ ] Update `customer-form.tsx` fields & schema binding for Account Name, Number, Manual Ref, Branch/City, Company details (Registration, NTN, Business Type).
  - [ ] Update `customer-profile.tsx` to display separate cards for Customer Account and Customer Company details.
- [ ] Component: Exchange Rates & Transaction Serials
  - [ ] Implement approved Pakistan Exchange Rates panel in `cash-entry-form.tsx`.
  - [ ] Display transaction information sequences (Serials, Date, Created, Approved, Status) in `cash-entry-form.tsx` below Company Details card.
- [ ] Component: Global Unified Search System
  - [ ] Build `/dashboard/search` page with advanced filters & action triggers (View, Edit, Print, Export, WhatsApp, Email).
- [ ] Component: Reports & Expense Tracking
  - [ ] Refactor `/dashboard/reports` page to support the 12 specified reports and cost summaries.
- [ ] Component: Multilingual, Keyboard & Font Switching
  - [ ] Update preferences switcher to load web fonts dynamically.
  - [ ] Map focused inputs to custom Urdu/Arabic/Farsi/Pashto virtual mappings.
- [ ] Verification & Testing
  - [ ] Build & type-check validation.
