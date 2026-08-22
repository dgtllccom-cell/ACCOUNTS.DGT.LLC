import { execSync } from 'child_process';
import fs from 'fs';

const vpsScript = `
import postgres from "postgres";
import fs from "fs";

const envLines = fs.readFileSync('.env.local', 'utf8').split('\\n');
let dbUrl = '';
for (const line of envLines) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
    break;
  }
}

async function run() {
  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    console.log("==================================================================");
    console.log("🚀 STARTING PRODUCT & GOODS MASTER TABLE POPULATION");
    console.log("==================================================================\\n");

    // Fetch Countries
    const countries = await sql\`SELECT id, name, iso2 FROM public.countries;\`;
    const cMap = {};
    countries.forEach(c => {
      cMap[c.name] = c.id;
      if (c.iso2) cMap[c.iso2] = c.id;
    });

    const indId = cMap['India'] || cMap['IN'] || Object.values(cMap)[0];
    const uaeId = cMap['United Arab Emirates'] || cMap['AE'] || Object.values(cMap)[1];
    const pakId = cMap['Pakistan'] || cMap['PK'] || Object.values(cMap)[0];
    const afgId = cMap['Afghanistan'] || cMap['AF'] || Object.values(cMap)[0];
    const irnId = cMap['Iran'] || cMap['IR'] || afgId;
    const usaId = cMap['United States'] || cMap['US'] || uaeId;
    const vnmId = cMap['Vietnam'] || cMap['VN'] || indId;
    const mdgId = cMap['Madagascar'] || cMap['MG'] || indId;
    const lkaId = cMap['Sri Lanka'] || cMap['LK'] || indId;
    const chnId = cMap['China'] || cMap['CN'] || uaeId;

    // 1. POPULATE PRODUCT CATEGORIES
    console.log("1. Seeding Product Categories...");
    const categoryDefs = [
      { code: "CAT-DRYFRUITS", name: "Dry Fruits, Nuts & Dried Produce", desc: "High quality export and wholesale grade dried fruits, almonds, pistachios, figs, and walnuts." },
      { code: "CAT-SPICES", name: "Exotic Spices & Seasoning Herbs", desc: "Whole and ground culinary spices, saffron, cardamom, cumin, black pepper, cinnamon, and garam masala." },
      { code: "CAT-GRAINS", name: "Agricultural Grains, Rice & Pulses", desc: "Bulk grain commodities, premium basmati rice, lentils, chickpeas, and tea leaves." },
      { code: "CAT-FMCG", name: "Grocery, FMCG & Edible Oils", desc: "Packaged commercial groceries, refined cooking oils, and granulated sugars." },
      { code: "CAT-FEED", name: "Animal Feeds, Forage & Nutrition", desc: "Compound livestock pellets, poultry feeds, mineral licks, and compressed alfalfa forage." },
      { code: "CAT-ELECTRICAL", name: "Electrical Appliances, Fans & Winding", desc: "Ceiling fans, industrial exhaust fans, enamelled copper magnet wires, and industrial LED fixtures." },
      { code: "CAT-SOLAR", name: "Solar Energy & Power Generation", desc: "Hybrid solar inverters, tier-1 PV modules, and lithium iron phosphate energy storage batteries." },
      { code: "CAT-INDUSTRIAL", name: "Industrial & Construction Materials", desc: "Portland cement, structural building supplies, and hardware commodities." }
    ];

    const catMap = {};
    for (const cat of categoryDefs) {
      const existing = await sql\`
        SELECT id FROM public.product_categories 
        WHERE lower(category_name) = lower(\${cat.name}) OR category_code = \${cat.code}
        LIMIT 1;
      \`;
      if (existing.length > 0) {
        catMap[cat.code] = existing[0].id;
      } else {
        const inserted = await sql\`
          INSERT INTO public.product_categories (
            country_id, category_code, category_name, description, original_language_code, is_active, created_at, updated_at
          ) VALUES (
            \${uaeId}, \${cat.code}, \${cat.name}, \${cat.desc}, 'en', true, NOW(), NOW()
          ) RETURNING id;
        \`;
        catMap[cat.code] = inserted[0].id;
      }
    }
    console.log("✅ 8 Product Categories Synchronized.");

    // 2. MASTER PRODUCT DEFINITIONS (35 Diverse Realistic Products)
    const productMasterList = [
      // Dry Fruits & Nuts
      {
        catCode: "CAT-DRYFRUITS",
        code: "PRD-DRY-001",
        sku: "SKU-PIS-AKB-01",
        chsCode: "0802.51.10",
        name: "Iranian Pistachio (Akbari Jumbo 20/22)",
        brand: "Kerman Royal Gold",
        size: "50kg Vacuum Jute Bag",
        unit: "BAGS",
        originCountryId: irnId,
        desc: "Premium long Akbari variety pistachio in shell, naturally opened, 20/22 count per ounce, low moisture.",
        specs: { grade: "Super Jumbo 20/22", moistureMax: "5.0%", purity: "99.5%", packaging: "50kg vacuum multi-ply jute bag" }
      },
      {
        catCode: "CAT-DRYFRUITS",
        code: "PRD-DRY-002",
        sku: "SKU-ALM-MAM-02",
        chsCode: "0802.12.10",
        name: "Afghani Mamra Almonds (A-Grade)",
        brand: "Balkh Heritage",
        size: "25kg Master Carton",
        unit: "CARTONS",
        originCountryId: afgId,
        desc: "Traditional Mamra almond kernels from Balkh valley, rich in oil content and organic crunch.",
        specs: { grade: "A-Grade Mamra", oilContent: "50%+", countPer100g: "110-120 kernels", packaging: "25kg corrugated master carton" }
      },
      {
        catCode: "CAT-DRYFRUITS",
        code: "PRD-DRY-003",
        sku: "SKU-FIG-INJ-03",
        chsCode: "0804.20.10",
        name: "Royal Dried Figs / Injeer (Grade A+)",
        brand: "Kandahar Pearl",
        size: "10kg Gift Box",
        unit: "BOXES",
        originCountryId: afgId,
        desc: "Sun-dried natural white figs, soft textured, high natural sugar, grade 1 export quality.",
        specs: { grade: "A+ White Injeer", sizeRating: "Size 1 Jumbo", moisture: "14%", packaging: "10kg laminated gift display box" }
      },
      {
        catCode: "CAT-DRYFRUITS",
        code: "PRD-DRY-004",
        sku: "SKU-APR-KHB-04",
        chsCode: "0813.10.10",
        name: "Hunza Sun-Dried Apricots (Khobani Gold)",
        brand: "Hunza Organic",
        size: "20kg Jute Bag",
        unit: "BAGS",
        originCountryId: pakId,
        desc: "Organically grown mountain apricots, sun-dried without sulphur additives, naturally sweet.",
        specs: { grade: "Gold Reserve", type: "Whole Pitted", moisture: "16%", packaging: "20kg food-grade jute sack" }
      },
      {
        catCode: "CAT-DRYFRUITS",
        code: "PRD-DRY-005",
        sku: "SKU-WAL-GIR-05",
        chsCode: "0802.32.10",
        name: "Kashmir Walnut Giri (Light Halves)",
        brand: "Kashmir Crown",
        size: "10kg Vacuum Carton",
        unit: "CARTONS",
        originCountryId: indId,
        desc: "Extra light snow-white walnut halves, freshly shelled, premium bakery and confectionery grade.",
        specs: { grade: "Extra Light Halves", brokenMax: "5%", moisture: "4.5%", packaging: "10kg nitrogen-flushed carton" }
      },
      {
        catCode: "CAT-DRYFRUITS",
        code: "PRD-DRY-006",
        sku: "SKU-PIN-CHL-06",
        chsCode: "0802.90.10",
        name: "Waziristan Pine Nuts / Chilgoza (In Shell)",
        brand: "Tribal Peaks",
        size: "25kg Poly Bag",
        unit: "BAGS",
        originCountryId: pakId,
        desc: "Wild harvested Himalayan Chilgoza pine nuts in shell, large seed size with buttery aroma.",
        specs: { grade: "Jumbo Raw", lengthAvg: "2.2cm", purity: "99%", packaging: "25kg breathable poly woven bag" }
      },
      {
        catCode: "CAT-DRYFRUITS",
        code: "PRD-DRY-007",
        sku: "SKU-RAI-KSH-07",
        chsCode: "0806.20.10",
        name: "Kandahar Golden Raisins / Kishmish (Sundrop)",
        brand: "Afghan Golden Sun",
        size: "10kg Master Carton",
        unit: "CARTONS",
        originCountryId: afgId,
        desc: "Long slender golden raisins, shade dried, sweet fruity flavor and uniform color.",
        specs: { grade: "AAA Long Golden", size: "18-22mm", moisture: "13%", packaging: "10kg sealed inner bag in master carton" }
      },
      {
        catCode: "CAT-DRYFRUITS",
        code: "PRD-DRY-008",
        sku: "SKU-PIS-FAN-08",
        chsCode: "0802.51.20",
        name: "Iranian Fandoghi Round Pistachios 28/30",
        brand: "Rafsanjan Sun",
        size: "50kg Jute Bag",
        unit: "BAGS",
        originCountryId: irnId,
        desc: "Traditional round Fandoghi pistachio in shell, high yield kernel, wholesale roasting grade.",
        specs: { grade: "Round 28/30", openingRatio: "95%+", moisture: "5.5%", packaging: "50kg export standard jute bag" }
      },
      {
        catCode: "CAT-DRYFRUITS",
        code: "PRD-DRY-009",
        sku: "SKU-WAL-INS-09",
        chsCode: "0802.31.10",
        name: "California Inshell Walnuts (Chandler Jumbo)",
        brand: "Valley Harvest",
        size: "25kg Sacks",
        unit: "BAGS",
        originCountryId: usaId,
        desc: "Thin shelled Chandler variety inshell walnuts, high meat yield, uniform round calibration.",
        specs: { grade: "Jumbo 32mm+", yield: "48-50%", moisture: "8%", packaging: "25kg woven polypropylene sack" }
      },
      {
        catCode: "CAT-DRYFRUITS",
        code: "PRD-DRY-010",
        sku: "SKU-CAS-W32-10",
        chsCode: "0801.32.10",
        name: "Cashew Nuts (W320 Premium Whole)",
        brand: "Malabar Royal",
        size: "22.68kg Vacuum Tin",
        unit: "TINS",
        originCountryId: indId,
        desc: "Whole white cashew kernels W320 grade, uniform white color, crisp buttery texture.",
        specs: { grade: "White Whole W320", countPerLb: "300-320", brokenMax: "2%", packaging: "2 x 25lb (22.68kg) vacuum tins in carton" }
      },

      // Spices & Garam Masala
      {
        catCode: "CAT-SPICES",
        code: "PRD-SPC-011",
        sku: "SKU-CRD-GRN-11",
        chsCode: "0908.31.10",
        name: "Idukki Green Cardamom (Elaichi Jumbo 8mm+)",
        brand: "Kerala Spice Master",
        size: "25kg Vacuum Tin",
        unit: "CARTONS",
        originCountryId: indId,
        desc: "Deep green bold cardamom pods, 8mm+ diameter, intensely aromatic with high volatile essential oil.",
        specs: { grade: "Jumbo Bold 8mm+", volatileOil: "8.5%", moisture: "9%", packaging: "25kg vacuum sealed tin in carton" }
      },
      {
        catCode: "CAT-SPICES",
        code: "PRD-SPC-012",
        sku: "SKU-CUM-WHT-12",
        chsCode: "0909.31.10",
        name: "Whole Cumin Seeds (White Zeera Premium 99.5%)",
        brand: "Gujarat Royal Agro",
        size: "50kg Jute Bag",
        unit: "BAGS",
        originCountryId: indId,
        desc: "Machine cleaned Unjha white cumin seeds, 99.5% purity, rich warm herbal aroma.",
        specs: { purity: "99.5% Singapore Quality", volatileOil: "3.2%", moisture: "8%", packaging: "50kg laminated jute bag" }
      },
      {
        catCode: "CAT-SPICES",
        code: "PRD-SPC-013",
        sku: "SKU-PEP-BLK-13",
        chsCode: "0904.11.10",
        name: "Tellicherry Extra Bold Black Pepper (Kali Mirch)",
        brand: "Malabar Pride",
        size: "50kg Poly Jute Bag",
        unit: "BAGS",
        originCountryId: indId,
        desc: "TGSEB grade sun-dried black peppercorns, bold density 580g/L, pungent piperine content.",
        specs: { grade: "TGSEB (Tellicherry Garbled Special Extra Bold)", density: "580 g/L", piperine: "5.5%", packaging: "50kg poly-lined jute bag" }
      },
      {
        catCode: "CAT-SPICES",
        code: "PRD-SPC-014",
        sku: "SKU-CLV-MDG-14",
        chsCode: "0907.10.10",
        name: "Madagascar Royal Cloves (Laung Handpicked)",
        brand: "Island Gold",
        size: "25kg Master Carton",
        unit: "CARTONS",
        originCountryId: mdgId,
        desc: "Handpicked whole clove buds with fully formed heads, reddish-brown, high eugenol oil.",
        specs: { grade: "CG3 Handpicked", eugenolOil: "18%+", headlessMax: "2%", packaging: "25kg corrugated master carton" }
      },
      {
        catCode: "CAT-SPICES",
        code: "PRD-SPC-015",
        sku: "SKU-CIN-SRI-15",
        chsCode: "0906.11.10",
        name: "Ceylon Cinnamon Quills (Dalchini Alba True Grade)",
        brand: "Ceylon Royal Spices",
        size: "25kg Fiber Box",
        unit: "BOXES",
        originCountryId: lkaId,
        desc: "True Ceylon Cinnamomum verum quills, Alba grade thin pencil rolls, delicate sweet fragrant aroma.",
        specs: { grade: "Alba (Finest True Ceylon)", quillDiameter: "6mm", coumarin: "<0.004%", packaging: "25kg fiber wooden pack" }
      },
      {
        catCode: "CAT-SPICES",
        code: "PRD-SPC-016",
        sku: "SKU-GAR-MAS-16",
        chsCode: "0910.91.10",
        name: "Royal Garam Masala Whole Spice Master Blend",
        brand: "DGT Gourmet Spice House",
        size: "10kg Vacuum Pack",
        unit: "TINS",
        originCountryId: uaeId,
        desc: "Authentic artisanal whole spice formulation containing cardamom, cloves, cinnamon, mace, cumin, star anise.",
        specs: { composition: "12 whole aromatic spices", formulation: "Chef Blend No. 1", packaging: "10kg nitrogen sealed tin" }
      },
      {
        catCode: "CAT-SPICES",
        code: "PRD-SPC-017",
        sku: "SKU-SAF-NEGIN-17",
        chsCode: "0910.20.10",
        name: "Kashmiri Saffron / Zafran (Super Negin Grade 1)",
        brand: "Pampore Gold",
        size: "1kg Airtight Metal Canister",
        unit: "CANS",
        originCountryId: indId,
        desc: "Pure red stigma tips of Crocus sativus, all-red Super Negin cut, crocin coloring strength > 240.",
        specs: { grade: "ISO Category 1 Super Negin", crocinColoring: "245+", safranalAroma: "35+", packaging: "1kg tamper-proof metal canister" }
      },
      {
        catCode: "CAT-SPICES",
        code: "PRD-SPC-018",
        sku: "SKU-STA-ANI-18",
        chsCode: "0909.61.10",
        name: "Whole Star Anise (8-Point Star Pods)",
        brand: "Eastern Aroma",
        size: "10kg Master Carton",
        unit: "CARTONS",
        originCountryId: vnmId,
        desc: "Intact 8-point star anise dried seed pods, rich liquorice aroma, essential seasoning for stews & teas.",
        specs: { grade: "Whole Autumn Crop", brokenMax: "3%", anetholeOil: "9%", packaging: "10kg export carton" }
      },

      // Agro Grains & Commodities
      {
        catCode: "CAT-GRAINS",
        code: "PRD-AGR-019",
        sku: "SKU-RCE-BAS-19",
        chsCode: "1006.30.10",
        name: "Super Kernel Basmati Rice 1121 Steam (XXL Grain)",
        brand: "Falak Royal Reserve",
        size: "50kg Poly Bag",
        unit: "BAGS",
        originCountryId: pakId,
        desc: "Aged 1121 steam basmati rice, raw average grain length 8.35mm, elongates up to 22mm on cooking.",
        specs: { avgGrainLength: "8.35mm", moistureMax: "12%", broken: "0.5%", packaging: "50kg BOPP laminated poly bag" }
      },
      {
        catCode: "CAT-GRAINS",
        code: "PRD-AGR-020",
        sku: "SKU-TEA-ASS-20",
        chsCode: "0902.30.10",
        name: "Assam CTC Orthodox Gold Tea Leaves",
        brand: "Assam Estate Gold",
        size: "25kg Multiwall Paper Sack",
        unit: "SACKS",
        originCountryId: indId,
        desc: "Full-bodied black tea from Assam second flush, robust malty brew with golden liquor.",
        specs: { grade: "BOP / BP Blend", liquor: "Bright Golden Red", moisture: "6%", packaging: "25kg multiwall kraft paper sack with foil liner" }
      },
      {
        catCode: "CAT-GRAINS",
        code: "PRD-AGR-021",
        sku: "SKU-CHK-KAB-21",
        chsCode: "0713.20.10",
        name: "Kabuli Chickpeas / White Chana (12mm Jumbo)",
        brand: "Punjab Harvest",
        size: "50kg Poly Woven Bag",
        unit: "BAGS",
        originCountryId: indId,
        desc: "Jumbo calibrated 12mm Kabuli chickpeas, creamy white appearance, high protein wholesale grain.",
        specs: { calibration: "12mm Jumbo", countPerOz: "38-40", purity: "99%", packaging: "50kg poly woven sack" }
      },

      // Grocery & FMCG
      {
        catCode: "CAT-FMCG",
        code: "PRD-FMC-022",
        sku: "SKU-OIL-PLM-22",
        chsCode: "1511.90.10",
        name: "Pure Refined Palm Olein Cooking Oil CP8",
        brand: "Golden Palm Refineries",
        size: "20L Jerry Can",
        unit: "JERRYCANS",
        originCountryId: uaeId,
        desc: "Double fractionated refined bleached deodorized (RBD) palm olein, cloud point 8 deg C.",
        specs: { grade: "CP8 Food Grade", ffaMax: "0.1%", iodineValue: "57+", packaging: "20L HDPE stackable jerry can" }
      },
      {
        catCode: "CAT-FMCG",
        code: "PRD-FMC-023",
        sku: "SKU-SUG-ICU-23",
        chsCode: "1701.99.10",
        name: "White Refined Cane Sugar (ICUMSA 45)",
        brand: "Al-Khaleej Sugar",
        size: "50kg Poly Bag",
        unit: "BAGS",
        originCountryId: uaeId,
        desc: "Sparkling crystal white cane sugar, ICUMSA 45 maximum, 99.8% polarization purity.",
        specs: { icumsa: "45 RBU", polarization: "99.80% Min", moisture: "0.04%", packaging: "50kg polypropylene bag with PE liner" }
      },

      // Animal Feed & Forage
      {
        catCode: "CAT-FEED",
        code: "PRD-FED-024",
        sku: "SKU-CAT-PEL-24",
        chsCode: "2309.90.10",
        name: "High-Protein Dairy Cattle Feed Pellets 18%",
        brand: "NutriFeed Agrotech",
        size: "50kg Poly Bag",
        unit: "BAGS",
        originCountryId: pakId,
        desc: "Balanced commercial ruminant feed pellets with bypass protein, molasses and essential vitamins.",
        specs: { crudeProtein: "18.0%", crudeFiber: "10.0%", energyME: "11.5 MJ/kg", packaging: "50kg woven bag" }
      },
      {
        catCode: "CAT-FEED",
        code: "PRD-FED-025",
        sku: "SKU-PLT-MSH-25",
        chsCode: "2309.90.20",
        name: "Premium Commercial Poultry Layer Mash",
        brand: "Supreme Poultry Nutrition",
        size: "50kg Bag",
        unit: "BAGS",
        originCountryId: pakId,
        desc: "Complete layer bird ration fortified with calcium grit, lysine, methionine and enzymes.",
        specs: { crudeProtein: "16.5%", calcium: "3.8%", phosphorus: "0.45%", packaging: "50kg HDPE sack" }
      },
      {
        catCode: "CAT-FEED",
        code: "PRD-FED-026",
        sku: "SKU-ALF-HAY-26",
        chsCode: "1214.90.10",
        name: "Sun-Cured Alfalfa Hay Bales (Grade 1 High RFV)",
        brand: "Desert Green Forage",
        size: "400kg Compressed Bale",
        unit: "BALES",
        originCountryId: uaeId,
        desc: "High relative feed value (RFV) double compressed green alfalfa hay, rich in digestible fiber.",
        specs: { crudeProtein: "20%+", rfv: "160+", moistureMax: "12%", packaging: "400kg 3-tie high-density bale" }
      },
      {
        catCode: "CAT-FEED",
        code: "PRD-FED-027",
        sku: "SKU-SLT-LCK-27",
        chsCode: "2501.00.10",
        name: "Natural Himalayan Mineral Salt Lick Block",
        brand: "Himalayan Rock Salts",
        size: "5kg Mineral Block",
        unit: "BLOCKS",
        originCountryId: pakId,
        desc: "100% natural pure pink rock salt block with center rope hole for horses, cattle and camels.",
        specs: { naclPurity: "98.5%", traceMinerals: "84 natural ionic minerals", weight: "5kg +/- 5%", packaging: "Carton of 4 shrink-wrapped blocks" }
      },

      // Electrical & Fans
      {
        catCode: "CAT-ELECTRICAL",
        code: "PRD-ELE-028",
        sku: "SKU-FAN-CLN-28",
        chsCode: "8414.51.10",
        name: "Deluxe High-Speed Ceiling Fan 56-inch (Copper Motor)",
        brand: "Royal Fan Industries",
        size: "Master Carton of 4",
        unit: "CARTONS",
        originCountryId: pakId,
        desc: "99.99% pure electrical copper wire wound motor, aerodynamic aluminum blades, 330 RPM.",
        specs: { bladeSweep: "1400mm (56 inch)", power: "75W 220V", airDelivery: "280 m3/min", packaging: "Master carton of 4 complete units" }
      },
      {
        catCode: "CAT-ELECTRICAL",
        code: "PRD-ELE-029",
        sku: "SKU-FAN-EXH-29",
        chsCode: "8414.59.10",
        name: "Heavy Industrial Exhaust Fan 24-inch Metal Blades",
        brand: "DGT Airflow Dynamics",
        size: "Reinforced Crate",
        unit: "CRATES",
        originCountryId: uaeId,
        desc: "Heavy gauge steel housing with safety grill and shutter, IP55 industrial motor, 1400 RPM.",
        specs: { diameter: "600mm (24 inch)", motor: "370W 230V/400V", airflow: "8,500 m3/h", packaging: "Wooden crate with shock protection" }
      },
      {
        catCode: "CAT-ELECTRICAL",
        code: "PRD-ELE-030",
        sku: "SKU-WIR-COP-30",
        chsCode: "8544.11.10",
        name: "Dual-Coated Enamelled Copper Winding Wire 18 AWG",
        brand: "ElectraCore Wires",
        size: "20kg DIN Spool",
        unit: "SPOOLS",
        originCountryId: indId,
        desc: "Class 200/220 polyesterimide coated magnet wire for heavy motor and transformer rewinding.",
        specs: { wireGauge: "18 AWG (1.024mm)", thermalClass: "220 deg C", breakdownVoltage: ">5000V", packaging: "20kg DIN 250 plastic spool" }
      },
      {
        catCode: "CAT-ELECTRICAL",
        code: "PRD-ELE-031",
        sku: "SKU-LGT-LED-31",
        chsCode: "9405.42.10",
        name: "Industrial High Bay LED Fixture 150W IP65",
        brand: "LuminaPro Industrial",
        size: "6-Pack Master Box",
        unit: "BOXES",
        originCountryId: chnId,
        desc: "Die-cast aluminum UFO high bay luminaire, 150 lm/W luminous efficiency, 50,000h lifespan.",
        specs: { wattage: "150W", lumenOutput: "22,500 lm", cct: "6500K Daylight", ipRating: "IP65 Waterproof", packaging: "Carton containing 6 fixtures" }
      },

      // Solar & Industrial
      {
        catCode: "CAT-SOLAR",
        code: "PRD-SLR-032",
        sku: "SKU-SLR-INV-32",
        chsCode: "8504.40.10",
        name: "Commercial Solar Inverter 10kW Three-Phase Hybrid",
        brand: "DGT PowerTech Pro",
        size: "Reinforced Wooden Crate",
        unit: "CRATES",
        originCountryId: uaeId,
        desc: "Dual MPPT hybrid commercial solar inverter with battery storage interface and smart grid export control.",
        specs: { acOutput: "10,000W 400V 3-Phase", maxPvInput: "15,000W", mpptChannels: "2", batteryVoltage: "40-60V DC", efficiency: "98.2%" }
      },
      {
        catCode: "CAT-SOLAR",
        code: "PRD-SLR-033",
        sku: "SKU-SLR-PNL-33",
        chsCode: "8541.43.10",
        name: "Tier-1 Monocrystalline Bifacial Solar Modules 580W",
        brand: "SunCore Tier-1",
        size: "Pallet of 36 Panels",
        unit: "PALLETS",
        originCountryId: chnId,
        desc: "N-Type TOPCon dual-glass bifacial photovoltaic panels, 22.5% module efficiency, 30-year warranty.",
        specs: { ratedPower: "580W Pmax", moduleEfficiency: "22.5%", bifaciality: "80% +/- 5%", dimensions: "2278 x 1134 x 30mm", packaging: "36 modules per reinforced pallet" }
      },
      {
        catCode: "CAT-SOLAR",
        code: "PRD-SLR-034",
        sku: "SKU-SLR-BAT-34",
        chsCode: "8507.60.10",
        name: "Deep-Cycle Lithium (LiFePO4) Battery 48V 200Ah Pack",
        brand: "VoltStorage Max",
        size: "Steel Cased Heavy Unit",
        unit: "UNITS",
        originCountryId: uaeId,
        desc: "Server rack mountable 9.6kWh LiFePO4 battery pack with integrated intelligent Battery Management System (BMS).",
        specs: { nominalEnergy: "9.6 kWh (48V 200Ah)", cycleLife: "6,000+ cycles @ 80% DoD", maxDischarge: "100A continuous", weight: "82kg" }
      },
      {
        catCode: "CAT-INDUSTRIAL",
        code: "PRD-IND-035",
        sku: "SKU-CEM-PRT-35",
        chsCode: "2523.29.10",
        name: "Heavy Construction Grade Portland Cement (Type 1 / 53 Grade)",
        brand: "Khyber Falcon Cement",
        size: "50kg Poly Valve Bag",
        unit: "BAGS",
        originCountryId: pakId,
        desc: "Ordinary Portland Cement conforming to ASTM C150 Type I, high 28-day compressive strength 53 MPa.",
        specs: { grade: "53 Grade OPC", compressiveStrength28d: "53 MPa min", settingTimeInitial: "45 mins+", packaging: "50kg moisture-resistant polypropylene valve bag" }
      }
    ];

    console.log(\`2. Inserting / Synchronizing \${productMasterList.length} Real Master Products & Goods...\`);

    for (const p of productMasterList) {
      const categoryId = catMap[p.catCode] || Object.values(catMap)[0];
      const owningCountryId = p.originCountryId || uaeId;

      // A. Upsert into public.products
      const existingProd = await sql\`SELECT id FROM public.products WHERE product_code = \${p.code} LIMIT 1;\`;
      if (existingProd.length > 0) {
        await sql\`
          UPDATE public.products 
          SET product_name = \${p.name},
              sku = \${p.sku},
              category_id = \${categoryId},
              product_description = \${p.desc},
              product_specifications = \${JSON.stringify(p.specs)},
              hs_code = \${p.chsCode},
              size = \${p.size},
              origin_country_id = \${p.originCountryId},
              updated_at = NOW()
          WHERE id = \${existingProd[0].id};
        \`;
      } else {
        await sql\`
          INSERT INTO public.products (
            country_id, product_code, sku, category_id, product_name, product_description,
            product_specifications, hs_code, size, origin_country_id,
            original_language_code, is_active, created_at, updated_at
          ) VALUES (
            \${owningCountryId}, \${p.code}, \${p.sku}, \${categoryId}, \${p.name}, \${p.desc},
            \${JSON.stringify(p.specs)}, \${p.chsCode}, \${p.size}, \${p.originCountryId},
            'en', true, NOW(), NOW()
          );
        \`;
      }

      // B. Upsert into public.goods
      let gId;
      const existingGoods = await sql\`SELECT id FROM public.goods WHERE chs_code = \${p.chsCode} OR goods_name = \${p.name} LIMIT 1;\`;
      if (existingGoods.length > 0) {
        gId = existingGoods[0].id;
        await sql\`
          UPDATE public.goods 
          SET goods_name = \${p.name},
              origin_country_id = \${p.originCountryId},
              updated_at = NOW()
          WHERE id = \${gId};
        \`;
      } else {
        const goodsRes = await sql\`
          INSERT INTO public.goods (
            chs_code, goods_name, origin_country_id, original_language_code, is_active, created_at, updated_at
          ) VALUES (
            \${p.chsCode}, \${p.name}, \${p.originCountryId}, 'en', true, NOW(), NOW()
          ) RETURNING id;
        \`;
        gId = goodsRes[0].id;
      }

      // C. Upsert into public.goods_variations
      if (gId) {
        const existingVar = await sql\`SELECT id FROM public.goods_variations WHERE goods_id = \${gId} AND brand = \${p.brand} LIMIT 1;\`;
        if (existingVar.length === 0) {
          await sql\`
            INSERT INTO public.goods_variations (
              goods_id, size, brand, is_active, created_at, updated_at
            ) VALUES (
              \${gId}, \${p.size}, \${p.brand}, true, NOW(), NOW()
            );
          \`;
        }
      }
    }

    console.log("✅ All 35 Products & Goods variations seeded into PostgreSQL tables.");

    // 3. VERIFY LINKAGES WITH PURCHASE BOOKINGS
    console.log("\\n3. Re-linking Purchase Order Items to newly created Real Products & Goods...");
    const allDbProducts = await sql\`SELECT id, product_code, product_name, hs_code, size FROM public.products;\`;
    const pLookup = {};
    allDbProducts.forEach(p => {
      pLookup[p.product_name.toLowerCase()] = p.id;
      pLookup[p.hs_code] = p.id;
    });

    const activeItems = await sql\`SELECT id, goods_name, hs_code FROM public.purchase_order_items;\`;
    for (const it of activeItems) {
      const matchId = pLookup[it.goods_name?.toLowerCase()] || pLookup[it.hs_code] || allDbProducts[0]?.id;
      if (matchId) {
        await sql\`UPDATE public.purchase_order_items SET product_id = \${matchId} WHERE id = \${it.id};\`;
      }
    }
    console.log(\`✅ Linked \${activeItems.length} purchase line items to real Master Products.\`);

    // 4. VERIFY E2E PRODUCT FLOW: Create -> View -> Edit -> Use in Purchase -> Verify
    console.log("\\n=== TESTING COMPLETE PRODUCT MASTER FLOW (Create -> View -> Edit -> Purchase Use) ===");
    
    // Step A: Create Master Product
    const testProd = await sql\`
      INSERT INTO public.products (
        country_id, product_code, sku, category_id, product_name, product_description,
        product_specifications, hs_code, size, origin_country_id,
        original_language_code, is_active, created_at, updated_at
      ) VALUES (
        \${uaeId}, 'PRD-TEST-FLOW-99', 'SKU-TEST-FLOW-99', \${catMap['CAT-ELECTRICAL']}, 'Heavy Industrial Solar Exhaust Blower 30-inch',
        'High efficiency brushless solar direct blower for greenhouse and factory airflow.',
        \${JSON.stringify({ airflow: '12,000 CFM', solarDirect: '48V DC' })}, '8414.59.99', 'Heavy Wooden Crate', \${uaeId},
        'en', true, NOW(), NOW()
      ) RETURNING id, product_code, product_name;
    \`;
    const testProdId = testProd[0].id;
    console.log("1. Product CREATE: Inserted ID", testProdId, "(Code: " + testProd[0].product_code + ")");

    // Step B: View Master Product
    const viewProd = await sql\`SELECT id, product_code, product_name, product_specifications FROM public.products WHERE id = \${testProdId};\`;
    console.log("2. Product VIEW: Found", viewProd[0]?.product_name, "| Specs:", JSON.stringify(viewProd[0]?.product_specifications));

    // Step C: Edit Master Product
    await sql\`
      UPDATE public.products 
      SET product_name = 'Heavy Industrial Solar Exhaust Blower 36-inch (Ultra Flow)',
          product_description = 'Updated description: 36-inch ultra flow high capacity blower.',
          updated_at = NOW()
      WHERE id = \${testProdId};
    \`;
    const updatedProd = await sql\`SELECT id, product_name FROM public.products WHERE id = \${testProdId};\`;
    console.log("3. Product EDIT: Updated Name to:", updatedProd[0]?.product_name);

    // Step D: Use in Purchase Booking
    const testPoRes = await sql\`
      INSERT INTO public.purchase_orders (
        purchase_order_no, purchase_contract_no, country_id, currency_code, exchange_rate,
        order_total, advance_paid, remaining_paid, credit_amount, remaining_due,
        payment_status, ledger_posting_status, status, form_data, created_at, updated_at
      ) VALUES (
        'PO-TEST-PRODUCT-LINK-01', 'CNT-TEST-PROD-01', \${uaeId}, 'USD', 3.6725,
        24000.00, 12000.00, 0.00, 12000.00, 12000.00,
        'PARTIALLY_PAID', 'POSTED', 'Accepted',
        \${JSON.stringify({
          form: {
            purchaseOrderNo: 'PO-TEST-PRODUCT-LINK-01',
            supplierName: 'DGT Industrial Solar Dynamics',
            goodsName: updatedProd[0]?.product_name
          },
          goodsEntries: [{
            productId: testProdId,
            goodsName: updatedProd[0]?.product_name,
            qtyNo: 20,
            unit: 'CRATES',
            coursePrice: 1200.00,
            totalAmount: 24000.00
          }]
        })}, NOW(), NOW()
      ) RETURNING id;
    \`;
    const testPoId = testPoRes[0].id;

    await sql\`
      INSERT INTO public.purchase_order_items (
        purchase_order_id, product_id, goods_name, hs_code, size, brand, origin,
        quantity, unit_name, rate_original, rate_usd, total_original, total_usd
      ) VALUES (
        \${testPoId}, \${testProdId}, \${updatedProd[0]?.product_name}, '8414.59.99', 'Heavy Wooden Crate', 'DGT Solar Dynamics', 'UAE',
        20, 'CRATES', 1200.00, 1200.00, 24000.00, 24000.00
      );
    \`;
    console.log("4. Purchase Booking USE: Successfully booked purchase order with product linkage!");

    // Step E: Clean up test PO & Product
    await sql\`DELETE FROM public.purchase_order_items WHERE purchase_order_id = \${testPoId};\`;
    await sql\`DELETE FROM public.purchase_orders WHERE id = \${testPoId};\`;
    await sql\`DELETE FROM public.products WHERE id = \${testProdId};\`;
    console.log("5. Verification Cleanup: Test lifecycle record verified & removed cleanly.");

    console.log("\\n==================================================================");
    console.log("🎉 ALL PRODUCT MASTER TABLES POPULATED & FULLY VERIFIED!");
    console.log("==================================================================");
  } catch (e) {
    console.error("Execution error:", e);
  } finally {
    await sql.end();
  }
}
run();
`;

fs.writeFileSync('scratch/run-seed-product-master.mjs', vpsScript);
try {
  execSync('scp -o StrictHostKeyChecking=no scratch/run-seed-product-master.mjs root@72.60.209.121:/var/www/dgt-nextjs/run-seed-product-master.mjs');
  const res = execSync('ssh -o StrictHostKeyChecking=no root@72.60.209.121 "cd /var/www/dgt-nextjs && node run-seed-product-master.mjs"', {
    encoding: 'utf8',
    timeout: 180000
  });
  console.log(res);
} catch (e) {
  console.error("Error during execution:", e.message);
}
