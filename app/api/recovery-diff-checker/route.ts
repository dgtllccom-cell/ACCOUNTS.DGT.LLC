import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const workspaceDir = 'C:\\Users\\dgtll\\OneDrive\\Documents\\ACCOUNTS.DGT.LLC';
const tempBaseDir = 'C:\\tmp\\recovery_zips_extracted';

function searchInFiles(dir: string, pattern: string, results: Array<{ file: string; line: number; text: string }> = []) {
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git' || entry.name === 'docs') continue;

    if (entry.isDirectory()) {
      searchInFiles(fullPath, pattern, results);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js') || entry.name.endsWith('.jsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes(pattern)) {
          results.push({
            file: path.relative(workspaceDir, fullPath).replace(/\\/g, '/'),
            line: idx + 1,
            text: line.trim().slice(0, 150)
          });
        }
      });
    }
  }
  return results;
}

export async function GET() {
  try {
    // 1. Scan for Conflict Markers
    const conflictMarkers = searchInFiles(workspaceDir, '<<<<<<<');

    // 2. Scan for TODOs, FIXMEs, placeholders
    const todos = searchInFiles(workspaceDir, 'TODO');
    const fixmes = searchInFiles(workspaceDir, 'FIXME');
    const placeholders = searchInFiles(workspaceDir, 'not implemented');

    // 3. Scan Migration files
    const migrationsDir = path.join(workspaceDir, 'supabase', 'migrations');
    const migrations = fs.existsSync(migrationsDir) ? fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')) : [];

    // Check migrations in Zip 1
    const zip1MigrationsDir = path.join(tempBaseDir, 'zip_1_ACCOUNTS.DGT.LLC-main', 'ACCOUNTS.DGT.LLC-main', 'supabase', 'migrations');
    const zip1Migrations = fs.existsSync(zip1MigrationsDir) ? fs.readdirSync(zip1MigrationsDir).filter(f => f.endsWith('.sql')) : [];

    const missingMigrationsInMain = zip1Migrations.filter(m => !migrations.includes(m));

    // 4. Key feature area check in main
    const keyFeaturesCheck = {
      idempotency: fs.existsSync(path.join(workspaceDir, 'lib', 'api', 'idempotency.ts')) || fs.existsSync(path.join(workspaceDir, 'lib', 'idempotency.ts')),
      supabaseAdminClient: fs.existsSync(path.join(workspaceDir, 'lib', 'supabase', 'config.ts')) || fs.existsSync(path.join(workspaceDir, 'lib', 'supabase', 'admin.ts')),
      purchasePaymentRoute: fs.existsSync(path.join(workspaceDir, 'app', 'dashboard', 'journal', 'purchase-order-payment', 'advance', 'page.tsx')) || fs.existsSync(path.join(workspaceDir, 'app', 'dashboard', 'purchases', 'page.tsx')),
      roznamchaRoute: fs.existsSync(path.join(workspaceDir, 'app', 'dashboard', 'roznamcha', 'all', 'page.tsx')) || fs.existsSync(path.join(workspaceDir, 'app', 'dashboard', 'roznamcha', 'cash-entry', 'page.tsx')),
      ledgerGeneralReport: fs.existsSync(path.join(workspaceDir, 'app', 'dashboard', 'ledger', 'general-report', 'page.tsx')),
    };

    return NextResponse.json({
      success: true,
      conflictMarkersCount: conflictMarkers.length,
      conflictMarkers,
      todosCount: todos.length,
      fixmesCount: fixmes.length,
      placeholdersCount: placeholders.length,
      migrationsCountMain: migrations.length,
      migrationsCountZip1: zip1Migrations.length,
      missingMigrationsInMain,
      keyFeaturesCheck
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, stack: err.stack }, { status: 500 });
  }
}
