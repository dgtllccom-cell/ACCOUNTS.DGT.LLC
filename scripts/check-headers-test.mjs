import fs from "node:fs";

const content = fs.readFileSync("lib/i18n/table-headers.ts", "utf8");
const labels = [
  "Purchase Transfer Payment",
  "Booking Purchase Orders",
  "Purchase Status",
  "Payment Stages",
  "Shipment Status",
  "Report Actions",
  "Rows per page",
  "Status Legend",
  "Posted",
  "Bill Items Breakdown",
  "No purchase order records match the selected filters."
];

for (const l of labels) {
  const norm = l.trim().replace(/\s+/g, " ").toUpperCase();
  const has = content.includes(`"${norm}":`);
  console.log(`${norm.padEnd(60)} -> ${has}`);
}
