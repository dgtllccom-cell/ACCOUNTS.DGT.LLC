import { execSync } from "child_process";
import fs from "fs";

const out = execSync("git show a7d6f1a:features/purchases/components/purchase-order-wizard.jsx", { maxBuffer: 20 * 1024 * 1024 }).toString();
const lines = out.split("\n");
const slice = lines.slice(5240, 5650).join("\n");
fs.writeFileSync("scratch_goods_form_full2.txt", slice);
console.log("Wrote full goods form 2 to scratch_goods_form_full2.txt");
