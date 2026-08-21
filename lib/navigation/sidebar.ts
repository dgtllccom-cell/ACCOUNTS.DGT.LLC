import type { Route } from "next";
import type { EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import type { UiKey } from "@/lib/i18n/ui";

export type SidebarIconKey =
  | "layout-dashboard"
  | "list-plus"
  | "building-2"
  | "users"
  | "gantt"
  | "file-text"
  | "clipboard-list"
  | "book-open"
  | "banknote"
  | "scroll-text"
  | "settings"
  | "bar-chart"
  | "bar-chart-3"
  | "message-square"
  | "mail"
  | "bell"
  | "palette"
  | "search"
  | "truck"
  | "video"
  | "globe"
  | "send"
  | "shield-check"
  | "package"
  | "shopping-bag"
  | "clock"
  | "calendar"
  | "badge"
  | "user-check"
  | "shield"
  | "check-square"
  | "coins"
  | "calculator"
  | "file-spreadsheet"
  | "scale"
  | "credit-card";

export type SidebarNode = {
  key: string;
  labelKey: UiKey;
  iconKey?: SidebarIconKey;
  href?: Route;
  roles?: EnterpriseRole[];
  permission?: PermissionRequirement;
  menuSettingKey?: string;
  children?: SidebarNode[];
};

type PermissionRequirement = {
  resource: string;
  action: string;
};

export type SidebarMenuVisibilityMap = Record<string, boolean>;

export const sidebarTree: SidebarNode[] = [
  {
    key: "dashboard",
    labelKey: "nav.dashboard",
    iconKey: "layout-dashboard",
    href: "/dashboard" as Route,
    children: [
      {
        key: "dash-super",
        labelKey: "nav.super_admin_dashboard",
        href: "/dashboard/super-admin" as Route,
        roles: ["super_admin"]
      },
      {
        key: "dash-country",
        labelKey: "nav.country_dashboard",
        href: "/dashboard/country" as Route,
        roles: ["super_admin", "country_admin", "country_user", "main_branch_admin"]
      },
      {
        key: "dash-city",
        labelKey: "nav.city_dashboard",
        href: "/dashboard/city" as Route,
        roles: ["super_admin", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
      },
      {
        key: "dash-logistics",
        labelKey: "nav.shipping_clearing",
        href: "/dashboard/logistics" as Route,
        roles: ["super_admin", "agent_user"]
      }
    ]
  },
  {
    key: "new-entry",
    labelKey: "nav.new_entry" as any,
    iconKey: "list-plus",
    roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant"],
    children: [
      {
        key: "new-entry-branch-group",
        labelKey: "nav.branch_setup_network" as any,
        iconKey: "building-2",
        roles: ["super_admin", "country_admin", "main_branch_admin"],
        children: [
          {
            key: "new-entry-country-branch",
            labelKey: "nav.country_branch" as any,
            href: "/dashboard/new-entry/branch-entry/country-branch" as Route,
            roles: ["super_admin"]
          },
          {
            key: "new-entry-city-branch",
            labelKey: "nav.city_branch" as any,
            href: "/dashboard/new-entry/branch-entry/city-branch" as Route,
            roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin"]
          },
          {
            key: "new-entry-super-admin-branch",
            labelKey: "nav.super_admin_branch" as any,
            href: "/dashboard/new-entry/branches/super-admin" as Route,
            roles: ["super_admin"]
          },
          {
            key: "new-entry-branch-general-report",
            labelKey: "nav.branch_general_report" as any,
            href: "/dashboard/branch-management/general-report" as Route,
            roles: ["super_admin", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "accountant"]
          },
          {
            key: "new-entry-location-management",
            labelKey: "nav.locations_management" as any,
            href: "/dashboard/settings/locations" as Route,
            roles: ["super_admin", "country_admin", "main_branch_admin"]
          }
        ]
      },
      {
        key: "new-entry-user-group",
        labelKey: "nav.user_entry" as any,
        iconKey: "user-check",
        roles: ["super_admin", "country_admin", "main_branch_admin"],
        children: [
          {
            key: "new-entry-user-registration",
            labelKey: "nav.new_user_registration" as any,
            href: "/dashboard/new-entry/users/registration" as Route,
            roles: ["super_admin"]
          },
          {
            key: "new-entry-users-all-report",
            labelKey: "nav.user_general_report" as any,
            href: "/dashboard/new-entry/users/all" as Route,
            roles: ["super_admin", "country_admin", "main_branch_admin"]
          },
          {
            key: "new-entry-user-super-admin",
            labelKey: "nav.super_admin_user" as any,
            href: "/dashboard/new-entry/users/super-admin" as Route,
            roles: ["super_admin"]
          },
          {
            key: "new-entry-user-country",
            labelKey: "nav.country_user" as any,
            href: "/dashboard/new-entry/users/country" as Route,
            roles: ["super_admin", "country_admin", "main_branch_admin"]
          },
          {
            key: "new-entry-user-branch",
            labelKey: "nav.branch_user" as any,
            href: "/dashboard/new-entry/users/branch" as Route,
            roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin"]
          }
        ]
      },
      {
        key: "new-entry-account-group",
        labelKey: "nav.accounts" as any,
        iconKey: "book-open",
        roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant"],
        children: [
          {
            key: "new-entry-account-setup",
            labelKey: "nav.new_account" as any,
            href: "/dashboard/accounts/setup" as Route,
            roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant"]
          },
          {
            key: "new-entry-account-ledger",
            labelKey: "nav.ledger_account" as any,
            href: "/dashboard/ledger/new" as Route,
            roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant"]
          },
          {
            key: "new-entry-account-report",
            labelKey: "nav.new_account_general_report" as any,
            href: "/dashboard/new-entry/accounts/general-report" as Route,
            roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant"]
          }
        ]
      },
      {
        key: "new-entry-employee",
        labelKey: "nav.register_employee" as any,
        iconKey: "users",
        href: "/dashboard/general-office/employees" as Route,
        roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant"]
      },
      {
        key: "new-entry-hub",
        labelKey: "nav.new_entry_hub" as any,
        iconKey: "gantt",
        href: "/dashboard/new-entry" as Route,
        roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant"]
      }
    ]
  },
  {
    key: "general-office",
    labelKey: "nav.general_office_management",
    iconKey: "users",
    href: "/dashboard/general-office/employees" as Route,
    roles: ["super_admin", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "accountant"],
    children: [
      { key: "go-master-setup", labelKey: "nav.employee_master_setup", iconKey: "users", href: "/dashboard/general-office/employees?tab=master-setup" as Route },
      { key: "go-emp-mgmt", labelKey: "nav.employee_management", iconKey: "users", href: "/dashboard/general-office/employees?tab=management" as Route },
      { key: "go-departments", labelKey: "nav.departments", iconKey: "building-2", href: "/dashboard/general-office/employees?tab=departments" as Route },
      { key: "go-designations", labelKey: "nav.designations", iconKey: "scroll-text", href: "/dashboard/general-office/employees?tab=designations" as Route },
      { key: "go-attendance", labelKey: "nav.attendance", iconKey: "clock", href: "/dashboard/general-office/employees?tab=attendance" as Route },
      { key: "go-leave", labelKey: "nav.leave_management", iconKey: "calendar", href: "/dashboard/general-office/employees?tab=leave" as Route },
      { key: "go-payroll", labelKey: "nav.payroll_salary", iconKey: "banknote", href: "/dashboard/general-office/employees?tab=payroll" as Route },
      { key: "go-assets", labelKey: "nav.office_assets", iconKey: "clipboard-list", href: "/dashboard/general-office/employees?tab=assets" as Route },
      { key: "go-documents", labelKey: "nav.office_documents", iconKey: "file-text", href: "/dashboard/general-office/employees?tab=documents" as Route },
      { key: "go-id-cards", labelKey: "nav.employee_id_cards", iconKey: "badge", href: "/dashboard/general-office/employees?tab=id-cards" as Route },
      { key: "go-reports", labelKey: "nav.employee_reports", iconKey: "bar-chart", href: "/dashboard/general-office/employees?tab=reports" as Route }
    ]
  },
  {
    key: "ledgers",
    labelKey: "nav.ledgers",
    iconKey: "book-open",
    children: [
      {
        key: "ledgers-new",
        labelKey: "nav.new_ledger",
        href: "/dashboard/ledger/new" as Route,
        roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant"]
      },
      {
        key: "ledgers-super-admin-detailed",
        labelKey: "nav.ledger_super_admin_detailed",
        href: "/dashboard/ledger/super-admin/detailed" as Route,
        roles: ["super_admin"]
      },
      {
        key: "ledgers-country-detailed",
        labelKey: "nav.ledger_country_detailed",
        href: "/dashboard/ledger/country/detailed" as Route,
        roles: ["super_admin", "country_admin"]
      },
      {
        key: "ledgers-general-report",
        labelKey: "nav.ledger_general_report",
        href: "/dashboard/ledger/general-report" as Route,
        roles: ["super_admin", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "accountant", "auditor_viewer"]
      },
      {
        key: "ledgers-outstanding",
        labelKey: "nav.ledger_outstanding",
        href: "/dashboard/ledger/outstanding" as Route,
        roles: ["super_admin", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "accountant", "auditor_viewer"]
      }
    ]
  },
      {
        key: "journal",
        labelKey: "nav.journal",
        iconKey: "banknote",
        children: [
          {
            key: "purchase-order-payment",
            labelKey: "nav.purchase_order_payment",
            iconKey: "banknote",
            roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"],
            children: [
              {
                key: "purchase-order-payment-advance",
                labelKey: "nav.purchase_order_payment_advance",
                href: "/dashboard/journal/purchase-order-payment/advance" as Route,
                roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
              },
              {
                key: "purchase-order-payment-remaining",
                labelKey: "nav.purchase_order_payment_remaining",
                href: "/dashboard/journal/purchase-order-payment/remaining" as Route,
                roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
              },
              {
                key: "purchase-order-payment-charges",
                labelKey: "nav.purchase_order_payment_charges",
                href: "/dashboard/journal/purchase-order-payment/charges" as Route,
                roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
              },
              {
                key: "purchase-order-payment-history",
                labelKey: "nav.purchase_order_payment_history",
                href: "/dashboard/journal/purchase-order-payment/history" as Route,
                roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
              }
            ]
          },
          {
            key: "sales-order-payment",
            labelKey: "nav.sales_order_payment",
            iconKey: "banknote",
            roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"],
            children: [
              {
                key: "sales-order-payment-advance",
                labelKey: "nav.sales_order_payment_advance",
                href: "/dashboard/journal/sales-order-payment/advance" as Route,
                roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
              },
              {
                key: "sales-order-payment-remaining",
                labelKey: "nav.sales_order_payment_remaining",
                href: "/dashboard/journal/sales-order-payment/remaining" as Route,
                roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
              },
              {
                key: "sales-order-payment-charges",
                labelKey: "nav.sales_order_payment_charges",
                href: "/dashboard/journal/sales-order-payment/charges" as Route,
                roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
              },
              {
                key: "sales-order-payment-history",
                labelKey: "nav.sales_order_payment_history",
                href: "/dashboard/journal/sales-order-payment/history" as Route,
                roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
              }
            ]
          },
          {
            key: "final-payments",
            labelKey: "nav.final_payments",
            iconKey: "banknote",
            roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"],
            children: [
              {
                key: "final-payments-advance-nil",
                labelKey: "nav.final_payments_advance_nil",
                href: "/dashboard/journal/final-payments/advance-nil" as Route,
                roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
              }
            ]
          },
          {
            key: "roznamcha",
            labelKey: "nav.roznamcha",
            iconKey: "scroll-text",
            roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"],
            children: [
              {
                key: "roz-cash-entry",
                labelKey: "nav.cash_journal_entry",
                href: "/dashboard/roznamcha/cash-entry" as Route,
                roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
              },
              {
                key: "roz-daily-expenses-bill",
                labelKey: "nav.daily_operational_expenses",
                href: "/dashboard/roznamcha/daily-expenses-bill" as Route,
                roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
              },
              {
                key: "roz-expenses-bill",
                labelKey: "nav.office_home_expenses_bill",
                href: "/dashboard/roznamcha/expenses-bill" as Route,
                roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
              },
              {
                key: "roz-money-exchange",
                labelKey: "nav.money_changer_short",
                href: "/dashboard/roznamcha/money-exchange" as Route,
                roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
              }
            ]
          },
          {
            key: "general-roznamcha-reports",
            labelKey: "nav.general_roznamcha_reports",
            iconKey: "bar-chart-3",
            roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"],
            children: [
              {
                key: "roz-report-business",
                labelKey: "nav.business_report",
                href: "/dashboard/roznamcha/reports/business" as Route,
                roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
              },
              {
                key: "roz-report-bank",
                labelKey: "nav.bank_report_roz",
                href: "/dashboard/roznamcha/reports/bank" as Route,
                roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
              },
              {
                key: "roz-report-cash-entry",
                labelKey: "nav.cash_entry_report",
                href: "/dashboard/roznamcha/reports/cash-entry" as Route,
                roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
              },
              {
                key: "roz-report-invoice",
                labelKey: "nav.invoice_report",
                href: "/dashboard/roznamcha/reports/invoice" as Route,
                roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
              },
              {
                key: "roz-report-transfer",
                labelKey: "report.transfer",
                href: "/dashboard/roznamcha/reports/transfer" as Route,
                roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
              },
              {
                key: "roz-report-all",
                labelKey: "nav.roznamcha_all_report",
                href: "/dashboard/roznamcha/reports/all" as Route,
                roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
              }
            ]
          },
          {
            key: "journal-super-admin-exchange-rate",
            labelKey: "nav.super_admin_exchange_rate",
            href: "/dashboard/reports/exchange-rate" as Route,
            roles: ["super_admin", "country_admin"]
          }
        ]
      },
  {
    key: "inter-country-trade",
    labelKey: "nav.inter_country_trade",
    iconKey: "globe",
    roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant"],
    children: [
      {
        key: "inter-country-booking",
        labelKey: "nav.inter_country_purchase_booking",
        iconKey: "clipboard-list",
        href: "/dashboard/purchase/local-purchase" as Route,
        roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant"]
      },
      {
        key: "inter-country-transfer-payment",
        labelKey: "nav.inter_country_transfer_payment",
        iconKey: "send",
        href: "/dashboard/purchase/local-purchase-transfer-payment" as Route,
        roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant"]
      },
      {
        key: "inter-country-verification",
        labelKey: "nav.inter_country_transfer_verification",
        iconKey: "shield-check",
        href: "/dashboard/purchase/purchase-transfer-verification" as Route,
        roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant"]
      },
      {
        key: "receiving-country-workflow",
        labelKey: "nav.receiving_country_workflow",
        iconKey: "package",
        href: "/dashboard/purchase/local-goods-received" as Route,
        roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant"]
      }
    ]
  },
  {
    key: "purchase",
    labelKey: "nav.purchase",
    iconKey: "gantt",
    href: "/dashboard/purchase/new-purchase-booking-order" as Route,
    children: [
      {
        key: "branch-purchase-management",
        labelKey: "nav.branch_purchase",
        iconKey: "shopping-bag",
        href: "/dashboard/purchase/new-purchase-booking-order" as Route,
        children: [
          {
            key: "purchase-new-booking-order",
            labelKey: "nav.new_purchase_booking",
            href: "/dashboard/purchase/new-purchase-booking-order" as Route
          },
          {
            key: "purchase-order-master",
            labelKey: "nav.purchase_transfer_payment",
            href: "/dashboard/purchase/purchase-order" as Route
          },
          {
            key: "purchase-booking-orders",
            labelKey: "nav.purchase_entry",
            href: "/dashboard/purchase/purchase-order?stage=booking" as Route
          },
          {
            key: "purchase-confirmed-orders",
            labelKey: "nav.booking_purchase_confirmation",
            href: "/dashboard/purchase/purchase-confirm" as Route
          },
          {
            key: "purchase-container-loading",
            labelKey: "nav.local_loading",
            href: "/dashboard/purchase/purchase-loading-records" as Route
          },
          {
            key: "purchase-finalized-orders",
            labelKey: "nav.final_purchase_order",
            href: "/dashboard/purchase/finalized-purchase-orders" as Route
          },
          {
            key: "completed-purchase-bills",
            labelKey: "nav.completed_purchase_bills",
            href: "/dashboard/purchase/completed-purchase-bills" as Route
          },
          {
            key: "purchase-order-tracking",
            labelKey: "nav.purchase_order_tracking",
            href: "/dashboard/purchase/purchase-order-tracking" as Route
          }
        ]
      },
      {
        key: "local-branch-purchase-management",
        labelKey: "nav.local_branch_purchase",
        iconKey: "building-2",
        children: [
          {
            key: "local-purchase",
            labelKey: "nav.local_purchase",
            href: "/dashboard/purchase/local-purchase" as Route
          },
          {
            key: "local-branch-transfer",
            labelKey: "nav.local_transfer",
            href: "/dashboard/purchase/local-purchase-transfer-payment" as Route
          },
          {
            key: "local-branch-loading",
            labelKey: "nav.local_loading",
            href: "/dashboard/purchase/local-goods-received" as Route
          }
        ]
      },
      {
        key: "country-purchase-management",
        labelKey: "nav.country_purchase",
        iconKey: "globe",
        children: [
          {
            key: "country-branch-purchase",
            labelKey: "nav.country_branch_purchase",
            href: "/dashboard/purchase/new-purchase-booking-order" as Route
          },
          {
            key: "country-local-purchase",
            labelKey: "nav.country_local_purchase",
            href: "/dashboard/purchase/purchase-transfer-verification" as Route
          },
          {
            key: "country-transfer",
            labelKey: "nav.country_transfer",
            href: "/dashboard/purchase/local-goods-received?scope=country" as Route
          },
          {
            key: "country-loading",
            labelKey: "nav.country_loading",
            href: "/dashboard/purchase/purchase-loading-records" as Route
          }
        ]
      }
    ]
  },
  {
    key: "sales",
    labelKey: "nav.sales",
    iconKey: "gantt",
    children: [
      {
        key: "sales-order-management",
        labelKey: "nav.sales_order_management",
        iconKey: "clipboard-list",
        children: [
          {
            key: "sales-new-booking",
            labelKey: "nav.new_sales_booking",
            href: "/dashboard/sales/new-sales-booking-order" as Route
          },
          {
            key: "sales-order",
            labelKey: "nav.sales_transfer_payment",
            href: "/dashboard/sales/sales-order" as Route
          },
          {
            key: "sales-confirm",
            labelKey: "nav.confirmed_sales",
            href: "/dashboard/sales/sales-confirm" as Route
          },
          {
            key: "sales-booking-register",
            labelKey: "nav.sales_booking_register",
            href: "/dashboard/sales/sales-booking-journal-report" as Route
          }
        ]
      },
      {
        key: "local-sales-management",
        labelKey: "nav.local_sales_management",
        iconKey: "clipboard-list",
        children: [
          {
            key: "sales-local",
            labelKey: "nav.local_sales",
            href: "/dashboard/sales/local-sales" as Route
          }
        ]
      }
    ]
  },
  {
    key: "documents-hub",
    labelKey: "nav.document_management",
    iconKey: "file-text",
    href: "/dashboard/documents" as Route,
    roles: ["super_admin", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "accountant"]
  },
  {
    key: "journal-stock",
    labelKey: "nav.journal_stock",
    iconKey: "clipboard-list",
    children: [
      {
        key: "journal-stock-sub",
        labelKey: "nav.journal_stock",
        iconKey: "file-text",
        children: [
          {
            key: "journal-stock-group",
            labelKey: "nav.journal_stock_report",
            iconKey: "bar-chart",
            children: [
              {
                key: "salesman-report",
                labelKey: "nav.salesman_report",
                href: "/dashboard/inventory/stock-reports/salesman" as Route
              },
              {
                key: "country-report",
                labelKey: "nav.country_report",
                href: "/dashboard/inventory/stock-reports/country" as Route
              },
              {
                key: "branch-report",
                labelKey: "nav.branch_report",
                href: "/dashboard/inventory/stock-reports/branch" as Route
              }
            ]
          },
          {
            key: "journal-bill-checking-group",
            labelKey: "nav.journal_stock_checking_report",
            iconKey: "file-text",
            children: [
              {
                key: "journal-salesman-report",
                labelKey: "nav.journal_salesman_report",
                href: "/dashboard/inventory/journal-report/salesman" as Route
              },
              {
                key: "journal-country-report",
                labelKey: "nav.journal_country_report",
                href: "/dashboard/inventory/journal-report/country" as Route
              },
              {
                key: "journal-branch-report",
                labelKey: "nav.journal_branch_report",
                href: "/dashboard/inventory/journal-report/branch" as Route
              }
            ]
          }
        ]
      },
      {
        key: "stock-sub",
        labelKey: "nav.stock",
        iconKey: "clipboard-list",
        menuSettingKey: "menu_purchase_stock_section",
        children: [
          {
            key: "stock-booking",
            labelKey: "nav.booking_stock",
            href: "/dashboard/purchase/stock/booking" as Route
          },
          {
            key: "stock-confirmed",
            labelKey: "nav.confirmed_stock",
            href: "/dashboard/purchase/stock/confirmed" as Route
          },
          {
            key: "stock-import",
            labelKey: "nav.import_stock",
            href: "/dashboard/purchase/stock/import" as Route
          },
          {
            key: "stock-warehouse",
            labelKey: "nav.warehouse_stock",
            href: "/dashboard/purchase/stock/warehouse" as Route
          },
          {
            key: "stock-in-transit",
            labelKey: "nav.in_transit_stock",
            href: "/dashboard/purchase/stock/in-transit" as Route
          },
          {
            key: "stock-export",
            labelKey: "nav.export_stock",
            href: "/dashboard/purchase/stock/export" as Route
          },
          {
            key: "stock-delivered",
            labelKey: "nav.delivered_stock",
            href: "/dashboard/purchase/stock/delivered" as Route
          }
        ]
      }
    ]
  },
  {
    key: "kyc-reports-top",
    labelKey: "nav.kyc_reports",
    iconKey: "clipboard-list",
    href: "/dashboard/kyc-reports" as Route,
    roles: ["super_admin", "auditor_viewer", "country_admin", "main_branch_admin", "city_branch_admin", "accountant"]
  },
  {
    key: "logistics",
    labelKey: "nav.shipping_clearing",
    iconKey: "truck",
    children: [
      {
        key: "clearing-customer-order",
        labelKey: "nav.customer_order",
        href: "/dashboard/clearing-agent/customer-order" as Route,
        roles: ["super_admin", "agent_user"],
        permission: { resource: "shipping_records", action: "read" }
      },
      {
        key: "shipping-shipment-details",
        labelKey: "nav.shipment_details",
        href: "/dashboard/shipping-line/shipment-details" as Route,
        roles: ["super_admin", "agent_user"]
      },
      {
        key: "shipping-bl-entry",
        labelKey: "nav.bl_entry",
        href: "/dashboard/shipping-line/bl-entry" as Route,
        roles: ["super_admin", "agent_user"]
      },
      {
        key: "shipping-shipment-report",
        labelKey: "nav.shipment_report",
        href: "/dashboard/shipping-line/shipment-report" as Route,
        roles: ["super_admin", "agent_user"]
      },
      {
        key: "shipping-agent",
        labelKey: "nav.shipping_agent_entry",
        href: "/dashboard/shipping-line/agent-entry" as Route,
        roles: ["super_admin", "agent_user"]
      },
      {
        key: "clearing-truck-registration",
        labelKey: "nav.truck_registration",
        href: "/dashboard/clearing-agent/truck-registration" as Route,
        permission: { resource: "shipping_records", action: "read" }
      },
      {
        key: "clearing-truck-recreation",
        labelKey: "nav.truck_recreation",
        href: "/dashboard/clearing-agent/truck-recreation" as Route,
        permission: { resource: "shipping_records", action: "read" }
      },
      {
        key: "clearing-truck-loading",
        labelKey: "nav.truck_loading",
        href: "/dashboard/clearing-agent/truck-loading" as Route,
        permission: { resource: "shipping_records", action: "read" }
      },
      {
        key: "clearing-custom",
        labelKey: "nav.agent_custom_entry",
        href: "/dashboard/clearing-agent/agent-custom-entry" as Route,
        roles: ["super_admin", "agent_user"]
      },
      {
        key: "clearing-bill",
        labelKey: "nav.clearing_bill_entry",
        href: "/dashboard/clearing-agent/bill-entry" as Route,
        roles: ["super_admin", "agent_user"]
      },
      {
        key: "clearing-transit-entry",
        labelKey: "nav.agent_custom_entry",
        href: "/dashboard/clearing-agent/transit-entry" as Route,
        roles: ["super_admin", "agent_user", "country_admin", "main_branch_admin"]
      },
      {
        key: "clearing-payment-bill",
        labelKey: "nav.payment_bill_entry",
        href: "/dashboard/clearing-agent/payment-bill-entry" as Route,
        roles: ["super_admin", "agent_user"]
      }
    ]
  },
  {
    key: "tax",
    labelKey: "nav.tax",
    iconKey: "banknote",
    href: "/dashboard/tax" as Route
  },
  {
    key: "super-admin-menu",
    labelKey: "nav.super_admin_menu" as any,
    iconKey: "shield-check",
    href: "/dashboard/super-admin" as Route,
    roles: ["super_admin", "super_admin_reports"],
    children: [
      {
        key: "sa-all-release-entries",
        labelKey: "nav.all_release_entries",
        iconKey: "list-plus",
        href: "/dashboard/all-release-entries" as Route,
        roles: ["super_admin", "super_admin_reports"]
      },
      {
        key: "sa-entry-register",
        labelKey: "nav.entry_register" as any,
        iconKey: "scroll-text",
        href: "/dashboard/new-entry" as Route,
        roles: ["super_admin", "super_admin_reports"]
      },
      {
        key: "sa-enterprise-audit",
        labelKey: "nav.enterprise_audit_monitoring" as any,
        iconKey: "shield-check",
        href: "/dashboard/audit-monitoring" as Route,
        roles: ["super_admin", "super_admin_reports"]
      },
      {
        key: "sa-edit-version-history",
        labelKey: "nav.edit_version_history" as any,
        iconKey: "clock",
        href: "/dashboard/audit-monitoring?tab=edits" as Route,
        roles: ["super_admin", "super_admin_reports"]
      },
      {
        key: "sa-deleted-records",
        labelKey: "nav.deleted_records_vault" as any,
        iconKey: "clipboard-list",
        href: "/dashboard/audit-monitoring?tab=deleted" as Route,
        roles: ["super_admin", "super_admin_reports"]
      },
      {
        key: "sa-user-activity",
        labelKey: "nav.user_activity_productivity" as any,
        iconKey: "users",
        href: "/dashboard/audit-monitoring?tab=users" as Route,
        roles: ["super_admin", "super_admin_reports"]
      },
      {
        key: "sa-daily-branch-activity",
        labelKey: "nav.daily_branch_activity" as any,
        iconKey: "calendar",
        href: "/dashboard/audit-monitoring?tab=daily" as Route,
        roles: ["super_admin", "super_admin_reports"]
      },
      {
        key: "sa-security-events",
        labelKey: "nav.security_events" as any,
        iconKey: "shield",
        href: "/dashboard/settings/security-events" as Route,
        roles: ["super_admin", "super_admin_reports"]
      },
      {
        key: "sa-audit-logs",
        labelKey: "nav.audit_logs" as any,
        iconKey: "file-text",
        href: "/dashboard/settings/audit-logs" as Route,
        roles: ["super_admin", "super_admin_reports"]
      },
      {
        key: "sa-super-admin-panel",
        labelKey: "nav.super_admin_reports",
        iconKey: "bar-chart",
        href: "/dashboard/reports/super-admin" as Route,
        roles: ["super_admin", "super_admin_reports"]
      }
    ]
  },
  {
    key: "reports",
    labelKey: "nav.reports",
    iconKey: "bar-chart",
    href: "/dashboard/reports" as Route,
    roles: ["super_admin", "super_admin_reports", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "accountant", "auditor_viewer"],
    children: [
      {
        key: "reports-country-panel",
        labelKey: "nav.country_reports",
        iconKey: "globe",
        href: "/dashboard/reports/country" as Route,
        roles: ["super_admin", "super_admin_reports", "country_admin", "country_user", "main_branch_admin"],
        permission: { resource: "reports", action: "read" }
      },
      {
        key: "reports-branch-panel",
        labelKey: "nav.branch_reports",
        iconKey: "building-2",
        href: "/dashboard/reports/branch" as Route,
        roles: ["super_admin", "super_admin_reports", "country_admin", "city_branch_admin", "accountant", "cashier", "staff_user", "auditor_viewer"],
        permission: { resource: "reports", action: "read" }
      },
      {
        key: "rep-export-pdf-center",
        labelKey: "nav.export_pdf_center" as any,
        iconKey: "file-spreadsheet",
        href: "/dashboard/print-reports" as Route,
        roles: ["super_admin", "super_admin_reports", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "accountant", "auditor_viewer"]
      },
      {
        key: "reports-forms-directory",
        labelKey: "nav.forms_directory_audit" as any,
        iconKey: "clipboard-list",
        href: "/dashboard/reports/system-forms-directory" as Route
      },
      {
        key: "reports-journal-report-pdf",
        labelKey: "nav.journal_report_pdf_erp",
        iconKey: "file-text",
        href: "/dashboard/reports/handover" as Route
      },
      {
        key: "reports-super-admin-panel",
        labelKey: "nav.super_admin_reports",
        iconKey: "bar-chart",
        href: "/dashboard/reports/super-admin" as Route,
        roles: ["super_admin", "super_admin_reports"],
        permission: { resource: "reports", action: "read" }
      },
      // ─── Legacy: Enterprise Reporting Hub ───────────────────────────
      {
        key: "reports-general",
        labelKey: "nav.enterprise_reporting_hub",
        iconKey: "bar-chart",
        href: "/dashboard/reports" as Route,
        roles: ["super_admin", "auditor_viewer", "country_admin", "main_branch_admin"],
        children: [
          { key: "rep-cash-entry", labelKey: "nav.cash_entry_roznamcha", iconKey: "scroll-text", href: "/dashboard/reports?type=cash-entry" as Route },
          { key: "rep-receipts", labelKey: "nav.receipts_general_ledger", iconKey: "file-text", href: "/dashboard/reports?type=receipts" as Route },
          { key: "rep-payments", labelKey: "nav.payments_ledger", iconKey: "banknote", href: "/dashboard/reports?type=payments" as Route },
          { key: "rep-customer-accounts", labelKey: "nav.customer_account_details", iconKey: "users", href: "/dashboard/reports?type=customer-accounts" as Route },
          { key: "rep-customer-companies", labelKey: "nav.customer_company_registrations", iconKey: "building-2", href: "/dashboard/reports?type=customer-companies" as Route },
          { key: "rep-exchange-rates", labelKey: "nav.global_exchange_rates", iconKey: "globe", href: "/dashboard/reports?type=exchange-rates" as Route },
          { key: "rep-branch-transactions", labelKey: "nav.branch_transaction_performance", iconKey: "bar-chart", href: "/dashboard/reports?type=branch-transactions" as Route },
          { key: "rep-user-activity", labelKey: "nav.user_live_activity", iconKey: "user-check", href: "/dashboard/reports?type=user-activity" as Route },
          { key: "rep-audit-logs", labelKey: "nav.audit_trail_logs", iconKey: "shield", href: "/dashboard/reports?type=audit-logs" as Route },
          { key: "rep-approval-workflows", labelKey: "nav.approval_workflow_states", iconKey: "check-square", href: "/dashboard/reports?type=approval-workflows" as Route },
          { key: "rep-expenses", labelKey: "nav.interval_expense_tracking", iconKey: "coins", href: "/dashboard/reports?type=expenses" as Route },
          { key: "rep-financial-summaries", labelKey: "nav.financial_balance_summaries", iconKey: "calculator", href: "/dashboard/reports?type=financial-summaries" as Route },
          { key: "rep-purchase-booking-register", labelKey: "nav.purchase_booking_register", iconKey: "shopping-bag", href: "/dashboard/reports?type=purchase-booking-register" as Route },
          { key: "rep-daily-comprehensive", labelKey: "report.daily_comprehensive", iconKey: "calendar", href: "/dashboard/reports?type=daily-comprehensive" as Route }
        ]
      },

      {
        key: "print-reports-hub",
        labelKey: "nav.print_reports_hub",
        iconKey: "file-text",
        href: "/dashboard/print-reports" as Route,
        roles: ["super_admin", "auditor_viewer", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
      },
      {
        key: "reports-other",
        labelKey: "nav.other_reports",
        iconKey: "bar-chart",
        children: [
          {
            key: "reports-all-roznamcha",
            labelKey: "nav.roznamcha_all_report",
            iconKey: "scroll-text",
            children: [
              {
                key: "reports-roz-super-admin",
                labelKey: "nav.super_admin_roznamcha",
                href: "/dashboard/roznamcha/super-admin" as Route,
                roles: ["super_admin"]
              },
              {
                key: "reports-roz-country",
                labelKey: "nav.country_roznamcha",
                href: "/dashboard/roznamcha/country" as Route,
                roles: ["super_admin", "country_admin", "country_user", "main_branch_admin"]
              },
              {
                key: "reports-roz-branch",
                labelKey: "nav.branch_roznamcha",
                href: "/dashboard/roznamcha/branch" as Route,
                roles: ["super_admin", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "cashier"]
              }
            ]
          },
          {
            key: "reports-ledger-journals",
            labelKey: "nav.ledger_journal_reports",
            iconKey: "scroll-text",
            children: [
              {
                key: "reports-ledger-super-admin",
                labelKey: "nav.super_admin_journal_report",
                href: "/dashboard/ledger/super-admin" as Route,
                roles: ["super_admin"]
              },
              {
                key: "reports-ledger-pakistan",
                labelKey: "nav.pakistan",
                children: [
                  {
                    key: "reports-ledger-pk-country",
                    labelKey: "nav.country_journal_report",
                    href: "/dashboard/ledger/country?country=Pakistan" as Route,
                    roles: ["super_admin", "country_admin", "country_user", "main_branch_admin"]
                  },
                  {
                    key: "reports-ledger-pk-branch",
                    labelKey: "nav.city_journal_report",
                    href: "/dashboard/ledger/branch?country=Pakistan" as Route,
                    roles: ["super_admin", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
                  },
                  {
                    key: "reports-ledger-pk-construction",
                    labelKey: "nav.construction_journal_report",
                    href: "/dashboard/ledger/construction?country=Pakistan" as Route,
                    roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
                  }
                ]
              },
              {
                key: "reports-ledger-afghanistan",
                labelKey: "nav.afghanistan",
                children: [
                  {
                    key: "reports-ledger-af-country",
                    labelKey: "nav.country_journal_report",
                    href: "/dashboard/ledger/country?country=Afghanistan" as Route,
                    roles: ["super_admin", "country_admin", "country_user", "main_branch_admin"]
                  },
                  {
                    key: "reports-ledger-af-branch",
                    labelKey: "nav.city_journal_report",
                    href: "/dashboard/ledger/branch?country=Afghanistan" as Route,
                    roles: ["super_admin", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
                  },
                  {
                    key: "reports-ledger-af-construction",
                    labelKey: "nav.construction_journal_report",
                    href: "/dashboard/ledger/construction?country=Afghanistan" as Route,
                    roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
                  }
                ]
              },
              {
                key: "reports-ledger-india",
                labelKey: "nav.india",
                children: [
                  {
                    key: "reports-ledger-in-country",
                    labelKey: "nav.country_journal_report",
                    href: "/dashboard/ledger/country?country=India" as Route,
                    roles: ["super_admin", "country_admin", "country_user", "main_branch_admin"]
                  },
                  {
                    key: "reports-ledger-in-branch",
                    labelKey: "nav.city_journal_report",
                    href: "/dashboard/ledger/branch?country=India" as Route,
                    roles: ["super_admin", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
                  },
                  {
                    key: "reports-ledger-in-construction",
                    labelKey: "nav.construction_journal_report",
                    href: "/dashboard/ledger/construction?country=India" as Route,
                    roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
                  }
                ]
              },
              {
                key: "reports-ledger-dubai",
                labelKey: "nav.uae_dubai",
                children: [
                  {
                    key: "reports-ledger-ae-country",
                    labelKey: "nav.country_journal_report",
                    href: "/dashboard/ledger/country?country=UAE" as Route,
                    roles: ["super_admin", "country_admin", "country_user", "main_branch_admin"]
                  },
                  {
                    key: "reports-ledger-ae-branch",
                    labelKey: "nav.city_journal_report",
                    href: "/dashboard/ledger/branch?country=UAE" as Route,
                    roles: ["super_admin", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
                  },
                  {
                    key: "reports-ledger-ae-construction",
                    labelKey: "nav.construction_journal_report",
                    href: "/dashboard/ledger/construction?country=UAE" as Route,
                    roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
                  }
                ]
              },
              {
                key: "reports-ledger-iran",
                labelKey: "nav.iran",
                children: [
                  {
                    key: "reports-ledger-ir-country",
                    labelKey: "nav.country_journal_report",
                    href: "/dashboard/ledger/country?country=Iran" as Route,
                    roles: ["super_admin", "country_admin", "country_user", "main_branch_admin"]
                  },
                  {
                    key: "reports-ledger-ir-branch",
                    labelKey: "nav.city_journal_report",
                    href: "/dashboard/ledger/branch?country=Iran" as Route,
                    roles: ["super_admin", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
                  },
                  {
                    key: "reports-ledger-ir-construction",
                    labelKey: "nav.construction_journal_report",
                    href: "/dashboard/ledger/construction?country=Iran" as Route,
                    roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier"]
                  }
                ]
              }
            ]
          },
          {
            key: "reports-sales",
            labelKey: "nav.sales_report",
            iconKey: "credit-card",
            children: [
              {
                key: "rep-sales-super-admin",
                labelKey: "nav.sa_sales_report",
                href: "/dashboard/reports?type=branch-transactions&scope=super-admin" as Route,
                roles: ["super_admin"]
              },
              {
                key: "rep-sales-country",
                labelKey: "nav.ctry_sales_report",
                href: "/dashboard/reports?type=branch-transactions&scope=country" as Route,
                roles: ["super_admin", "country_admin", "country_user", "main_branch_admin"]
              },
              {
                key: "rep-sales-branch",
                labelKey: "nav.br_sales_report",
                href: "/dashboard/reports?type=branch-transactions&scope=branch" as Route,
                roles: ["super_admin", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "cashier"]
              }
            ]
          },
          {
            key: "reports-purchase",
            labelKey: "nav.purchase_report",
            iconKey: "shopping-bag",
            children: [
              {
                key: "rep-pur-super-admin",
                labelKey: "nav.sa_purchase_report",
                href: "/dashboard/reports?type=purchase-booking-register&scope=super-admin" as Route,
                roles: ["super_admin"]
              },
              {
                key: "rep-pur-country",
                labelKey: "nav.ctry_purchase_report",
                href: "/dashboard/reports?type=purchase-booking-register&scope=country" as Route,
                roles: ["super_admin", "country_admin", "country_user", "main_branch_admin"]
              },
              {
                key: "rep-pur-branch",
                labelKey: "nav.br_purchase_report",
                href: "/dashboard/reports?type=purchase-booking-register&scope=branch" as Route,
                roles: ["super_admin", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "cashier"]
              }
            ]
          },
          {
            key: "reports-purchase-order",
            labelKey: "nav.purchase_order_report",
            iconKey: "file-text",
            children: [
              {
                key: "rep-po-super-admin",
                labelKey: "nav.sa_po_report",
                href: "/dashboard/purchase/purchase-booking-journal-report?scope=super-admin" as Route,
                roles: ["super_admin"]
              },
              {
                key: "rep-po-country",
                labelKey: "nav.ctry_po_report",
                href: "/dashboard/purchase/purchase-booking-journal-report?scope=country" as Route,
                roles: ["super_admin", "country_admin", "country_user", "main_branch_admin"]
              },
              {
                key: "rep-po-branch",
                labelKey: "nav.br_po_report",
                href: "/dashboard/purchase/purchase-booking-journal-report?scope=branch" as Route,
                roles: ["super_admin", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "cashier"]
              }
            ]
          },
          {
            key: "reports-audit",
            labelKey: "nav.audit_report",
            iconKey: "shield",
            children: [
              {
                key: "rep-audit-super-admin",
                labelKey: "nav.sa_audit_report",
                href: "/dashboard/reports?type=audit-logs&scope=super-admin" as Route,
                roles: ["super_admin", "auditor_viewer"]
              },
              {
                key: "rep-audit-country",
                labelKey: "nav.ctry_audit_report",
                href: "/dashboard/reports?type=audit-logs&scope=country" as Route,
                roles: ["super_admin", "auditor_viewer", "country_admin", "main_branch_admin"]
              },
              {
                key: "rep-audit-branch",
                labelKey: "nav.br_audit_report",
                href: "/dashboard/reports?type=audit-logs&scope=branch" as Route,
                roles: ["super_admin", "auditor_viewer", "country_admin", "main_branch_admin", "city_branch_admin"]
              }
            ]
          },
          {
            key: "reports-pl",
            labelKey: "nav.profit_loss_report",
            iconKey: "calculator",
            children: [
              {
                key: "rep-pl-super-admin",
                labelKey: "nav.sa_pl_report",
                href: "/dashboard/reports?type=financial-summaries&scope=super-admin" as Route,
                roles: ["super_admin"]
              },
              {
                key: "rep-pl-country",
                labelKey: "nav.ctry_pl_report",
                href: "/dashboard/reports?type=financial-summaries&scope=country" as Route,
                roles: ["super_admin", "country_admin", "country_user", "main_branch_admin"]
              },
              {
                key: "rep-pl-branch",
                labelKey: "nav.br_pl_report",
                href: "/dashboard/reports?type=financial-summaries&scope=branch" as Route,
                roles: ["super_admin", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "accountant"]
              }
            ]
          },
          {
            key: "reports-bs",
            labelKey: "nav.balance_sheet",
            iconKey: "file-spreadsheet",
            children: [
              {
                key: "rep-bs-super-admin",
                labelKey: "nav.sa_balance_sheet",
                href: "/dashboard/reports?type=financial-summaries&scope=super-admin" as Route,
                roles: ["super_admin"]
              },
              {
                key: "rep-bs-country",
                labelKey: "nav.ctry_balance_sheet",
                href: "/dashboard/reports?type=financial-summaries&scope=country" as Route,
                roles: ["super_admin", "country_admin", "country_user", "main_branch_admin"]
              },
              {
                key: "rep-bs-branch",
                labelKey: "nav.br_balance_sheet",
                href: "/dashboard/reports?type=financial-summaries&scope=branch" as Route,
                roles: ["super_admin", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "accountant"]
              }
            ]
          },
          {
            key: "reports-tb",
            labelKey: "nav.trial_balance",
            iconKey: "scale",
            children: [
              {
                key: "rep-tb-super-admin",
                labelKey: "nav.sa_trial_balance",
                href: "/dashboard/reports?type=financial-summaries&scope=super-admin" as Route,
                roles: ["super_admin"]
              },
              {
                key: "rep-tb-country",
                labelKey: "nav.ctry_trial_balance",
                href: "/dashboard/reports?type=financial-summaries&scope=country" as Route,
                roles: ["super_admin", "country_admin", "country_user", "main_branch_admin"]
              },
              {
                key: "rep-tb-branch",
                labelKey: "nav.br_trial_balance",
                href: "/dashboard/reports?type=financial-summaries&scope=branch" as Route,
                roles: ["super_admin", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "accountant"]
              }
            ]
          }
        ]
      }
    ]
  },
  {
    key: "message-system",
    labelKey: "nav.message_system",
    iconKey: "message-square",
    children: [
      {
        key: "msg-email",
        labelKey: "nav.messages_email",
        iconKey: "mail",
        children: [
          {
            key: "msg-email-inbox",
            labelKey: "nav.email_inbox_sent",
            href: "/dashboard/messages/email" as Route
          },
          {
            key: "msg-email-setup",
            labelKey: "nav.branch_email_setup",
            href: "/dashboard/settings/email-accounts" as Route
          }
        ]
      },
      {
        key: "msg-whatsapp",
        labelKey: "nav.messages_whatsapp",
        iconKey: "message-square",
        permission: { resource: "whatsapp", action: "read" },
        children: [
          {
            key: "msg-whatsapp-inbox",
            labelKey: "nav.whatsapp_inbox",
            href: "/dashboard/messages/whatsapp" as Route,
            permission: { resource: "whatsapp", action: "read" }
          },
          {
            key: "msg-whatsapp-setup",
            labelKey: "nav.whatsapp_setup",
            href: "/dashboard/messages/whatsapp/setup" as Route,
            permission: { resource: "whatsapp", action: "delete" }
          }
        ]
      },
      {
        key: "msg-return-sms",
        labelKey: "nav.return_sms_reply",
        iconKey: "message-square",
        href: "/dashboard/return-sms-reply" as Route
      },
      {
        key: "msg-ai-mobile",
        labelKey: "nav.ai_mobile_reply",
        iconKey: "message-square",
        href: "/mobile" as Route
      },
      {
        key: "msg-internal",
        labelKey: "nav.messages_internal",
        iconKey: "message-square",
        href: "/dashboard/messages/internal" as Route
      },
      {
        key: "msg-notifications",
        labelKey: "nav.notification_center",
        iconKey: "bell",
        href: "/dashboard/messages/notifications" as Route
      }
    ]
  },
  {
    key: "settings",
    labelKey: "nav.settings",
    iconKey: "settings",
    href: "/dashboard/settings" as Route,
    children: [
      {
        key: "settings-master-forms",
        labelKey: "nav.master_forms",
        iconKey: "settings",
        children: [
          {
            key: "mgmt-location-workspace",
            labelKey: "nav.location_form",
            href: "/dashboard/settings/locations" as Route
          },
          {
            key: "mgmt-company",
            labelKey: "nav.company_form",
            href: "/dashboard/settings/company" as Route
          },
          {
            key: "mgmt-company-registration-type",
            labelKey: "nav.company_registration_type",
            href: "/dashboard/settings/company-registration-type" as Route
          },
          {
            key: "mgmt-customers",
            labelKey: "nav.customers_form",
            href: "/dashboard/settings/customers" as Route,
            roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant"]
          },
          {
            key: "mgmt-employees",
            labelKey: "nav.employee_management",
            href: "/dashboard/settings/employees" as Route,
            roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant"]
          },
          {
            key: "mgmt-bank",
            labelKey: "nav.bank_form",
            href: "/dashboard/settings/bank" as Route,
            roles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant"]
          },
          {
            key: "mgmt-contact-type",
            labelKey: "nav.contact_type",
            href: "/dashboard/settings/contact-type" as Route
          },
          {
            key: "mgmt-document-type",
            labelKey: "nav.document_type",
            href: "/dashboard/settings/document-type" as Route
          },
          {
            key: "mgmt-account-type",
            labelKey: "nav.account_type",
            href: "/dashboard/settings/account-type" as Route
          },
          {
            key: "mgmt-goods-group",
            labelKey: "nav.goods_master",
            iconKey: "clipboard-list",
            children: [
              {
                key: "mgmt-goods-master",
                labelKey: "nav.goods_master",
                href: "/dashboard/settings/management/goods" as Route
              },
              {
                key: "mgmt-product-units",
                labelKey: "nav.product_units",
                href: "/dashboard/settings/product-units" as Route,
                permission: { resource: "product_units", action: "read" }
              },
              {
                key: "mgmt-product-brands",
                labelKey: "nav.product_brands",
                href: "/dashboard/settings/product-brands" as Route,
                permission: { resource: "product_brands", action: "read" }
              },
              {
                key: "mgmt-product-categories",
                labelKey: "nav.product_categories",
                href: "/dashboard/settings/product-categories" as Route,
                permission: { resource: "product_categories", action: "read" }
              }
            ]
          },
          {
            key: "mgmt-warehouses",
            labelKey: "nav.warehouses",
            href: "/dashboard/settings/warehouse" as Route,
            permission: { resource: "warehouses", action: "read" }
          },
          {
            key: "mgmt-port-master",
            labelKey: "nav.port_master",
            href: "/dashboard/settings/ports" as Route
          },
          {
            key: "mgmt-tax-setup",
            labelKey: "nav.tax_settings",
            href: "/dashboard/settings/tax" as Route
          }
        ]
      },
      {
        key: "settings-system-settings",
        labelKey: "nav.system_settings",
        iconKey: "layout-dashboard",
        children: [
          {
            key: "settings-dashboard-settings",
            labelKey: "nav.dashboard_settings",
            href: "/dashboard/settings/dashboard-settings" as Route,
            roles: ["super_admin"]
          },
          {
            key: "settings-translations-management",
            labelKey: "nav.translations_management",
            href: "/dashboard/settings/translations" as Route,
            roles: ["super_admin"]
          },
          {
            key: "settings-user-login-management",
            labelKey: "nav.user_login_management",
            href: "/dashboard/users" as Route,
            roles: ["super_admin"]
          },
          {
            key: "settings-form-settings",
            labelKey: "nav.form_settings",
            iconKey: "palette",
            children: [
              {
                key: "settings-template-color",
                labelKey: "nav.template_color",
                href: "/dashboard/settings/template-color" as Route
              },
              {
                key: "template-purple",
                labelKey: "nav.template_purple",
                href: "/dashboard/settings/template-color/purple" as Route
              },
              {
                key: "template-blue",
                labelKey: "nav.template_blue",
                href: "/dashboard/settings/template-color/blue" as Route
              },
              {
                key: "template-green",
                labelKey: "nav.template_green",
                href: "/dashboard/settings/template-color/green" as Route
              },
              {
                key: "template-gold",
                labelKey: "nav.template_gold",
                href: "/dashboard/settings/template-color/gold" as Route
              },
              {
                key: "template-cyan",
                labelKey: "nav.template_cyan",
                href: "/dashboard/settings/template-color/cyan" as Route
              }
            ]
          }
        ]
      }
    ]
  },
  {
    key: "walkthrough-video",
    labelKey: "nav.walkthrough_video",
    iconKey: "video",
    href: "/dashboard/walkthrough-video" as Route
  }
];

function hasRole(roles: EnterpriseRole[] | null, requiredRoles?: EnterpriseRole[]) {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  if (!roles) return true; // demo mode / preview
  return requiredRoles.some((role) => roles.includes(role));
}

function impliedPermission(node: SidebarNode): PermissionRequirement | null {
  const href = String(node.href ?? "");
  const key = node.key;

  if (href.includes("/new-entry/users/registration")) return { resource: "users", action: "create" };
  if (href.includes("/new-entry/users/journal-report")) return { resource: "users", action: "read" };

  if (href.includes("/branch-management/general-report")) return { resource: "reports", action: "read" };
  if (href.includes("/branch-management/org-chart")) return { resource: "reports", action: "read" };
  if (href.includes("/branch-entry/country-branch")) return { resource: "country_branches", action: "create" };
  if (href.includes("/branch-entry/city-branch")) return { resource: "city_branches", action: "create" };
  if (href.includes("/new-entry/branches/super-admin")) return { resource: "countries", action: "create" };

  if (href.includes("/ledger/new")) return { resource: "ledgers", action: "create" };
  if (href.includes("/ledger/")) return { resource: "ledgers", action: "read" };
  if (href.includes("/journal/purchase-order-payment")) return { resource: "purchases", action: "post" };
  if (href.includes("/roznamcha/") && href.includes("/cash-entry")) return { resource: "roznamcha", action: "create" };
  if (href.includes("/roznamcha/")) return { resource: "roznamcha", action: "read" };

  if (href.includes("/purchase/")) return { resource: "purchases", action: key.includes("report") ? "read" : "read" };
  if (href.includes("/sales/")) return { resource: "sales", action: "read" };
  if (href.includes("/reports")) return { resource: "reports", action: "read" };
  if (href.includes("/messages/whatsapp/setup")) return { resource: "whatsapp", action: "delete" };
  if (href.includes("/messages/whatsapp")) return { resource: "whatsapp", action: "read" };
  if (href.includes("/messages")) return { resource: "messages", action: "read" };
  if (href.includes("/settings")) return { resource: "settings", action: "read" };
  if (href.includes("/shipping-line")) return { resource: "shipping_records", action: "read" };

  return null;
}

function hasPermission(permissions: string[] | null, requiredPermission?: PermissionRequirement | null) {
  if (!requiredPermission) return true;
  if (!permissions) return true; // demo mode / preview

  const exact = `${requiredPermission.resource}:${requiredPermission.action}`;
  const resourceWildcard = `${requiredPermission.resource}:*`;
  return permissions.includes(exact) || permissions.includes(resourceWildcard) || permissions.includes("*:*");
}

export function filterSidebarTree(
  nodes: SidebarNode[],
  roles: EnterpriseRole[] | null,
  permissions: string[] | null = null,
  menuVisibility: SidebarMenuVisibilityMap | null = null
): SidebarNode[] {
  return nodes
    .map((node) => {
      if (!hasRole(roles, node.roles)) return null;
      if (!hasPermission(permissions, node.permission ?? impliedPermission(node))) return null;
      if (node.menuSettingKey && menuVisibility?.[node.menuSettingKey] === false) return null;

      const children = node.children ? filterSidebarTree(node.children, roles, permissions, menuVisibility) : undefined;
      const trimmed: SidebarNode = {
        key: node.key,
        labelKey: node.labelKey,
        iconKey: node.iconKey,
        href: node.href,
        roles: node.roles,
        permission: node.permission,
        menuSettingKey: node.menuSettingKey,
        ...(children?.length ? { children } : {})
      };

      // If a node has no href and no remaining children, hide it.
      if (!trimmed.href && !trimmed.children) return null;
      return trimmed;
    })
    .filter((node): node is SidebarNode => node !== null);
}


