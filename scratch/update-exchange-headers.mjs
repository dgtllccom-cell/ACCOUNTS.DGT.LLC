import fs from 'fs';

const filePath = 'features/currency/daily-exchange-rate-manager.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Table headers
content = content.replace(
  '<th className="py-2.5 px-3 text-center">SR NO</th>',
  '<th className="py-2.5 px-3 text-center">{th("SR NO")}</th>'
);
content = content.replace(
  '<th className="py-2.5 px-3">COUNTRY NAME</th>',
  '<th className="py-2.5 px-3">{th("COUNTRY NAME")}</th>'
);
content = content.replace(
  '<th className="py-2.5 px-3">BRANCH NAME</th>',
  '<th className="py-2.5 px-3">{th("BRANCH NAME")}</th>'
);
content = content.replace(
  '<th className="py-2.5 px-3">USER NAME</th>',
  '<th className="py-2.5 px-3">{th("USER NAME")}</th>'
);
content = content.replace(
  '<th className="py-2.5 px-3 text-center">CURRENCY</th>',
  '<th className="py-2.5 px-3 text-center">{th("CURRENCY")}</th>'
);
content = content.replace(
  '<th className="py-2.5 px-3">DATE & TIME</th>',
  '<th className="py-2.5 px-3">{th("DATE & TIME")}</th>'
);
content = content.replace(
  '<th className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">CREDIT RATE ($)</th>',
  '<th className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">{th("CREDIT RATE ($)")}</th>'
);
content = content.replace(
  '<th className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400">DEBIT RATE ($)</th>',
  '<th className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400">{th("DEBIT RATE ($)")}</th>'
);
content = content.replace(
  '<th className="py-2.5 px-3 text-right">LAST UPDATED</th>',
  '<th className="py-2.5 px-3 text-right">{th("LAST UPDATED")}</th>'
);

// 2. Summary count & filters
content = content.replace(
  'TOTAL ENTRIES: {rates.length}',
  '{th("TOTAL ENTRIES:")} {rates.length}'
);
content = content.replace(
  'placeholder="Search user, branch..."',
  'placeholder={th("Search user, branch...")}'
);
content = content.replace(
  'No exchange rates recorded matching your search criteria.',
  '{th("NO EXCHANGE RATES RECORDED MATCHING YOUR SEARCH CRITERIA.")}'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Updated daily-exchange-rate-manager.tsx table headers and filters!");
