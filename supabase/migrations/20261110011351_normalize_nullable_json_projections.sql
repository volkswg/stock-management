-- Align typed nullable JSON with core.convert/literal; preserve original business_cells.
-- Previously applied migrations and all existing rows, policies and indexes remain untouched.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc AS p
    WHERE p.oid = 'stock_operational.map_payroll_settlements()'::regprocedure
      AND p.prosrc = $expected_map_payroll_settlements$ BEGIN NEW."id" := NULLIF(NEW.business_cells->>0,'')::text; NEW."employeeId" := NULLIF(NEW.business_cells->>1,'')::text; NEW."month" := NULLIF(NEW.business_cells->>2,'')::text; NEW."paidDate" := NULLIF(NEW.business_cells->>3,'')::text; NEW."reference" := NULLIF(NEW.business_cells->>4,'')::text; NEW."createdAt" := NULLIF(NEW.business_cells->>5,'')::text; NEW."snapshot" := NULLIF(NEW.business_cells->>6,'')::jsonb; IF TG_OP='UPDATE' THEN IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable business identity or archived record'; END IF; NEW.revision := OLD.revision+1; END IF; RETURN NEW; END $expected_map_payroll_settlements$
      AND p.prorettype = 'pg_catalog.trigger'::regtype
      AND p.prolang = (SELECT oid FROM pg_catalog.pg_language WHERE lanname = 'plpgsql')
      AND NOT p.prosecdef
      AND p.proconfig = ARRAY['search_path=""']
      AND p.provolatile = 'v' AND p.proparallel = 'u' AND NOT p.proisstrict
      AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
  ) THEN
    RAISE EXCEPTION 'Unexpected definition or attributes for stock_operational.map_payroll_settlements; review before applying';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc AS p
    WHERE p.oid = 'stock_operational.map_sales_receipt_items()'::regprocedure
      AND p.prosrc = $expected_map_sales_receipt_items$ BEGIN NEW."id" := NULLIF(NEW.business_cells->>0,'')::text; NEW."receiptId" := NULLIF(NEW.business_cells->>1,'')::text; NEW."lineItemId" := NULLIF(NEW.business_cells->>2,'')::text; NEW."itemId" := NULLIF(NEW.business_cells->>3,'')::text; NEW."variantId" := NULLIF(NEW.business_cells->>4,'')::text; NEW."itemName" := NULLIF(NEW.business_cells->>5,'')::text; NEW."variantName" := NULLIF(NEW.business_cells->>6,'')::text; NEW."sku" := NULLIF(NEW.business_cells->>7,'')::text; NEW."quantity" := NULLIF(NEW.business_cells->>8,'')::numeric; NEW."price" := NULLIF(NEW.business_cells->>9,'')::numeric; NEW."grossTotalMoney" := NULLIF(NEW.business_cells->>10,'')::numeric; NEW."totalDiscount" := NULLIF(NEW.business_cells->>11,'')::numeric; NEW."totalMoney" := NULLIF(NEW.business_cells->>12,'')::numeric; NEW."cost" := NULLIF(NEW.business_cells->>13,'')::numeric; NEW."costTotal" := NULLIF(NEW.business_cells->>14,'')::numeric; NEW."taxes" := NULLIF(NEW.business_cells->>15,'')::numeric; NEW."lineNote" := NULLIF(NEW.business_cells->>16,'')::text; NEW."lineDiscountsJson" := NULLIF(NEW.business_cells->>17,'')::jsonb; NEW."lineTaxesJson" := NULLIF(NEW.business_cells->>18,'')::jsonb; NEW."lineModifiersJson" := NULLIF(NEW.business_cells->>19,'')::jsonb; NEW."syncedAt" := NULLIF(NEW.business_cells->>20,'')::text; IF TG_OP='UPDATE' THEN IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable business identity or archived record'; END IF; NEW.revision := OLD.revision+1; END IF; RETURN NEW; END $expected_map_sales_receipt_items$
      AND p.prorettype = 'pg_catalog.trigger'::regtype
      AND p.prolang = (SELECT oid FROM pg_catalog.pg_language WHERE lanname = 'plpgsql')
      AND NOT p.prosecdef
      AND p.proconfig = ARRAY['search_path=""']
      AND p.provolatile = 'v' AND p.proparallel = 'u' AND NOT p.proisstrict
      AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
  ) THEN
    RAISE EXCEPTION 'Unexpected definition or attributes for stock_operational.map_sales_receipt_items; review before applying';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc AS p
    WHERE p.oid = 'stock_operational.map_sales_receipt_payments()'::regprocedure
      AND p.prosrc = $expected_map_sales_receipt_payments$ BEGIN NEW."id" := NULLIF(NEW.business_cells->>0,'')::text; NEW."receiptId" := NULLIF(NEW.business_cells->>1,'')::text; NEW."paymentIndex" := NULLIF(NEW.business_cells->>2,'')::bigint; NEW."paymentTypeId" := NULLIF(NEW.business_cells->>3,'')::text; NEW."paymentName" := NULLIF(NEW.business_cells->>4,'')::text; NEW."paymentType" := NULLIF(NEW.business_cells->>5,'')::text; NEW."moneyAmount" := NULLIF(NEW.business_cells->>6,'')::numeric; NEW."paidAt" := NULLIF(NEW.business_cells->>7,'')::text; NEW."paymentDetailsJson" := NULLIF(NEW.business_cells->>8,'')::jsonb; NEW."syncedAt" := NULLIF(NEW.business_cells->>9,'')::text; IF TG_OP='UPDATE' THEN IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable business identity or archived record'; END IF; NEW.revision := OLD.revision+1; END IF; RETURN NEW; END $expected_map_sales_receipt_payments$
      AND p.prorettype = 'pg_catalog.trigger'::regtype
      AND p.prolang = (SELECT oid FROM pg_catalog.pg_language WHERE lanname = 'plpgsql')
      AND NOT p.prosecdef
      AND p.proconfig = ARRAY['search_path=""']
      AND p.provolatile = 'v' AND p.proparallel = 'u' AND NOT p.proisstrict
      AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
  ) THEN
    RAISE EXCEPTION 'Unexpected definition or attributes for stock_operational.map_sales_receipt_payments; review before applying';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc AS p
    WHERE p.oid = 'stock_operational.map_user_state()'::regprocedure
      AND p.prosrc = $expected_map_user_state$ BEGIN NEW."id" := NULLIF(NEW.business_cells->>0,'')::text; NEW."userId" := NULLIF(NEW.business_cells->>1,'')::text; NEW."flowname" := NULLIF(NEW.business_cells->>2,'')::text; NEW."referenceId" := NULLIF(NEW.business_cells->>3,'')::text; NEW."state" := NULLIF(NEW.business_cells->>4,'')::text; NEW."createdAt" := NULLIF(NEW.business_cells->>5,'')::text; NEW."updatedAt" := NULLIF(NEW.business_cells->>6,'')::text; NEW."context" := NULLIF(NEW.business_cells->>7,'')::jsonb; IF TG_OP='UPDATE' THEN IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable business identity or archived record'; END IF; NEW.revision := OLD.revision+1; END IF; RETURN NEW; END $expected_map_user_state$
      AND p.prorettype = 'pg_catalog.trigger'::regtype
      AND p.prolang = (SELECT oid FROM pg_catalog.pg_language WHERE lanname = 'plpgsql')
      AND NOT p.prosecdef
      AND p.proconfig = ARRAY['search_path=""']
      AND p.provolatile = 'v' AND p.proparallel = 'u' AND NOT p.proisstrict
      AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
  ) THEN
    RAISE EXCEPTION 'Unexpected definition or attributes for stock_operational.map_user_state; review before applying';
  END IF;
END;
$guard$;

CREATE OR REPLACE FUNCTION stock_operational.map_payroll_settlements() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$ BEGIN NEW."id" := NULLIF(NEW.business_cells->>0,'')::text; NEW."employeeId" := NULLIF(NEW.business_cells->>1,'')::text; NEW."month" := NULLIF(NEW.business_cells->>2,'')::text; NEW."paidDate" := NULLIF(NEW.business_cells->>3,'')::text; NEW."reference" := NULLIF(NEW.business_cells->>4,'')::text; NEW."createdAt" := NULLIF(NEW.business_cells->>5,'')::text; NEW."snapshot" := NULLIF(NULLIF(NEW.business_cells->>6,'')::jsonb, 'null'::jsonb); IF TG_OP='UPDATE' THEN IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable business identity or archived record'; END IF; NEW.revision := OLD.revision+1; END IF; RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION stock_operational.map_sales_receipt_items() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$ BEGIN NEW."id" := NULLIF(NEW.business_cells->>0,'')::text; NEW."receiptId" := NULLIF(NEW.business_cells->>1,'')::text; NEW."lineItemId" := NULLIF(NEW.business_cells->>2,'')::text; NEW."itemId" := NULLIF(NEW.business_cells->>3,'')::text; NEW."variantId" := NULLIF(NEW.business_cells->>4,'')::text; NEW."itemName" := NULLIF(NEW.business_cells->>5,'')::text; NEW."variantName" := NULLIF(NEW.business_cells->>6,'')::text; NEW."sku" := NULLIF(NEW.business_cells->>7,'')::text; NEW."quantity" := NULLIF(NEW.business_cells->>8,'')::numeric; NEW."price" := NULLIF(NEW.business_cells->>9,'')::numeric; NEW."grossTotalMoney" := NULLIF(NEW.business_cells->>10,'')::numeric; NEW."totalDiscount" := NULLIF(NEW.business_cells->>11,'')::numeric; NEW."totalMoney" := NULLIF(NEW.business_cells->>12,'')::numeric; NEW."cost" := NULLIF(NEW.business_cells->>13,'')::numeric; NEW."costTotal" := NULLIF(NEW.business_cells->>14,'')::numeric; NEW."taxes" := NULLIF(NEW.business_cells->>15,'')::numeric; NEW."lineNote" := NULLIF(NEW.business_cells->>16,'')::text; NEW."lineDiscountsJson" := NULLIF(NULLIF(NEW.business_cells->>17,'')::jsonb, 'null'::jsonb); NEW."lineTaxesJson" := NULLIF(NULLIF(NEW.business_cells->>18,'')::jsonb, 'null'::jsonb); NEW."lineModifiersJson" := NULLIF(NULLIF(NEW.business_cells->>19,'')::jsonb, 'null'::jsonb); NEW."syncedAt" := NULLIF(NEW.business_cells->>20,'')::text; IF TG_OP='UPDATE' THEN IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable business identity or archived record'; END IF; NEW.revision := OLD.revision+1; END IF; RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION stock_operational.map_sales_receipt_payments() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$ BEGIN NEW."id" := NULLIF(NEW.business_cells->>0,'')::text; NEW."receiptId" := NULLIF(NEW.business_cells->>1,'')::text; NEW."paymentIndex" := NULLIF(NEW.business_cells->>2,'')::bigint; NEW."paymentTypeId" := NULLIF(NEW.business_cells->>3,'')::text; NEW."paymentName" := NULLIF(NEW.business_cells->>4,'')::text; NEW."paymentType" := NULLIF(NEW.business_cells->>5,'')::text; NEW."moneyAmount" := NULLIF(NEW.business_cells->>6,'')::numeric; NEW."paidAt" := NULLIF(NEW.business_cells->>7,'')::text; NEW."paymentDetailsJson" := NULLIF(NULLIF(NEW.business_cells->>8,'')::jsonb, 'null'::jsonb); NEW."syncedAt" := NULLIF(NEW.business_cells->>9,'')::text; IF TG_OP='UPDATE' THEN IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable business identity or archived record'; END IF; NEW.revision := OLD.revision+1; END IF; RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION stock_operational.map_user_state() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$ BEGIN NEW."id" := NULLIF(NEW.business_cells->>0,'')::text; NEW."userId" := NULLIF(NEW.business_cells->>1,'')::text; NEW."flowname" := NULLIF(NEW.business_cells->>2,'')::text; NEW."referenceId" := NULLIF(NEW.business_cells->>3,'')::text; NEW."state" := NULLIF(NEW.business_cells->>4,'')::text; NEW."createdAt" := NULLIF(NEW.business_cells->>5,'')::text; NEW."updatedAt" := NULLIF(NEW.business_cells->>6,'')::text; NEW."context" := NULLIF(NULLIF(NEW.business_cells->>7,'')::jsonb, 'null'::jsonb); IF TG_OP='UPDATE' THEN IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable business identity or archived record'; END IF; NEW.revision := OLD.revision+1; END IF; RETURN NEW; END $$;

-- CREATE OR REPLACE retains existing owners, ACLs and trigger dependencies.
-- No row updates, reconciliation bypasses, sequence resets or privilege changes.
COMMIT;
