-- Destructive to audit history only. Apply with writers stopped and an approved backup.
-- Existing business tables, command replay and side-effect journals are preserved.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
SELECT pg_advisory_xact_lock(835107241);
SELECT pg_advisory_xact_lock(835107242);
CREATE TABLE stock_operational.revision (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  value bigint NOT NULL CHECK (value >= 0)
);
INSERT INTO stock_operational.revision(singleton,value)
SELECT true,coalesce(max(sequence),0) FROM stock_operational.audit;
ALTER TABLE stock_operational.revision ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stock_operational.revision FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE(value) ON stock_operational.revision TO stock_runtime;
CREATE POLICY revision_read ON stock_operational.revision FOR SELECT TO stock_runtime USING (true);
CREATE POLICY revision_advance ON stock_operational.revision FOR UPDATE TO stock_runtime USING (singleton) WITH CHECK (singleton);
CREATE FUNCTION stock_operational.advance_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  UPDATE stock_operational.revision SET value=value+1 WHERE singleton;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing storage revision'; END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION stock_operational.advance_revision() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.advance_revision() TO stock_runtime;
DROP TRIGGER audit_record ON stock_operational.orders;
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.orders FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
DROP TRIGGER audit_record ON stock_operational.order_items;
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.order_items FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
DROP TRIGGER audit_record ON stock_operational.order_bills;
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.order_bills FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
DROP TRIGGER audit_record ON stock_operational.shipments;
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.shipments FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
DROP TRIGGER audit_record ON stock_operational.shipment_orders;
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.shipment_orders FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
DROP TRIGGER audit_record ON stock_operational.employees;
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.employees FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
DROP TRIGGER audit_record ON stock_operational.employee_compensations;
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.employee_compensations FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
DROP TRIGGER audit_record ON stock_operational.employee_timesheets;
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.employee_timesheets FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
DROP TRIGGER audit_record ON stock_operational.employee_advances;
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.employee_advances FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
DROP TRIGGER audit_record ON stock_operational.payroll_settlements;
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.payroll_settlements FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
DROP TRIGGER audit_record ON stock_operational.expenses;
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.expenses FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
DROP TRIGGER audit_record ON stock_operational.expense_categories;
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.expense_categories FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
DROP TRIGGER audit_record ON stock_operational.shops;
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.shops FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
DROP TRIGGER audit_record ON stock_operational.sales_receipts;
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.sales_receipts FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
DROP TRIGGER audit_record ON stock_operational.sales_receipt_items;
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.sales_receipt_items FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
DROP TRIGGER audit_record ON stock_operational.sales_receipt_payments;
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.sales_receipt_payments FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
DROP TRIGGER audit_record ON stock_operational.sales_receipt_syncs;
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.sales_receipt_syncs FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
DROP TRIGGER audit_record ON stock_operational.sales_profit_cost_overrides;
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.sales_profit_cost_overrides FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
DROP TRIGGER audit_record ON stock_operational.stock_counts;
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.stock_counts FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
DROP TRIGGER audit_record ON stock_operational.stock_adjustments;
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.stock_adjustments FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
DROP TRIGGER audit_record ON stock_operational.movements;
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.movements FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
DROP TRIGGER audit_record ON stock_operational.movement_details;
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.movement_details FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
DROP TRIGGER audit_record ON stock_operational.user_state;
CREATE TRIGGER advance_revision AFTER INSERT OR UPDATE OR DELETE ON stock_operational.user_state FOR EACH STATEMENT EXECUTE FUNCTION stock_operational.advance_revision();
DROP FUNCTION stock_operational.audit_change();
DROP TABLE stock_operational.audit;
COMMIT;
