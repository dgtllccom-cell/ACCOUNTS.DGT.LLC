const SERVER = "http://72.60.209.121";

async function testHierarchy() {
  console.log("=== VERIFYING COMPLETE 5-LANGUAGE HIERARCHY ON VPS (72.60.209.121) ===\n");

  const languages = [
    { code: "en", name: "English" },
    { code: "ur", name: "Urdu (اردو)" },
    { code: "ar", name: "Arabic (العربية)" },
    { code: "fa", name: "Persian (فارسی)" },
    { code: "ps", name: "Pashto (پښتو)" }
  ];

  // 1. First get all countries
  const countriesRes = await fetch(`${SERVER}/api/erp/locations/countries?all=true`, {
    headers: { "cookie": `erp_lang=en` }
  });
  const countriesData = await countriesRes.json();
  const countries = countriesData?.data?.countries || [];
  console.log(`Found ${countries.length} active countries.\n`);

  for (const lang of languages) {
    console.log(`\n================== LANGUAGE: ${lang.name} (${lang.code.toUpperCase()}) ==================`);

    for (const c of countries) {
      // Get country localized name
      const cRes = await fetch(`${SERVER}/api/erp/locations/countries?all=true`, {
        headers: { "cookie": `erp_lang=${lang.code}` }
      });
      const cList = (await cRes.json())?.data?.countries || [];
      const localizedCountry = cList.find(x => x.id === c.id) || c;

      // Get states for this country
      const statesRes = await fetch(`${SERVER}/api/erp/locations/states?countryId=${c.id}`, {
        headers: { "cookie": `erp_lang=${lang.code}` }
      });
      const states = (await statesRes.json())?.data?.states || [];

      // Get cities for this country
      const citiesRes = await fetch(`${SERVER}/api/erp/locations/cities?countryId=${c.id}`, {
        headers: { "cookie": `erp_lang=${lang.code}` }
      });
      const cities = (await citiesRes.json())?.data?.cities || [];

      console.log(`\n🌍 ${localizedCountry.name} (${c.iso2}) - ${states.length} States, ${cities.length} Cities:`);
      console.log(`   States: ${states.map(s => s.name).join(", ")}`);
      console.log(`   Sample Cities (up to 5): ${cities.slice(0, 5).map(ct => ct.name).join(", ")}`);
    }
  }
}

testHierarchy().catch(console.error);
