const fs = require("fs");
const path = require("path");

const destDir = "C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\7c714624-7346-45ba-a2cc-e298bf3f1ed4\\screenshots";
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

const files = [
  "evidence_all_release_entries.png",
  "evidence_kyc_badges.png",
  "evidence_shipping_stage_search.png",
  "evidence_bl_entry.png",
  "evidence_shipping_agents.png",
  "evidence_truck_live_summary.png"
];

for (const f of files) {
  if (fs.existsSync(f)) {
    fs.copyFileSync(f, path.join(destDir, f));
    console.log("Copied", f, "to artifact directory");
  }
}
