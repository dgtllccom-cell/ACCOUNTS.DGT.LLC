import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoadingReceivingCell, extractLoadingReceivingDetails } from "@/features/journal/components/loading-receiving-cell";

describe("LoadingReceivingCell and extractLoadingReceivingDetails", () => {
  it("extracts Sea transport loading & receiving details correctly", () => {
    const row = {
      id: "po-sea-1",
      purchase_order_no: "AE-001-0001",
      form_data: {
        form: {
          loadingCountry: "United Arab Emirates",
          loadingPort: "Jebel Ali Port (Dubai)",
          loadingDate: "2026-11-04",
          receivedCountry: "United Arab Emirates",
          receivedPort: "Khalifa Port (Abu Dhabi)",
          receivedDate: "2026-11-08",
        },
      },
    };

    const details = extractLoadingReceivingDetails(row);
    expect(details).toHaveLength(1);
    expect(details[0]).toEqual({
      loadingCountry: "United Arab Emirates",
      loadingPort: "Jebel Ali Port (Dubai)",
      loadingDate: "2026-11-04",
      receivingCountry: "United Arab Emirates",
      receivingPort: "Khalifa Port (Abu Dhabi)",
      receivingDate: "2026-11-08",
    });
  });

  it("extracts Road transport with borders correctly", () => {
    const row = {
      id: "po-road-1",
      purchase_order_no: "AE-001-0002",
      form_data: {
        form: {
          loadingCountry: "Afghanistan",
          loadingBorder: "Dand-e-Patan Border (Paktia - PK)",
          loadingDate: "2026-11-14",
          destinationCountry: "Pakistan",
          receivingBorder: "Torkham Border",
          arrivalDate: "2026-11-16",
        },
      },
    };

    const details = extractLoadingReceivingDetails(row);
    expect(details).toHaveLength(1);
    expect(details[0]).toEqual({
      loadingCountry: "Afghanistan",
      loadingPort: "Dand-e-Patan Border (Paktia - PK)",
      loadingDate: "2026-11-14",
      receivingCountry: "Pakistan",
      receivingPort: "Torkham Border",
      receivingDate: "2026-11-16",
    });
  });

  it("extracts Train / Rail transport correctly", () => {
    const row = {
      id: "po-rail-1",
      purchase_order_no: "AE-001-0003",
      form_data: {
        form: {
          loadingCountry: "Turkmenistan",
          loadingStation: "Aqina Dry Port & Rail (Faryab - TM)",
          loadingDate: "2026-11-10",
          receivedCountry: "Afghanistan",
          receivedStation: "Hairatan Dry Port & Rail",
          receivedDate: "2026-11-12",
        },
      },
    };

    const details = extractLoadingReceivingDetails(row);
    expect(details).toHaveLength(1);
    expect(details[0]).toEqual({
      loadingCountry: "Turkmenistan",
      loadingPort: "Aqina Dry Port & Rail (Faryab - TM)",
      loadingDate: "2026-11-10",
      receivingCountry: "Afghanistan",
      receivingPort: "Hairatan Dry Port & Rail",
      receivingDate: "2026-11-12",
    });
  });

  it("extracts Local Purchase details correctly", () => {
    const row = {
      id: "lp-1",
      is_local_purchase: true,
      origin_country_name: "United Arab Emirates",
      truck_no: "7721",
      driver_name: "Ahmad Shah",
      loading_date: "2026-11-05",
      country_name: "United Arab Emirates",
      warehouse_name: "Central Logistics Warehouse",
      warehouse_plot_no: "Plot 42",
      warehouse_transferred_at: "2026-11-06T10:00:00Z",
    };

    const details = extractLoadingReceivingDetails(row);
    expect(details).toHaveLength(1);
    expect(details[0]).toEqual({
      loadingCountry: "United Arab Emirates",
      loadingPort: "Truck 7721",
      loadingDate: "2026-11-05",
      receivingCountry: "United Arab Emirates",
      receivingPort: "Central Logistics Warehouse (Plot 42)",
      receivingDate: "2026-11-06",
    });
  });

  it("falls back to dashes (—) when fields are missing or not saved", () => {
    const row = {
      id: "po-empty",
      purchase_order_no: "AE-001-0099",
      form_data: { form: {} },
    };

    const details = extractLoadingReceivingDetails(row);
    expect(details).toHaveLength(1);
    expect(details[0]).toEqual({
      loadingCountry: "—",
      loadingPort: "—",
      loadingDate: "—",
      receivingCountry: "—",
      receivingPort: "—",
      receivingDate: "—",
    });
  });

  it("handles multiple loading records without duplicating the purchase bill", () => {
    const row = {
      id: "po-multi",
      purchase_order_no: "AE-001-0007",
      form_data: { form: {} },
    };

    const loadingRecords = [
      {
        id: "rec-1",
        purchase_order_id: "po-multi",
        loading_record_no: "PLR-001-00000001",
        container_number: "C-101",
        loaded_at: "2026-11-01",
        received_at: "2026-11-05",
        report_payload: {
          loadingCountry: "China",
          loadingPort: "Tianjin Port",
          receivingCountry: "United Arab Emirates",
          receivingPort: "Jebel Ali Port",
        },
      },
      {
        id: "rec-2",
        purchase_order_id: "po-multi",
        loading_record_no: "PLR-001-00000002",
        container_number: "C-102",
        loaded_at: "2026-11-03",
        received_at: "2026-11-07",
        report_payload: {
          loadingCountry: "China",
          loadingPort: "Ningbo Port",
          receivingCountry: "United Arab Emirates",
          receivingPort: "Khalifa Port",
        },
      },
    ];

    const details = extractLoadingReceivingDetails(row, loadingRecords);
    expect(details).toHaveLength(2);
    expect(details[0].loadingPort).toBe("Tianjin Port");
    expect(details[0].loadingRef).toBe("PLR-001-00000001");
    expect(details[1].loadingPort).toBe("Ningbo Port");
    expect(details[1].loadingRef).toBe("PLR-001-00000002");
  });

  it("renders the 2-column layout and NO colored boxes for Loaded, Received, Damage, Shortage, Outstanding", () => {
    const row = {
      id: "po-test-render",
      form_data: {
        form: {
          loadingCountry: "United Arab Emirates",
          loadingPort: "Jebel Ali Port",
          loadingDate: "2026-11-04",
          receivingCountry: "United Arab Emirates",
          receivingPort: "Jebel Ali Port",
          receivedDate: "2026-11-04",
        },
      },
    };

    render(<LoadingReceivingCell row={row} lang="en" />);

    // Verify 6 fields are rendered
    expect(screen.getByText("Loading Details")).toBeTruthy();
    expect(screen.getByText("Receiving Details")).toBeTruthy();
    expect(screen.getAllByText("United Arab Emirates")).toHaveLength(2);
    expect(screen.getAllByText("Jebel Ali Port")).toHaveLength(2);
    expect(screen.getAllByText("2026-11-04")).toHaveLength(2);

    // Verify old colored boxes are completely absent
    expect(screen.queryByText("Loaded")).toBeNull();
    expect(screen.queryByText("Received")).toBeNull();
    expect(screen.queryByText("Damage")).toBeNull();
    expect(screen.queryByText("Shortage")).toBeNull();
    expect(screen.queryByText("Outstanding")).toBeNull();
  });

  it("supports all 5 ERP languages (English, Urdu, Arabic, Persian, Pashto)", () => {
    const row = {
      id: "po-lang-test",
      form_data: {
        form: {
          loadingCountry: "Afghanistan",
          loadingPort: "Kabul",
          loadingDate: "2026-11-01",
          receivingCountry: "Pakistan",
          receivingPort: "Peshawar",
          receivedDate: "2026-11-02",
        },
      },
    };

    // Arabic
    const { rerender } = render(<LoadingReceivingCell row={row} lang="ar" />);
    expect(screen.getByText("تفاصيل التحميل")).toBeTruthy();
    expect(screen.getByText("تفاصيل الاستلام")).toBeTruthy();

    // Urdu
    rerender(<LoadingReceivingCell row={row} lang="ur" />);
    expect(screen.getByText("لوڈنگ کی تفصیلات")).toBeTruthy();
    expect(screen.getByText("وصولی کی تفصیلات")).toBeTruthy();

    // Persian
    rerender(<LoadingReceivingCell row={row} lang="fa" />);
    expect(screen.getByText("جزئیات بارگیری")).toBeTruthy();
    expect(screen.getByText("جزئیات دریافت")).toBeTruthy();

    // Pashto
    rerender(<LoadingReceivingCell row={row} lang="ps" />);
    expect(screen.getByText("د بارولو جزئیات")).toBeTruthy();
    expect(screen.getByText("د ترلاسه کولو جزئیات")).toBeTruthy();
  });
});

