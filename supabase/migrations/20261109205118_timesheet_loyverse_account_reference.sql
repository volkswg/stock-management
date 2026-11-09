-- Attendance stores the external Loyverse account ID selected by its HTTP API.
-- It is not the expense shop-master ID. Keep all existing cell values and indexes.
-- Account credentials/configuration remain external and must never be imported.
-- Previously applied migrations are immutable; this correction is unapplied.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE stock_migration.employee_timesheets, stock_operational.employee_timesheets
  IN ACCESS EXCLUSIVE MODE;

DO $guard$
DECLARE
  schema_name text;
  expected_constraint boolean;
BEGIN
  -- Refuse schema drift before removing either incorrect relationship.
  FOREACH schema_name IN ARRAY ARRAY['stock_migration', 'stock_operational'] LOOP
    SELECT count(*) = 1 INTO expected_constraint
    FROM pg_catalog.pg_constraint AS c
    JOIN pg_catalog.pg_attribute AS child
      ON child.attrelid = c.conrelid AND child.attname = 'shopId'
    JOIN pg_catalog.pg_attribute AS parent
      ON parent.attrelid = c.confrelid AND parent.attname = 'id'
    WHERE c.conrelid = format('%I.employee_timesheets', schema_name)::regclass
      AND c.confrelid = format('%I.shops', schema_name)::regclass
      AND c.conname = 'employee_timesheets_shopId_fkey'
      AND c.contype = 'f'
      AND c.conkey = ARRAY[child.attnum]
      AND c.confkey = ARRAY[parent.attnum];
    IF NOT expected_constraint THEN
      RAISE EXCEPTION 'Unexpected timesheet shop relationship in %; review schema before proceeding', schema_name;
    END IF;
  END LOOP;
END;
$guard$;

ALTER TABLE stock_migration.employee_timesheets
  DROP CONSTRAINT "employee_timesheets_shopId_fkey";
ALTER TABLE stock_operational.employee_timesheets
  DROP CONSTRAINT "employee_timesheets_shopId_fkey";

-- employeeId -> employees, access controls and all existing indexes are retained.
-- Account existence is checked against approved credential-free metadata during
-- offline application parity; no FK to the private credential worksheet is made.
COMMIT;
