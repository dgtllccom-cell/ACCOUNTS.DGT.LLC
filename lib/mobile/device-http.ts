import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { appChannelFromUserAgent, type AppChannel } from "@/lib/mobile/app-channel";
import { DEVICE_COOKIE, DEVICE_COOKIE_MAX_AGE, signDeviceToken } from "@/lib/mobile/device-service";

export const clientIp = (req: NextRequest) => (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || null;

/** The app is read from the User-Agent tag the store app adds. Only a DEV server (ALLOW_DEV_SESSION) also accepts it in the body, for tests. */
export function requestApp(req: NextRequest, bodyApp?: unknown): AppChannel | null {
  const fromUa = appChannelFromUserAgent(req.headers.get("user-agent"));
  if (fromUa) return fromUa;
  if (process.env.ALLOW_DEV_SESSION === "true" && (bodyApp === "b" || bodyApp === "bs")) return bodyApp;
  return null;
}

export function setDeviceCookie(res: NextResponse, deviceId: string) {
  res.cookies.set(DEVICE_COOKIE, signDeviceToken(deviceId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE,
  });
}
