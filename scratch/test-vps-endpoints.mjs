import { spawnSync } from 'child_process';

const cmd = `
echo "=== TESTING API ENDPOINTS ON VPS ==="

echo "--- 1. /api/erp/locations/cities ---"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/api/erp/locations/cities

echo "--- 2. /api/erp/admin/dashboard-settings ---"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/api/erp/admin/dashboard-settings

echo "--- 3. /dashboard/journal/sales-order-payment/advance ---"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/dashboard/journal/sales-order-payment/advance

echo "--- 4. /dashboard/new-entry/users/registration ---"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/dashboard/new-entry/users/registration

echo "--- 5. /dashboard/ledger ---"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/dashboard/ledger

echo "--- 6. /dashboard/roznamcha ---"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/dashboard/roznamcha

echo "--- 7. /api/erp/roznamcha ---"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/api/erp/roznamcha

echo "--- 8. /api/erp/ledger ---"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/api/erp/ledger

echo "--- 9. /api/erp/vouchers/simple ---"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/api/erp/vouchers/simple
`;

const res = spawnSync('ssh', ['-o', 'StrictHostKeyChecking=no', 'root@72.60.209.121', 'bash -s'], {
  input: cmd,
  encoding: 'utf8'
});

console.log("STDOUT:\n", res.stdout);
console.log("STDERR:\n", res.stderr);
