import type { ErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";

/**
 * Tracking is read through three existing pages (Shipping Line, Business cargo, Portal) whose route policy
 * accepts shipping_records:read, purchases:read or dashboard:read respectively. The API accepts exactly the
 * same set, so a login that cannot open a tracking page cannot call its data either. Row visibility is
 * still limited to the caller's country / branch scope inside the service.
 */
export function authorizeTrackingRead(session: ErpSession) {
  const attempts = [
    { resource: "shipping_records", action: "read" },
    { resource: "purchases", action: "read" },
    { resource: "dashboard", action: "read" },
  ];
  let firstError: unknown = null;
  for (const a of attempts) {
    try {
      authorizeApiScope(session, a);
      return;
    } catch (e) {
      firstError ??= e;
    }
  }
  throw firstError;
}

/** Recording a milestone changes the shipment's vessel / voyage / container / ETA: operational write access. */
export function authorizeTrackingWrite(session: ErpSession) {
  authorizeApiScope(session, { resource: "shipping_records", action: "update" });
}
