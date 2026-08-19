import { sidebarTree, filterSidebarTree } from "../lib/navigation/sidebar.js";

console.log("==================== SIDEBAR TREE AUDIT ====================");

function traverse(nodes, depth = 0, path = []) {
  let list = [];
  for (const node of nodes) {
    const currentPath = [...path, node.key];
    list.push({
      key: node.key,
      labelKey: node.labelKey,
      href: node.href,
      depth,
      path: currentPath.join(" -> "),
      roles: node.roles
    });
    if (node.children) {
      list = list.concat(traverse(node.children, depth + 1, currentPath));
    }
  }
  return list;
}

const allItems = traverse(sidebarTree);
console.log(`Total nodes in sidebarTree: ${allItems.length}`);

// 1. Check duplicate keys
const keyCounts = {};
for (const item of allItems) {
  keyCounts[item.key] = (keyCounts[item.key] || 0) + 1;
}
const duplicateKeys = Object.entries(keyCounts).filter(([_, count]) => count > 1);
console.log("\n--- Duplicate Keys Check ---");
if (duplicateKeys.length === 0) {
  console.log("✅ Zero duplicate keys found!");
} else {
  console.log("❌ Duplicate keys found:", duplicateKeys);
}

// 2. Check duplicate hrefs
const hrefCounts = {};
for (const item of allItems) {
  if (item.href) {
    hrefCounts[item.href] = (hrefCounts[item.href] || 0) + 1;
  }
}
const duplicateHrefs = Object.entries(hrefCounts).filter(([_, count]) => count > 1);
console.log("\n--- Duplicate Hrefs Check ---");
if (duplicateHrefs.length === 0) {
  console.log("✅ Zero duplicate hrefs found across entire sidebar!");
} else {
  console.log("Duplicate hrefs:", duplicateHrefs);
}

// 3. Test filtering across roles
const testRoles = [
  "super_admin",
  "country_admin",
  "city_branch_admin",
  "agent_user",
  "accountant",
  "auditor_viewer"
];

console.log("\n--- Role-Based Filtering Check ---");
for (const role of testRoles) {
  const filtered = filterSidebarTree(sidebarTree, [role]);
  const flat = traverse(filtered);
  console.log(`Role [${role}]: ${flat.length} total accessible navigation nodes.`);
}

console.log("\n==================== TOP LEVEL MENU STRUCTURE ====================");
sidebarTree.forEach((node, idx) => {
  console.log(`${idx + 1}. [${node.key}] ${node.labelKey} ${node.href ? `-> ${node.href}` : `(${node.children?.length || 0} children)`}`);
  if (node.children) {
    node.children.forEach((child, cIdx) => {
      console.log(`   ${idx + 1}.${cIdx + 1} [${child.key}] ${child.labelKey} ${child.href ? `-> ${child.href}` : `(${child.children?.length || 0} sub-children)`}`);
    });
  }
});
