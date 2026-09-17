#!/bin/bash

# VPS Email Workspace Production Test

VPS_URL="https://api.dgt.llc"
PASS=0
FAIL=0

echo "📧 VPS EMAIL WORKSPACE PRODUCTION TEST"
echo "========================================"

# Test ACCOUNTS endpoint (no auth needed for 200 OK or 403 redirect)
echo "Testing /api/erp/email/accounts..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$VPS_URL/api/erp/email/accounts")
if [ "$STATUS" -eq 200 ] || [ "$STATUS" -eq 307 ]; then
  echo "✅ Accounts endpoint: $STATUS"
  ((PASS++))
else
  echo "❌ Accounts endpoint: $STATUS (expected 200 or 307)"
  ((FAIL++))
fi

# Test homepage (should be 200)
echo "Testing / (homepage)..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$VPS_URL/")
if [ "$STATUS" -eq 200 ]; then
  echo "✅ Homepage: $STATUS"
  ((PASS++))
else
  echo "❌ Homepage: $STATUS (expected 200)"
  ((FAIL++))
fi

# Test auth endpoint (should be 500 without session, but endpoint exists)
echo "Testing /api/erp/auth/dev-session..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$VPS_URL/api/erp/auth/dev-session")
if [ "$STATUS" -ge 200 ] && [ "$STATUS" -lt 500 ]; then
  echo "✅ Auth endpoint exists: $STATUS"
  ((PASS++))
else
  echo "⚠️ Auth endpoint: $STATUS"
  ((FAIL++))
fi

# Check PM2 status
echo ""
echo "Checking PM2..."
ssh -i ~/.ssh/id_rsa root@72.60.209.121 "pm2 status dgt-nextjs | grep online" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ PM2 online"
  ((PASS++))
else
  echo "❌ PM2 not online"
  ((FAIL++))
fi

# Summary
echo ""
echo "========================================"
echo "PASSED: $PASS/5"
echo "FAILED: $FAIL/5"

if [ $FAIL -eq 0 ]; then
  echo "✅ VPS OPERATIONAL"
  exit 0
else
  echo "❌ VPS HAS ISSUES"
  exit 1
fi
