-- Permit an explicitly approved new production target without retagging staging.
-- No record, UUID, role, grant or default changes. Runtime cannot update environment.
BEGIN;
ALTER TABLE stock_operational.environment
  DROP CONSTRAINT environment_purpose_check,
  ADD CONSTRAINT environment_purpose_check
    CHECK (purpose IN ('isolated-staging', 'production'));
COMMIT;
