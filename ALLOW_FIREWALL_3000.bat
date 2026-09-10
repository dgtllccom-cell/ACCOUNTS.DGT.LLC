@echo off
title ACCOUNTS ERP Firewall Setup
color 0A

:: Check for Administrator elevation
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting Administrator permission...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/k \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo ========================================================
echo   Configuring Windows Firewall for ACCOUNTS ERP Port 3000
echo ========================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "New-NetFirewallRule -DisplayName 'ACCOUNTS ERP Dev 3000' -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Any"

echo.
echo --------------------------------------------------------
echo Verifying rule:
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetFirewallRule -DisplayName 'ACCOUNTS ERP Dev 3000' | Format-Table -Property DisplayName, Enabled, Direction, Action"

echo.
echo.
echo ========================================================
echo SUCCESS! Port 3000 is now OPEN for LAN and mobile access.
echo.
for /f "usebackq tokens=*" %%A in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notlike '169.254*' -and $_.IPAddress -like '192.168*' } | Select-Object -First 1).IPAddress"`) do set MY_IP=%%A
if not defined MY_IP set MY_IP=192.168.1.96
echo Access URL: http://%MY_IP%:3000/auth/login
echo ========================================================
echo.
pause

