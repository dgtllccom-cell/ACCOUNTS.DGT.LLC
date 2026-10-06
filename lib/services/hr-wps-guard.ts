import { ErpPermissionError } from "@/lib/permissions/middleware";
import { guardHr, canRunPayroll } from "@/lib/services/hr-api";

/** WPS reads need HRM read; generating / changing SIF status needs a payroll-capable role. */
export async function guardWps(action: "read" | "write") {
  const g = await guardHr(action);
  if (action === "write" && !canRunPayroll(g.session)) throw new ErpPermissionError("UAE WPS actions require a payroll or admin role.");
  return g;
}
