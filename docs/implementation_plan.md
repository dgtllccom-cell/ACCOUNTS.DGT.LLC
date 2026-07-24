# Complete ERP System Enhancement & Final Implementation Plan

This implementation plan details the final updates across the ERP system to introduce complete database connectivity, separated customer details cards, approved Pakistan exchange rates, transaction information sequences, a unified multi-criteria search engine, extensive reports, cost tracking, and virtual keyboard layout switching with RTL fonts.

## User Review Required

> [!IMPORTANT]
> **Dynamic Font & Keyboard Layout Integration**
> - Since standard web browsers restrict scripts from programmatically changing the operating system's physical keyboard layout, we will build a custom **interactive virtual input character mapper** for Urdu, Arabic, Pashto, and Persian.
> - When any text input is focused and a non-English language is active, keystrokes will be dynamically mapped to the corresponding Unicode characters of the active language, providing a native keyboard layout typing experience within the ERP.
> - Premium web fonts (Cairo, Vazirmatn, Noto Naskh Arabic, and Nastaleeq web-fallbacks) will be dynamically loaded via Google Fonts link references inside the DOM.

> [!NOTE]
> **Data Storage Strategy for Custom Fields**
> - Custom fields (e.g. registration number, tax/NTN number, business type, manual reference) are stored inside the `notes` column of the `customers` database table as a structured JSON payload.
> - This keeps the database schema clean and avoids breaking existing database triggers, while ensuring full reload, search, and edit capability.

---

## Proposed Changes

### Component: Frontend Customer Profiles & Forms

We will update the customer setup form and profile view to support separate cards, all required details, and prefilling.

#### [MODIFY] [customer-form.tsx](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/features/customers/components/customer-form.tsx)
- Add form fields for:
  - Account Name, Account Number, Manual Reference, Branch Name, Branch Code, City Branch.
  - Registration Number, Tax / NTN Number, Business Type (Sole Proprietorship, Partnership, LLC, Private Limited).
- Save all these fields inside the structured `notes` JSON block.
- Pre-fill these fields when loading an existing customer for editing.

#### [MODIFY] [customer-profile.tsx](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/features/customers/components/customer-profile.tsx)
- Re-architect the preview certificate and cards.
- Render two distinct, clean independent cards:
  1. **Customer Account Details** (Account Name, Account Number, Customer Number, Manual Reference, Country, Branch Name, Branch Code, City Branch, State, Address).
  2. **Customer Company Details** (Company Name, Registration Number, Tax / NTN Number, Business Type, Phone Number, Email Address, Country, City, State, Complete Address).

---

### Component: Exchange Rates & Transaction Serials

We will update the Cash Entry Form's sidebar details panel to render the exact exchange rates and transaction sequence items requested.

#### [MODIFY] [cash-entry-form.tsx](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/features/roznamcha/components/cash-entry-form.tsx)
- Re-align the right-side details panel:
  - Fetch and show exactly one **Pakistan Exchange Rates** card containing: Currency, Debit Rate, Credit Rate, Budget Rate, Effective Date, Last Updated By.
  - The rates displayed will be the approved, active rates queried from the database `daily_usd_rates` table for Pakistan.
  - Below the Customer Company Details section, render a **Transaction Information** panel containing: Journal Serial Number, Country Serial Number, Branch Serial Number, Transaction Date, Created By, Approved By, Approval Status.
  - Automatically load these fields after an entry is saved or retrieved for editing.

---

### Component: Global Unified Search System

We will create a global search system that allows searching across both customers and transactions.

#### [NEW] [page.tsx](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/app/dashboard/search/page.tsx)
- Create a unified search interface at `/dashboard/search`.
- Implement filters: Country, Branch, City, Currency, Approval Status, User.
- Implement search parameters: Serial Number, Customer/Company Name, Account Number, Date Range, Transaction Type.
- Display a comprehensive grid of matches from both customers and payments/vouchers.
- Embed actions per match: View, Edit, Print, Export PDF, Email, and WhatsApp Sharing.

---

### Component: Reports & Expense Tracking

We will build the reports module.

#### [MODIFY] [page.tsx](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/app/dashboard/reports/page.tsx)
- Replace the static placeholder with a fully-functional **ERP Reporting Dashboard**.
- Add a sidebar to select from 12 distinct reports (Cash Entry, Receipts, Payments, Customer Accounts, Customer Companies, Exchange Rates, Branch Transactions, User Activity, Audit Logs, Approval Workflows, Expenses, Financial Summaries).
- Render interactive report tables, summaries, and total costs/expenses.
- Implement Expense Tracking by selecting ledger entries of expense accounts, filtered by daily/weekly/monthly/yearly intervals, highlighting: Total Cost, Total Expense, Branch-wise Expense, Company-wise Expense, User-wise Expense.
- Provide export tools: print, download PDF, share via WhatsApp, send email, and export CSV/Excel.

---

### Component: Keyboard switching & Font injector

We will configure dynamic font loading and keystroke interceptors for multilingual layouts.

#### [MODIFY] [preferences-controls.tsx](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/components/layout/preferences-controls.tsx)
- In `changeLanguage`, dynamically insert Google Fonts link tags to load the required fonts:
  - Urdu: Cairo / Noto Naskh Arabic (RTL Nastaleeq style)
  - Arabic: Cairo (RTL)
  - Pashto: Cairo (RTL)
  - Persian: Vazirmatn (RTL)
- Apply corresponding Tailwind/CSS class rules to change font-family and text-direction (`dir="rtl"`) on the entire `document.documentElement` dynamically.
- Register an input text listener that intercepts standard QWERTY keyboard strokes on focused inputs and auto-maps them to language-specific Unicode characters (Urdu/Arabic/Farsi/Pashto) based on the active locale.

---

## Verification Plan

### Automated Tests
- Run `npm run build` or compilation checks to verify TypeScript types and Next.js routes.

### Manual Verification
- Open Customer Registry, click Add Customer, save details, reload, edit, and verify both cards load correct data.
- Open Cash Entry Form, select counterparty, and verify Pakistan Exchange Rates and Transaction Information serial sequence sections render.
- Test the language selector: switch to Urdu, Arabic, Persian, Pashto, verify layout is RTL, font changes immediately, and typing in input inputs the correct language characters automatically.
- Open the Search page, run multi-criteria queries, and test PDF exports, printing, and WhatsApp links.
