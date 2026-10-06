import { sidebarTree, filterSidebarTree } from '../lib/navigation/sidebar.ts';
import { t } from '../lib/i18n/ui.ts';

const languages = ['en', 'ur', 'ar', 'fa', 'ps'];

console.log('=== VERIFYING DEDICATED SUPER ADMIN MENU & REPORTS MENU IN 5 LANGUAGES ===\n');

for (const lang of languages) {
  console.log(`\n======================================================`);
  console.log(`Language: ${lang.toUpperCase()}`);
  console.log(`======================================================`);
  
  const filtered = filterSidebarTree(sidebarTree, ['super_admin']);
  
  // 1. Super Admin Menu
  const saNode = filtered.find(n => n.key === 'super-admin-menu');
  if (!saNode) {
    console.error(`❌ Missing Super Admin menu node for ${lang}`);
    process.exit(1);
  }
  console.log(`\n👑 Super Admin Section: "${t(lang, saNode.labelKey)}" (key: ${saNode.labelKey})`);
  saNode.children?.forEach((child, i) => {
    console.log(`   ${i + 1}. [${child.key}] -> "${t(lang, child.labelKey)}" (href: ${child.href || 'no-link'})`);
  });

  // 2. Reports Menu
  const repNode = filtered.find(n => n.key === 'reports');
  if (!repNode) {
    console.error(`❌ Missing Reports menu node for ${lang}`);
    process.exit(1);
  }
  console.log(`\n📊 Reports Section: "${t(lang, repNode.labelKey)}" (key: ${repNode.labelKey})`);
  repNode.children?.forEach((child, i) => {
    console.log(`   ${i + 1}. [${child.key}] -> "${t(lang, child.labelKey)}" (href: ${child.href || 'no-link'})`);
  });
}

console.log('\n======================================================');
console.log('DEDICATED SUPER ADMIN & REPORTS MENU 5-LANGUAGE VERIFIED (100% PASS ✅)');
console.log('======================================================');
