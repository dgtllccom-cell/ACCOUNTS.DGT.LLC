// Retired 2026-09-11 — CustomerPicker was a near-duplicate of PersonPicker
// (same /api/erp/customers backend, same "search & select a customer" job),
// kept only as a thin re-export so existing imports keep working while every
// caller is standardized on the one shared master-selector component and its
// compact rich-list design (avatar, code, branch, country, View/Edit/Print).
export { PersonPicker as CustomerPicker } from "@/components/erp/person-picker";
