set -euo pipefail
DB_URL=$(grep '^DATABASE_URL=' /var/www/dgt-nextjs/.env | cut -d'=' -f2-)
psql "$DB_URL" -c "SELECT u.email, p.user_code, p.full_name FROM auth.users u JOIN public.profiles p ON p.id = u.id WHERE p.deleted_at IS NULL LIMIT 5;"
