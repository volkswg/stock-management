-- Additive configuration only. Never populate from business snapshots or expose
-- this schema through PostgREST/Realtime. Live application/import need approval.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE SCHEMA stock_configuration;
REVOKE ALL ON SCHEMA stock_configuration FROM PUBLIC, anon, authenticated;
CREATE TABLE stock_configuration.loyverse_accounts (
  id text PRIMARY KEY CHECK (id <> '' AND id = btrim(id)),
  "shopName" text NOT NULL CHECK ("shopName" <> '' AND "shopName" = btrim("shopName")),
  "storeId" text CHECK ("storeId" IS NULL OR ("storeId" <> '' AND "storeId" = btrim("storeId"))),
  "accessToken" text CHECK ("accessToken" IS NULL OR "accessToken" = btrim("accessToken")),
  active boolean NOT NULL,
  "sortOrder" bigint NOT NULL UNIQUE CHECK ("sortOrder" BETWEEN 0 AND 9007199254740991),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite("createdAt")),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite("updatedAt")),
  CHECK (NOT active OR coalesce(length("accessToken") > 0, false))
);
-- int8 maps to string in pg; the reader selects sortOrder as float8 (exact for
-- the bounded JS safe-integer domain), avoiding lossy global driver parsers.
ALTER TABLE stock_configuration.loyverse_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE stock_configuration.loyverse_accounts FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA stock_configuration TO stock_runtime;
GRANT SELECT ON stock_configuration.loyverse_accounts TO stock_runtime;
CREATE POLICY runtime_read ON stock_configuration.loyverse_accounts
  FOR SELECT TO stock_runtime USING (true);

-- Preserve existing role identities. No new logins, memberships or broad grants.
DO $$BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'stock_prod_reader') THEN
    GRANT USAGE ON SCHEMA stock_configuration TO stock_prod_reader;
    GRANT SELECT (id,"shopName","storeId",active,"sortOrder","createdAt","updatedAt")
      ON stock_configuration.loyverse_accounts TO stock_prod_reader;
    CREATE POLICY metadata_read ON stock_configuration.loyverse_accounts
      FOR SELECT TO stock_prod_reader USING (true);
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'stock_prod_backup') THEN
    GRANT USAGE ON SCHEMA stock_configuration TO stock_prod_backup;
    GRANT SELECT ON stock_configuration.loyverse_accounts TO stock_prod_backup;
    CREATE POLICY recovery_read ON stock_configuration.loyverse_accounts
      FOR SELECT TO stock_prod_backup USING (true);
  END IF;
END$$;

-- One invoker timestamp trigger; validation uses CHECK/UNIQUE constraints.
CREATE FUNCTION stock_configuration.touch_account_timestamp() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN NEW."updatedAt" := clock_timestamp(); RETURN NEW; END$$;
REVOKE ALL ON FUNCTION stock_configuration.touch_account_timestamp() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER touch_account_timestamp BEFORE UPDATE ON stock_configuration.loyverse_accounts
FOR EACH ROW EXECUTE FUNCTION stock_configuration.touch_account_timestamp();
COMMIT;
