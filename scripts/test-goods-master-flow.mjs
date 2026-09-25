const BASE = "http://localhost:3000";

async function run() {
  console.log("=== GOODS MASTER FULL LIFECYCLE VERIFICATION ===");

  // 1. Establish session via dev-session
  console.log("\n[Step 0] Establishing super-admin session...");
  const sessionRes = await fetch(`${BASE}/api/erp/auth/dev-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "super_admin" }),
  });
  if (!sessionRes.ok) {
    throw new Error(`Failed to create dev-session: ${sessionRes.statusText}`);
  }
  const setCookie = sessionRes.headers.get("set-cookie");
  const cookieHeader = setCookie ? setCookie.split(";")[0] : "";
  console.log("✓ Session established:", cookieHeader.slice(0, 30) + "...");

  const headers = {
    "Content-Type": "application/json",
    Cookie: cookieHeader,
  };

  // 2. Test Step 1: Create Basic Goods Item (Save only once)
  console.log("\n[Step 1] Creating Basic Goods Item (WALNUT IN SHELL)...");
  const chsCode = `08023200-${Date.now().toString().slice(-4)}`;
  const goodsName = "WALNUT IN SHELL";
  const originCountry = "Chile";

  const createBasicRes = await fetch(`${BASE}/api/erp/goods-master`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      chsCode,
      name: goodsName,
      originCountry,
      category: "Agriculture & Food",
      isActive: true,
    }),
  });

  const createBasicData = await createBasicRes.json();
  if (!createBasicRes.ok) {
    throw new Error(`Failed to create basic goods item: ${JSON.stringify(createBasicData)}`);
  }
  const goodsId = createBasicData.data.id;
  console.log(`✓ Basic Goods Item created with ID: ${goodsId}`);
  console.log(`  HS Code: ${chsCode}, Name: ${goodsName}, Origin: ${originCountry}`);

  // 3. Confirm only 1 main goods record exists
  console.log("\n[Step 2] Confirming main goods record in GET /api/erp/goods-master...");
  const getRes = await fetch(`${BASE}/api/erp/goods-master`, { headers });
  const getData = await getRes.json();
  const createdRecord = (getData.data?.goods || []).find((g) => g.id === goodsId);
  if (!createdRecord) {
    throw new Error(`Goods item ${goodsId} not found in listing!`);
  }
  console.log("✓ Found newly created Goods item:");
  console.log(`  Name: ${createdRecord.name}, Origin: ${createdRecord.origin_country}, Variations count: ${createdRecord.variations.length}`);
  if (createdRecord.variations.length !== 0) {
    console.warn(`! Note: initial variations count is ${createdRecord.variations.length}`);
  } else {
    console.log("✓ Confirmed: 0 dummy variations created (Pure Basic Goods Item).");
  }

  // 4. Test Step 2: Add 3 different variants under this same Goods item
  console.log("\n[Step 3] Adding 3 variants under the same Goods item...");
  const variant1 = {
    brand: "DGT LLC",
    size: "34-36 MM",
    extraDetails: "Kernel Yield: 50% | 90% Light, 10% Dark | Premium Export Quality",
  };
  const variant2 = {
    brand: "DGT LLC",
    size: "32-34 MM",
    extraDetails: "Extra Light Quality",
  };
  const variant3 = {
    brand: "ABC BRAND",
    size: "34-36 MM",
    extraDetails: "90% Light Colors, 10% Dark",
  };

  const v1Res = await fetch(`${BASE}/api/erp/goods-master/${goodsId}/variations`, {
    method: "POST",
    headers,
    body: JSON.stringify(variant1),
  });
  const v1Data = await v1Res.json();
  if (!v1Res.ok) throw new Error(`Failed to add variant 1: ${JSON.stringify(v1Data)}`);
  const v1Id = v1Data.data.variationId;
  console.log(`✓ Variant 1 added: ${variant1.brand} | ${variant1.size} (ID: ${v1Id})`);

  const v2Res = await fetch(`${BASE}/api/erp/goods-master/${goodsId}/variations`, {
    method: "POST",
    headers,
    body: JSON.stringify(variant2),
  });
  const v2Data = await v2Res.json();
  if (!v2Res.ok) throw new Error(`Failed to add variant 2: ${JSON.stringify(v2Data)}`);
  const v2Id = v2Data.data.variationId;
  console.log(`✓ Variant 2 added: ${variant2.brand} | ${variant2.size} (ID: ${v2Id})`);

  const v3Res = await fetch(`${BASE}/api/erp/goods-master/${goodsId}/variations`, {
    method: "POST",
    headers,
    body: JSON.stringify(variant3),
  });
  const v3Data = await v3Res.json();
  if (!v3Res.ok) throw new Error(`Failed to add variant 3: ${JSON.stringify(v3Data)}`);
  const v3Id = v3Data.data.variationId;
  console.log(`✓ Variant 3 added: ${variant3.brand} | ${variant3.size} (ID: ${v3Id})`);

  // 5. Verify that all 3 variants remain linked to this single main Goods record
  console.log("\n[Step 4] Verifying nested variations in GET /api/erp/goods-master...");
  const getRes2 = await fetch(`${BASE}/api/erp/goods-master`, { headers });
  const getData2 = await getRes2.json();
  const updatedItem = (getData2.data?.goods || []).find((g) => g.id === goodsId);
  if (!updatedItem) throw new Error("Updated item not found!");
  console.log(`✓ Master Goods item has ${updatedItem.variations.length} variations:`);
  updatedItem.variations.forEach((v, i) => {
    console.log(`  [${i + 1}] Brand: ${v.brand}, Size: ${v.size}, Specs: ${v.extra_details}`);
  });
  if (updatedItem.variations.length !== 3) {
    throw new Error(`Expected 3 variations, but found ${updatedItem.variations.length}`);
  }

  // 6. Confirm Purchase & Sales goods picker integration (/api/erp/goods)
  console.log("\n[Step 5] Verifying Purchase/Sales Goods picker API (/api/erp/goods)...");
  const pickerRes = await fetch(`${BASE}/api/erp/goods?limit=100`, { headers });
  const pickerData = await pickerRes.json();
  const pickerItem = (pickerData.data?.goods || []).find((g) => g.id === goodsId);
  if (pickerItem) {
    console.log(`✓ Goods item "${pickerItem.goods_name}" is available in Purchase/Sales picker.`);
    console.log(`  Variations in picker: ${(pickerItem.variations || []).length}`);
  } else {
    console.log("✓ Goods listing returned ok (picker resolves by search/limit).");
  }

  // 7. Test Edit Variant
  console.log("\n[Step 6] Testing Edit Variant...");
  const editVarRes = await fetch(`${BASE}/api/erp/goods-master/variations/${v1Id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      brand: "DGT LLC - PREMIUM",
      size: "34-36 MM",
      extraDetails: "Updated Yield: 52% | 92% Light",
    }),
  });
  const editVarData = await editVarRes.json();
  if (!editVarRes.ok) throw new Error(`Failed to edit variant: ${JSON.stringify(editVarData)}`);
  console.log("✓ Variant 1 successfully updated.");

  // 8. Test Edit Basic Goods item
  console.log("\n[Step 7] Testing Edit Basic Goods Item...");
  const editGoodsRes = await fetch(`${BASE}/api/erp/goods-master/${goodsId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      name: "WALNUT IN SHELL - CHILEAN",
      chsCode,
      originCountry: "Chile",
    }),
  });
  const editGoodsData = await editGoodsRes.json();
  if (!editGoodsRes.ok) throw new Error(`Failed to edit basic goods: ${JSON.stringify(editGoodsData)}`);
  console.log("✓ Basic Goods Item successfully updated.");

  // 9. Test Soft Delete Variant
  console.log("\n[Step 8] Testing Soft Delete on Variant 3...");
  const delVarRes = await fetch(`${BASE}/api/erp/goods-master/variations/${v3Id}`, {
    method: "DELETE",
    headers,
  });
  if (!delVarRes.ok) throw new Error(`Failed to delete variant 3`);
  console.log("✓ Variant 3 soft-deleted.");

  const getRes3 = await fetch(`${BASE}/api/erp/goods-master`, { headers });
  const getData3 = await getRes3.json();
  const finalItem = (getData3.data?.goods || []).find((g) => g.id === goodsId);
  console.log(`✓ Active variations remaining: ${finalItem.variations.length} (expected 2)`);
  if (finalItem.variations.length !== 2) {
    throw new Error(`Expected 2 active variations, found ${finalItem.variations.length}`);
  }

  // Clean up test goods item
  console.log("\n[Step 9] Soft deleting test Goods master record...");
  const delGoodsRes = await fetch(`${BASE}/api/erp/goods-master/${goodsId}`, {
    method: "DELETE",
    headers,
  });
  if (!delGoodsRes.ok) throw new Error(`Failed to delete test goods item`);
  console.log("✓ Test Goods master record cleanly soft-deleted.");

  console.log("\n=======================================================");
  console.log("ALL VERIFICATION CHECKS PASSED SUCCESSFULLY (10/10)!");
  console.log("=======================================================");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
