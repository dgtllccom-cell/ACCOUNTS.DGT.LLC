import postgres from "postgres";

const dbUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";
if (!dbUrl.includes("csesvyxxjivnkkozgopt")) {
  throw new Error("SAFETY CHECK FAILED: Must run only on dev database!");
}

const sql = postgres(dbUrl, { ssl: "require", max: 5 });

const C = {
  UAE: { id: "935dd0b9-8228-43b3-b53d-c06e9ae2882f", name: "United Arab Emirates" },
  IRAN: { id: "44771a90-df8d-4a29-b524-f128bde17071", name: "Iran" },
  AFG: { id: "8366fa0e-dcf6-4acd-8602-2819f103dd63", name: "Afghanistan" },
  PAK: { id: "fb021716-a2e7-4141-9c1a-bd1ddd92eb14", name: "Pakistan" },
  UZB: { id: "9c622bc0-5321-4787-b5c8-0dcea552d153", name: "Uzbekistan" },
  IND: { id: "96ab1da1-12f6-470a-85d5-a681424559ab", name: "India" },
  CHN: { id: "e2fbe3c8-9bc2-406a-aeb2-1de9192a1fb7", name: "China" },
  TJK: { id: "5477eadf-fc11-4142-b00e-00cbc8c9baca", name: "Tajikistan" },
  TKM: { id: "fb5163fe-ba96-4381-90f7-9ef4f94b45c8", name: "Turkmenistan" },
};

const B = {
  UAE: "87c2e253-b6c1-482d-a808-272337f3ffda",
  PAK: "5269c1cb-92a1-4aa8-aad8-d4c7260badaa",
  AFG: "0842bdac-4c33-4b9e-ada5-e21aa8176151",
};

const remainingOrders = [
  // 3. User Audio 3: Afghanistan -> 2 Trucks Mixed Dry Fruit -> Chaman Customs (tax paid) -> Karachi
  {
    customerName: "Haji Qasim & Brothers Fresh Fruits",
    goodsName: "Mixed Dry Fruit (Almonds, Pistachio, Raisins, Dried Figs) - Truck 1",
    goodsQuantity: 28000,
    goodsUnit: "KG",
    goodsBagsCartons: 1400,
    goodsGrossWeight: 28600,
    goodsNetWeight: 28000,
    shipmentType: "FCL",
    transportMode: "by_road",
    movementType: "export",
    loadingCountryId: C.AFG.id,
    loadingCountryName: C.AFG.name,
    receivingCountryId: C.PAK.id,
    receivingCountryName: C.PAK.name,
    countryId: C.AFG.id,
    countryBranchId: B.AFG,
    loadingSourceName: "Kandahar Spin Boldak Dry Port",
    destinationPortName: "Karachi New Sabzi Mandi Terminal",
    remarks: "Audio 3 Route: 2 trucks loaded in Afghanistan -> Chaman custom tax paid -> Truck 1 sent to Karachi",
    legs: [
      {
        legNo: 1,
        fromCountryId: C.AFG.id,
        fromCountryName: C.AFG.name,
        toCountryId: C.PAK.id,
        toCountryName: C.PAK.name,
        fromLocationText: "Spin Boldak / Kandahar Terminal",
        toLocationText: "Chaman Customs Border Post",
        transportMode: "by_road",
        truckNumber: "KBL-7291-TK",
        truckDriverName: "Mirwais Khan",
        clearanceType: "export",
        dutyTreatment: "no_duty_exempt",
        customsStatus: "cleared",
        remarks: "Crossed from Afghanistan into Pakistan Chaman dry port"
      },
      {
        legNo: 2,
        fromCountryId: C.PAK.id,
        fromCountryName: C.PAK.name,
        toCountryId: C.PAK.id,
        toCountryName: C.PAK.name,
        fromLocationText: "Chaman Customs Terminal",
        toLocationText: "Karachi Sabzi Mandi Hub",
        transportMode: "by_road",
        truckNumber: "TLB-4819-KHI",
        truckDriverName: "Gul Khan Kakar",
        clearanceType: "import",
        dutyTreatment: "duty_payable",
        dutyAmount: 215000,
        dutyCurrency: "PKR",
        customsStatus: "cleared",
        remarks: "Chaman customs duties & sales tax paid; Truck 1 delivered safely to Karachi Wholesale Hub"
      }
    ]
  },

  // 3B. Sister truck from Entry 3 to Faisalabad
  {
    customerName: "Haji Qasim & Brothers Fresh Fruits",
    goodsName: "Mixed Dry Fruit - Truck 2 (Shelled Almonds & Dried Figs)",
    goodsQuantity: 26500,
    goodsUnit: "KG",
    goodsBagsCartons: 1325,
    goodsGrossWeight: 27100,
    goodsNetWeight: 26500,
    shipmentType: "FCL",
    transportMode: "by_road",
    movementType: "export",
    loadingCountryId: C.AFG.id,
    loadingCountryName: C.AFG.name,
    receivingCountryId: C.PAK.id,
    receivingCountryName: C.PAK.name,
    countryId: C.AFG.id,
    countryBranchId: B.AFG,
    loadingSourceName: "Spin Boldak Terminal",
    destinationPortName: "Faisalabad Agro Produce Terminal",
    remarks: "Audio 3 (Truck 2): Chaman customs duty cleared, dispatched to Faisalabad Market",
    legs: [
      {
        legNo: 1,
        fromCountryId: C.AFG.id,
        fromCountryName: C.AFG.name,
        toCountryId: C.PAK.id,
        toCountryName: C.PAK.name,
        fromLocationText: "Spin Boldak / Kandahar Terminal",
        toLocationText: "Chaman Customs Border Post",
        transportMode: "by_road",
        truckNumber: "KBL-8812-TK",
        truckDriverName: "Nematullah Barech",
        clearanceType: "export",
        dutyTreatment: "no_duty_exempt",
        customsStatus: "cleared"
      },
      {
        legNo: 2,
        fromCountryId: C.PAK.id,
        fromCountryName: C.PAK.name,
        toCountryId: C.PAK.id,
        toCountryName: C.PAK.name,
        fromLocationText: "Chaman Customs Post",
        toLocationText: "Faisalabad Grain & Agro Terminal",
        transportMode: "by_road",
        truckNumber: "FSD-9201-TK",
        truckDriverName: "Malik Tariq",
        clearanceType: "import",
        dutyTreatment: "duty_payable",
        dutyAmount: 198000,
        dutyCurrency: "PKR",
        customsStatus: "cleared",
        remarks: "Dispatched direct via Indus Highway to Faisalabad terminal"
      }
    ]
  },

  // 4. User Audio 4: China -> Tajikistan -> Sher Khan Bandar -> Afghanistan (truck change) -> Hairatan -> Uzbekistan -> Air to India
  {
    customerName: "Trans-Eurasia Electronics Corp",
    goodsName: "High-Efficiency Solar Inverters & Lithium Cells",
    goodsQuantity: 18500,
    goodsUnit: "KG",
    goodsBagsCartons: 1100,
    goodsGrossWeight: 19200,
    goodsNetWeight: 18500,
    shipmentType: "FCL",
    transportMode: "by_road",
    movementType: "transit",
    loadingCountryId: C.CHN.id,
    loadingCountryName: C.CHN.name,
    receivingCountryId: C.IND.id,
    receivingCountryName: C.IND.name,
    countryId: C.UAE.id,
    countryBranchId: B.UAE,
    loadingSourceName: "Kashgar International Logistics Park",
    destinationPortName: "New Delhi Air Cargo Terminal",
    remarks: "Audio 4 Route: China -> Tajikistan border -> Sher Khan Bandar -> Afghanistan truck changed -> Hairatan -> Tashkent Uzbekistan -> Air to India",
    legs: [
      {
        legNo: 1,
        fromCountryId: C.CHN.id,
        fromCountryName: C.CHN.name,
        toCountryId: C.TJK.id,
        toCountryName: C.TJK.name,
        fromLocationText: "Kashgar International Logistics Hub",
        toLocationText: "Kulma Pass / Murghab Tajikistan",
        transportMode: "by_road",
        truckNumber: "XIN-8849-CN",
        clearanceType: "export",
        dutyTreatment: "no_duty_exempt",
        customsStatus: "cleared"
      },
      {
        legNo: 2,
        fromCountryId: C.TJK.id,
        fromCountryName: C.TJK.name,
        toCountryId: C.AFG.id,
        toCountryName: C.AFG.name,
        fromLocationText: "Nizhny Panj Tajikistan Border",
        toLocationText: "Sher Khan Bandar Port Afghanistan",
        transportMode: "by_road",
        truckNumber: "TJ-39-1029",
        clearanceType: "transit",
        dutyTreatment: "transit_bonded",
        customsStatus: "cleared",
        remarks: "Crossed Panj River Bridge into Sher Khan Bandar"
      },
      {
        legNo: 3,
        fromCountryId: C.AFG.id,
        fromCountryName: C.AFG.name,
        toCountryId: C.UZB.id,
        toCountryName: C.UZB.name,
        fromLocationText: "Sher Khan Bandar / Kunduz (Truck Changed)",
        toLocationText: "Hairatan Friendship Bridge / Termez",
        transportMode: "by_road",
        truckNumber: "AFG-31-9041",
        truckDriverName: "Jalilullah Uzbek",
        clearanceType: "transit",
        dutyTreatment: "transit_bonded",
        customsStatus: "cleared",
        remarks: "Truck changed in Afghanistan; moved northward through Mazar to Hairatan"
      },
      {
        legNo: 4,
        fromCountryId: C.UZB.id,
        fromCountryName: C.UZB.name,
        toCountryId: C.IND.id,
        toCountryName: C.IND.name,
        fromLocationText: "Tashkent International Airport Cargo Hub (TAS)",
        toLocationText: "Indira Gandhi International Airport Cargo (DEL)",
        transportMode: "by_air",
        airlineName: "Air Cargo Global",
        flightNumber: "ACG-9102",
        airWaybillNumber: "771-3829104",
        clearanceType: "import",
        dutyTreatment: "duty_payable",
        customsStatus: "submitted",
        remarks: "Air freight dispatch from Tashkent to New Delhi terminal"
      }
    ]
  },

  // 5. User Audio 5: Dubai -> 1 container to Pakistan (Karachi branch/others handled) -> transit road to Chaman -> road to Afghanistan
  {
    customerName: "Afghan-Nippon Auto Spare Parts Ltd",
    goodsName: "Automotive Transmission & Brake Assemblies",
    goodsQuantity: 1,
    goodsUnit: "Container (40ft HC)",
    goodsBagsCartons: 820,
    goodsGrossWeight: 24500,
    goodsNetWeight: 23800,
    shipmentType: "FCL",
    transportMode: "by_sea",
    movementType: "transit",
    loadingCountryId: C.UAE.id,
    loadingCountryName: C.UAE.name,
    receivingCountryId: C.AFG.id,
    receivingCountryName: C.AFG.name,
    countryId: C.PAK.id,
    countryBranchId: B.PAK,
    loadingSourceName: "Jebel Ali Freezone (JAFZA)",
    destinationPortName: "Kandahar Dry Port Logistics Center",
    remarks: "Audio 5 Route: 1 Container loaded from Dubai to Karachi Pakistan (handled by Karachi branch/agent) -> Transit by road to Chaman -> Road to Afghanistan",
    legs: [
      {
        legNo: 1,
        fromCountryId: C.UAE.id,
        fromCountryName: C.UAE.name,
        toCountryId: C.PAK.id,
        toCountryName: C.PAK.name,
        fromLocationText: "Dubai Jebel Ali Port",
        toLocationText: "Karachi Port Trust (KPT)",
        transportMode: "by_sea",
        vesselName: "APL Qingdao",
        containerNumber: "APLU-8192031",
        blNumber: "BL-KHI-2026-901",
        clearanceType: "transit",
        dutyTreatment: "transit_bonded",
        customsStatus: "cleared",
        remarks: "Discharged at KPT, transit in-bond documentation processed by Karachi agent"
      },
      {
        legNo: 2,
        fromCountryId: C.PAK.id,
        fromCountryName: C.PAK.name,
        toCountryId: C.PAK.id,
        toCountryName: C.PAK.name,
        fromLocationText: "Karachi Port Trust (KPT)",
        toLocationText: "Chaman Customs Transit Yard",
        transportMode: "by_road",
        truckNumber: "TTA-9921-KHI",
        truckDriverName: "Naseerullah Tareen",
        clearanceType: "transit",
        dutyTreatment: "transit_bonded",
        customsStatus: "cleared",
        remarks: "Bonded transit haulage via RCD Highway through Quetta to Chaman terminal"
      },
      {
        legNo: 3,
        fromCountryId: C.PAK.id,
        fromCountryName: C.PAK.name,
        toCountryId: C.AFG.id,
        toCountryName: C.AFG.name,
        fromLocationText: "Chaman Transit Terminal",
        toLocationText: "Kandahar Customs Inland Port",
        transportMode: "by_road",
        truckNumber: "AFG-12-7729",
        truckDriverName: "Sardar Mohammad",
        clearanceType: "import",
        dutyTreatment: "duty_payable",
        customsStatus: "cleared",
        remarks: "Delivered to Kandahar dry port, final import duty cleared"
      }
    ]
  },

  // 6. User Audio 6: Dubai -> 2 containers to Karachi -> Karachi external clearing agent paid duty -> delivered to Karachi warehouse
  {
    customerName: "Metro Synthetic Textiles Karachi",
    goodsName: "Polyester Suiting Fabric & Lining Rolls",
    goodsQuantity: 2,
    goodsUnit: "Container (40ft HQ)",
    goodsBagsCartons: 1600,
    goodsGrossWeight: 52000,
    goodsNetWeight: 51200,
    shipmentType: "FCL",
    transportMode: "by_sea",
    movementType: "import",
    loadingCountryId: C.UAE.id,
    loadingCountryName: C.UAE.name,
    receivingCountryId: C.PAK.id,
    receivingCountryName: C.PAK.name,
    countryId: C.PAK.id,
    countryBranchId: B.PAK,
    loadingSourceName: "Dubai Port Rashid / Jebel Ali",
    destinationPortName: "SITE Industrial Area Warehouse, Karachi",
    remarks: "Audio 6 Route: 2 containers from Dubai to Karachi -> Karachi other clearing agent cleared duty & sales tax -> delivered to Karachi warehouse",
    legs: [
      {
        legNo: 1,
        fromCountryId: C.UAE.id,
        fromCountryName: C.UAE.name,
        toCountryId: C.PAK.id,
        toCountryName: C.PAK.name,
        fromLocationText: "Dubai Jebel Ali Port",
        toLocationText: "Port Muhammad Bin Qasim (QICT)",
        transportMode: "by_sea",
        vesselName: "MSC Nicole",
        containerNumber: "MEDU-4819024 / MEDU-4819025",
        blNumber: "BL-MEDU-902183",
        clearanceType: "import",
        dutyTreatment: "duty_payable",
        customsStatus: "cleared",
        remarks: "Discharged at Port Qasim container terminal"
      },
      {
        legNo: 2,
        fromCountryId: C.PAK.id,
        fromCountryName: C.PAK.name,
        toCountryId: C.PAK.id,
        toCountryName: C.PAK.name,
        fromLocationText: "Port Qasim QICT Terminal",
        toLocationText: "SITE Karachi Central Warehouse",
        transportMode: "by_road",
        truckNumber: "KHI-8830-TR",
        truckDriverName: "Asghar Ali",
        clearanceType: "import",
        dutyTreatment: "duty_payable",
        dutyAmount: 485000,
        dutyCurrency: "PKR",
        customsStatus: "cleared",
        remarks: "Handled by external clearing agent; customs duty, regulatory duty & sales tax paid; offloaded at SITE warehouse"
      }
    ]
  },

  // 7. UAE -> Iran -> Turkmenistan -> Uzbekistan (Ceramics & Sanitary Ware)
  {
    customerName: "Samarkand Modern Construction LLC",
    goodsName: "Porcelain Floor Tiles & Ceramic Fittings",
    goodsQuantity: 24000,
    goodsUnit: "KG",
    goodsBagsCartons: 1200,
    goodsGrossWeight: 24500,
    goodsNetWeight: 24000,
    shipmentType: "FCL",
    transportMode: "by_sea",
    movementType: "transit",
    loadingCountryId: C.UAE.id,
    loadingCountryName: C.UAE.name,
    receivingCountryId: C.UZB.id,
    receivingCountryName: C.UZB.name,
    countryId: C.UAE.id,
    countryBranchId: B.UAE,
    remarks: "Sharjah to Samarkand transit via Bandar Abbas & Sarakhs border",
    legs: [
      {
        legNo: 1,
        fromCountryId: C.UAE.id,
        fromCountryName: C.UAE.name,
        toCountryId: C.IRAN.id,
        toCountryName: C.IRAN.name,
        fromLocationText: "Sharjah Khalid Port",
        toLocationText: "Bandar Abbas Port",
        transportMode: "by_sea",
        vesselName: "Al Zahra Cargo",
        containerNumber: "ZAHU-7192031",
        clearanceType: "export",
        customsStatus: "cleared"
      },
      {
        legNo: 2,
        fromCountryId: C.IRAN.id,
        fromCountryName: C.IRAN.name,
        toCountryId: C.TKM.id,
        toCountryName: C.TKM.name,
        fromLocationText: "Bandar Abbas Port",
        toLocationText: "Sarakhs / Sarahs Border Post",
        transportMode: "by_road",
        truckNumber: "IR-92-3841",
        clearanceType: "transit",
        customsStatus: "cleared"
      },
      {
        legNo: 3,
        fromCountryId: C.TKM.id,
        fromCountryName: C.TKM.name,
        toCountryId: C.UZB.id,
        toCountryName: C.UZB.name,
        fromLocationText: "Farap Border Post",
        toLocationText: "Samarkand Logistics Terminal",
        transportMode: "by_road",
        truckNumber: "UZB-10-8291",
        clearanceType: "import",
        dutyTreatment: "duty_payable",
        customsStatus: "cleared"
      }
    ]
  },

  // 8. Afghanistan -> Uzbekistan -> UAE (Saffron & Pine Nuts Air Courier)
  {
    customerName: "Afghan Royal Saffron & Spices",
    goodsName: "Super Negin Saffron & Roasted Pine Nuts (Chilgoza)",
    goodsQuantity: 3200,
    goodsUnit: "KG",
    goodsBagsCartons: 320,
    goodsGrossWeight: 3400,
    goodsNetWeight: 3200,
    shipmentType: "Air Cargo",
    transportMode: "by_road",
    movementType: "export",
    loadingCountryId: C.AFG.id,
    loadingCountryName: C.AFG.name,
    receivingCountryId: C.UAE.id,
    receivingCountryName: C.UAE.name,
    countryId: C.AFG.id,
    countryBranchId: B.AFG,
    remarks: "High-value agricultural export from Mazar-i-Sharif via Tashkent air link to Dubai",
    legs: [
      {
        legNo: 1,
        fromCountryId: C.AFG.id,
        fromCountryName: C.AFG.name,
        toCountryId: C.UZB.id,
        toCountryName: C.UZB.name,
        fromLocationText: "Mazar-i-Sharif Export Facility",
        toLocationText: "Termez Cargo Terminal",
        transportMode: "by_road",
        truckNumber: "AFG-19-4820",
        clearanceType: "export",
        customsStatus: "cleared"
      },
      {
        legNo: 2,
        fromCountryId: C.UZB.id,
        fromCountryName: C.UZB.name,
        toCountryId: C.UAE.id,
        toCountryName: C.UAE.name,
        fromLocationText: "Tashkent International Airport (TAS)",
        toLocationText: "Dubai International Airport Cargo (DXB)",
        transportMode: "by_air",
        airlineName: "Emirates SkyCargo",
        flightNumber: "EK-9821",
        clearanceType: "import",
        dutyTreatment: "duty_payable",
        customsStatus: "cleared"
      }
    ]
  },

  // 9. China -> Pakistan via Khunjerab Pass / Sost Dry Port (Consumer Electronics)
  {
    customerName: "Lahore Tech Mart Enterprises",
    goodsName: "Smart LED TVs & Home Audio Soundbars",
    goodsQuantity: 15400,
    goodsUnit: "KG",
    goodsBagsCartons: 950,
    goodsGrossWeight: 16200,
    goodsNetWeight: 15400,
    shipmentType: "FCL",
    transportMode: "by_road",
    movementType: "import",
    loadingCountryId: C.CHN.id,
    loadingCountryName: C.CHN.name,
    receivingCountryId: C.PAK.id,
    receivingCountryName: C.PAK.name,
    countryId: C.PAK.id,
    countryBranchId: B.PAK,
    remarks: "Direct overland import via Karakoram Highway and Sost dry port customs",
    legs: [
      {
        legNo: 1,
        fromCountryId: C.CHN.id,
        fromCountryName: C.CHN.name,
        toCountryId: C.PAK.id,
        toCountryName: C.PAK.name,
        fromLocationText: "Kashgar Dry Port China",
        toLocationText: "Sost Dry Port Customs Post Pakistan",
        transportMode: "by_road",
        truckNumber: "XIN-9912-CN",
        clearanceType: "export",
        customsStatus: "cleared"
      },
      {
        legNo: 2,
        fromCountryId: C.PAK.id,
        fromCountryName: C.PAK.name,
        toCountryId: C.PAK.id,
        toCountryName: C.PAK.name,
        fromLocationText: "Sost Dry Port Pakistan",
        toLocationText: "Lahore Thokar Niaz Baig Terminal",
        transportMode: "by_road",
        truckNumber: "GLT-3921-TK",
        truckDriverName: "Sher Afzal Hunzai",
        clearanceType: "import",
        dutyTreatment: "duty_payable",
        dutyAmount: 380000,
        dutyCurrency: "PKR",
        customsStatus: "cleared"
      }
    ]
  },

  // 10. Iran -> Afghanistan via Milak / Nimruz Border (Construction Steel & Rods)
  {
    customerName: "Kandahar Builders Syndicate",
    goodsName: "Deformed Steel Reinforcing Bars (Grade 60)",
    goodsQuantity: 65000,
    goodsUnit: "KG",
    goodsBagsCartons: 130,
    goodsGrossWeight: 65500,
    goodsNetWeight: 65000,
    shipmentType: "Flatbed Truck",
    transportMode: "by_road",
    movementType: "import",
    loadingCountryId: C.IRAN.id,
    loadingCountryName: C.IRAN.name,
    receivingCountryId: C.AFG.id,
    receivingCountryName: C.AFG.name,
    countryId: C.AFG.id,
    countryBranchId: B.AFG,
    remarks: "Isfahan Steel plant via Milak Border Bridge into Zaranj / Nimruz",
    legs: [
      {
        legNo: 1,
        fromCountryId: C.IRAN.id,
        fromCountryName: C.IRAN.name,
        toCountryId: C.AFG.id,
        toCountryName: C.AFG.name,
        fromLocationText: "Isfahan Steel Complex",
        toLocationText: "Milak / Zaranj Border Crossing",
        transportMode: "by_road",
        truckNumber: "IR-44-1029",
        truckDriverName: "Hassan Rostami",
        clearanceType: "export",
        customsStatus: "cleared"
      },
      {
        legNo: 2,
        fromCountryId: C.AFG.id,
        fromCountryName: C.AFG.name,
        toCountryId: C.AFG.id,
        toCountryName: C.AFG.name,
        fromLocationText: "Zaranj Customs Port",
        toLocationText: "Kandahar Aino Mina Construction Site",
        transportMode: "by_road",
        truckNumber: "AFG-77-3910",
        truckDriverName: "Habibullah Khan",
        clearanceType: "import",
        dutyTreatment: "duty_payable",
        dutyAmount: 54000,
        dutyCurrency: "AFN",
        customsStatus: "cleared"
      }
    ]
  },

  // 11. Pakistan -> Afghanistan via Torkham (Basmati Rice & Wheat Flour)
  {
    customerName: "Jalalabad Flour & Food Mills",
    goodsName: "Super Kernel Basmati Rice (50 KG Bags)",
    goodsQuantity: 50000,
    goodsUnit: "KG",
    goodsBagsCartons: 1000,
    goodsGrossWeight: 50400,
    goodsNetWeight: 50000,
    shipmentType: "FCL",
    transportMode: "by_road",
    movementType: "export",
    loadingCountryId: C.PAK.id,
    loadingCountryName: C.PAK.name,
    receivingCountryId: C.AFG.id,
    receivingCountryName: C.AFG.name,
    countryId: C.PAK.id,
    countryBranchId: B.PAK,
    remarks: "Gujranwala Rice Mills via Peshawar Ring Road and Torkham Border",
    legs: [
      {
        legNo: 1,
        fromCountryId: C.PAK.id,
        fromCountryName: C.PAK.name,
        toCountryId: C.AFG.id,
        toCountryName: C.AFG.name,
        fromLocationText: "Gujranwala Export Silos",
        toLocationText: "Torkham / Nangarhar Customs Post",
        transportMode: "by_road",
        truckNumber: "P-8821-TK",
        truckDriverName: "Zahid Shinwari",
        clearanceType: "export",
        customsStatus: "cleared"
      },
      {
        legNo: 2,
        fromCountryId: C.AFG.id,
        fromCountryName: C.AFG.name,
        toCountryId: C.AFG.id,
        toCountryName: C.AFG.name,
        fromLocationText: "Torkham Customs Post",
        toLocationText: "Jalalabad Wholesale Market",
        transportMode: "by_road",
        truckNumber: "AFG-18-2019",
        truckDriverName: "Gulab Khan",
        clearanceType: "import",
        dutyTreatment: "duty_payable",
        customsStatus: "cleared"
      }
    ]
  },

  // 12. UAE -> India by Sea (Industrial Copper Ingots & Scrap)
  {
    customerName: "Mumbai Metal Recyclers Pvt Ltd",
    goodsName: "Electrolytic Copper Cathodes & Ingot Bars",
    goodsQuantity: 44000,
    goodsUnit: "KG",
    goodsBagsCartons: 88,
    goodsGrossWeight: 44200,
    goodsNetWeight: 44000,
    shipmentType: "FCL",
    transportMode: "by_sea",
    movementType: "export",
    loadingCountryId: C.UAE.id,
    loadingCountryName: C.UAE.name,
    receivingCountryId: C.IND.id,
    receivingCountryName: C.IND.name,
    countryId: C.UAE.id,
    countryBranchId: B.UAE,
    remarks: "Jebel Ali Port direct container liner to Nhava Sheva (JNPT) Mumbai",
    legs: [
      {
        legNo: 1,
        fromCountryId: C.UAE.id,
        fromCountryName: C.UAE.name,
        toCountryId: C.IND.id,
        toCountryName: C.IND.name,
        fromLocationText: "Dubai Jebel Ali Port Terminal 1",
        toLocationText: "Nhava Sheva JNPT Mumbai",
        transportMode: "by_sea",
        vesselName: "CMA CGM Figaro",
        voyageNumber: "CF-2026-X",
        containerNumber: "CMAU-8829104 / CMAU-8829105",
        blNumber: "BL-JNPT-448291",
        clearanceType: "export",
        customsStatus: "cleared"
      }
    ]
  },

  // 13. Uzbekistan -> Afghanistan -> Pakistan (Cotton Yarn & Combed Fabric)
  {
    customerName: "Faisalabad Textile Processing Mills",
    goodsName: "100% Combed Cotton Yarn (Count 30/1)",
    goodsQuantity: 36000,
    goodsUnit: "KG",
    goodsBagsCartons: 1800,
    goodsGrossWeight: 36800,
    goodsNetWeight: 36000,
    shipmentType: "FCL",
    transportMode: "by_road",
    movementType: "transit",
    loadingCountryId: C.UZB.id,
    loadingCountryName: C.UZB.name,
    receivingCountryId: C.PAK.id,
    receivingCountryName: C.PAK.name,
    countryId: C.PAK.id,
    countryBranchId: B.PAK,
    remarks: "Bukhara Textile Mills via Termez, Hairatan and Chaman route to Faisalabad",
    legs: [
      {
        legNo: 1,
        fromCountryId: C.UZB.id,
        fromCountryName: C.UZB.name,
        toCountryId: C.AFG.id,
        toCountryName: C.AFG.name,
        fromLocationText: "Bukhara Spinning Mills",
        toLocationText: "Hairatan Border Customs Yard",
        transportMode: "by_road",
        truckNumber: "UZB-80-2910",
        clearanceType: "export",
        customsStatus: "cleared"
      },
      {
        legNo: 2,
        fromCountryId: C.AFG.id,
        fromCountryName: C.AFG.name,
        toCountryId: C.PAK.id,
        toCountryName: C.PAK.name,
        fromLocationText: "Hairatan / Mazar Transit Yard",
        toLocationText: "Chaman Customs Post",
        transportMode: "by_road",
        truckNumber: "AFG-55-8910",
        clearanceType: "transit",
        dutyTreatment: "transit_bonded",
        customsStatus: "cleared"
      },
      {
        legNo: 3,
        fromCountryId: C.PAK.id,
        fromCountryName: C.PAK.name,
        toCountryId: C.PAK.id,
        toCountryName: C.PAK.name,
        fromLocationText: "Chaman Customs Post",
        toLocationText: "Faisalabad Textile Estate",
        transportMode: "by_road",
        truckNumber: "FSD-4410-TK",
        clearanceType: "import",
        dutyTreatment: "duty_payable",
        customsStatus: "cleared"
      }
    ]
  },

  // 14. China -> UAE by Sea (Home Furniture & Interior Fixtures)
  {
    customerName: "Gulf Luxury Living Furniture LLC",
    goodsName: "Solid Teak & Modular Living Room Furniture",
    goodsQuantity: 3,
    goodsUnit: "Container (40ft HQ)",
    goodsBagsCartons: 540,
    goodsGrossWeight: 38000,
    goodsNetWeight: 36500,
    shipmentType: "FCL",
    transportMode: "by_sea",
    movementType: "import",
    loadingCountryId: C.CHN.id,
    loadingCountryName: C.CHN.name,
    receivingCountryId: C.UAE.id,
    receivingCountryName: C.UAE.name,
    countryId: C.UAE.id,
    countryBranchId: B.UAE,
    remarks: "Guangzhou Nansha Port to Jebel Ali Port, full container liner shipment",
    legs: [
      {
        legNo: 1,
        fromCountryId: C.CHN.id,
        fromCountryName: C.CHN.name,
        toCountryId: C.UAE.id,
        toCountryName: C.UAE.name,
        fromLocationText: "Guangzhou Nansha Port",
        toLocationText: "Dubai Jebel Ali Port Terminal 2",
        transportMode: "by_sea",
        vesselName: "COSCO Rotterdam",
        voyageNumber: "CR-992-W",
        containerNumber: "COSU-9281048 / COSU-9281049 / COSU-9281050",
        clearanceType: "import",
        dutyTreatment: "duty_payable",
        customsStatus: "cleared"
      }
    ]
  },

  // 15. Afghanistan -> Iran (Fresh Watermelons & Grapes)
  {
    customerName: "Khorasan Fresh Agro Importers",
    goodsName: "Herat Sweet Watermelons & Kishmishi Grapes",
    goodsQuantity: 28000,
    goodsUnit: "KG",
    goodsBagsCartons: 1400,
    goodsGrossWeight: 28500,
    goodsNetWeight: 28000,
    shipmentType: "Reefer Truck",
    transportMode: "by_road",
    movementType: "export",
    loadingCountryId: C.AFG.id,
    loadingCountryName: C.AFG.name,
    receivingCountryId: C.IRAN.id,
    receivingCountryName: C.IRAN.name,
    countryId: C.AFG.id,
    countryBranchId: B.AFG,
    remarks: "Refrigerated cross-border produce via Dogharoun customs into Mashhad wholesale market",
    legs: [
      {
        legNo: 1,
        fromCountryId: C.AFG.id,
        fromCountryName: C.AFG.name,
        toCountryId: C.IRAN.id,
        toCountryName: C.IRAN.name,
        fromLocationText: "Herat Injeel Agricultural Orchards",
        toLocationText: "Dogharoun / Taybad Customs Iran",
        transportMode: "by_road",
        truckNumber: "AFG-90-2810",
        truckDriverName: "Nasir Ahmad Popal",
        clearanceType: "export",
        customsStatus: "cleared"
      },
      {
        legNo: 2,
        fromCountryId: C.IRAN.id,
        fromCountryName: C.IRAN.name,
        toCountryId: C.IRAN.id,
        toCountryName: C.IRAN.name,
        fromLocationText: "Dogharoun Customs Post",
        toLocationText: "Mashhad Central Sabzi & Fruit Mandi",
        transportMode: "by_road",
        truckNumber: "IR-12-8821",
        truckDriverName: "Farhad Ghasemi",
        clearanceType: "import",
        dutyTreatment: "duty_payable",
        customsStatus: "cleared"
      }
    ]
  },

  // 16. UAE -> Iran -> Afghanistan -> Tajikistan (Industrial Cleaning Chemicals)
  {
    customerName: "Dushanbe Industrial Chemical Works",
    goodsName: "Industrial Detergent Surfactants & Solvents (Drums)",
    goodsQuantity: 22000,
    goodsUnit: "KG",
    goodsBagsCartons: 110,
    goodsGrossWeight: 23200,
    goodsNetWeight: 22000,
    shipmentType: "FCL",
    transportMode: "by_sea",
    movementType: "transit",
    loadingCountryId: C.UAE.id,
    loadingCountryName: C.UAE.name,
    receivingCountryId: C.TJK.id,
    receivingCountryName: C.TJK.name,
    countryId: C.UAE.id,
    countryBranchId: B.UAE,
    remarks: "Jebel Ali to Dushanbe via Bandar Abbas, Islam Qala and Sher Khan Bandar",
    legs: [
      {
        legNo: 1,
        fromCountryId: C.UAE.id,
        fromCountryName: C.UAE.name,
        toCountryId: C.IRAN.id,
        toCountryName: C.IRAN.name,
        fromLocationText: "Dubai Jebel Ali Port",
        toLocationText: "Bandar Abbas Port",
        transportMode: "by_sea",
        vesselName: "MSC Alessia",
        containerNumber: "MSCU-1092837",
        clearanceType: "export",
        customsStatus: "cleared"
      },
      {
        legNo: 2,
        fromCountryId: C.IRAN.id,
        fromCountryName: C.IRAN.name,
        toCountryId: C.AFG.id,
        toCountryName: C.AFG.name,
        fromLocationText: "Bandar Abbas Port",
        toLocationText: "Islam Qala Border",
        transportMode: "by_road",
        truckNumber: "IR-66-8291",
        clearanceType: "transit",
        customsStatus: "cleared"
      },
      {
        legNo: 3,
        fromCountryId: C.AFG.id,
        fromCountryName: C.AFG.name,
        toCountryId: C.TJK.id,
        toCountryName: C.TJK.name,
        fromLocationText: "Sher Khan Bandar Port",
        toLocationText: "Dushanbe Industrial Depot",
        transportMode: "by_road",
        truckNumber: "TJ-77-2910",
        clearanceType: "import",
        dutyTreatment: "duty_payable",
        customsStatus: "cleared"
      }
    ]
  },

  // 17. Pakistan -> UAE by Air Cargo (Fresh Mangoes - Chaunsa & Sindhri)
  {
    customerName: "Dubai Fresh Express Produce LLC",
    goodsName: "Premium Sindhri & Chaunsa Mangoes (Cold Chain)",
    goodsQuantity: 8500,
    goodsUnit: "KG",
    goodsBagsCartons: 1700,
    goodsGrossWeight: 9200,
    goodsNetWeight: 8500,
    shipmentType: "Air Cargo",
    transportMode: "by_air",
    movementType: "export",
    loadingCountryId: C.PAK.id,
    loadingCountryName: C.PAK.name,
    receivingCountryId: C.UAE.id,
    receivingCountryName: C.UAE.name,
    countryId: C.PAK.id,
    countryBranchId: B.PAK,
    remarks: "Air-freighted from Multan International Airport to Dubai Al Maktoum Airport",
    legs: [
      {
        legNo: 1,
        fromCountryId: C.PAK.id,
        fromCountryName: C.PAK.name,
        toCountryId: C.UAE.id,
        toCountryName: C.UAE.name,
        fromLocationText: "Multan International Airport Cargo (MUX)",
        toLocationText: "Dubai Al Maktoum International Airport (DWC)",
        transportMode: "by_air",
        airlineName: "Emirates SkyCargo",
        flightNumber: "EK-9941",
        airWaybillNumber: "176-88291039",
        clearanceType: "export",
        dutyTreatment: "no_duty_exempt",
        customsStatus: "cleared"
      }
    ]
  },

  // 18. China -> Tajikistan -> Afghanistan (Medical Disposables & Lab Diagnostic Kits)
  {
    customerName: "Kabul National Health Supplies",
    goodsName: "Sterile Medical Disposables & Rapid Diagnostic Kits",
    goodsQuantity: 12500,
    goodsUnit: "KG",
    goodsBagsCartons: 850,
    goodsGrossWeight: 13100,
    goodsNetWeight: 12500,
    shipmentType: "FCL",
    transportMode: "by_road",
    movementType: "import",
    loadingCountryId: C.CHN.id,
    loadingCountryName: C.CHN.name,
    receivingCountryId: C.AFG.id,
    receivingCountryName: C.AFG.name,
    countryId: C.AFG.id,
    countryBranchId: B.AFG,
    remarks: "Urumqi logistics hub through Karasu Pass to Sher Khan Bandar into Kabul",
    legs: [
      {
        legNo: 1,
        fromCountryId: C.CHN.id,
        fromCountryName: C.CHN.name,
        toCountryId: C.TJK.id,
        toCountryName: C.TJK.name,
        fromLocationText: "Karasu Port China",
        toLocationText: "Murghab Logistics Terminal Tajikistan",
        transportMode: "by_road",
        truckNumber: "XIN-7719-CN",
        clearanceType: "export",
        customsStatus: "cleared"
      },
      {
        legNo: 2,
        fromCountryId: C.TJK.id,
        fromCountryName: C.TJK.name,
        toCountryId: C.AFG.id,
        toCountryName: C.AFG.name,
        fromLocationText: "Nizhny Panj Tajikistan",
        toLocationText: "Kabul Health Central Warehouse",
        transportMode: "by_road",
        truckNumber: "AFG-88-2910",
        truckDriverName: "Dr. Waheedullah Logistics",
        clearanceType: "import",
        dutyTreatment: "duty_payable",
        customsStatus: "cleared"
      }
    ]
  },

  // 19. UAE -> Pakistan -> Afghanistan (Solar Tier-1 Panels & Inverters)
  {
    customerName: "Helmand Green Energy Projects",
    goodsName: "550W Mono PERC Solar Panels (6 Pallets)",
    goodsQuantity: 28000,
    goodsUnit: "KG",
    goodsBagsCartons: 480,
    goodsGrossWeight: 29000,
    goodsNetWeight: 28000,
    shipmentType: "FCL",
    transportMode: "by_sea",
    movementType: "transit",
    loadingCountryId: C.UAE.id,
    loadingCountryName: C.UAE.name,
    receivingCountryId: C.AFG.id,
    receivingCountryName: C.AFG.name,
    countryId: C.UAE.id,
    countryBranchId: B.UAE,
    remarks: "Dubai to Helmand Lashkar Gah via Karachi KICT and Chaman transit corridor",
    legs: [
      {
        legNo: 1,
        fromCountryId: C.UAE.id,
        fromCountryName: C.UAE.name,
        toCountryId: C.PAK.id,
        toCountryName: C.PAK.name,
        fromLocationText: "Dubai Jebel Ali Port",
        toLocationText: "Karachi KICT Terminal",
        transportMode: "by_sea",
        vesselName: "Safeen Pride",
        containerNumber: "SAFU-8192039",
        clearanceType: "export",
        customsStatus: "cleared"
      },
      {
        legNo: 2,
        fromCountryId: C.PAK.id,
        fromCountryName: C.PAK.name,
        toCountryId: C.PAK.id,
        toCountryName: C.PAK.name,
        fromLocationText: "Karachi KICT Terminal",
        toLocationText: "Chaman Border Customs Station",
        transportMode: "by_road",
        truckNumber: "KHI-9920-TK",
        truckDriverName: "Haji Gulzar",
        clearanceType: "transit",
        dutyTreatment: "transit_bonded",
        customsStatus: "cleared"
      },
      {
        legNo: 3,
        fromCountryId: C.PAK.id,
        fromCountryName: C.PAK.name,
        toCountryId: C.AFG.id,
        toCountryName: C.AFG.name,
        fromLocationText: "Chaman Customs Station",
        toLocationText: "Helmand Lashkar Gah Solar Yard",
        transportMode: "by_road",
        truckNumber: "AFG-22-9018",
        truckDriverName: "Mullah Akhtar",
        clearanceType: "import",
        dutyTreatment: "duty_payable",
        customsStatus: "cleared"
      }
    ]
  },

  // 20. Afghanistan -> Uzbekistan -> India (Raw Lapis Lazuli & Gemstones)
  {
    customerName: "Jaipur Jewels & Heritage Stones",
    goodsName: "Rough Natural Badakhshan Lapis Lazuli Rocks",
    goodsQuantity: 14000,
    goodsUnit: "KG",
    goodsBagsCartons: 280,
    goodsGrossWeight: 14400,
    goodsNetWeight: 14000,
    shipmentType: "FCL",
    transportMode: "by_road",
    movementType: "export",
    loadingCountryId: C.AFG.id,
    loadingCountryName: C.AFG.name,
    receivingCountryId: C.IND.id,
    receivingCountryName: C.IND.name,
    countryId: C.AFG.id,
    countryBranchId: B.AFG,
    remarks: "Badakhshan mines through Hairatan bridge, air-lifted from Tashkent to New Delhi",
    legs: [
      {
        legNo: 1,
        fromCountryId: C.AFG.id,
        fromCountryName: C.AFG.name,
        toCountryId: C.UZB.id,
        toCountryName: C.UZB.name,
        fromLocationText: "Fayzabad Badakhshan Logistics Yard",
        toLocationText: "Hairatan / Termez Customs Port",
        transportMode: "by_road",
        truckNumber: "AFG-09-4821",
        truckDriverName: "Zalmay Khan",
        clearanceType: "export",
        customsStatus: "cleared"
      },
      {
        legNo: 2,
        fromCountryId: C.UZB.id,
        fromCountryName: C.UZB.name,
        toCountryId: C.IND.id,
        toCountryName: C.IND.name,
        fromLocationText: "Tashkent International Airport Cargo (TAS)",
        toLocationText: "New Delhi Air Cargo Hub (DEL)",
        transportMode: "by_air",
        airlineName: "Uzbekistan Airways",
        flightNumber: "HY-423",
        airWaybillNumber: "250-91823741",
        clearanceType: "import",
        dutyTreatment: "duty_payable",
        customsStatus: "cleared"
      }
    ]
  }
];

async function insertOrderFast(order) {
  return await sql.begin(async (tx) => {
    const now = new Date().toISOString();

    // 1. Get next serial
    const [seqRow] = await tx`select public.next_entity_serial('global', 'GLOBAL', 'clearing_customer_orders', 'CL-ORD') as serial`;
    const orderNo = seqRow?.serial || `CL-ORD-000000${Math.floor(Math.random() * 900) + 100}`;

    // 2. 4-level serials
    let superAdminSerial = null;
    let countrySerial = null;
    let branchSerial = null;
    let entrySerial = null;
    try {
      const [serialRow] = await tx`
        select allocate_4level_serials(
          'clearing_customer_orders',
          ${order.countryId || "GLOBAL"},
          ${order.countryBranchId || "GLOBAL"},
          'CCO'
        ) as res
      `;
      if (serialRow?.res) {
        superAdminSerial = serialRow.res.super_admin_serial || null;
        countrySerial = serialRow.res.country_serial || null;
        branchSerial = serialRow.res.branch_serial || null;
        entrySerial = serialRow.res.entry_serial || null;
      }
    } catch (e) {
      // non-fatal
    }

    // 3. Insert order
    const [orderRow] = await tx`
      insert into public.clearing_customer_orders (
        order_no, customer_name, goods_name, shipment_type, transport_mode, movement_type,
        loading_country_id, loading_country_name, receiving_country_id, receiving_country_name,
        loading_source_name, destination_port_name,
        goods_quantity, goods_unit, goods_bags_cartons, goods_gross_weight, goods_net_weight,
        country_id, country_branch_id,
        super_admin_serial, country_serial, branch_serial, entry_serial,
        remarks, status, current_stage,
        created_at, updated_at
      ) values (
        ${orderNo}, ${order.customerName}, ${order.goodsName}, ${order.shipmentType || 'FCL'}, ${order.transportMode || 'by_road'}, ${order.movementType || 'transit'},
        ${order.loadingCountryId}::uuid, ${order.loadingCountryName}, ${order.receivingCountryId}::uuid, ${order.receivingCountryName},
        ${order.loadingSourceName || null}, ${order.destinationPortName || null},
        ${order.goodsQuantity || null}, ${order.goodsUnit || null}, ${order.goodsBagsCartons || null}, ${order.goodsGrossWeight || null}, ${order.goodsNetWeight || null},
        ${order.countryId}::uuid, ${order.countryBranchId}::uuid,
        ${superAdminSerial}, ${countrySerial}, ${branchSerial}, ${entrySerial},
        ${order.remarks || null}, 'pending', 'booking',
        ${now}, ${now}
      )
      returning *
    `;

    // 4. Insert legs
    for (const leg of order.legs) {
      await tx`
        insert into public.clearing_customer_order_legs (
          order_id, leg_no,
          from_country_id, from_country_name, to_country_id, to_country_name,
          from_location_text, to_location_text,
          transport_mode,
          vessel_name, voyage_number, container_number, bl_number,
          truck_number, truck_driver_name,
          airline_name, flight_number, airway_bill_no,
          clearance_type, duty_treatment, duty_amount, duty_currency, customs_status,
          remarks, status,
          created_at, updated_at
        ) values (
          ${orderRow.id}::uuid, ${leg.legNo},
          ${leg.fromCountryId}::uuid, ${leg.fromCountryName}, ${leg.toCountryId}::uuid, ${leg.toCountryName},
          ${leg.fromLocationText || null}, ${leg.toLocationText || null},
          ${leg.transportMode || null},
          ${leg.vesselName || null}, ${leg.voyageNumber || null}, ${leg.containerNumber || null}, ${leg.blNumber || null},
          ${leg.truckNumber || null}, ${leg.truckDriverName || null},
          ${leg.airlineName || null}, ${leg.flightNumber || null}, ${leg.airWaybillNumber || null},
          ${leg.clearanceType || null}, ${leg.dutyTreatment || null}, ${leg.dutyAmount || null}, ${leg.dutyCurrency || null}, ${leg.customsStatus || 'cleared'},
          ${leg.remarks || null}, 'in_transit',
          ${now}, ${now}
        )
      `;
    }

    return orderRow;
  });
}

async function main() {
  console.log(`Inserting ${remainingOrders.length} remaining orders directly into test database...`);
  let idx = 2; // Orders 1 and 2 are already in DB!
  for (const o of remainingOrders) {
    idx++;
    console.log(`[${idx}/21] Inserting ${o.customerName} - ${o.goodsName}...`);
    const res = await insertOrderFast(o);
    console.log(`   -> Created Order ID: ${res.id}, Order No: ${res.order_no}`);
  }
  console.log("\nALL REMAINING ORDERS SUCCESSFULLY CREATED!");
  await sql.end();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
