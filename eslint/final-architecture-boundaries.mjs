import { noDynamicServerBypass } from './orders-boundaries.mjs';
const scopes = {
    "src/services/employees/payroll-composition.ts": [
        "server-only",
        "@/composition/hr-payroll"
    ],
    "src/services/employees/salary-advance-shops.ts": [
        "server-only",
        "@/composition/salary-advance-shops"
    ],
    "src/services/stock-adjustments/employee-directory.ts": [
        "server-only",
        "@/composition/employee-directory"
    ],
    "src/services/orders/listOrders.ts": [
        "server-only",
        "@/composition/orders"
    ],
    "src/services/utils/createSortableId.ts": [
        "@/infrastructure/runtime/create-sortable-id"
    ],
    "src/features/backend/shipments/utils.ts": [
        "@/modules/shipments/http"
    ],
    "src/scripts/line-rich-menu-client.ts": [
        "../infrastructure/external/line/LineRichMenuClient.ts"
    ],
    "src/composition/google-sheets/GoogleSheetsService.ts": [
        "@/modules/inventory/infrastructure/google-sheets/stock-adjustments/StockAdjustmentsSheet",
        "@/modules/hr/infrastructure/google-sheets/employee-advances/PayrollRecordsSheet",
        "@/modules/expenses/infrastructure/google-sheets/expenses/RecordsSheet",
        "@/infrastructure/persistence/google-sheets/google-auth/GoogleServiceAccountAuth",
        "@/infrastructure/persistence/google-sheets/client",
        "@/infrastructure/persistence/google-sheets/const",
        "@/modules/hr/infrastructure/google-sheets/employee-compensations/EmployeeCompensationsSheet",
        "@/modules/hr/infrastructure/google-sheets/employees/EmployeesSheet",
        "@/modules/hr/infrastructure/google-sheets/employee-timesheets/EmployeeTimesheetsSheet",
        "@/modules/orders/infrastructure/google-sheets/order-bills/OrderBillsSheet",
        "@/modules/orders/infrastructure/google-sheets/order-items/OrderItemsSheet",
        "@/modules/orders/infrastructure/google-sheets/orders/OrdersSheet",
        "@/modules/sales/infrastructure/google-sheets/receipt-items/SalesReceiptItemsSheet",
        "@/modules/sales/infrastructure/google-sheets/profit-cost-overrides/SalesProfitCostOverridesSheet",
        "@/modules/sales/infrastructure/google-sheets/receipt-payments/SalesReceiptPaymentsSheet",
        "@/modules/sales/infrastructure/google-sheets/receipts/SalesReceiptsSheet",
        "@/modules/sales/infrastructure/google-sheets/receipt-syncs/SalesReceiptSyncsSheet",
        "@/modules/shipments/infrastructure/google-sheets/shipment-orders/ShipmentOrdersSheet",
        "@/modules/shipments/infrastructure/google-sheets/shipments/ShipmentsSheet",
        "@/modules/inventory/infrastructure/google-sheets/stock-counts/StockCountsSheet",
        "@/modules/line-workflows/infrastructure/google-sheets/user-state/UserStateSheet",
        "@/modules/inventory/infrastructure/google-sheets/movements/MovementSheet",
        "@/infrastructure/persistence/google-sheets/service-contracts"
    ],
    "src/composition/google-sheets/createGoogleSheetsServiceFromConfig.ts": [
        "@/config",
        "./GoogleSheetsService"
    ],
    "src/composition/hr-payroll.ts": [
        "server-only",
        "@/infrastructure/persistence/google-sheets/service-contracts",
        "@/modules/hr/application/ports/salary-advance-shops",
        "@/modules/hr/application/ports/payroll",
        "@/modules/hr/payroll-server",
        "@/modules/hr/server",
        "@/modules/sales/server",
        "./salary-advance-shops"
    ],
    "src/composition/salary-advance-shops.ts": [
        "server-only",
        "@/infrastructure/persistence/google-sheets/service-contracts",
        "@/modules/hr/application/ports/salary-advance-shops",
        "@/modules/expenses/server"
    ],
    "src/composition/employee-directory.ts": [
        "server-only",
        "@/infrastructure/persistence/google-sheets/service-contracts",
        "@/modules/inventory/application/ports/employee-directory",
        "@/modules/hr/server"
    ],
    "src/composition/orders.ts": [
        "server-only",
        "@/infrastructure/persistence/google-sheets/service-contracts",
        "@/modules/orders/contracts",
        "@/modules/orders/server",
        "@/modules/shipments/infrastructure/google-sheets/order-detail-shipment-projection"
    ],
    "src/infrastructure/runtime/create-sortable-id.ts": [
        "node:crypto"
    ],
    "src/modules/shipments/http.ts": [
        "./contracts"
    ],
    "src/infrastructure/external/line/LineRichMenuClient.ts": [
        "./types"
    ],
    "src/composition/google-sheets/index.ts": [
        "./GoogleSheetsService",
        "./createGoogleSheetsServiceFromConfig",
        "@/infrastructure/persistence/google-sheets/service-contracts"
    ],
    "src/modules/line-workflows/server.ts": [
        "server-only",
        "@/infrastructure/persistence/google-sheets/service-contracts",
        "@/infrastructure/files/google-drive/types",
        "@/infrastructure/external/line",
        "@/shared/types/line-protocol",
        "@/config",
        "@/infrastructure/runtime/create-sortable-id",
        "@/modules/orders/contracts",
        "@/modules/orders/server",
        "@/modules/inventory/server",
        "./contracts",
        "./application/ports/workflows",
        "./infrastructure/google-sheets/sessions",
        "./infrastructure/runtime",
        "./application/sessions",
        "./application/order-events",
        "./application/movement-events",
        "./application/classify-event",
        "./application/resolve-user-state",
        "./application/reply",
        "./application/order-events/complete-bill",
        "./application/order-events/complete-products",
        "./application/order-events/create-order",
        "./application/order-events/bill-image",
        "./application/order-events/product-image",
        "./application/order-events/total-price",
        "./infrastructure/payload",
        "./domain/payload",
        "./commands",
        "./application/webhook"
    ],
    "src/modules/orders/server.ts": [
        "server-only",
        "@/infrastructure/persistence/google-sheets/service-contracts",
        "@/infrastructure/runtime/create-sortable-id",
        "./contracts",
        "./application/create-order",
        "./application/list-orders",
        "./infrastructure/google-sheets/order-list-reader",
        "./infrastructure/google-sheets/order-writer",
        "./application/get-order-detail",
        "./application/ports/order-detail-shipment-projection",
        "./infrastructure/google-sheets/order-detail-reader",
        "./application/order-mutations",
        "./infrastructure/google-sheets/order-mutations",
        "./application/order-attachments",
        "./infrastructure/google-sheets/order-attachments",
        "@/infrastructure/files/google-drive/types",
        "./application/ports/order-images",
        "./application/order-images",
        "./application/replace-product-image",
        "./infrastructure/google-drive/order-images"
    ],
    "src/modules/shipments/server.ts": [
        "server-only",
        "@/infrastructure/persistence/google-sheets/service-contracts",
        "@/infrastructure/runtime/create-sortable-id",
        "./contracts",
        "./application/create-shipment",
        "./infrastructure/google-sheets/shipment-writer",
        "./application/list-shipments",
        "./infrastructure/google-sheets/shipment-list-reader",
        "./application/link-order-to-shipment",
        "./infrastructure/google-sheets/shipment-order-link-store",
        "./application/update-shipment-status",
        "./infrastructure/google-sheets/shipment-status-store",
        "@/infrastructure/files/google-drive/types",
        "./application/advance-shipment-status-with-bill",
        "./infrastructure/google-drive/shipment-bill-storage"
    ],
    "src/modules/hr/infrastructure/google-sheets/employee-directory-reader.ts": [
        "server-only",
        "@/infrastructure/persistence/google-sheets/service-contracts",
        "@/modules/hr/infrastructure/google-sheets/employees/const",
        "../../contracts"
    ],
    "src/modules/orders/infrastructure/google-sheets/order-writer.ts": [
        "server-only",
        "@/infrastructure/persistence/google-sheets/service-contracts",
        "@/infrastructure/persistence/google-sheets/const",
        "@/modules/orders/infrastructure/google-sheets/orders/const",
        "../../contracts",
        "../../application/ports/created-order-writer"
    ],
    "src/modules/shipments/infrastructure/google-drive/shipment-bill-storage.ts": [
        "server-only",
        "@/infrastructure/files/google-drive/types",
        "../../application/ports/shipment-bill-storage"
    ],
    "src/modules/shipments/infrastructure/google-sheets/shipment-order-link-store.ts": [
        "server-only",
        "@/infrastructure/persistence/google-sheets/service-contracts",
        "@/infrastructure/persistence/google-sheets/const",
        "@/modules/shipments/infrastructure/google-sheets/shipment-orders/const",
        "../../contracts",
        "../../application/ports/shipment-order-link-store"
    ],
    "src/modules/shipments/infrastructure/google-sheets/shipment-writer.ts": [
        "server-only",
        "@/infrastructure/persistence/google-sheets/service-contracts",
        "@/infrastructure/persistence/google-sheets/const",
        "@/modules/shipments/infrastructure/google-sheets/shipments/const",
        "../../contracts",
        "../../application/ports/created-shipment-writer"
    ]
};
const only = paths => ['error', { paths: paths.includes('@/infrastructure/persistence/google-sheets/service-contracts') ? [{ name: '@/infrastructure/persistence/google-sheets/service-contracts', allowTypeImports: true, message: 'Erase aggregate compatibility interfaces.' }] : [], patterns: [{ regex: paths.length ? `^(?!(?:${paths.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$).+` : '.+', message: 'Use canonical composition/transport and exact named dependencies.' }] }];
export const finalArchitectureBoundaries = [...Object.entries(scopes).map(([file, paths]) => ({ files: [file], rules: { 'no-restricted-imports': only(paths) } })),
    { plugins: { 'final-architecture': { rules: { imports: { create(context) { const file = context.filename; return { ImportDeclaration(node) { check(node.source, node); }, ExportNamedDeclaration(node) { if (node.source)
                                check(node.source, node); } }; function check(source, node) { const spec = source.value; const core = /\/(application|domain)\//.test(file), active = /\/(app|config)\//.test(file); if ((core && /(^|\/)(services|externals|config|composition|infrastructure)(\/|$)|(^|\/)server$/.test(spec)) || (active && /(^|\/)(services|externals)(\/|$)|features\/backend\//.test(spec)))
                            context.report({ node, message: 'Use canonical composition and consumer-owned application ports.' }); } } }, facades: { create(context) { return { FunctionDeclaration(node) { fail(node); }, ClassDeclaration(node) { fail(node); }, ExportAllDeclaration(node) { fail(node); }, VariableDeclarator(node) { if (['ArrowFunctionExpression', 'FunctionExpression'].includes(node.init?.type))
                                fail(node); } }; function fail(node) { context.report({ node, message: 'Legacy business paths retain named compatibility bindings only.' }); } } } } } } },
    { files: ['src/app/**/*.{ts,tsx}', 'src/config/**/*.ts', 'src/modules/*/application/**/*.ts', 'src/modules/*/domain/**/*.ts'], rules: { 'final-architecture/imports': 'error' } },
    { files: ['src/modules/shipments/http.ts'], rules: { 'no-restricted-syntax': [...noDynamicServerBypass, { selector: 'ExportAllDeclaration', message: 'Expose named HTTP helpers.' }], 'no-restricted-globals': ['error', 'process', 'Buffer', 'fetch'] } },
    { files: ['src/services/employees/payroll-composition.ts', 'src/services/stock-adjustments/employee-directory.ts'], rules: { 'no-restricted-syntax': [...noDynamicServerBypass, { selector: 'ExportAllDeclaration', message: 'Keep compatibility exports named.' }] } },
    { files: ['src/composition/hr-payroll.ts', 'src/composition/employee-directory.ts'], rules: { 'no-restricted-syntax': [...noDynamicServerBypass, { selector: 'ExportNamedDeclaration[source]', message: 'Physical composition owns its implementations.' }, { selector: 'ExportAllDeclaration', message: 'Keep exports named.' }] } },
    { files: ['src/services/**/*.ts', 'src/features/backend/**/*.ts'], rules: { 'final-architecture/facades': 'error' } }
];
