set -euo pipefail
DB_URL=$(grep '^DATABASE_URL=' /var/www/dgt-nextjs/.env | cut -d'=' -f2-)
psql "$DB_URL" -c "SELECT id, supplier_name, goods_name, status, final_cost, purchase_currency, journal_serial_no, created_at FROM public.local_purchases WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 5;"
