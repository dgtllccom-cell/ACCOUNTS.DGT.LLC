import { execSync } from "child_process";
import fs from "fs";

const out = execSync("git show a7d6f1a:features/purchases/components/purchase-order-wizard.jsx", { maxBuffer: 20 * 1024 * 1024 }).toString();
const lines = out.split("\n");
const startIdx = lines.findIndex(l => l.includes('activeTab === "goods" && ('));
let endIdx = -1;
let openCount = 0;
for (let i = startIdx; i < lines.length; i++) {
  if (lines[i].includes("<fieldset")) openCount++;
  if (lines[i].includes("</fieldset>")) {
    openCount--;
    if (openCount === 0) {
      endIdx = i;
      break;
    }
  }
}

const goodsFormCode = lines.slice(startIdx, endIdx + 2).join("\n");
fs.writeFileSync("scratch_goods_form.txt", goodsFormCode);
console.log("Extracted goods form from git to scratch_goods_form.txt. Total lines:", endIdx - startIdx);
