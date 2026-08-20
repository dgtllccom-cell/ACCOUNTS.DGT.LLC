import { sidebarTree } from '../lib/navigation/sidebar.ts';

console.log('=== TOP LEVEL SIDEBAR NODES ===');
sidebarTree.forEach((node, i) => {
  console.log(`${i + 1}. key: "${node.key}", labelKey: "${node.labelKey}", href: "${node.href || ''}", children: ${node.children?.length || 0}`);
  if (node.children) {
    node.children.forEach((c, ci) => {
      console.log(`   ${i+1}.${ci+1} key: "${c.key}", labelKey: "${c.labelKey}", href: "${c.href || ''}"`);
    });
  }
});
