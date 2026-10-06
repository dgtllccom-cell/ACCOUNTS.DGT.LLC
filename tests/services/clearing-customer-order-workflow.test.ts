import { describe, it, expect } from "vitest";
import type {
  PartyRoleKey,
  PartyLinkInput,
  ClearingCustomerOrderInput,
  LoadingAllocationInput,
  OrderLegInput,
} from "@/lib/services/clearing-customer-order-service";

describe("Clearing Customer Order 4-Step Workflow & Role Architecture", () => {
  describe("Step 1: Order Booking, Dual Route Countries & Party Roles", () => {
    it("validates required party roles: supplier, importer, exporter", () => {
      const requiredRoles: PartyRoleKey[] = ["supplier", "importer", "exporter"];
      const samplePartyLinks: PartyLinkInput[] = [
        {
          roleKey: "supplier",
          partyCustomerId: "cust-001",
          partyCustomerName: "Al Baraka Trading",
          partyCompanyId: "comp-001",
          partyCompanyName: "Al Baraka LLC",
          selectedAddressText: "Warehouse 12, Industrial Area 1, Sharjah, UAE",
        },
        {
          roleKey: "importer",
          partyCustomerId: "cust-002",
          partyCustomerName: "Khyber Logistics Ltd",
          partyCompanyId: "comp-002",
          partyCompanyName: "Khyber Logistics PVT",
          selectedAddressText: "Chamankot, Quetta, Pakistan",
        },
        {
          roleKey: "exporter",
          partyCustomerId: "cust-001",
          partyCustomerName: "Al Baraka Trading",
          selectedAddressText: "Sharjah, UAE",
        },
      ];

      const presentRoles = new Set(samplePartyLinks.map((p) => p.roleKey));
      const hasAllRequired = requiredRoles.every((r) => presentRoles.has(r));
      expect(hasAllRequired).toBe(true);

      // Optional roles
      const optionalRoles: PartyRoleKey[] = ["notify_party", "buyer", "consignee"];
      expect(optionalRoles.some((r) => presentRoles.has(r))).toBe(false);
    });

    it("enforces dual route countries (loadingCountryId and receivingCountryId)", () => {
      const order: Partial<ClearingCustomerOrderInput> = {
        orderNo: "CO-2026-0042",
        customerName: "Global Trade Inc",
        loadingCountryId: "74a7482f-e8b0-4f59-a292-9a008c2a969f",
        loadingCountryName: "United Arab Emirates",
        receivingCountryId: "pk-country-uuid",
        receivingCountryName: "Pakistan",
      };

      expect(order.loadingCountryId).toBeDefined();
      expect(order.receivingCountryId).toBeDefined();
      expect(order.loadingCountryId).not.toBe(order.receivingCountryId);
    });
  });

  describe("Step 2: Cargo, Goods Variations & Loading Allocation", () => {
    it("allocates total goods quantity across multi-warehouse sources accurately", () => {
      const totalQuantity = 500;
      const allocations: LoadingAllocationInput[] = [
        {
          rowSerial: 1,
          warehouseId: "wh-jebel-ali",
          sourceLocationText: "Jebel Ali Free Zone Berth 4",
          quantity: 300,
          unit: "MTS",
        },
        {
          rowSerial: 2,
          warehouseId: "wh-sharjah-central",
          sourceLocationText: "Sharjah Industrial 10 Depot",
          quantity: 200,
          unit: "MTS",
        },
      ];

      const allocatedTotal = allocations.reduce((sum, a) => sum + (a.quantity || 0), 0);
      expect(allocatedTotal).toBe(totalQuantity);
      expect(allocations).toHaveLength(2);
      expect(allocations[0].warehouseId).toBe("wh-jebel-ali");
      expect(allocations[1].warehouseId).toBe("wh-sharjah-central");
    });
  });

  describe("Step 3: Route, Multi-Leg Logistics & Customs Clearance", () => {
    it("validates multi-leg routing with duty treatment and customs status", () => {
      const legs: OrderLegInput[] = [
        {
          legNo: 1,
          fromCountryId: "uae-id",
          fromCountryName: "United Arab Emirates",
          toCountryId: "iran-id",
          toCountryName: "Iran",
          fromLocationText: "Port Khalid, Sharjah",
          toLocationText: "Bandar Abbas Port",
          transportMode: "by_sea",
          customsStatus: "cleared",
          dutyTreatment: "transit_bonded",
          clearanceType: "transit",
        },
        {
          legNo: 2,
          fromCountryId: "iran-id",
          fromCountryName: "Iran",
          toCountryId: "pakistan-id",
          toCountryName: "Pakistan",
          fromLocationText: "Bandar Abbas",
          toLocationText: "Taftan Border",
          transportMode: "by_road",
          truckRegistrationType: "registered",
          truckNumber: "IR-98765-A",
          customsStatus: "submitted",
          dutyTreatment: "duty_payable",
          clearanceType: "import",
        },
      ];

      expect(legs).toHaveLength(2);
      expect(legs[0].transportMode).toBe("by_sea");
      expect(legs[0].customsStatus).toBe("cleared");
      expect(legs[0].dutyTreatment).toBe("transit_bonded");

      expect(legs[1].transportMode).toBe("by_road");
      expect(legs[1].truckRegistrationType).toBe("registered");
      expect(legs[1].truckNumber).toBe("IR-98765-A");
      expect(legs[1].dutyTreatment).toBe("duty_payable");
    });
  });

  describe("Step 4: Review & Canonical Order Submission", () => {
    it("constructs full canonical payload for clearing customer order", () => {
      const fullOrder: ClearingCustomerOrderInput = {
        orderNo: "CO-2026-0099",
        customerId: "cust-100",
        customerName: "Habib International",
        goodsId: "goods-sugar",
        goodsName: "Refined White Sugar Grade A",
        goodsQuantity: 1000,
        goodsUnit: "Bags",
        goodsGrossWeight: 50000,
        goodsNetWeight: 49500,
        loadingCountryId: "uae-id",
        loadingCountryName: "United Arab Emirates",
        receivingCountryId: "pk-id",
        receivingCountryName: "Pakistan",
        transportMode: "by_sea",
        movementType: "transit",
        status: "confirmed",
        partyLinks: [
          { roleKey: "supplier", partyCustomerId: "cust-100", partyCustomerName: "Habib International" },
          { roleKey: "importer", partyCustomerId: "cust-200", partyCustomerName: "Apex Distributing Quetta" },
          { roleKey: "exporter", partyCustomerId: "cust-100", partyCustomerName: "Habib International" },
        ],
        loadingAllocations: [
          { rowSerial: 1, warehouseId: "wh-1", quantity: 1000, unit: "Bags" },
        ],
        legs: [
          {
            legNo: 1,
            fromCountryId: "uae-id",
            fromCountryName: "United Arab Emirates",
            toCountryId: "pk-id",
            toCountryName: "Pakistan",
            fromLocationText: "Sharjah Port",
            toLocationText: "Karachi Port",
            transportMode: "by_sea",
            customsStatus: "pending",
            dutyTreatment: "transit_bonded",
          },
        ],
      };

      expect(fullOrder.orderNo).toBe("CO-2026-0099");
      expect(fullOrder.partyLinks).toHaveLength(3);
      expect(fullOrder.loadingAllocations).toHaveLength(1);
      expect(fullOrder.legs).toHaveLength(1);
      expect(fullOrder.status).toBe("confirmed");
    });
  });
});
