import { appChannelFromUserAgent } from "@/lib/mobile/app-channel";

/**
 * Device access = the KINDS of device a login may sign in from ("mobile" = phone or tablet, including the DGT.llc B / BS store apps;
 * "computer" = desktop or laptop browser). It is an allotment on the user's assignment (user_role_assignments.device_access), set by a
 * Super Admin or Country Admin in the user registration wizard. It is a policy gate checked at sign-in, not a hardware identity:
 * the device kind is read from the sign-in request's User-Agent. Store-app devices keep their own approval in mobile_devices.
 *
 *   null / unset  → not restricted (every row saved before device allotment existed; behaves exactly as before)
 *   ["mobile"]    → sign-in from a phone / tablet only
 *   ["computer"]  → sign-in from a computer only
 *   both          → any device (what the wizard saves by default)
 */
export const DEVICE_KINDS = ["mobile", "computer"] as const;
export type DeviceKind = (typeof DEVICE_KINDS)[number];

/** What a new login is given when nobody restricts it: every device kind. */
export const DEFAULT_DEVICE_ACCESS: readonly DeviceKind[] = DEVICE_KINDS;

export function isDeviceKind(value: unknown): value is DeviceKind {
  return typeof value === "string" && (DEVICE_KINDS as readonly string[]).includes(value);
}

/** Valid kinds only, de-duplicated, in DEVICE_KINDS order. An empty result means "nothing allotted" and cannot be saved. */
export function normalizeDeviceKinds(input: unknown): DeviceKind[] {
  if (!Array.isArray(input)) return [];
  const present = new Set<string>(input.filter((v): v is string => typeof v === "string"));
  return DEVICE_KINDS.filter((kind) => present.has(kind));
}

/**
 * Device kinds allowed by a user's ACTIVE assignments (a login with several assignments gets the union of them).
 * Returns null when any active assignment is unrestricted, because that assignment already grants every device.
 */
export function effectiveDeviceKinds(
  assignments: ReadonlyArray<{ device_access?: readonly string[] | null } | null | undefined>
): DeviceKind[] | null {
  const union = new Set<DeviceKind>();
  for (const row of assignments) {
    if (!row) continue;
    if (row.device_access === null || row.device_access === undefined) return null;
    for (const kind of normalizeDeviceKinds(row.device_access)) union.add(kind);
  }
  return DEVICE_KINDS.filter((kind) => union.has(kind));
}

/** Null (unrestricted) allows every kind; otherwise the kind must be allotted. */
export function deviceKindAllowed(allowed: readonly DeviceKind[] | null | undefined, kind: DeviceKind): boolean {
  return allowed === null || allowed === undefined || allowed.includes(kind);
}

const MOBILE_USER_AGENT = /Mobi|Android|iPhone|iPad|iPod|Tablet|Silk|Kindle/i;

/**
 * The kind of device a sign-in request comes from. The DGT.llc B / BS store apps are phone apps. A phone or tablet browser is "mobile".
 * Anything else, including a request with no User-Agent, is "computer", so a mobile-only user cannot sign in from an unidentified client.
 */
export function deviceKindFromUserAgent(userAgent: string | null | undefined): DeviceKind {
  if (appChannelFromUserAgent(userAgent)) return "mobile";
  return MOBILE_USER_AGENT.test(userAgent ?? "") ? "mobile" : "computer";
}

/** Only a Super Admin or a Country Admin may set or change device access. */
export function canManageDeviceAccess(session: { isSuperAdmin: boolean; roles: readonly string[] } | null | undefined): boolean {
  if (!session) return false;
  return session.isSuperAdmin === true || session.roles.includes("country_admin");
}

/** Same allotment regardless of order. Used to detect whether a non-admin PATCH actually changes device access. */
export function sameDeviceAccess(a: readonly string[] | null | undefined, b: readonly string[] | null | undefined): boolean {
  const left = a === null || a === undefined ? [...DEVICE_KINDS] : normalizeDeviceKinds(a);
  const right = b === null || b === undefined ? [...DEVICE_KINDS] : normalizeDeviceKinds(b);
  return left.length === right.length && left.every((kind, i) => kind === right[i]);
}
