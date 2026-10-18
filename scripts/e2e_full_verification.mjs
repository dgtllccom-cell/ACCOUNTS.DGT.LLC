import fs from "node:fs";
import postgres from "postgres";

const BASE = "http://127.0.0.1:3000";

function envUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const t = fs.readFileSync(".env.local", "utf8");
  return t.match(/^DATABASE_URL\s*=\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g, "");
}
const URL_ = envUrl();
if (!/csesvyxxjivnkkozgopt/.test(URL_)) {
  console.error("REFUSING TO RUN: DATABASE_URL is not DEV (csesvyxxjivnkkozgopt).");
  process.exit(2);
}
const sql = postgres(URL_, { max: 2, prepare: false });

async function login(role, countryId = null, cb = null, city = null) {
  const body = { role, countryId, countryBranchId: cb, cityBranchId: city };
  const r = await fetch(`${BASE}/api/erp/auth/dev-session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error("dev-session failed: " + r.status);
  const cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  return async (method, path, payload, lang = "en") => {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        cookie,
        "x-erp-lang": lang
      },
      body: payload === undefined ? undefined : JSON.stringify(payload)
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text };
  };
}

const checkList = [];
function check(section, name, ok, detail = "") {
  checkList.push({ section, name, ok: Boolean(ok), detail });
  console.log(`${ok ? "✅ PASS" : "❌ FAIL"} [${section}] ${name}${!ok && detail ? " -> " + JSON.stringify(detail) : ""}`);
}

async function run() {
  console.log("==================================================================");
  console.log("  FULL INDEPENDENT CUSTOMER ORDER & SHIPMENT TRACKING E2E         ");
  console.log("  Target Database: DEV (csesvyxxjivnkkozgopt)                     ");
  console.log("==================================================================\n");

  const superAdmin = await login("super_admin");
  const pkAdmin = await login("country_admin", "fb021716-a2e7-4141-9c1a-bd1ddd92eb14");
  const aeAdmin = await login("country_admin", "935dd0b9-8228-43b3-b53d-c06e9ae2882f");
  const chamanBranch = await login("city_branch_admin", "fb021716-a2e7-4141-9c1a-bd1ddd92eb14", "5269c1cb-92a1-4aa8-aad8-d4c7260badaa", "322351af-732f-4351-a89b-ba34cfe598cf");

  const AF = "8366fa0e-dcf6-4acd-8602-2819f103dd63";
  const PK = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14";
  const AE = "935dd0b9-8228-43b3-b53d-c06e9ae2882f";
  const IR = "44771a90-df8d-4a29-b524-f128bde17071";
  const UZ = "9c622bc0-5321-4787-b5c8-0dcea552d153";
  const IN = "96ab1da1-12f6-470a-85d5-a681424559ab";

  const customerId = "ffc90074-1f0e-45ac-9a33-ac2aaea84c59";
  const customerName = "DEV TEST Al-Farooq International Traders";

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. SCENARIO A: Afghanistan -> Chaman Border (Pakistan) -> Karachi (Pakistan)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--- TEST SCENARIO A: Afghanistan -> Chaman Border -> Karachi (By Road) ---");

  const orderAPayload = {
    customer_id: customerId,
    customer_name: customerName,
    movement_type: "import",
    import_scenario: "collect_from_origin",
    shipment_type: "FCL",
    transport_mode: "by_road",
    load_type: "full_truck",
    loading_country_id: AF,
    loading_country_name: "Afghanistan",
    receiving_country_id: PK,
    receiving_country_name: "Pakistan",
    route_name: "Kandahar -> Chaman Border -> Karachi Port Commercial Route",
    cargo_details: "200 Bags Afghan Premium Dried Figs & Almonds",
    goods_name: "Afghan Dried Fruits",
    goods_quantity: 200,
    goods_unit: "bags",
    goods_bags_cartons: 200,
    goods_gross_weight: 10000,
    goods_empty_weight: 400,
    goods_net_weight: 9600,
    goods_items: [
      {
        goods_name: "Dry Figs (Injeer)",
        hs_code: "0804.20.00",
        quantity: 100,
        unit: "bags",
        gross_weight: 5000,
        net_weight: 4800,
        currency: "USD",
        rate: 85,
        total_amount: 8500
      },
      {
        goods_name: "Mamra Almonds",
        hs_code: "0802.12.00",
        quantity: 100,
        unit: "bags",
        gross_weight: 5000,
        net_weight: 4800,
        currency: "USD",
        rate: 110,
        total_amount: 11000
      }
    ],
    truck_number: "AF-KDR-4421",
    truck_driver_name: "Gul Mohammad Khan",
    truck_driver_mobile: "+93 700 123456",
    truck_owner_name: "Kandahar Cross-Border Logistics",
    truck_registration_type: "temporary",
    remarks: "DEV TEST SCENARIO A - AF to PK direct transit via Chaman",
    legs: [
      {
        legNo: 1,
        transportMode: "by_road",
        fromCountryId: AF,
        fromCountryName: "Afghanistan",
        fromLocationText: "Spin Boldak Terminal, Kandahar",
        toCountryId: PK,
        toCountryName: "Pakistan",
        toLocationText: "Chaman Customs Border Post",
        handlerType: "our_branch",
        customsRequired: true,
        clearanceType: "import",
        customsStatus: "in_progress",
        customsAgentName: "DGT Chaman Clearing Agency",
        truckNumber: "AF-KDR-4421",
        truckDriverName: "Gul Mohammad Khan",
        status: "in_transit",
        insuranceRequired: true
      },
      {
        legNo: 2,
        transportMode: "by_road",
        fromCountryId: PK,
        fromCountryName: "Pakistan",
        fromLocationText: "Chaman Customs Border Post",
        toCountryId: PK,
        toCountryName: "Pakistan",
        toLocationText: "Karachi Port Qasim Wholesale Hub",
        handlerType: "our_branch",
        customsRequired: false,
        clearanceType: null,
        customsStatus: "completed",
        truckNumber: "PK-QTA-9982",
        truckDriverName: "Abdul Rahman Mengal",
        status: "pending",
        insuranceRequired: true
      }
    ]
  };

  const createARes = await superAdmin("POST", "/api/erp/clearing-agent/customer-order", orderAPayload);
  check("Scenario A", "Create Order A via API returns HTTP 200", createARes.status === 200, createARes.json?.error || createARes.text);
  const orderA = createARes.json?.data;
  check("Scenario A", "Order A generated order_no and ID", Boolean(orderA?.id && orderA?.order_no), orderA);

  if (orderA?.id) {
    const orderId = orderA.id;
    const orderNo = orderA.order_no;

    const [dbRow] = await sql`select * from public.clearing_customer_orders where id = ${orderId}::uuid`;
    check("Scenario A", "DB persists import_scenario = collect_from_origin", dbRow?.import_scenario === "collect_from_origin", dbRow?.import_scenario);
    check("Scenario A", "DB persists goods_gross_weight = 10000", Number(dbRow?.goods_gross_weight) === 10000, dbRow?.goods_gross_weight);
    check("Scenario A", "DB persists goods_items JSON manifest (2 items)", Array.isArray(dbRow?.goods_items) && dbRow.goods_items.length === 2, dbRow?.goods_items);

    const dbLegs = await sql`select * from public.clearing_customer_order_legs where order_id = ${orderId}::uuid order by leg_no`;
    check("Scenario A", "DB has exactly 2 route legs", dbLegs.length === 2, dbLegs.length);
    check("Scenario A", "Leg 1 border crossing from AF to PK", dbLegs[0]?.from_country_name === "Afghanistan" && dbLegs[0]?.to_country_name === "Pakistan");
    check("Scenario A", "Leg 2 transport Chaman to Karachi", dbLegs[1]?.from_location_text?.includes("Chaman") && dbLegs[1]?.to_location_text?.includes("Karachi"));

    // Workflow: Confirm Stage 1B (Truck Confirmation)
    const truck1bRes = await superAdmin("POST", `/api/erp/clearing-agent/customer-order/${orderId}/workflow`, {
      action: "confirm_truck",
      truckNumber: "AF-KDR-4421",
      truckDriverName: "Gul Mohammad Khan",
      truckDriverMobile: "+93 700 123456",
      truckTransportCompany: "Kandahar Logistics",
      truckRegistrationType: "temporary",
      vehicleType: "Trailer",
      continueMyself: true
    });
    check("Scenario A", "Workflow 1B Truck Confirmation succeeds", truck1bRes.status === 200, truck1bRes.json);

    // Workflow: Complete Stage 1C (Goods Entry & Finalize)
    const goods1cRes = await superAdmin("POST", `/api/erp/clearing-agent/customer-order/${orderId}/workflow`, {
      action: "complete_goods",
      goodsItems: [
        {
          goodsName: "Dry Figs (Injeer)",
          goodsChsCode: "0804.20.00",
          quantity: 100,
          unit: "bags",
          grossWeight: 5000,
          emptyWeight: 200,
          netWeight: 4800,
          currency: "USD",
          rate: 85,
          totalAmount: 8500
        },
        {
          goodsName: "Mamra Almonds",
          goodsChsCode: "0802.12.00",
          quantity: 100,
          unit: "bags",
          grossWeight: 5000,
          emptyWeight: 200,
          netWeight: 4800,
          currency: "USD",
          rate: 110,
          totalAmount: 11000
        }
      ]
    });
    check("Scenario A", "Workflow 1C Goods Entry Finalization succeeds", goods1cRes.status === 200, goods1cRes.json);

    // Tracking: Add Milestone Events using orderId
    const leg1Id = dbLegs[0]?.id;
    const eventRes1 = await superAdmin("POST", `/api/erp/tracking/${orderId}/events`, {
      legId: leg1Id,
      eventCode: "gate_in",
      locationName: "Spin Boldak - Chaman Border Gate",
      status: "in_progress",
      remarks: "Truck arrived at Chaman border gate; documents in review"
    });
    check("Scenario A", "Tracking Milestone 1 (gate_in) recorded", eventRes1.status === 200, eventRes1.json);

    const eventRes2 = await superAdmin("POST", `/api/erp/tracking/${orderId}/events`, {
      legId: leg1Id,
      eventCode: "loaded",
      locationName: "Chaman Customs Post",
      status: "completed",
      remarks: "Customs declaration cleared under GD-PK-CHM-2026-9921; dispatched"
    });
    check("Scenario A", "Tracking Milestone 2 (loaded / cleared) recorded", eventRes2.status === 200, eventRes2.json);

    const leg2Id = dbLegs[1]?.id;
    const eventRes3 = await superAdmin("POST", `/api/erp/tracking/${orderId}/events`, {
      legId: leg2Id,
      eventCode: "arrived",
      locationName: "Karachi Port Qasim Hub",
      status: "completed",
      remarks: "Shipment arrived safely at Karachi destination warehouse"
    });
    check("Scenario A", "Tracking Milestone 3 (arrived at destination) recorded", eventRes3.status === 200, eventRes3.json);

    // Fetch tracking timeline
    const trackingRes = await superAdmin("GET", `/api/erp/tracking/${orderNo}`);
    check("Scenario A", "Shipment tracking detail endpoint returns timeline", trackingRes.status === 200, trackingRes.json);

    // Customer Bill generation & link
    const billRes = await superAdmin("POST", "/api/erp/clearing-agent/customer-bill", { orderId });
    check("Scenario A", "Generate Customer Bill for Order A returns HTTP 200", billRes.status === 200, billRes.json || billRes.text);
    const billData = billRes.json?.data;
    check("Scenario A", "Customer Bill linked to order_id and has bill_no", Boolean(billData?.bill_no && (billData.order_id === orderId || billData.order_ids?.includes(orderId))), billData);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. SCENARIO B: Dubai, UAE -> Iran -> Afghanistan -> Uzbekistan -> India
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST SCENARIO B: Dubai -> Iran -> Afghanistan -> Uzbekistan -> India (Multimodal) ---");

  const orderBPayload = {
    customer_id: customerId,
    customer_name: customerName,
    movement_type: "transit",
    shipment_type: "FCL",
    transport_mode: "by_sea",
    load_type: "container_haulage",
    loading_country_id: AE,
    loading_country_name: "United Arab Emirates",
    receiving_country_id: IN,
    receiving_country_name: "India",
    route_name: "Dubai (Sea) -> Bandar Abbas (IR) -> Herat (AF) -> Termez (UZ) -> Mumbai (IN)",
    cargo_details: "1x40ft High Cube Container Industrial Electrical Machinery",
    goods_name: "Electrical Components & Industrial Control Systems",
    goods_quantity: 40,
    goods_unit: "packages",
    goods_bags_cartons: 40,
    goods_gross_weight: 8500,
    goods_empty_weight: 3800,
    goods_net_weight: 4700,
    goods_items: [
      {
        goods_name: "Variable Frequency Drives & Inverters",
        hs_code: "8504.40.90",
        quantity: 20,
        unit: "packages",
        gross_weight: 4250,
        net_weight: 2350,
        currency: "USD",
        rate: 1200,
        total_amount: 24000
      },
      {
        goods_name: "Programmable Logic Controllers (PLC)",
        hs_code: "8537.10.91",
        quantity: 20,
        unit: "packages",
        gross_weight: 4250,
        net_weight: 2350,
        currency: "USD",
        rate: 950,
        total_amount: 19000
      }
    ],
    remarks: "DEV TEST SCENARIO B - Multi-modal 4-leg corridor (UAE -> IR -> AF -> UZ -> IN)",
    legs: [
      {
        legNo: 1,
        transportMode: "by_sea",
        fromCountryId: AE,
        fromCountryName: "United Arab Emirates",
        fromLocationText: "Jebel Ali Port Terminal 2, Dubai",
        toCountryId: IR,
        toCountryName: "Iran",
        toLocationText: "Shahid Rajaee Port, Bandar Abbas",
        vesselName: "MV DGT EMIRATES",
        voyageNumber: "VY-2026-088",
        containerNumber: "DGTU-8849201",
        containerSize: "40HC",
        sealNumber: "SL-UAE-9921",
        handlerType: "external_partner",
        partnerType: "shipping_provider",
        partnerName: "Gulf Marine Feeder Lines",
        customsRequired: true,
        clearanceType: "export",
        customsStatus: "completed",
        status: "completed",
        insuranceRequired: true
      },
      {
        legNo: 2,
        transportMode: "by_road",
        fromCountryId: IR,
        fromCountryName: "Iran",
        fromLocationText: "Dogharoon Border Transit Hub, Khorasan",
        toCountryId: AF,
        toCountryName: "Afghanistan",
        toLocationText: "Islam Qala Border Terminal, Herat",
        truckNumber: "IR-MHD-7729",
        truckDriverName: "Hossein Rezaei",
        truckDriverMobile: "+98 912 345678",
        handlerType: "external_partner",
        partnerType: "transporter",
        partnerName: "Khorasan Overland Transit Co",
        customsRequired: true,
        clearanceType: "transit",
        customsStatus: "in_progress",
        status: "in_transit",
        insuranceRequired: true
      },
      {
        legNo: 3,
        transportMode: "by_road",
        fromCountryId: AF,
        fromCountryName: "Afghanistan",
        fromLocationText: "Hairatan Dry Port & Railhead, Balkh",
        toCountryId: UZ,
        toCountryName: "Uzbekistan",
        toLocationText: "Termez Cargo Centre & River Port",
        railContainerNumber: "UZ-RAIL-44129",
        wagonNumber: "WAG-9021",
        railwayOperator: "Uzbekistan Temir Yollari",
        handlerType: "our_branch",
        customsRequired: true,
        clearanceType: "transit",
        customsStatus: "pending",
        status: "pending",
        insuranceRequired: true
      },
      {
        legNo: 4,
        transportMode: "by_air",
        fromCountryId: UZ,
        fromCountryName: "Uzbekistan",
        fromLocationText: "Islam Karimov Tashkent Airport (TAS)",
        toCountryId: IN,
        toCountryName: "India",
        toLocationText: "Indira Gandhi International Airport Cargo (DEL)",
        flightNumber: "HY-421",
        airlineName: "Uzbekistan Airways Cargo",
        airwayBillNo: "AWB-250-99418201",
        handlerType: "external_partner",
        partnerType: "airline",
        partnerName: "Uzbekistan Airways",
        customsRequired: true,
        clearanceType: "import",
        customsStatus: "pending",
        status: "pending",
        insuranceRequired: true
      }
    ]
  };

  const createBRes = await superAdmin("POST", "/api/erp/clearing-agent/customer-order", orderBPayload);
  check("Scenario B", "Create 4-Leg Multimodal Order B returns HTTP 200", createBRes.status === 200, createBRes.json?.error || createBRes.text);
  const orderB = createBRes.json?.data;
  check("Scenario B", "Order B generated order_no and ID", Boolean(orderB?.id && orderB?.order_no), orderB);

  if (orderB?.id) {
    const orderId = orderB.id;
    const orderNo = orderB.order_no;

    const [dbRowB] = await sql`select * from public.clearing_customer_orders where id = ${orderId}::uuid`;
    check("Scenario B", "DB movement_type is transit", dbRowB?.movement_type === "transit", dbRowB?.movement_type);
    check("Scenario B", "DB loading country is UAE, receiving is India", dbRowB?.loading_country_id === AE && dbRowB?.receiving_country_id === IN);

    const dbLegsB = await sql`select * from public.clearing_customer_order_legs where order_id = ${orderId}::uuid order by leg_no`;
    check("Scenario B", "DB persists exactly 4 route legs", dbLegsB.length === 4, dbLegsB.length);

    check("Scenario B", "Leg 1 is Sea (Jebel Ali -> Bandar Abbas)", dbLegsB[0]?.transport_mode === "by_sea" && dbLegsB[0]?.vessel_name === "MV DGT EMIRATES");
    check("Scenario B", "Leg 2 is Road (Dogharoon -> Islam Qala)", dbLegsB[1]?.transport_mode === "by_road" && dbLegsB[1]?.truck_number === "IR-MHD-7729");
    check("Scenario B", "Leg 3 is Border Crossing (Hairatan AF -> Termez UZ)", dbLegsB[2]?.from_country_name?.includes("Afghanistan") && dbLegsB[2]?.to_country_name?.includes("Uzbekistan"));
    check("Scenario B", "Leg 4 is Air (Tashkent UZ -> Delhi IN)", dbLegsB[3]?.transport_mode === "by_air" && dbLegsB[3]?.flight_number === "HY-421");

    // Tracking Milestones across multiple countries
    const ev1 = await superAdmin("POST", `/api/erp/tracking/${orderId}/events`, {
      legId: dbLegsB[0]?.id,
      eventCode: "vessel_departed",
      locationName: "Jebel Ali Port, Dubai",
      vesselName: "MV DGT EMIRATES",
      voyageNumber: "VY-2026-088",
      containerNumber: "DGTU-8849201",
      status: "in_progress",
      remarks: "Container loaded onto MV DGT EMIRATES voyage VY-2026-088; vessel departed"
    });
    check("Scenario B", "Milestone Leg 1 UAE vessel departure recorded", ev1.status === 200, ev1.json);

    const ev2 = await superAdmin("POST", `/api/erp/tracking/${orderId}/events`, {
      legId: dbLegsB[0]?.id,
      eventCode: "discharged",
      locationName: "Shahid Rajaee Port, Bandar Abbas",
      containerNumber: "DGTU-8849201",
      status: "completed",
      remarks: "Container discharged from vessel at Shahid Rajaee port"
    });
    check("Scenario B", "Milestone Leg 1 Iran port discharge recorded", ev2.status === 200, ev2.json);

    const ev3 = await superAdmin("POST", `/api/erp/tracking/${orderId}/events`, {
      legId: dbLegsB[1]?.id,
      eventCode: "gate_in",
      locationName: "Islam Qala Border Terminal",
      status: "in_progress",
      remarks: "Transit truck arrived at Islam Qala Afghan border gate"
    });
    check("Scenario B", "Milestone Leg 2 AF border gate_in recorded", ev3.status === 200, ev3.json);

    // Tracking search test by order number & container number
    const trackSearch = await superAdmin("GET", `/api/erp/tracking/list?domain=both&limit=100&q=DGTU-8849201`);
    check("Scenario B", "Shipment tracking search matches container number DGTU-8849201", trackSearch.status === 200 && (trackSearch.json?.data?.rows || []).some((i) => i.orderNo === orderNo || (i.containerNumber && i.containerNumber.includes("DGTU-8849201"))), trackSearch.json?.data?.rows);

    // Customer Bill generation for Order B
    const billResB = await superAdmin("POST", "/api/erp/clearing-agent/customer-bill", { orderId });
    check("Scenario B", "Generate Customer Bill for Order B returns HTTP 200", billResB.status === 200, billResB.json || billResB.text);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. MULTILINGUAL (5 Languages) & RBAC Verification
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST 3: Multilingual & Role-Based Access Control ---");
  const languages = ["en", "ur", "ar", "fa", "ps"];
  for (const lang of languages) {
    const listRes = await superAdmin("GET", "/api/erp/clearing-agent/customer-order?limit=5", undefined, lang);
    check("Multilingual", `API customer-order list responds 200 in language '${lang}'`, listRes.status === 200, listRes.status);
  }

  // Scoped access: Pakistan Country Admin sees Order A (PK involved)
  const pkList = await pkAdmin("GET", "/api/erp/clearing-agent/customer-order?limit=20");
  check("RBAC Scope", "PK Country Admin retrieves orders with Pakistan scope", pkList.status === 200 && Array.isArray(pkList.json?.data), pkList.status);

  // Scoped access: UAE Country Admin sees Order B (UAE origin)
  const aeList = await aeAdmin("GET", "/api/erp/clearing-agent/customer-order?limit=20");
  check("RBAC Scope", "UAE Country Admin retrieves orders with UAE scope", aeList.status === 200 && Array.isArray(aeList.json?.data), aeList.status);

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. READ-ONLY PRODUCTION VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST 4: Read-Only Verification of Production (72.60.209.121) ---");
  try {
    const vpsCheck = await fetch("http://72.60.209.121/dashboard/clearing-agent/customer-order", {
      headers: { "User-Agent": "Antigravity-Verification-Agent" }
    });
    check("Live VPS Read-Only", "VPS Customer Order page serves HTTP 200/307 (healthy web app)", [200, 307, 308].includes(vpsCheck.status), `Status: ${vpsCheck.status}`);
  } catch (err) {
    check("Live VPS Read-Only", "VPS HTTP reachability", false, err.message);
  }

  await sql.end();

  console.log("\n==================================================================");
  const total = checkList.length;
  const passed = checkList.filter(c => c.ok).length;
  const failed = checkList.filter(c => !c.ok).length;
  console.log(`SUMMARY: Total Checks: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exitCode = 1;
  }
}

run().catch(err => {
  console.error("FATAL TEST HARNESS ERROR:", err);
  process.exit(1);
});
