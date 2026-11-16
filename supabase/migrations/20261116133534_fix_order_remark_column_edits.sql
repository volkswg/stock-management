-- Accept direct Table Editor edits to orders.remark without changing app writes.
-- Only the trigger function changes; existing records, grants and RLS are untouched.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc AS p
    WHERE p.oid = 'stock_operational.map_orders()'::regprocedure
      AND p.prosrc = $expected$ BEGIN NEW."id" := NULLIF(NEW.business_cells->>0,'')::text; NEW."status" := NULLIF(NEW.business_cells->>1,'')::text; NEW."seller" := NULLIF(NEW.business_cells->>2,'')::text; NEW."totalPrice" := NULLIF(NEW.business_cells->>3,'')::numeric; NEW."remark" := NULLIF(NEW.business_cells->>4,'')::text; NEW."createdAt" := NULLIF(NEW.business_cells->>5,'')::text; NEW."updatedAt" := NULLIF(NEW.business_cells->>6,'')::text; NEW."deletedAt" := NULLIF(NEW.business_cells->>7,'')::text; NEW."createdBy" := NULLIF(NEW.business_cells->>8,'')::text; IF TG_OP='UPDATE' THEN IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable business identity or archived record'; END IF; NEW.revision := OLD.revision+1; END IF; RETURN NEW; END $expected$
      AND p.prorettype = 'pg_catalog.trigger'::regtype
      AND p.prolang = (SELECT oid FROM pg_catalog.pg_language WHERE lanname = 'plpgsql')
      AND NOT p.prosecdef
      AND p.proconfig = ARRAY['search_path=""']
      AND p.provolatile = 'v' AND p.proparallel = 'u' AND NOT p.proisstrict
      AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
  ) THEN
    RAISE EXCEPTION 'Unexpected definition or attributes for stock_operational.map_orders; review before applying';
  END IF;
END;
$guard$;

CREATE OR REPLACE FUNCTION stock_operational.map_orders()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $mapper$
BEGIN
  -- The app writes business_cells. Keep that payload authoritative when changed.
  -- A remark-only column edit instead updates its canonical fifth cell first.
  IF TG_OP = 'UPDATE' THEN
    IF NEW."remark" IS DISTINCT FROM OLD."remark"
       AND NEW.business_cells IS NOT DISTINCT FROM OLD.business_cells THEN
      -- Short historical rows need padding: jsonb_set otherwise appends too early.
      WHILE jsonb_array_length(NEW.business_cells) < 5 LOOP
        NEW.business_cells := NEW.business_cells || '[""]'::jsonb;
      END LOOP;
      NEW.business_cells := jsonb_set(
        NEW.business_cells, '{4}', to_jsonb(coalesce(NEW."remark", '')), true
      );
    END IF;
  END IF;

  NEW."id" := NULLIF(NEW.business_cells->>0,'')::text;
  NEW."status" := NULLIF(NEW.business_cells->>1,'')::text;
  NEW."seller" := NULLIF(NEW.business_cells->>2,'')::text;
  NEW."totalPrice" := NULLIF(NEW.business_cells->>3,'')::numeric;
  NEW."remark" := NULLIF(NEW.business_cells->>4,'')::text;
  NEW."createdAt" := NULLIF(NEW.business_cells->>5,'')::text;
  NEW."updatedAt" := NULLIF(NEW.business_cells->>6,'')::text;
  NEW."deletedAt" := NULLIF(NEW.business_cells->>7,'')::text;
  NEW."createdBy" := NULLIF(NEW.business_cells->>8,'')::text;
  IF TG_OP = 'UPDATE' THEN
    IF NEW."id" IS DISTINCT FROM OLD."id" OR OLD.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'Immutable business identity or archived record';
    END IF;
    NEW.revision := OLD.revision + 1;
  END IF;
  RETURN NEW;
END;
$mapper$;
COMMIT;
