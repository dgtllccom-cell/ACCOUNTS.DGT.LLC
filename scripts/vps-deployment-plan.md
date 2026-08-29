# VPS Deployment & Data Migration Plan

## ENVIRONMENT CONFIGURATION

### LOCAL Development
- Database: csesvyxxjivnkkozgopt (Supabase DEV)
- Host: csesvyxxjivnkkozgopt.supabase.co
- Database URL: postgresql://USER:PASSWORD@DEV_HOST:6543/postgres

### VPS Production  
- Server IP: 72.60.209.121
- App Path: /var/www/dgt-nextjs
- Database: inmayhrxucimxqhgseqi (Supabase PROD)
- Host: inmayhrxucimxqhgseqi.supabase.co
- Database URL: postgresql://USER:PASSWORD@PROD_HOST:5432/postgres

## DEPLOYMENT STEPS

### Phase 1: Pre-Deployment Verification
- [ ] Connect to VPS via SSH ✓
- [ ] Verify VPS app path (/var/www/dgt-nextjs)
- [ ] Check VPS PM2 status
- [ ] Create database backup (VPS PROD)
- [ ] Compare LOCAL vs VPS schemas
- [ ] Count existing VPS records

### Phase 2: Data Migration (LOCAL → VPS)
- [ ] Backup VPS database BEFORE any changes
- [ ] Export LOCAL Accounts data
- [ ] Export LOCAL record_translations (EN/UR/AR/FA/PS)
- [ ] Export LOCAL multi-link junction tables
- [ ] Migrate to VPS with upsert (prevent duplicates)
- [ ] Verify data integrity
- [ ] Compare record counts

### Phase 3: Code Deployment
- [ ] Deploy latest code to VPS
- [ ] Run VPS database migrations
- [ ] Rebuild Next.js application
- [ ] Restart PM2 process

### Phase 4: Post-Deployment Testing
- [ ] Verify VPS URL is accessible
- [ ] Test Accounts Registry on VPS
- [ ] Test Account Setup Report page
- [ ] Test multi-link functionality
- [ ] Test 5-language display
- [ ] Verify data persistence
- [ ] Check console/network logs
- [ ] Verify PM2/server logs

### Phase 5: Verification Report
- [ ] Before/After record counts
- [ ] Data integrity verification
- [ ] No duplicates introduced
- [ ] All relationships intact
- [ ] Final PASS/FAIL report
