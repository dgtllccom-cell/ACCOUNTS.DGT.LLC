/**
 * Edge-safe session cookie constant.
 *
 * `middleware.ts` runs on the Edge runtime, which cannot bundle `node:crypto`.
 * Importing this name from `lib/auth/temp-session.ts` (which imports
 * `node:crypto` at module top-level) drags the whole Node crypto graph into the
 * Edge bundle and fails the build with
 *   UnhandledSchemeError: Reading from "node:crypto" is not handled by plugins
 * on a cold `.next` compile. Keeping the constant in its own dependency-free
 * module lets the Edge middleware import it without pulling in Node built-ins.
 */
export const ERP_SESSION_COOKIE = "erp_session";
