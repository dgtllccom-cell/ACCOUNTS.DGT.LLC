// Same page as /dashboard/reports (both are linked from the sidebar for
// different role groups - see lib/navigation/sidebar.ts). Kept as a thin
// re-export instead of a second copy of the same server logic, so there is
// exactly one implementation of the Super Admin Reports page to maintain.
export { default, metadata } from "../page";
