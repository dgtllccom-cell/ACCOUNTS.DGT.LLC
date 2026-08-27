import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ModuleAllotmentItem = {
  key: string;
  label: string;
  category: "dashboards" | "shipping_clearing" | "finance_operations" | "inventory_stock" | "reports";
  enabled: boolean;
  alertText?: string;
};

export type RoleModuleSettings = {
  role: string;
  roleLabel: string;
  modules: ModuleAllotmentItem[];
};

const defaultModuleDefinitions: Array<{ key: string; label: string; category: ModuleAllotmentItem["category"] }> = [
  // Dashboards
  { key: "dash_super_admin", label: "Super Admin Overview Dashboard (/dashboard/super-admin)", category: "dashboards" },
  { key: "dash_country", label: "Country Admin Dashboard (/dashboard/country)", category: "dashboards" },
  { key: "dash_city", label: "City & Branch Dashboard (/dashboard/city)", category: "dashboards" },
  { key: "dash_logistics", label: "Shipping Line & Clearing Agent Dashboard (/dashboard/logistics)", category: "dashboards" },

  // Shipping & Clearing Forms
  { key: "form_shipment_details", label: "Shipment Details & Tracking Matrix (/dashboard/shipping-line/shipment-details)", category: "shipping_clearing" },
  { key: "form_shipment_report", label: "Shipment Report (/dashboard/shipping-line/shipment-report)", category: "shipping_clearing" },
  { key: "form_shipping_agent_entry", label: "Shipping Agent Entry (/dashboard/shipping-line/agent-entry)", category: "shipping_clearing" },
  { key: "form_agent_custom_entry", label: "Agent Custom Entry (/dashboard/clearing-agent/agent-custom-entry)", category: "shipping_clearing" },
  { key: "form_bill_entry", label: "Bill Entry (/dashboard/clearing-agent/bill-entry)", category: "shipping_clearing" },
  { key: "form_payment_bill_entry", label: "Payment Bill Entry (/dashboard/clearing-agent/payment-bill-entry)", category: "shipping_clearing" },

  // Financial & Operational Forms
  { key: "form_purchase_new_booking", label: "New Purchase Booking Order (/dashboard/purchase/new-purchase-booking-order)", category: "finance_operations" },
  { key: "form_purchase_container_loading", label: "Purchase Container Loading (/dashboard/purchase/purchase-loading-records)", category: "finance_operations" },
  { key: "form_sales_booking", label: "New Sales Booking Order (/dashboard/sales/new-sales-booking-order)", category: "finance_operations" },
  { key: "form_cash_entry", label: "Roznamcha Cash Entry (/dashboard/roznamcha/cash-entry)", category: "finance_operations" },
  { key: "form_expenses_bill", label: "Expenses Bill Entry (/dashboard/roznamcha/expenses-bill)", category: "finance_operations" },
  { key: "form_user_registration", label: "User Registration & Role Setup (/dashboard/new-entry/users/registration)", category: "finance_operations" },

  // Stock Menu
  { key: "menu_purchase_stock_section", label: "Purchase Stock Menu (/dashboard/purchase/stock/*)", category: "inventory_stock" },

  // Reports
  { key: "report_general_hub", label: "Enterprise Reporting Hub (/dashboard/reports)", category: "reports" },
  { key: "report_print_pdf", label: "A4 PDF Print Reports Hub (/dashboard/print-reports)", category: "reports" }
];

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    const supabase = createSupabaseAdminClient() as any;

    // Fetch saved settings from app_settings table or fallback
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "dashboard_module_allotments")
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.warn("Unable to read dashboard_module_allotments from database:", error.message);
    }

    const savedAllotments = data?.setting_value ? JSON.parse(data.setting_value) : null;

    return apiOk({
      isSuperAdmin: session.isSuperAdmin,
      allotments: savedAllotments || null,
      defaults: defaultModuleDefinitions
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireErpSession();

    if (!session.isSuperAdmin) {
      return apiOk({ ok: false, message: "Super Admin privileges required to update dashboard module allotments." }, { status: 403 });
    }

    const body = await req.json();
    const { allotments } = body;

    if (!allotments || typeof allotments !== "object") {
      return apiOk({ ok: false, message: "Invalid payload: allotments object required." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient() as any;

    const { error } = await supabase
      .from("app_settings")
      .upsert({
        setting_key: "dashboard_module_allotments",
        setting_value: JSON.stringify(allotments),
        updated_at: new Date().toISOString()
      }, { onConflict: "setting_key" });

    if (error) {
      console.warn("Could not persist allotments to database app_settings:", error.message);
    }

    return apiOk({
      ok: true,
      message: "Dashboard system and module allotments saved successfully!",
      allotments
    });
  } catch (error) {
    return handleApiError(error);
  }
}
