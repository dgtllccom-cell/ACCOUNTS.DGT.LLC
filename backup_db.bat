@echo off
echo Starting Supabase Database Backup...
npx supabase db dump -f supabase/backups/erp_backup_%date:~-4,4%%date:~-10,2%%date:~-7,2%.sql
echo Backup completed successfully!
pause
