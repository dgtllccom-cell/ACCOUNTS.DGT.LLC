const fs = require("fs");
function edit(file, pairs) {
  const raw = fs.readFileSync(file, "utf8");
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  let s = raw.replace(/\r\n/g, "\n");
  for (const [a, b, n = 1] of pairs) {
    const count = s.split(a).length - 1;
    if (count !== n) throw new Error(`${file}: expected ${n} of "${a.slice(0, 70)}", found ${count}`);
    s = s.split(a).join(b);
  }
  fs.writeFileSync(file, s.split("\n").join(eol));
  console.log("ok", file);
}
edit("features/dashboard/components/logistics-dashboard-overview.tsx", [
  ["<span>Settings</span>", "<span>{translateHeader(lang, \"Settings\")}</span>"],
]);
edit("features/general-office/components/vip-register-employee-view.tsx", [
  [">Dashboard</span>", ">{T(\"common.dashboard\", \"Dashboard\")}</span>"],
]);
edit("features/branch-management/components/branch-general-report-view.tsx", [
  ['<Th className="border-r p-2">Email</Th>', '<Th className="border-r p-2">{translateHeader(lang, "Email")}</Th>', 2],
]);
edit("app/dashboard/new-entry/users/all/page.tsx", [
  ['className="hover:text-foreground transition-colors">Dashboard</Link>', 'className="hover:text-foreground transition-colors">{th("Dashboard")}</Link>'],
  ['className="hover:text-foreground transition-colors">New Entry</Link>', 'className="hover:text-foreground transition-colors">{th("New Entry")}</Link>'],
]);
edit("features/journal/components/purchase-order-payment-journal.tsx", [
  ['ariaLabel="Row actions"', 'ariaLabel={translateHeader(currentLanguage, "Row actions")}'],
]);
edit("features/journal/components/sales-order-payment-journal.tsx", [
  ['ariaLabel="Row actions"', 'ariaLabel={th("Row actions")}'],
]);
