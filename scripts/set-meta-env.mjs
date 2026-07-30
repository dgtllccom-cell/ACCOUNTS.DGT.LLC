import { execSync } from "child_process";

const SERVER = "root@72.60.209.121";

/**
 * Script to set Meta Cloud API environment variables directly on the Hostinger VPS (.env.local)
 * and test physical delivery to +971544816664.
 * Usage: node scripts/set-meta-env.mjs <token> <pnid> [wabaId]
 */
const token = process.argv[2];
const pnid = process.argv[3] || "154760354377649";
const wabaId = process.argv[4] || "335626955041488";

if (!token) {
  console.error("Usage: node scripts/set-meta-env.mjs <token> [pnid] [wabaId]");
  process.exit(1);
}

console.log(`Configuring VPS 72.60.209.121 with Meta Credentials...`);
console.log(`PNID: ${pnid}`);
console.log(`WABA ID: ${wabaId}`);
console.log(`Token: ${token.substring(0, 15)}...`);

const remoteScript = `
set -e
cd /var/www/dgt-nextjs

# Update .env.local
sed -i '/META_WHATSAPP_TOKEN=/d' .env.local 2>/dev/null || true
sed -i '/META_PHONE_NUMBER_ID=/d' .env.local 2>/dev/null || true
sed -i '/META_WABA_ID=/d' .env.local 2>/dev/null || true
sed -i '/WHATSAPP_ACCESS_TOKEN=/d' .env.local 2>/dev/null || true
sed -i '/WHATSAPP_PHONE_NUMBER_ID=/d' .env.local 2>/dev/null || true

echo "" >> .env.local
echo "META_WHATSAPP_TOKEN=${token}" >> .env.local
echo "WHATSAPP_ACCESS_TOKEN=${token}" >> .env.local
echo "META_PHONE_NUMBER_ID=${pnid}" >> .env.local
echo "WHATSAPP_PHONE_NUMBER_ID=${pnid}" >> .env.local
echo "META_WABA_ID=${wabaId}" >> .env.local

echo "✅ Updated /var/www/dgt-nextjs/.env.local on VPS"

# Restart PM2
pm2 restart dgt-nextjs || pm2 restart all
echo "✅ Restarted PM2 server"

# Test Live Message Dispatch via Meta Cloud API
echo "📲 Testing Live Physical Message Dispatch to +971544816664..."
TEST_RES=$(curl -s -X POST "https://graph.facebook.com/v19.0/${pnid}/messages" \
  -H "Authorization: Bearer ${token}" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "971544816664",
    "type": "text",
    "text": { "body": "🟢 Digital Dock ERP — Official Meta WhatsApp Cloud API Connection Test Successful!" }
  }')

echo "Meta Graph API Response:"
echo "$TEST_RES"
`;

try {
  const out = execSync(`ssh -o StrictHostKeyChecking=no ${SERVER} "bash -s"`, {
    input: remoteScript,
    encoding: "utf8"
  });
  console.log(out);
  console.log("🎉 VPS Meta Environment Variables & Live Message Verification Complete!");
} catch (e) {
  console.error("VPS SSH error:", e.stdout || e.stderr || e.message);
}
