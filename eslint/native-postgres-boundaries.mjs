import { noDynamicServerBypass } from './orders-boundaries.mjs';
// Exact named dependencies for the PostgreSQL-only owners; never wildcard feature access.
const scopes = {
  "src/infrastructure/persistence/postgres/text.ts": ["server-only"],
  "src/modules/expenses/infrastructure/postgres/movement-shop-directory.ts": ["server-only", "@/infrastructure/persistence/postgres/database"],
  "src/modules/inventory/infrastructure/postgres/movement-shop-aliases.ts": ["server-only", "@/infrastructure/persistence/postgres/database"],
  "src/composition/employee-directory.ts": [
    "@/composition/postgres/service",
    "@/modules/hr/server",
    "@/modules/inventory/application/ports/employee-directory",
    "server-only"
  ],
  "src/composition/hr-payroll.ts": [
    "./salary-advance-shops",
    "@/composition/postgres/service",
    "@/modules/hr/application/ports/payroll",
    "@/modules/hr/application/ports/salary-advance-shops",
    "@/modules/hr/payroll-server",
    "@/modules/hr/server",
    "@/modules/sales/server",
    "server-only"
  ],
  "src/composition/loyverse-accounts.ts": [
    "@/config",
    "@/infrastructure/configuration/postgres/loyverse-accounts",
    "@/infrastructure/external/loyverse",
    "@/shared/types/loyverse-account",
    "server-only"
  ],
  "src/composition/orders.ts": [
    "@/composition/postgres/service",
    "@/modules/orders/contracts",
    "@/modules/orders/server",
    "@/modules/shipments/infrastructure/postgres/order-detail-shipment-projection",
    "server-only"
  ],
  "src/composition/postgres/service.ts": [
    "@/modules/expenses/infrastructure/postgres/tables",
    "@/modules/hr/infrastructure/postgres/tables",
    "@/modules/inventory/infrastructure/postgres/tables",
    "@/modules/line-workflows/infrastructure/postgres/tables",
    "@/modules/orders/infrastructure/postgres/tables",
    "@/modules/sales/infrastructure/postgres/tables",
    "@/modules/shipments/infrastructure/postgres/tables",
    "server-only"
  ],
  "src/composition/salary-advance-shops.ts": [
    "@/composition/postgres/service",
    "@/modules/expenses/server",
    "@/modules/hr/application/ports/salary-advance-shops",
    "server-only"
  ],
  "src/composition/staging-upload-cleanup.ts": [
    "@/infrastructure/files/google-drive/types",
    "@/infrastructure/persistence/postgres/database",
    "@/infrastructure/persistence/postgres/uploads",
    "server-only"
  ],
  "src/infrastructure/persistence/postgres/native-records.ts": [
    "./database",
    "server-only"
  ],
  "src/modules/expenses/infrastructure/postgres/expense-store.ts": [
    "../../application/ports/expense-store",
    "./storage",
    "@/infrastructure/persistence/postgres/native-records",
    "server-only"
  ],
  "src/modules/expenses/infrastructure/postgres/storage.ts": [
    "./tables",
    "@/infrastructure/persistence/postgres/native-records"
  ],
  "src/modules/expenses/infrastructure/postgres/tables.ts": [
    "@/infrastructure/persistence/postgres/native-records",
    "server-only"
  ],
  "src/modules/expenses/server.ts": [
    "./application/manage-expenses",
    "./contracts",
    "./domain/rules",
    "./infrastructure/postgres/expense-store",
    "./infrastructure/postgres/movement-shop-directory",
    "node:crypto",
    "server-only"
  ],
  "src/modules/hr/infrastructure/postgres/employee-directory-reader.ts": [
    "../../contracts",
    "./storage",
    "server-only"
  ],
  "src/modules/hr/infrastructure/postgres/salary-store.ts": [
    "../../application/ports/payroll",
    "../../contracts",
    "../../domain/salary-rules",
    "./storage",
    "server-only"
  ],
  "src/modules/hr/infrastructure/postgres/storage.ts": [
    "./tables",
    "@/infrastructure/persistence/postgres/native-records"
  ],
  "src/modules/hr/infrastructure/postgres/tables.ts": [
    "@/infrastructure/persistence/postgres/native-records",
    "server-only"
  ],
  "src/modules/hr/infrastructure/postgres/workforce-store.ts": [
    "../../application/ports/workforce",
    "../../contracts",
    "./storage",
    "@/infrastructure/persistence/postgres/native-records",
    "server-only"
  ],
  "src/modules/hr/payroll-server.ts": [
    "./application/calculate-payroll",
    "./application/ports/payroll",
    "./application/ports/salary-advance-shops",
    "./application/salary-advances",
    "./application/settle-payroll",
    "./domain/salary-rules",
    "./infrastructure/payroll-revision",
    "./infrastructure/postgres/salary-store",
    "server-only"
  ],
  "src/modules/hr/server.ts": [
    "./application/attendance",
    "./application/employees",
    "./application/ports/payroll",
    "./contracts",
    "./domain/attendance-rules",
    "./infrastructure/postgres/employee-directory-reader",
    "./infrastructure/postgres/storage",
    "./infrastructure/postgres/workforce-store",
    "./infrastructure/workforce-runtime",
    "server-only"
  ],
  "src/modules/inventory/infrastructure/postgres/adjustments.ts": [
    "../../application/ports/adjustments",
    "../../contracts",
    "../../domain/adjustment-rules",
    "./storage",
    "server-only"
  ],
  "src/modules/inventory/infrastructure/postgres/movement-journeys.ts": [
    "../../application/ports/movement-journeys",
    "../../contracts",
    "./storage",
    "@/infrastructure/persistence/postgres/native-records",
    "server-only"
  ],
  "src/modules/inventory/infrastructure/postgres/movements.ts": [
    "../../application/ports/movements",
    "../../contracts",
    "../../domain/movement-rules",
    "./storage",
    "@/infrastructure/persistence/postgres/native-records",
    "server-only"
  ],
  "src/modules/inventory/infrastructure/postgres/stock-counts.ts": [
    "../../application/ports/stock-counts",
    "../../contracts",
    "./storage",
    "@/infrastructure/persistence/postgres/native-records",
    "server-only"
  ],
  "src/modules/inventory/infrastructure/postgres/storage.ts": [
    "./tables",
    "@/infrastructure/persistence/postgres/native-records"
  ],
  "src/modules/inventory/infrastructure/postgres/tables.ts": [
    "@/infrastructure/persistence/postgres/native-records",
    "server-only"
  ],
  "src/modules/inventory/server.ts": [
    "@/modules/expenses/server",
    "./infrastructure/postgres/movement-shop-aliases",

    "./application/adjustments",
    "./application/list-adjustment-employees",
    "./application/movement-journeys",
    "./application/movements",
    "./application/stock-counts",
    "./contracts",
    "./domain/adjustment-rules",
    "./infrastructure/postgres/adjustments",
    "./infrastructure/postgres/movement-journeys",
    "./infrastructure/postgres/movements",
    "./infrastructure/postgres/stock-counts",
    "./infrastructure/postgres/storage",
    "./quantity",
    "@/modules/hr/server",
    "@/modules/sales/server",
    "node:crypto",
    "server-only"
  ],
  "src/modules/line-workflows/infrastructure/postgres/sessions.ts": [
    "../../application/ports/workflows",
    "../../contracts",
    "./storage",
    "@/infrastructure/persistence/postgres/native-records",
    "@/modules/inventory/contracts",
    "@/modules/orders/contracts",
    "server-only"
  ],
  "src/modules/line-workflows/infrastructure/postgres/storage.ts": [
    "./tables",
    "@/infrastructure/persistence/postgres/native-records"
  ],
  "src/modules/line-workflows/infrastructure/postgres/tables.ts": [
    "@/infrastructure/persistence/postgres/native-records",
    "server-only"
  ],
  "src/modules/line-workflows/infrastructure/postgres/webhook.ts": [
    "../../application/webhook",
    "@/infrastructure/persistence/postgres/commands",
    "@/infrastructure/persistence/postgres/database",
    "@/infrastructure/persistence/postgres/effects",
    "@/infrastructure/persistence/postgres/uploads",
    "@/shared/types/line-protocol",
    "server-only"
  ],
  "src/modules/line-workflows/server.ts": [
    "@/modules/expenses/server",

    "./application/classify-event",
    "./application/movement-events",
    "./application/order-events",
    "./application/order-events/bill-image",
    "./application/order-events/complete-bill",
    "./application/order-events/complete-products",
    "./application/order-events/create-order",
    "./application/order-events/product-image",
    "./application/order-events/total-price",
    "./application/ports/workflows",
    "./application/reply",
    "./application/resolve-user-state",
    "./application/sessions",
    "./commands",
    "./contracts",
    "./domain/payload",
    "./infrastructure/payload",
    "./infrastructure/postgres/sessions",
    "./infrastructure/postgres/storage",
    "./infrastructure/postgres/webhook",
    "./infrastructure/runtime",
    "@/config",
    "@/infrastructure/external/line",
    "@/infrastructure/files/google-drive/types",
    "@/infrastructure/runtime/create-sortable-id",
    "@/modules/inventory/server",
    "@/modules/orders/contracts",
    "@/modules/orders/server",
    "@/shared/types/line-protocol",
    "server-only"
  ],
  "src/modules/orders/infrastructure/postgres/order-attachments.ts": [
    "../../application/ports/order-attachments",
    "./storage",
    "server-only"
  ],
  "src/modules/orders/infrastructure/postgres/order-detail-reader.ts": [
    "../../application/ports/order-detail-reader",
    "../../contracts",
    "./order-row-mapping",
    "./storage",
    "@/infrastructure/persistence/postgres/native-records",
    "server-only"
  ],
  "src/modules/orders/infrastructure/postgres/order-list-reader.ts": [
    "@/infrastructure/persistence/postgres/database",
    "@/infrastructure/persistence/postgres/text",
    "../../application/ports/order-list-reader",
    "../../contracts",
    "./order-row-mapping",
    "./storage",
    "@/infrastructure/persistence/postgres/native-records",
    "server-only"
  ],
  "src/modules/orders/infrastructure/postgres/order-mutations.ts": [
    "../../application/ports/order-mutations",
    "./storage",
    "@/infrastructure/persistence/postgres/native-records",
    "server-only"
  ],
  "src/modules/orders/infrastructure/postgres/order-row-mapping.ts": [
    "../../contracts",
    "@/infrastructure/persistence/postgres/native-records",
    "server-only"
  ],
  "src/modules/orders/infrastructure/postgres/order-writer.ts": [
    "../../application/ports/created-order-writer",
    "../../contracts",
    "./storage",
    "server-only"
  ],
  "src/modules/orders/infrastructure/postgres/storage.ts": [
    "./tables",
    "@/infrastructure/persistence/postgres/native-records"
  ],
  "src/modules/orders/infrastructure/postgres/tables.ts": [
    "@/infrastructure/persistence/postgres/native-records",
    "server-only"
  ],
  "src/modules/orders/infrastructure/postgres/order-image-uploads.ts": [
    "../../contracts",
    "@/infrastructure/persistence/postgres/commands",
    "@/infrastructure/persistence/postgres/database",
    "server-only"
  ],
  "src/modules/orders/server.ts": [
    "./application/create-order",
    "./application/get-order-detail",
    "./application/list-orders",
    "./application/order-attachments",
    "./application/order-images",
    "./application/order-mutations",
    "./application/ports/order-detail-shipment-projection",
    "./application/ports/order-images",
    "./application/replace-product-image",
    "./contracts",
    "./infrastructure/google-drive/order-images",
    "./infrastructure/postgres/order-attachments",
    "./infrastructure/postgres/order-image-uploads",
    "./infrastructure/postgres/order-detail-reader",
    "./infrastructure/postgres/order-list-reader",
    "./infrastructure/postgres/order-mutations",
    "./infrastructure/postgres/order-writer",
    "./infrastructure/postgres/storage",
    "@/infrastructure/files/google-drive/types",
    "@/infrastructure/runtime/create-sortable-id",
    "server-only"
  ],
  "src/modules/sales/infrastructure/postgres/cost-overrides.ts": [
    "../../application/ports/cost-overrides",
    "../../contracts",
    "./storage",
    "@/infrastructure/persistence/postgres/native-records",
    "server-only"
  ],
  "src/modules/sales/infrastructure/postgres/receipt-record-mapping.ts": [
    "../../application/ports/receipt-source"
  ],
  "src/modules/sales/infrastructure/postgres/receipt-payment.ts": [
    "@/infrastructure/persistence/postgres/database",
    "@/infrastructure/persistence/postgres/native-records",
    "@/shared/lib/utc-timestamp",
    "server-only"
  ],
  "src/modules/sales/infrastructure/postgres/receipt-sync.ts": [
    "./receipt-payment",
    "@/infrastructure/persistence/postgres/database",
    "../../application/ports/receipt-source",
    "../../application/ports/receipt-sync",
    "../../application/receipts-for-date",
    "../../domain/receipt-ids",
    "./receipt-record-mapping",
    "./storage",
    "@/infrastructure/persistence/postgres/native-records",
    "server-only"
  ],
  "src/modules/sales/infrastructure/postgres/sales-reader.ts": [
    "@/infrastructure/persistence/postgres/text",
    "./receipt-payment",
    "@/infrastructure/persistence/postgres/database",
    "../../application/ports/sales-reader",
    "./storage",
    "server-only"
  ],
  "src/modules/sales/infrastructure/postgres/storage.ts": [
    "./tables",
    "@/infrastructure/persistence/postgres/native-records"
  ],
  "src/modules/sales/infrastructure/postgres/sync-status.ts": [
    "../../application/ports/sync-status",
    "../../contracts",
    "./storage",
    "@/infrastructure/persistence/postgres/native-records",
    "server-only"
  ],
  "src/modules/sales/infrastructure/postgres/tables.ts": [
    "@/infrastructure/persistence/postgres/native-records",
    "server-only"
  ],
  "src/modules/sales/server.ts": [
    "./application/cost-overrides",
    "./application/ports/receipt-source",
    "./application/ports/receipt-sync",
    "./application/receipts-for-date",
    "./application/reports",
    "./application/project-profit-expenses",
    "./application/sync-receipts",
    "./application/sync-status",
    "./contracts",
    "./infrastructure/postgres/cost-overrides",
    "./infrastructure/postgres/receipt-sync",
    "./infrastructure/postgres/sales-reader",
    "./infrastructure/postgres/storage",
    "./infrastructure/postgres/sync-status",
    "@/infrastructure/external/loyverse",
    "@/modules/expenses/contracts",
    "node:crypto",
    "server-only"
  ],
  "src/modules/shipments/infrastructure/postgres/order-detail-shipment-projection.ts": [
    "../../contracts",
    "./storage",
    "@/infrastructure/persistence/postgres/native-records",
    "@/modules/orders/application/ports/order-detail-shipment-projection",
    "@/modules/orders/contracts",
    "server-only"
  ],
  "src/modules/shipments/infrastructure/postgres/shipment-list-reader.ts": [
    "../../application/ports/shipment-list-reader",
    "../../contracts",
    "./storage",
    "@/infrastructure/persistence/postgres/native-records",
    "@/modules/orders/contracts",
    "server-only"
  ],
  "src/modules/shipments/infrastructure/postgres/shipment-order-link-store.ts": [
    "../../application/ports/shipment-order-link-store",
    "../../contracts",
    "./storage",
    "@/infrastructure/persistence/postgres/native-records",
    "server-only"
  ],
  "src/modules/shipments/infrastructure/postgres/shipment-status-store.ts": [
    "../../application/ports/shipment-status-store",
    "./storage",
    "server-only"
  ],
  "src/modules/shipments/infrastructure/postgres/shipment-writer.ts": [
    "../../application/ports/created-shipment-writer",
    "../../contracts",
    "./storage",
    "server-only"
  ],
  "src/modules/shipments/infrastructure/postgres/storage.ts": [
    "./tables",
    "@/infrastructure/persistence/postgres/native-records"
  ],
  "src/modules/shipments/infrastructure/postgres/tables.ts": [
    "@/infrastructure/persistence/postgres/native-records",
    "server-only"
  ],
  "src/modules/shipments/server.ts": [
    "./application/advance-shipment-status-with-bill",
    "./application/create-shipment",
    "./application/link-order-to-shipment",
    "./application/list-shipments",
    "./application/update-shipment-status",
    "./contracts",
    "./infrastructure/google-drive/shipment-bill-storage",
    "./infrastructure/postgres/shipment-list-reader",
    "./infrastructure/postgres/shipment-order-link-store",
    "./infrastructure/postgres/shipment-status-store",
    "./infrastructure/postgres/shipment-writer",
    "./infrastructure/postgres/storage",
    "@/infrastructure/files/google-drive/types",
    "@/infrastructure/runtime/create-sortable-id",
    "server-only"
  ]
};
const escape = value => [...value].map(character => "\\^$.*+?()[]{}|".includes(character) ? "\\" + character : character).join("");
export const nativePostgresBoundaries = Object.entries(scopes).map(([file, allowed]) => ({
  files: [file],
  rules: {
    "no-restricted-imports": ["error", { patterns: [{ regex: "^(?!(?:" + allowed.map(escape).join("|") + ")$).+", message: "Use the exact native PostgreSQL feature dependencies." }] }],
    "no-restricted-syntax": [...noDynamicServerBypass, { selector: "ExportDefaultDeclaration, ExportAllDeclaration", message: "Keep native dependencies and exports named." }],
  },
}));
