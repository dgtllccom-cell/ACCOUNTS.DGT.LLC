import { execSync } from "child_process";

const SERVER = "http://72.60.209.121";

async function testLoc() {
  console.log("Testing Live Multilingual Location APIs on VPS (72.60.209.121)...\n");

  const languages = [
    { code: "en", name: "English" },
    { code: "ur", name: "Urdu (اردو)" },
    { code: "ar", name: "Arabic (العربية)" },
    { code: "fa", name: "Persian (فارسی)" },
    { code: "ps", name: "Pashto (پښتو)" }
  ];

  for (const lang of languages) {
    const res = await fetch(`${SERVER}/api/erp/locations/countries?all=true`, {
      headers: {
        "cookie": `erp_lang=${lang.code}`
      }
    });

    const data = await res.json();
    const list = data?.data?.countries || [];
    console.log(`[Language: ${lang.name}] Countries (${list.length}):`);
    list.forEach(c => console.log(`   - ${c.iso2}: ${c.name}`));
    console.log("");
  }
}

testLoc().catch(console.error);
