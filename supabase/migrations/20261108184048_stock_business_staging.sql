-- Private migration target; deliberately excluded from runtime composition and Data API.
CREATE SCHEMA stock_migration;
REVOKE ALL ON SCHEMA stock_migration FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA stock_migration REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
CREATE TABLE stock_migration.import_batches (checksum text PRIMARY KEY CHECK (length(checksum)=64), workbook text NOT NULL, snapshot jsonb NOT NULL, imported_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE stock_migration.orders (
  "id" text PRIMARY KEY CHECK (id <> ''),
  "status" text,
  "seller" text,
  "totalPrice" numeric,
  "remark" text,
  "createdAt" text,
  "updatedAt" text,
  "deletedAt" text,
  "createdBy" text,
  source_workbook text NOT NULL,
  source_row bigint NOT NULL CHECK (source_row >= 2),
  source_cells jsonb NOT NULL CHECK (jsonb_typeof(source_cells) = 'array')
);
CREATE UNIQUE INDEX orders_source ON stock_migration.orders (source_workbook, source_row);
CREATE TABLE stock_migration.order_items (
  "id" text PRIMARY KEY CHECK (id <> ''),
  "orderId" text NOT NULL,
  "imageUrl" text,
  "quoteQuantity" numeric,
  "deliveredQuantity" numeric,
  "productCode" text,
  "createdAt" text,
  "updatedAt" text,
  "deletedAt" text,
  "createdBy" text,
  source_workbook text NOT NULL,
  source_row bigint NOT NULL CHECK (source_row >= 2),
  source_cells jsonb NOT NULL CHECK (jsonb_typeof(source_cells) = 'array')
);
CREATE UNIQUE INDEX order_items_source ON stock_migration.order_items (source_workbook, source_row);
CREATE TABLE stock_migration.order_bills (
  "id" text PRIMARY KEY CHECK (id <> ''),
  "orderId" text NOT NULL,
  "imageUrl" text,
  "createdAt" text,
  "updatedAt" text,
  "deletedAt" text,
  "createdBy" text,
  source_workbook text NOT NULL,
  source_row bigint NOT NULL CHECK (source_row >= 2),
  source_cells jsonb NOT NULL CHECK (jsonb_typeof(source_cells) = 'array')
);
CREATE UNIQUE INDEX order_bills_source ON stock_migration.order_bills (source_workbook, source_row);
CREATE TABLE stock_migration.shipments (
  "id" text PRIMARY KEY CHECK (id <> ''),
  "status" text,
  "carrier" text,
  "poNumber" text,
  "shippingFee" numeric,
  "remark" text,
  "shippedAt" text,
  "deliveredAt" text,
  "createdAt" text,
  "updatedAt" text,
  "deletedAt" text,
  "createdBy" text,
  "shippingBillUrl" text,
  source_workbook text NOT NULL,
  source_row bigint NOT NULL CHECK (source_row >= 2),
  source_cells jsonb NOT NULL CHECK (jsonb_typeof(source_cells) = 'array')
);
CREATE UNIQUE INDEX shipments_source ON stock_migration.shipments (source_workbook, source_row);
CREATE TABLE stock_migration.shipment_orders (
  "id" text PRIMARY KEY CHECK (id <> ''),
  "shipmentId" text NOT NULL,
  "orderId" text NOT NULL,
  "createdAt" text,
  "updatedAt" text,
  "deletedAt" text,
  "createdBy" text,
  source_workbook text NOT NULL,
  source_row bigint NOT NULL CHECK (source_row >= 2),
  source_cells jsonb NOT NULL CHECK (jsonb_typeof(source_cells) = 'array')
);
CREATE UNIQUE INDEX shipment_orders_source ON stock_migration.shipment_orders (source_workbook, source_row);
CREATE TABLE stock_migration.employees (
  "id" text PRIMARY KEY CHECK (id <> ''),
  "name" text,
  "phone" text,
  "status" text,
  "hiredDate" text,
  "terminatedDate" text,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" text,
  source_workbook text NOT NULL,
  source_row bigint NOT NULL CHECK (source_row >= 2),
  source_cells jsonb NOT NULL CHECK (jsonb_typeof(source_cells) = 'array')
);
CREATE UNIQUE INDEX employees_source ON stock_migration.employees (source_workbook, source_row);
CREATE TABLE stock_migration.employee_compensations (
  migration_id text PRIMARY KEY,
  "employeeId" text NOT NULL,
  "baseSalary" numeric,
  "commission" numeric,
  "createdAt" text,
  "updatedAt" text,
  "updatedBy" text,
  "effectiveFrom" text,
  "compensationType" text,
  "commissionType" text,
  "commissionBucketSales" numeric,
  "commissionBucketAmount" numeric,
  "commissionRoundupThreshold" numeric,
  source_workbook text NOT NULL,
  source_row bigint NOT NULL CHECK (source_row >= 2),
  source_cells jsonb NOT NULL CHECK (jsonb_typeof(source_cells) = 'array')
);
CREATE UNIQUE INDEX employee_compensations_source ON stock_migration.employee_compensations (source_workbook, source_row);
CREATE TABLE stock_migration.employee_timesheets (
  "id" text PRIMARY KEY CHECK (id <> ''),
  "employeeId" text NOT NULL,
  "shopId" text,
  "status" text,
  "createdAt" text,
  "updatedAt" text,
  "workdayType" text,
  source_workbook text NOT NULL,
  source_row bigint NOT NULL CHECK (source_row >= 2),
  source_cells jsonb NOT NULL CHECK (jsonb_typeof(source_cells) = 'array')
);
CREATE UNIQUE INDEX employee_timesheets_source ON stock_migration.employee_timesheets (source_workbook, source_row);
CREATE TABLE stock_migration.employee_advances (
  "id" text PRIMARY KEY CHECK (id <> ''),
  "employeeId" text NOT NULL,
  "shopId" text,
  "requestedDate" text,
  "payrollMonth" text,
  "requestedAmount" numeric,
  "paidAmount" numeric,
  "status" text,
  "paidDate" text,
  "reference" text,
  "note" text,
  "createdAt" text,
  "updatedAt" text,
  source_workbook text NOT NULL,
  source_row bigint NOT NULL CHECK (source_row >= 2),
  source_cells jsonb NOT NULL CHECK (jsonb_typeof(source_cells) = 'array')
);
CREATE UNIQUE INDEX employee_advances_source ON stock_migration.employee_advances (source_workbook, source_row);
CREATE TABLE stock_migration.payroll_settlements (
  "id" text PRIMARY KEY CHECK (id <> ''),
  "employeeId" text NOT NULL,
  "month" text,
  "paidDate" text,
  "reference" text,
  "createdAt" text,
  "snapshot" jsonb,
  source_workbook text NOT NULL,
  source_row bigint NOT NULL CHECK (source_row >= 2),
  source_cells jsonb NOT NULL CHECK (jsonb_typeof(source_cells) = 'array')
);
CREATE UNIQUE INDEX payroll_settlements_source ON stock_migration.payroll_settlements (source_workbook, source_row);
CREATE TABLE stock_migration.expenses (
  "id" text PRIMARY KEY CHECK (id <> ''),
  "month" text,
  "expenseDate" text,
  "shopId" text,
  "scope" text,
  "categoryId" text,
  "name" text,
  "amount" numeric,
  "note" text,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" text,
  "deletedAt" text,
  source_workbook text NOT NULL,
  source_row bigint NOT NULL CHECK (source_row >= 2),
  source_cells jsonb NOT NULL CHECK (jsonb_typeof(source_cells) = 'array')
);
CREATE UNIQUE INDEX expenses_source ON stock_migration.expenses (source_workbook, source_row);
CREATE TABLE stock_migration.expense_categories (
  "id" text PRIMARY KEY CHECK (id <> ''),
  "name" text,
  "active" boolean,
  "createdAt" text,
  "updatedAt" text,
  source_workbook text NOT NULL,
  source_row bigint NOT NULL CHECK (source_row >= 2),
  source_cells jsonb NOT NULL CHECK (jsonb_typeof(source_cells) = 'array')
);
CREATE UNIQUE INDEX expense_categories_source ON stock_migration.expense_categories (source_workbook, source_row);
CREATE TABLE stock_migration.shops (
  "id" text PRIMARY KEY CHECK (id <> ''),
  "name" text,
  "active" boolean,
  "loyverseAccountId" text,
  "createdAt" text,
  "updatedAt" text,
  source_workbook text NOT NULL,
  source_row bigint NOT NULL CHECK (source_row >= 2),
  source_cells jsonb NOT NULL CHECK (jsonb_typeof(source_cells) = 'array')
);
CREATE UNIQUE INDEX shops_source ON stock_migration.shops (source_workbook, source_row);
CREATE TABLE stock_migration.sales_receipts (
  "id" text PRIMARY KEY CHECK (id <> ''),
  "salesDate" text,
  "accountId" text,
  "shopName" text,
  "receiptNumber" text,
  "receiptType" text,
  "refundFor" text,
  "order" text,
  "receiptDate" text,
  "createdAt" text,
  "updatedAt" text,
  "cancelledAt" text,
  "source" text,
  "storeId" text,
  "employeeId" text,
  "customerId" text,
  "posDeviceId" text,
  "diningOption" text,
  "totalMoney" numeric,
  "totalTax" numeric,
  "totalDiscount" numeric,
  "tip" numeric,
  "surcharge" numeric,
  "pointsEarned" numeric,
  "pointsDeducted" numeric,
  "syncedAt" text,
  source_workbook text NOT NULL,
  source_row bigint NOT NULL CHECK (source_row >= 2),
  source_cells jsonb NOT NULL CHECK (jsonb_typeof(source_cells) = 'array')
);
CREATE UNIQUE INDEX sales_receipts_source ON stock_migration.sales_receipts (source_workbook, source_row);
CREATE TABLE stock_migration.sales_receipt_items (
  "id" text PRIMARY KEY CHECK (id <> ''),
  "receiptId" text NOT NULL,
  "lineItemId" text,
  "itemId" text,
  "variantId" text,
  "itemName" text,
  "variantName" text,
  "sku" text,
  "quantity" numeric,
  "price" numeric,
  "grossTotalMoney" numeric,
  "totalDiscount" numeric,
  "totalMoney" numeric,
  "cost" numeric,
  "costTotal" numeric,
  "taxes" numeric,
  "lineNote" text,
  "lineDiscountsJson" jsonb,
  "lineTaxesJson" jsonb,
  "lineModifiersJson" jsonb,
  "syncedAt" text,
  source_workbook text NOT NULL,
  source_row bigint NOT NULL CHECK (source_row >= 2),
  source_cells jsonb NOT NULL CHECK (jsonb_typeof(source_cells) = 'array')
);
CREATE UNIQUE INDEX sales_receipt_items_source ON stock_migration.sales_receipt_items (source_workbook, source_row);
CREATE TABLE stock_migration.sales_receipt_payments (
  "id" text PRIMARY KEY CHECK (id <> ''),
  "receiptId" text NOT NULL,
  "paymentIndex" bigint,
  "paymentTypeId" text,
  "paymentName" text,
  "paymentType" text,
  "moneyAmount" numeric,
  "paidAt" text,
  "paymentDetailsJson" jsonb,
  "syncedAt" text,
  source_workbook text NOT NULL,
  source_row bigint NOT NULL CHECK (source_row >= 2),
  source_cells jsonb NOT NULL CHECK (jsonb_typeof(source_cells) = 'array')
);
CREATE UNIQUE INDEX sales_receipt_payments_source ON stock_migration.sales_receipt_payments (source_workbook, source_row);
CREATE TABLE stock_migration.sales_receipt_syncs (
  "id" text PRIMARY KEY CHECK (id <> ''),
  "salesDate" text,
  "accountId" text,
  "shopName" text,
  "status" text,
  "receiptCount" bigint,
  "itemCount" bigint,
  "paymentCount" bigint,
  "syncedAt" text,
  source_workbook text NOT NULL,
  source_row bigint NOT NULL CHECK (source_row >= 2),
  source_cells jsonb NOT NULL CHECK (jsonb_typeof(source_cells) = 'array')
);
CREATE UNIQUE INDEX sales_receipt_syncs_source ON stock_migration.sales_receipt_syncs (source_workbook, source_row);
CREATE TABLE stock_migration.sales_profit_cost_overrides (
  "id" text PRIMARY KEY CHECK (id <> ''),
  "month" text,
  "accountId" text,
  "averageItemCost" numeric,
  "note" text,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" text,
  source_workbook text NOT NULL,
  source_row bigint NOT NULL CHECK (source_row >= 2),
  source_cells jsonb NOT NULL CHECK (jsonb_typeof(source_cells) = 'array')
);
CREATE UNIQUE INDEX sales_profit_cost_overrides_source ON stock_migration.sales_profit_cost_overrides (source_workbook, source_row);
CREATE TABLE stock_migration.stock_counts (
  "id" text PRIMARY KEY CHECK (id <> ''),
  "month" text,
  "accountId" text,
  "shopName" text,
  "physicalCount" numeric,
  "note" text,
  "countedAt" text,
  "updatedAt" text,
  "updatedBy" text,
  source_workbook text NOT NULL,
  source_row bigint NOT NULL CHECK (source_row >= 2),
  source_cells jsonb NOT NULL CHECK (jsonb_typeof(source_cells) = 'array')
);
CREATE UNIQUE INDEX stock_counts_source ON stock_migration.stock_counts (source_workbook, source_row);
CREATE TABLE stock_migration.stock_adjustments (
  "id" text PRIMARY KEY CHECK (id <> ''),
  "accountId" text,
  "shopName" text,
  "date" text,
  "direction" text,
  "reason" text,
  "employeeId" text,
  "employeeName" text,
  "quantity" numeric,
  "itemDescription" text,
  "photoUrl" text,
  "note" text,
  "reversesId" text,
  "replacesId" text,
  "createdAt" text,
  "createdBy" text,
  "notInLoyverse" boolean,
  source_workbook text NOT NULL,
  source_row bigint NOT NULL CHECK (source_row >= 2),
  source_cells jsonb NOT NULL CHECK (jsonb_typeof(source_cells) = 'array')
);
CREATE UNIQUE INDEX stock_adjustments_source ON stock_migration.stock_adjustments (source_workbook, source_row);
CREATE TABLE stock_migration.movements (
  "id" text PRIMARY KEY CHECK (id <> ''),
  "userId" text,
  "packingDate" text,
  "deliverDateTime" text,
  "status" text,
  "totalQuantity" numeric,
  "createdAt" text,
  "updatedAt" text,
  source_workbook text NOT NULL,
  source_row bigint NOT NULL CHECK (source_row >= 2),
  source_cells jsonb NOT NULL CHECK (jsonb_typeof(source_cells) = 'array')
);
CREATE UNIQUE INDEX movements_source ON stock_migration.movements (source_workbook, source_row);
CREATE TABLE stock_migration.movement_details (
  "id" text PRIMARY KEY CHECK (id <> ''),
  "movementMasterId" text NOT NULL,
  "shopName" text,
  "quantity" numeric,
  "remark" text,
  "fromLocation" text,
  "toLocation" text,
  "productImageUrl" text,
  "purchaseDetailId" text,
  "status" text,
  "createdAt" text,
  "updatedAt" text,
  "stockCounted" boolean,
  "isNewArrival" boolean,
  source_workbook text NOT NULL,
  source_row bigint NOT NULL CHECK (source_row >= 2),
  source_cells jsonb NOT NULL CHECK (jsonb_typeof(source_cells) = 'array')
);
CREATE UNIQUE INDEX movement_details_source ON stock_migration.movement_details (source_workbook, source_row);
CREATE TABLE stock_migration.user_state (
  "id" text PRIMARY KEY CHECK (id <> ''),
  "userId" text,
  "flowname" text,
  "referenceId" text,
  "state" text,
  "createdAt" text,
  "updatedAt" text,
  "context" jsonb,
  source_workbook text NOT NULL,
  source_row bigint NOT NULL CHECK (source_row >= 2),
  source_cells jsonb NOT NULL CHECK (jsonb_typeof(source_cells) = 'array')
);
CREATE UNIQUE INDEX user_state_source ON stock_migration.user_state (source_workbook, source_row);
CREATE INDEX ON stock_migration.orders ("createdAt");
ALTER TABLE stock_migration.order_items ADD FOREIGN KEY ("orderId") REFERENCES stock_migration.orders(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX ON stock_migration.order_items ("orderId");
CREATE INDEX ON stock_migration.order_items ("createdAt");
ALTER TABLE stock_migration.order_bills ADD FOREIGN KEY ("orderId") REFERENCES stock_migration.orders(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX ON stock_migration.order_bills ("orderId");
CREATE INDEX ON stock_migration.order_bills ("createdAt");
CREATE INDEX ON stock_migration.shipments ("createdAt");
ALTER TABLE stock_migration.shipment_orders ADD FOREIGN KEY ("orderId") REFERENCES stock_migration.orders(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX ON stock_migration.shipment_orders ("orderId");
ALTER TABLE stock_migration.shipment_orders ADD FOREIGN KEY ("shipmentId") REFERENCES stock_migration.shipments(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX ON stock_migration.shipment_orders ("shipmentId");
CREATE INDEX ON stock_migration.shipment_orders ("createdAt");
CREATE INDEX ON stock_migration.employees ("createdAt");
ALTER TABLE stock_migration.employee_compensations ADD FOREIGN KEY ("employeeId") REFERENCES stock_migration.employees(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX ON stock_migration.employee_compensations ("employeeId");
CREATE INDEX ON stock_migration.employee_compensations ("createdAt");
CREATE INDEX ON stock_migration.employee_compensations ("effectiveFrom");
ALTER TABLE stock_migration.employee_timesheets ADD FOREIGN KEY ("employeeId") REFERENCES stock_migration.employees(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX ON stock_migration.employee_timesheets ("employeeId");
ALTER TABLE stock_migration.employee_timesheets ADD FOREIGN KEY ("shopId") REFERENCES stock_migration.shops(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX ON stock_migration.employee_timesheets ("shopId");
CREATE INDEX ON stock_migration.employee_timesheets ("createdAt");
ALTER TABLE stock_migration.employee_advances ADD FOREIGN KEY ("employeeId") REFERENCES stock_migration.employees(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX ON stock_migration.employee_advances ("employeeId");
ALTER TABLE stock_migration.employee_advances ADD FOREIGN KEY ("shopId") REFERENCES stock_migration.shops(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX ON stock_migration.employee_advances ("shopId");
CREATE INDEX ON stock_migration.employee_advances ("createdAt");
ALTER TABLE stock_migration.payroll_settlements ADD FOREIGN KEY ("employeeId") REFERENCES stock_migration.employees(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX ON stock_migration.payroll_settlements ("employeeId");
CREATE INDEX ON stock_migration.payroll_settlements ("createdAt");
CREATE INDEX ON stock_migration.payroll_settlements ("month");
ALTER TABLE stock_migration.expenses ADD FOREIGN KEY ("shopId") REFERENCES stock_migration.shops(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX ON stock_migration.expenses ("shopId");
ALTER TABLE stock_migration.expenses ADD FOREIGN KEY ("categoryId") REFERENCES stock_migration.expense_categories(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX ON stock_migration.expenses ("categoryId");
CREATE INDEX ON stock_migration.expenses ("createdAt");
CREATE INDEX ON stock_migration.expenses ("month");
CREATE INDEX ON stock_migration.expense_categories ("createdAt");
CREATE INDEX ON stock_migration.shops ("createdAt");
CREATE INDEX ON stock_migration.sales_receipts ("createdAt");
CREATE INDEX ON stock_migration.sales_receipts ("salesDate");
CREATE INDEX ON stock_migration.sales_receipts ("accountId");
ALTER TABLE stock_migration.sales_receipt_items ADD FOREIGN KEY ("receiptId") REFERENCES stock_migration.sales_receipts(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX ON stock_migration.sales_receipt_items ("receiptId");
ALTER TABLE stock_migration.sales_receipt_payments ADD FOREIGN KEY ("receiptId") REFERENCES stock_migration.sales_receipts(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX ON stock_migration.sales_receipt_payments ("receiptId");
CREATE INDEX ON stock_migration.sales_receipt_syncs ("salesDate");
CREATE INDEX ON stock_migration.sales_receipt_syncs ("accountId");
CREATE INDEX ON stock_migration.sales_profit_cost_overrides ("createdAt");
CREATE INDEX ON stock_migration.sales_profit_cost_overrides ("month");
CREATE INDEX ON stock_migration.sales_profit_cost_overrides ("accountId");
CREATE INDEX ON stock_migration.stock_counts ("month");
CREATE INDEX ON stock_migration.stock_counts ("accountId");
ALTER TABLE stock_migration.stock_adjustments ADD FOREIGN KEY ("employeeId") REFERENCES stock_migration.employees(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX ON stock_migration.stock_adjustments ("employeeId");
ALTER TABLE stock_migration.stock_adjustments ADD FOREIGN KEY ("reversesId") REFERENCES stock_migration.stock_adjustments(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX ON stock_migration.stock_adjustments ("reversesId");
ALTER TABLE stock_migration.stock_adjustments ADD FOREIGN KEY ("replacesId") REFERENCES stock_migration.stock_adjustments(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX ON stock_migration.stock_adjustments ("replacesId");
CREATE INDEX ON stock_migration.stock_adjustments ("createdAt");
CREATE INDEX ON stock_migration.stock_adjustments ("accountId");
CREATE INDEX ON stock_migration.movements ("createdAt");
ALTER TABLE stock_migration.movement_details ADD FOREIGN KEY ("movementMasterId") REFERENCES stock_migration.movements(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX ON stock_migration.movement_details ("movementMasterId");
ALTER TABLE stock_migration.movement_details ADD FOREIGN KEY ("purchaseDetailId") REFERENCES stock_migration.order_items(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX ON stock_migration.movement_details ("purchaseDetailId");
CREATE INDEX ON stock_migration.movement_details ("createdAt");
CREATE INDEX ON stock_migration.user_state ("createdAt");
ALTER TABLE stock_migration.import_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.import_batches FROM PUBLIC, anon, authenticated;
ALTER TABLE stock_migration.orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.orders FROM PUBLIC, anon, authenticated;
ALTER TABLE stock_migration.order_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.order_items FROM PUBLIC, anon, authenticated;
ALTER TABLE stock_migration.order_bills ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.order_bills FROM PUBLIC, anon, authenticated;
ALTER TABLE stock_migration.shipments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.shipments FROM PUBLIC, anon, authenticated;
ALTER TABLE stock_migration.shipment_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.shipment_orders FROM PUBLIC, anon, authenticated;
ALTER TABLE stock_migration.employees ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.employees FROM PUBLIC, anon, authenticated;
ALTER TABLE stock_migration.employee_compensations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.employee_compensations FROM PUBLIC, anon, authenticated;
ALTER TABLE stock_migration.employee_timesheets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.employee_timesheets FROM PUBLIC, anon, authenticated;
ALTER TABLE stock_migration.employee_advances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.employee_advances FROM PUBLIC, anon, authenticated;
ALTER TABLE stock_migration.payroll_settlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.payroll_settlements FROM PUBLIC, anon, authenticated;
ALTER TABLE stock_migration.expenses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.expenses FROM PUBLIC, anon, authenticated;
ALTER TABLE stock_migration.expense_categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.expense_categories FROM PUBLIC, anon, authenticated;
ALTER TABLE stock_migration.shops ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.shops FROM PUBLIC, anon, authenticated;
ALTER TABLE stock_migration.sales_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.sales_receipts FROM PUBLIC, anon, authenticated;
ALTER TABLE stock_migration.sales_receipt_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.sales_receipt_items FROM PUBLIC, anon, authenticated;
ALTER TABLE stock_migration.sales_receipt_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.sales_receipt_payments FROM PUBLIC, anon, authenticated;
ALTER TABLE stock_migration.sales_receipt_syncs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.sales_receipt_syncs FROM PUBLIC, anon, authenticated;
ALTER TABLE stock_migration.sales_profit_cost_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.sales_profit_cost_overrides FROM PUBLIC, anon, authenticated;
ALTER TABLE stock_migration.stock_counts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.stock_counts FROM PUBLIC, anon, authenticated;
ALTER TABLE stock_migration.stock_adjustments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.stock_adjustments FROM PUBLIC, anon, authenticated;
ALTER TABLE stock_migration.movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.movements FROM PUBLIC, anon, authenticated;
ALTER TABLE stock_migration.movement_details ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.movement_details FROM PUBLIC, anon, authenticated;
ALTER TABLE stock_migration.user_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_migration.user_state FROM PUBLIC, anon, authenticated;
