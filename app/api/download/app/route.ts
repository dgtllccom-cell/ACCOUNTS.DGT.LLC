import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "installer";
  
  // Use host from request headers to build exact origin
  const host = request.headers.get("host") || "72.60.209.121";
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const origin = `${protocol}://${host}`;

  if (type === "installer" || type === "bat") {
    const batContent = `@echo off
title Digital Dock ERP - 1-Click Desktop Installer
color 0A
cls
echo ===================================================
echo     DIGITAL DOCK ERP - 1-CLICK DESKTOP INSTALLER
echo ===================================================
echo.
echo Installing Digital Dock ERP app icon on your Desktop...

set "DESKTOP_PATH=%USERPROFILE%\\Desktop\\Digital Dock ERP.url"
set "STARTMENU_PATH=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Digital Dock ERP.url"

(
echo [InternetShortcut]
echo URL=${origin}/auth/login
echo IconIndex=0
echo IconFile=${origin}/icons/digital-dock-icon.svg
) > "%DESKTOP_PATH%"

(
echo [InternetShortcut]
echo URL=${origin}/auth/login
echo IconIndex=0
echo IconFile=${origin}/icons/digital-dock-icon.svg
) > "%STARTMENU_PATH%"

echo.
echo [SUCCESS] Digital Dock ERP icon created on Desktop and Start Menu!
echo Opening Digital Dock ERP...
echo.

start "" chrome --app="${origin}/auth/login" 2>nul || start "" msedge --app="${origin}/auth/login" 2>nul || start "" "%DESKTOP_PATH%"
exit
`;
    return new NextResponse(batContent, {
      status: 200,
      headers: {
        "Content-Type": "application/x-bat",
        "Content-Disposition": 'attachment; filename="Install-Digital-Dock-ERP.bat"',
        "Cache-Control": "no-cache, no-store, must-revalidate"
      }
    });
  }

  if (type === "cmd" || type === "launcher") {
    const cmdContent = `@echo off
title Digital Dock ERP Launcher
echo Opening Digital Dock ERP...
start "" chrome --app="${origin}/auth/login" 2>nul || start "" msedge --app="${origin}/auth/login" 2>nul || start "" "${origin}/auth/login"
exit
`;
    return new NextResponse(cmdContent, {
      status: 200,
      headers: {
        "Content-Type": "application/x-bat",
        "Content-Disposition": 'attachment; filename="Digital-Dock-ERP-Launcher.cmd"',
        "Cache-Control": "no-cache, no-store, must-revalidate"
      }
    });
  }

  // Default: Windows .url Internet Shortcut file
  const urlShortcutContent = `[InternetShortcut]
URL=${origin}/auth/login
IDList=
IconIndex=0
IconFile=${origin}/icons/digital-dock-icon.svg
[{000214A0-0000-0000-C000-00000000046}]
Prop3=19,2
`;

  return new NextResponse(urlShortcutContent, {
    status: 200,
    headers: {
      "Content-Type": "application/x-mswinurl",
      "Content-Disposition": 'attachment; filename="Digital Dock ERP.url"',
      "Cache-Control": "no-cache, no-store, must-revalidate"
    }
  });
}
