-- Additive compatibility only. row_order, keys, business values and security remain.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
SELECT pg_advisory_xact_lock(835107241);
SELECT pg_advisory_xact_lock(835107242);

-- Source text/representation stays unchanged. Reject ambiguous or invalid dates;
-- never let session timezone/DateStyle determine ordering.
CREATE FUNCTION stock_operational.created_at_timestamp(value text) RETURNS timestamptz
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' SET timezone='UTC' SET datestyle='ISO, YMD' AS $$
BEGIN
  IF value ~ '^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?)?(Z|[+-]\d{2}:?\d{2})$' THEN
    RETURN value::timestamptz;
  ELSIF value ~ '^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?)?$' THEN
    RETURN value::timestamp AT TIME ZONE 'Asia/Bangkok';
  END IF;
  RETURN NULL;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow OR invalid_time_zone_displacement_value THEN
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION stock_operational.created_at_timestamp(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION stock_operational.created_at_timestamp(text) TO stock_runtime;
CREATE FUNCTION stock_operational.set_created_at_instant() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  NEW.created_at_instant := stock_operational.created_at_timestamp(NEW."createdAt");
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION stock_operational.set_created_at_instant() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION stock_operational.set_created_at_instant() TO stock_runtime;

ALTER TABLE stock_operational.orders ADD COLUMN created_at_instant timestamptz;
CREATE TRIGGER b_created_at_instant BEFORE INSERT OR UPDATE ON stock_operational.orders FOR EACH ROW EXECUTE FUNCTION stock_operational.set_created_at_instant();
-- Backfill derived metadata only; do not change record/global revisions or reject
-- archived records. Both existing triggers are restored in the same transaction.
ALTER TABLE stock_operational.orders DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.orders DISABLE TRIGGER advance_revision;
UPDATE stock_operational.orders SET created_at_instant=stock_operational.created_at_timestamp("createdAt");
ALTER TABLE stock_operational.orders ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.orders ENABLE TRIGGER a_validate;

ALTER TABLE stock_operational.order_items ADD COLUMN created_at_instant timestamptz;
CREATE TRIGGER b_created_at_instant BEFORE INSERT OR UPDATE ON stock_operational.order_items FOR EACH ROW EXECUTE FUNCTION stock_operational.set_created_at_instant();
-- Backfill derived metadata only; do not change record/global revisions or reject
-- archived records. Both existing triggers are restored in the same transaction.
ALTER TABLE stock_operational.order_items DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.order_items DISABLE TRIGGER advance_revision;
UPDATE stock_operational.order_items SET created_at_instant=stock_operational.created_at_timestamp("createdAt");
ALTER TABLE stock_operational.order_items ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.order_items ENABLE TRIGGER a_validate;

ALTER TABLE stock_operational.order_bills ADD COLUMN created_at_instant timestamptz;
CREATE TRIGGER b_created_at_instant BEFORE INSERT OR UPDATE ON stock_operational.order_bills FOR EACH ROW EXECUTE FUNCTION stock_operational.set_created_at_instant();
-- Backfill derived metadata only; do not change record/global revisions or reject
-- archived records. Both existing triggers are restored in the same transaction.
ALTER TABLE stock_operational.order_bills DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.order_bills DISABLE TRIGGER advance_revision;
UPDATE stock_operational.order_bills SET created_at_instant=stock_operational.created_at_timestamp("createdAt");
ALTER TABLE stock_operational.order_bills ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.order_bills ENABLE TRIGGER a_validate;

ALTER TABLE stock_operational.shipments ADD COLUMN created_at_instant timestamptz;
CREATE TRIGGER b_created_at_instant BEFORE INSERT OR UPDATE ON stock_operational.shipments FOR EACH ROW EXECUTE FUNCTION stock_operational.set_created_at_instant();
-- Backfill derived metadata only; do not change record/global revisions or reject
-- archived records. Both existing triggers are restored in the same transaction.
ALTER TABLE stock_operational.shipments DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.shipments DISABLE TRIGGER advance_revision;
UPDATE stock_operational.shipments SET created_at_instant=stock_operational.created_at_timestamp("createdAt");
ALTER TABLE stock_operational.shipments ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.shipments ENABLE TRIGGER a_validate;

ALTER TABLE stock_operational.shipment_orders ADD COLUMN created_at_instant timestamptz;
CREATE TRIGGER b_created_at_instant BEFORE INSERT OR UPDATE ON stock_operational.shipment_orders FOR EACH ROW EXECUTE FUNCTION stock_operational.set_created_at_instant();
-- Backfill derived metadata only; do not change record/global revisions or reject
-- archived records. Both existing triggers are restored in the same transaction.
ALTER TABLE stock_operational.shipment_orders DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.shipment_orders DISABLE TRIGGER advance_revision;
UPDATE stock_operational.shipment_orders SET created_at_instant=stock_operational.created_at_timestamp("createdAt");
ALTER TABLE stock_operational.shipment_orders ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.shipment_orders ENABLE TRIGGER a_validate;

ALTER TABLE stock_operational.employees ADD COLUMN created_at_instant timestamptz;
CREATE TRIGGER b_created_at_instant BEFORE INSERT OR UPDATE ON stock_operational.employees FOR EACH ROW EXECUTE FUNCTION stock_operational.set_created_at_instant();
-- Backfill derived metadata only; do not change record/global revisions or reject
-- archived records. Both existing triggers are restored in the same transaction.
ALTER TABLE stock_operational.employees DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.employees DISABLE TRIGGER advance_revision;
UPDATE stock_operational.employees SET created_at_instant=stock_operational.created_at_timestamp("createdAt");
ALTER TABLE stock_operational.employees ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.employees ENABLE TRIGGER a_validate;

ALTER TABLE stock_operational.employee_compensations ADD COLUMN created_at_instant timestamptz;
CREATE TRIGGER b_created_at_instant BEFORE INSERT OR UPDATE ON stock_operational.employee_compensations FOR EACH ROW EXECUTE FUNCTION stock_operational.set_created_at_instant();
-- Backfill derived metadata only; do not change record/global revisions or reject
-- archived records. Both existing triggers are restored in the same transaction.
ALTER TABLE stock_operational.employee_compensations DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.employee_compensations DISABLE TRIGGER advance_revision;
UPDATE stock_operational.employee_compensations SET created_at_instant=stock_operational.created_at_timestamp("createdAt");
ALTER TABLE stock_operational.employee_compensations ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.employee_compensations ENABLE TRIGGER a_validate;

ALTER TABLE stock_operational.employee_timesheets ADD COLUMN created_at_instant timestamptz;
CREATE TRIGGER b_created_at_instant BEFORE INSERT OR UPDATE ON stock_operational.employee_timesheets FOR EACH ROW EXECUTE FUNCTION stock_operational.set_created_at_instant();
-- Backfill derived metadata only; do not change record/global revisions or reject
-- archived records. Both existing triggers are restored in the same transaction.
ALTER TABLE stock_operational.employee_timesheets DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.employee_timesheets DISABLE TRIGGER advance_revision;
UPDATE stock_operational.employee_timesheets SET created_at_instant=stock_operational.created_at_timestamp("createdAt");
ALTER TABLE stock_operational.employee_timesheets ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.employee_timesheets ENABLE TRIGGER a_validate;

ALTER TABLE stock_operational.employee_advances ADD COLUMN created_at_instant timestamptz;
CREATE TRIGGER b_created_at_instant BEFORE INSERT OR UPDATE ON stock_operational.employee_advances FOR EACH ROW EXECUTE FUNCTION stock_operational.set_created_at_instant();
-- Backfill derived metadata only; do not change record/global revisions or reject
-- archived records. Both existing triggers are restored in the same transaction.
ALTER TABLE stock_operational.employee_advances DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.employee_advances DISABLE TRIGGER advance_revision;
UPDATE stock_operational.employee_advances SET created_at_instant=stock_operational.created_at_timestamp("createdAt");
ALTER TABLE stock_operational.employee_advances ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.employee_advances ENABLE TRIGGER a_validate;

ALTER TABLE stock_operational.payroll_settlements ADD COLUMN created_at_instant timestamptz;
CREATE TRIGGER b_created_at_instant BEFORE INSERT OR UPDATE ON stock_operational.payroll_settlements FOR EACH ROW EXECUTE FUNCTION stock_operational.set_created_at_instant();
-- Backfill derived metadata only; do not change record/global revisions or reject
-- archived records. Both existing triggers are restored in the same transaction.
ALTER TABLE stock_operational.payroll_settlements DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.payroll_settlements DISABLE TRIGGER advance_revision;
UPDATE stock_operational.payroll_settlements SET created_at_instant=stock_operational.created_at_timestamp("createdAt");
ALTER TABLE stock_operational.payroll_settlements ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.payroll_settlements ENABLE TRIGGER a_validate;

ALTER TABLE stock_operational.expenses ADD COLUMN created_at_instant timestamptz;
CREATE TRIGGER b_created_at_instant BEFORE INSERT OR UPDATE ON stock_operational.expenses FOR EACH ROW EXECUTE FUNCTION stock_operational.set_created_at_instant();
-- Backfill derived metadata only; do not change record/global revisions or reject
-- archived records. Both existing triggers are restored in the same transaction.
ALTER TABLE stock_operational.expenses DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.expenses DISABLE TRIGGER advance_revision;
UPDATE stock_operational.expenses SET created_at_instant=stock_operational.created_at_timestamp("createdAt");
ALTER TABLE stock_operational.expenses ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.expenses ENABLE TRIGGER a_validate;

ALTER TABLE stock_operational.expense_categories ADD COLUMN created_at_instant timestamptz;
CREATE TRIGGER b_created_at_instant BEFORE INSERT OR UPDATE ON stock_operational.expense_categories FOR EACH ROW EXECUTE FUNCTION stock_operational.set_created_at_instant();
-- Backfill derived metadata only; do not change record/global revisions or reject
-- archived records. Both existing triggers are restored in the same transaction.
ALTER TABLE stock_operational.expense_categories DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.expense_categories DISABLE TRIGGER advance_revision;
UPDATE stock_operational.expense_categories SET created_at_instant=stock_operational.created_at_timestamp("createdAt");
ALTER TABLE stock_operational.expense_categories ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.expense_categories ENABLE TRIGGER a_validate;

ALTER TABLE stock_operational.shops ADD COLUMN created_at_instant timestamptz;
CREATE TRIGGER b_created_at_instant BEFORE INSERT OR UPDATE ON stock_operational.shops FOR EACH ROW EXECUTE FUNCTION stock_operational.set_created_at_instant();
-- Backfill derived metadata only; do not change record/global revisions or reject
-- archived records. Both existing triggers are restored in the same transaction.
ALTER TABLE stock_operational.shops DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.shops DISABLE TRIGGER advance_revision;
UPDATE stock_operational.shops SET created_at_instant=stock_operational.created_at_timestamp("createdAt");
ALTER TABLE stock_operational.shops ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.shops ENABLE TRIGGER a_validate;

ALTER TABLE stock_operational.sales_receipts ADD COLUMN created_at_instant timestamptz;
CREATE TRIGGER b_created_at_instant BEFORE INSERT OR UPDATE ON stock_operational.sales_receipts FOR EACH ROW EXECUTE FUNCTION stock_operational.set_created_at_instant();
-- Backfill derived metadata only; do not change record/global revisions or reject
-- archived records. Both existing triggers are restored in the same transaction.
ALTER TABLE stock_operational.sales_receipts DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.sales_receipts DISABLE TRIGGER advance_revision;
UPDATE stock_operational.sales_receipts SET created_at_instant=stock_operational.created_at_timestamp("createdAt");
ALTER TABLE stock_operational.sales_receipts ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.sales_receipts ENABLE TRIGGER a_validate;

-- No historical creation evidence: leave existing rows NULL. Only future inserts
-- receive first-observed creation time; resync/update never overwrites it.
ALTER TABLE stock_operational.sales_receipt_items ADD COLUMN "createdAt" text;
ALTER TABLE stock_operational.sales_receipt_items ALTER COLUMN "createdAt" SET DEFAULT to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');

ALTER TABLE stock_operational.sales_receipt_items ADD COLUMN created_at_instant timestamptz;
CREATE TRIGGER b_created_at_instant BEFORE INSERT OR UPDATE ON stock_operational.sales_receipt_items FOR EACH ROW EXECUTE FUNCTION stock_operational.set_created_at_instant();
-- Backfill derived metadata only; do not change record/global revisions or reject
-- archived records. Both existing triggers are restored in the same transaction.
ALTER TABLE stock_operational.sales_receipt_items DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.sales_receipt_items DISABLE TRIGGER advance_revision;
UPDATE stock_operational.sales_receipt_items SET created_at_instant=stock_operational.created_at_timestamp("createdAt");
ALTER TABLE stock_operational.sales_receipt_items ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.sales_receipt_items ENABLE TRIGGER a_validate;

-- No historical creation evidence: leave existing rows NULL. Only future inserts
-- receive first-observed creation time; resync/update never overwrites it.
ALTER TABLE stock_operational.sales_receipt_payments ADD COLUMN "createdAt" text;
ALTER TABLE stock_operational.sales_receipt_payments ALTER COLUMN "createdAt" SET DEFAULT to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');

ALTER TABLE stock_operational.sales_receipt_payments ADD COLUMN created_at_instant timestamptz;
CREATE TRIGGER b_created_at_instant BEFORE INSERT OR UPDATE ON stock_operational.sales_receipt_payments FOR EACH ROW EXECUTE FUNCTION stock_operational.set_created_at_instant();
-- Backfill derived metadata only; do not change record/global revisions or reject
-- archived records. Both existing triggers are restored in the same transaction.
ALTER TABLE stock_operational.sales_receipt_payments DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.sales_receipt_payments DISABLE TRIGGER advance_revision;
UPDATE stock_operational.sales_receipt_payments SET created_at_instant=stock_operational.created_at_timestamp("createdAt");
ALTER TABLE stock_operational.sales_receipt_payments ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.sales_receipt_payments ENABLE TRIGGER a_validate;

-- No historical creation evidence: leave existing rows NULL. Only future inserts
-- receive first-observed creation time; resync/update never overwrites it.
ALTER TABLE stock_operational.sales_receipt_syncs ADD COLUMN "createdAt" text;
ALTER TABLE stock_operational.sales_receipt_syncs ALTER COLUMN "createdAt" SET DEFAULT to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');

ALTER TABLE stock_operational.sales_receipt_syncs ADD COLUMN created_at_instant timestamptz;
CREATE TRIGGER b_created_at_instant BEFORE INSERT OR UPDATE ON stock_operational.sales_receipt_syncs FOR EACH ROW EXECUTE FUNCTION stock_operational.set_created_at_instant();
-- Backfill derived metadata only; do not change record/global revisions or reject
-- archived records. Both existing triggers are restored in the same transaction.
ALTER TABLE stock_operational.sales_receipt_syncs DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.sales_receipt_syncs DISABLE TRIGGER advance_revision;
UPDATE stock_operational.sales_receipt_syncs SET created_at_instant=stock_operational.created_at_timestamp("createdAt");
ALTER TABLE stock_operational.sales_receipt_syncs ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.sales_receipt_syncs ENABLE TRIGGER a_validate;

ALTER TABLE stock_operational.sales_profit_cost_overrides ADD COLUMN created_at_instant timestamptz;
CREATE TRIGGER b_created_at_instant BEFORE INSERT OR UPDATE ON stock_operational.sales_profit_cost_overrides FOR EACH ROW EXECUTE FUNCTION stock_operational.set_created_at_instant();
-- Backfill derived metadata only; do not change record/global revisions or reject
-- archived records. Both existing triggers are restored in the same transaction.
ALTER TABLE stock_operational.sales_profit_cost_overrides DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.sales_profit_cost_overrides DISABLE TRIGGER advance_revision;
UPDATE stock_operational.sales_profit_cost_overrides SET created_at_instant=stock_operational.created_at_timestamp("createdAt");
ALTER TABLE stock_operational.sales_profit_cost_overrides ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.sales_profit_cost_overrides ENABLE TRIGGER a_validate;

-- No historical creation evidence: leave existing rows NULL. Only future inserts
-- receive first-observed creation time; resync/update never overwrites it.
ALTER TABLE stock_operational.stock_counts ADD COLUMN "createdAt" text;
ALTER TABLE stock_operational.stock_counts ALTER COLUMN "createdAt" SET DEFAULT to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');

ALTER TABLE stock_operational.stock_counts ADD COLUMN created_at_instant timestamptz;
CREATE TRIGGER b_created_at_instant BEFORE INSERT OR UPDATE ON stock_operational.stock_counts FOR EACH ROW EXECUTE FUNCTION stock_operational.set_created_at_instant();
-- Backfill derived metadata only; do not change record/global revisions or reject
-- archived records. Both existing triggers are restored in the same transaction.
ALTER TABLE stock_operational.stock_counts DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.stock_counts DISABLE TRIGGER advance_revision;
UPDATE stock_operational.stock_counts SET created_at_instant=stock_operational.created_at_timestamp("createdAt");
ALTER TABLE stock_operational.stock_counts ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.stock_counts ENABLE TRIGGER a_validate;

ALTER TABLE stock_operational.stock_adjustments ADD COLUMN created_at_instant timestamptz;
CREATE TRIGGER b_created_at_instant BEFORE INSERT OR UPDATE ON stock_operational.stock_adjustments FOR EACH ROW EXECUTE FUNCTION stock_operational.set_created_at_instant();
-- Backfill derived metadata only; do not change record/global revisions or reject
-- archived records. Both existing triggers are restored in the same transaction.
ALTER TABLE stock_operational.stock_adjustments DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.stock_adjustments DISABLE TRIGGER advance_revision;
UPDATE stock_operational.stock_adjustments SET created_at_instant=stock_operational.created_at_timestamp("createdAt");
ALTER TABLE stock_operational.stock_adjustments ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.stock_adjustments ENABLE TRIGGER a_validate;

ALTER TABLE stock_operational.movements ADD COLUMN created_at_instant timestamptz;
CREATE TRIGGER b_created_at_instant BEFORE INSERT OR UPDATE ON stock_operational.movements FOR EACH ROW EXECUTE FUNCTION stock_operational.set_created_at_instant();
-- Backfill derived metadata only; do not change record/global revisions or reject
-- archived records. Both existing triggers are restored in the same transaction.
ALTER TABLE stock_operational.movements DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.movements DISABLE TRIGGER advance_revision;
UPDATE stock_operational.movements SET created_at_instant=stock_operational.created_at_timestamp("createdAt");
ALTER TABLE stock_operational.movements ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.movements ENABLE TRIGGER a_validate;

ALTER TABLE stock_operational.movement_details ADD COLUMN created_at_instant timestamptz;
CREATE TRIGGER b_created_at_instant BEFORE INSERT OR UPDATE ON stock_operational.movement_details FOR EACH ROW EXECUTE FUNCTION stock_operational.set_created_at_instant();
-- Backfill derived metadata only; do not change record/global revisions or reject
-- archived records. Both existing triggers are restored in the same transaction.
ALTER TABLE stock_operational.movement_details DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.movement_details DISABLE TRIGGER advance_revision;
UPDATE stock_operational.movement_details SET created_at_instant=stock_operational.created_at_timestamp("createdAt");
ALTER TABLE stock_operational.movement_details ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.movement_details ENABLE TRIGGER a_validate;

ALTER TABLE stock_operational.user_state ADD COLUMN created_at_instant timestamptz;
CREATE TRIGGER b_created_at_instant BEFORE INSERT OR UPDATE ON stock_operational.user_state FOR EACH ROW EXECUTE FUNCTION stock_operational.set_created_at_instant();
-- Backfill derived metadata only; do not change record/global revisions or reject
-- archived records. Both existing triggers are restored in the same transaction.
ALTER TABLE stock_operational.user_state DISABLE TRIGGER a_validate;
ALTER TABLE stock_operational.user_state DISABLE TRIGGER advance_revision;
UPDATE stock_operational.user_state SET created_at_instant=stock_operational.created_at_timestamp("createdAt");
ALTER TABLE stock_operational.user_state ENABLE TRIGGER advance_revision;
ALTER TABLE stock_operational.user_state ENABLE TRIGGER a_validate;

COMMIT;
