-- Named columns own values. Per-field lexemes preserve input spelling only; validated against typed values.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
SELECT pg_advisory_xact_lock(835107241);
SELECT pg_advisory_xact_lock(835107242);
CREATE FUNCTION stock_operational.cell_projection(value jsonb, kind text, lexeme text, datatype text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE decoded jsonb;
BEGIN
 IF lexeme IS NOT NULL THEN
   decoded := CASE datatype WHEN 'numeric' THEN to_jsonb(lexeme::numeric) WHEN 'bigint' THEN to_jsonb(lexeme::bigint) WHEN 'boolean' THEN to_jsonb(lexeme::boolean) WHEN 'jsonb' THEN nullif(lexeme::jsonb,'null'::jsonb) END;
   IF decoded IS DISTINCT FROM nullif(value,'null'::jsonb) THEN RAISE EXCEPTION 'Cell spelling disagrees with named value'; END IF;
 END IF;
 IF kind='z' THEN
   IF nullif(value,'null'::jsonb) IS NOT NULL THEN RAISE EXCEPTION 'Null encoding disagrees with named value'; END IF;
   RETURN 'null'::jsonb;
 END IF;
 IF kind='s' OR kind IS NULL THEN
   RETURN to_jsonb(coalesce(lexeme, CASE WHEN datatype='jsonb' THEN nullif(value,'null'::jsonb)::text ELSE value#>>'{}' END,''));
 END IF;
 IF kind='n' AND datatype='boolean' THEN RETURN to_jsonb(CASE WHEN (value#>>'{}')::boolean THEN 1 ELSE 0 END); END IF;
 IF kind='n' THEN RETURN to_jsonb((value#>>'{}')::numeric); END IF;
 IF kind='b' THEN RETURN to_jsonb((value#>>'{}')::boolean); END IF;
 RAISE EXCEPTION 'Invalid cell encoding';
END $$;
ALTER TABLE stock_operational.orders ADD COLUMN cell_kinds text;
ALTER TABLE stock_operational.orders ADD COLUMN "totalPrice__lexeme" text;
CREATE FUNCTION stock_operational.input_orders(cells jsonb) RETURNS stock_operational.orders LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.orders; BEGIN
IF jsonb_typeof(cells)<>'array' OR jsonb_array_length(cells)>9 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
r.cell_kinds := '';
IF jsonb_array_length(cells)>0 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->0)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."id" := nullif((cells->>0),'')::text;
IF jsonb_array_length(cells)>1 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->1)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."status" := nullif((cells->>1),'')::text;
IF jsonb_array_length(cells)>2 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->2)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."seller" := nullif((cells->>2),'')::text;
IF jsonb_array_length(cells)>3 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->3)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."totalPrice" := nullif((cells->>3),'')::numeric;
IF jsonb_typeof((cells->3))='string' AND (cells->>3)<>'' THEN r."totalPrice__lexeme" := (cells->>3); END IF;
IF jsonb_array_length(cells)>4 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->4)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."remark" := nullif((cells->>4),'')::text;
IF jsonb_array_length(cells)>5 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->5)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdAt" := nullif((cells->>5),'')::text;
IF jsonb_array_length(cells)>6 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->6)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."updatedAt" := nullif((cells->>6),'')::text;
IF jsonb_array_length(cells)>7 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->7)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."deletedAt" := nullif((cells->>7),'')::text;
IF jsonb_array_length(cells)>8 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->8)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdBy" := nullif((cells->>8),'')::text;
RETURN r; END $$;
CREATE FUNCTION stock_operational.project_orders(r stock_operational.orders) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(stock_operational.cell_projection(to_jsonb(r."id"),nullif(substr(r.cell_kinds,1,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."status"),nullif(substr(r.cell_kinds,2,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."seller"),nullif(substr(r.cell_kinds,3,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."totalPrice"),nullif(substr(r.cell_kinds,4,1),''),r."totalPrice__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."remark"),nullif(substr(r.cell_kinds,5,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdAt"),nullif(substr(r.cell_kinds,6,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."updatedAt"),nullif(substr(r.cell_kinds,7,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."deletedAt"),nullif(substr(r.cell_kinds,8,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdBy"),nullif(substr(r.cell_kinds,9,1),''),NULL,'text'))) WITH ORDINALITY a(v,n) WHERE n<=coalesce(length(r.cell_kinds),9) $$;
CREATE FUNCTION stock_operational.validate_orders() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE supplied_encoding boolean;
BEGIN
IF TG_OP='UPDATE' THEN supplied_encoding := NEW.cell_kinds IS DISTINCT FROM OLD.cell_kinds; ELSE supplied_encoding := true; END IF;
NEW."id" := nullif(NEW."id",'');
NEW."status" := nullif(NEW."status",'');
NEW."seller" := nullif(NEW."seller",'');
NEW."remark" := nullif(NEW."remark",'');
NEW."createdAt" := nullif(NEW."createdAt",'');
NEW."updatedAt" := nullif(NEW."updatedAt",'');
NEW."deletedAt" := nullif(NEW."deletedAt",'');
NEW."createdBy" := nullif(NEW."createdBy",'');
IF TG_OP='UPDATE' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW.row_order IS DISTINCT FROM OLD.row_order OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
IF NEW."id" IS DISTINCT FROM OLD."id" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,1,1) IN ('','z') OR NEW."id" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),1),'s') placing 's' from 1 for 1); END IF;
END IF;
IF NEW."status" IS DISTINCT FROM OLD."status" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,2,1) IN ('','z') OR NEW."status" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),2),'s') placing 's' from 2 for 1); END IF;
END IF;
IF NEW."seller" IS DISTINCT FROM OLD."seller" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,3,1) IN ('','z') OR NEW."seller" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),3),'s') placing 's' from 3 for 1); END IF;
END IF;
IF NEW."totalPrice" IS DISTINCT FROM OLD."totalPrice" THEN
IF NEW."totalPrice__lexeme" IS NOT DISTINCT FROM OLD."totalPrice__lexeme" THEN NEW."totalPrice__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,4,1) IN ('','z') OR NEW."totalPrice" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),4),'s') placing 's' from 4 for 1); END IF;
END IF;
IF NEW."remark" IS DISTINCT FROM OLD."remark" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,5,1) IN ('','z') OR NEW."remark" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),5),'s') placing 's' from 5 for 1); END IF;
END IF;
IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,6,1) IN ('','z') OR NEW."createdAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),6),'s') placing 's' from 6 for 1); END IF;
END IF;
IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,7,1) IN ('','z') OR NEW."updatedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),7),'s') placing 's' from 7 for 1); END IF;
END IF;
IF NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,8,1) IN ('','z') OR NEW."deletedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),8),'s') placing 's' from 8 for 1); END IF;
END IF;
IF NEW."createdBy" IS DISTINCT FROM OLD."createdBy" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,9,1) IN ('','z') OR NEW."createdBy" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),9),'s') placing 's' from 9 for 1); END IF;
END IF;
END IF;
IF NEW.cell_kinds IS NOT NULL AND (length(NEW.cell_kinds)<1 OR length(NEW.cell_kinds)>9 OR NEW.cell_kinds !~ '^[snbz]+$') THEN RAISE EXCEPTION 'Invalid row encoding'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=0 AND NEW."id" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=1 AND NEW."status" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=2 AND NEW."seller" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=3 AND NEW."totalPrice" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=4 AND NEW."remark" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=5 AND NEW."createdAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=6 AND NEW."updatedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=7 AND NEW."deletedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=8 AND NEW."createdBy" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
PERFORM stock_operational.project_orders(NEW);
RETURN NEW; END $$;
CREATE FUNCTION stock_operational.compat_orders() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND (TG_NAME='y_explicit_cells' OR NEW.business_cells IS DISTINCT FROM OLD.business_cells) AND NEW.business_cells IS DISTINCT FROM stock_operational.project_orders(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer: write named columns'; END IF; IF TG_OP='INSERT' AND NEW.business_cells IS NOT NULL AND NEW.business_cells IS DISTINCT FROM stock_operational.project_orders(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer'; END IF; NEW.business_cells := stock_operational.project_orders(NEW); RETURN NEW; END $$;
ALTER TABLE stock_operational.orders DISABLE TRIGGER map_cells;
ALTER TABLE stock_operational.orders DISABLE TRIGGER advance_revision;
UPDATE stock_operational.orders t SET cell_kinds=i.cell_kinds,"totalPrice__lexeme"=i."totalPrice__lexeme" FROM (SELECT row_order AS source_order, (stock_operational.input_orders(business_cells)).* FROM stock_operational.orders) i WHERE t.row_order=i.source_order;
DO $$ BEGIN IF EXISTS(SELECT FROM stock_operational.orders t WHERE business_cells IS DISTINCT FROM stock_operational.project_orders(t)) THEN RAISE EXCEPTION 'Unrepresentable orders row; transition aborted'; END IF; END $$;
ALTER TABLE stock_operational.orders ENABLE TRIGGER advance_revision;
DROP TRIGGER map_cells ON stock_operational.orders;
ALTER TABLE stock_operational.orders ALTER COLUMN business_cells DROP NOT NULL;
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.orders FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_orders();
CREATE TRIGGER y_explicit_cells BEFORE UPDATE OF business_cells ON stock_operational.orders FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_orders();
CREATE TRIGGER z_compat BEFORE INSERT OR UPDATE ON stock_operational.orders FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_orders();
REVOKE ALL ON FUNCTION stock_operational.input_orders(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.input_orders(jsonb) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.project_orders(stock_operational.orders) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.project_orders(stock_operational.orders) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.validate_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.validate_orders() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.compat_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.compat_orders() TO stock_runtime;
ALTER TABLE stock_operational.order_items ADD COLUMN cell_kinds text;
ALTER TABLE stock_operational.order_items ADD COLUMN "quoteQuantity__lexeme" text;
ALTER TABLE stock_operational.order_items ADD COLUMN "deliveredQuantity__lexeme" text;
CREATE FUNCTION stock_operational.input_order_items(cells jsonb) RETURNS stock_operational.order_items LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.order_items; BEGIN
IF jsonb_typeof(cells)<>'array' OR jsonb_array_length(cells)>10 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
r.cell_kinds := '';
IF jsonb_array_length(cells)>0 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->0)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."id" := nullif((cells->>0),'')::text;
IF jsonb_array_length(cells)>1 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->1)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."orderId" := nullif((cells->>1),'')::text;
IF jsonb_array_length(cells)>2 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->2)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."imageUrl" := nullif((cells->>2),'')::text;
IF jsonb_array_length(cells)>3 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->3)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."quoteQuantity" := nullif((cells->>3),'')::numeric;
IF jsonb_typeof((cells->3))='string' AND (cells->>3)<>'' THEN r."quoteQuantity__lexeme" := (cells->>3); END IF;
IF jsonb_array_length(cells)>4 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->4)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."deliveredQuantity" := nullif((cells->>4),'')::numeric;
IF jsonb_typeof((cells->4))='string' AND (cells->>4)<>'' THEN r."deliveredQuantity__lexeme" := (cells->>4); END IF;
IF jsonb_array_length(cells)>5 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->5)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."productCode" := nullif((cells->>5),'')::text;
IF jsonb_array_length(cells)>6 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->6)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdAt" := nullif((cells->>6),'')::text;
IF jsonb_array_length(cells)>7 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->7)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."updatedAt" := nullif((cells->>7),'')::text;
IF jsonb_array_length(cells)>8 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->8)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."deletedAt" := nullif((cells->>8),'')::text;
IF jsonb_array_length(cells)>9 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->9)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdBy" := nullif((cells->>9),'')::text;
RETURN r; END $$;
CREATE FUNCTION stock_operational.project_order_items(r stock_operational.order_items) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(stock_operational.cell_projection(to_jsonb(r."id"),nullif(substr(r.cell_kinds,1,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."orderId"),nullif(substr(r.cell_kinds,2,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."imageUrl"),nullif(substr(r.cell_kinds,3,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."quoteQuantity"),nullif(substr(r.cell_kinds,4,1),''),r."quoteQuantity__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."deliveredQuantity"),nullif(substr(r.cell_kinds,5,1),''),r."deliveredQuantity__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."productCode"),nullif(substr(r.cell_kinds,6,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdAt"),nullif(substr(r.cell_kinds,7,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."updatedAt"),nullif(substr(r.cell_kinds,8,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."deletedAt"),nullif(substr(r.cell_kinds,9,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdBy"),nullif(substr(r.cell_kinds,10,1),''),NULL,'text'))) WITH ORDINALITY a(v,n) WHERE n<=coalesce(length(r.cell_kinds),10) $$;
CREATE FUNCTION stock_operational.validate_order_items() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE supplied_encoding boolean;
BEGIN
IF TG_OP='UPDATE' THEN supplied_encoding := NEW.cell_kinds IS DISTINCT FROM OLD.cell_kinds; ELSE supplied_encoding := true; END IF;
NEW."id" := nullif(NEW."id",'');
NEW."orderId" := nullif(NEW."orderId",'');
NEW."imageUrl" := nullif(NEW."imageUrl",'');
NEW."productCode" := nullif(NEW."productCode",'');
NEW."createdAt" := nullif(NEW."createdAt",'');
NEW."updatedAt" := nullif(NEW."updatedAt",'');
NEW."deletedAt" := nullif(NEW."deletedAt",'');
NEW."createdBy" := nullif(NEW."createdBy",'');
IF TG_OP='UPDATE' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW.row_order IS DISTINCT FROM OLD.row_order OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
IF NEW."id" IS DISTINCT FROM OLD."id" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,1,1) IN ('','z') OR NEW."id" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),1),'s') placing 's' from 1 for 1); END IF;
END IF;
IF NEW."orderId" IS DISTINCT FROM OLD."orderId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,2,1) IN ('','z') OR NEW."orderId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),2),'s') placing 's' from 2 for 1); END IF;
END IF;
IF NEW."imageUrl" IS DISTINCT FROM OLD."imageUrl" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,3,1) IN ('','z') OR NEW."imageUrl" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),3),'s') placing 's' from 3 for 1); END IF;
END IF;
IF NEW."quoteQuantity" IS DISTINCT FROM OLD."quoteQuantity" THEN
IF NEW."quoteQuantity__lexeme" IS NOT DISTINCT FROM OLD."quoteQuantity__lexeme" THEN NEW."quoteQuantity__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,4,1) IN ('','z') OR NEW."quoteQuantity" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),4),'s') placing 's' from 4 for 1); END IF;
END IF;
IF NEW."deliveredQuantity" IS DISTINCT FROM OLD."deliveredQuantity" THEN
IF NEW."deliveredQuantity__lexeme" IS NOT DISTINCT FROM OLD."deliveredQuantity__lexeme" THEN NEW."deliveredQuantity__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,5,1) IN ('','z') OR NEW."deliveredQuantity" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),5),'s') placing 's' from 5 for 1); END IF;
END IF;
IF NEW."productCode" IS DISTINCT FROM OLD."productCode" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,6,1) IN ('','z') OR NEW."productCode" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),6),'s') placing 's' from 6 for 1); END IF;
END IF;
IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,7,1) IN ('','z') OR NEW."createdAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),7),'s') placing 's' from 7 for 1); END IF;
END IF;
IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,8,1) IN ('','z') OR NEW."updatedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),8),'s') placing 's' from 8 for 1); END IF;
END IF;
IF NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,9,1) IN ('','z') OR NEW."deletedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),9),'s') placing 's' from 9 for 1); END IF;
END IF;
IF NEW."createdBy" IS DISTINCT FROM OLD."createdBy" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,10,1) IN ('','z') OR NEW."createdBy" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),10),'s') placing 's' from 10 for 1); END IF;
END IF;
END IF;
IF NEW.cell_kinds IS NOT NULL AND (length(NEW.cell_kinds)<1 OR length(NEW.cell_kinds)>10 OR NEW.cell_kinds !~ '^[snbz]+$') THEN RAISE EXCEPTION 'Invalid row encoding'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=0 AND NEW."id" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=1 AND NEW."orderId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=2 AND NEW."imageUrl" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=3 AND NEW."quoteQuantity" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=4 AND NEW."deliveredQuantity" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=5 AND NEW."productCode" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=6 AND NEW."createdAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=7 AND NEW."updatedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=8 AND NEW."deletedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=9 AND NEW."createdBy" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
PERFORM stock_operational.project_order_items(NEW);
RETURN NEW; END $$;
CREATE FUNCTION stock_operational.compat_order_items() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND (TG_NAME='y_explicit_cells' OR NEW.business_cells IS DISTINCT FROM OLD.business_cells) AND NEW.business_cells IS DISTINCT FROM stock_operational.project_order_items(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer: write named columns'; END IF; IF TG_OP='INSERT' AND NEW.business_cells IS NOT NULL AND NEW.business_cells IS DISTINCT FROM stock_operational.project_order_items(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer'; END IF; NEW.business_cells := stock_operational.project_order_items(NEW); RETURN NEW; END $$;
ALTER TABLE stock_operational.order_items DISABLE TRIGGER map_cells;
ALTER TABLE stock_operational.order_items DISABLE TRIGGER advance_revision;
UPDATE stock_operational.order_items t SET cell_kinds=i.cell_kinds,"quoteQuantity__lexeme"=i."quoteQuantity__lexeme","deliveredQuantity__lexeme"=i."deliveredQuantity__lexeme" FROM (SELECT row_order AS source_order, (stock_operational.input_order_items(business_cells)).* FROM stock_operational.order_items) i WHERE t.row_order=i.source_order;
DO $$ BEGIN IF EXISTS(SELECT FROM stock_operational.order_items t WHERE business_cells IS DISTINCT FROM stock_operational.project_order_items(t)) THEN RAISE EXCEPTION 'Unrepresentable order_items row; transition aborted'; END IF; END $$;
ALTER TABLE stock_operational.order_items ENABLE TRIGGER advance_revision;
DROP TRIGGER map_cells ON stock_operational.order_items;
ALTER TABLE stock_operational.order_items ALTER COLUMN business_cells DROP NOT NULL;
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.order_items FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_order_items();
CREATE TRIGGER y_explicit_cells BEFORE UPDATE OF business_cells ON stock_operational.order_items FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_order_items();
CREATE TRIGGER z_compat BEFORE INSERT OR UPDATE ON stock_operational.order_items FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_order_items();
REVOKE ALL ON FUNCTION stock_operational.input_order_items(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.input_order_items(jsonb) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.project_order_items(stock_operational.order_items) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.project_order_items(stock_operational.order_items) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.validate_order_items() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.validate_order_items() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.compat_order_items() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.compat_order_items() TO stock_runtime;
ALTER TABLE stock_operational.order_bills ADD COLUMN cell_kinds text;
CREATE FUNCTION stock_operational.input_order_bills(cells jsonb) RETURNS stock_operational.order_bills LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.order_bills; BEGIN
IF jsonb_typeof(cells)<>'array' OR jsonb_array_length(cells)>7 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
r.cell_kinds := '';
IF jsonb_array_length(cells)>0 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->0)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."id" := nullif((cells->>0),'')::text;
IF jsonb_array_length(cells)>1 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->1)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."orderId" := nullif((cells->>1),'')::text;
IF jsonb_array_length(cells)>2 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->2)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."imageUrl" := nullif((cells->>2),'')::text;
IF jsonb_array_length(cells)>3 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->3)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdAt" := nullif((cells->>3),'')::text;
IF jsonb_array_length(cells)>4 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->4)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."updatedAt" := nullif((cells->>4),'')::text;
IF jsonb_array_length(cells)>5 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->5)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."deletedAt" := nullif((cells->>5),'')::text;
IF jsonb_array_length(cells)>6 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->6)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdBy" := nullif((cells->>6),'')::text;
RETURN r; END $$;
CREATE FUNCTION stock_operational.project_order_bills(r stock_operational.order_bills) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(stock_operational.cell_projection(to_jsonb(r."id"),nullif(substr(r.cell_kinds,1,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."orderId"),nullif(substr(r.cell_kinds,2,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."imageUrl"),nullif(substr(r.cell_kinds,3,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdAt"),nullif(substr(r.cell_kinds,4,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."updatedAt"),nullif(substr(r.cell_kinds,5,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."deletedAt"),nullif(substr(r.cell_kinds,6,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdBy"),nullif(substr(r.cell_kinds,7,1),''),NULL,'text'))) WITH ORDINALITY a(v,n) WHERE n<=coalesce(length(r.cell_kinds),7) $$;
CREATE FUNCTION stock_operational.validate_order_bills() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE supplied_encoding boolean;
BEGIN
IF TG_OP='UPDATE' THEN supplied_encoding := NEW.cell_kinds IS DISTINCT FROM OLD.cell_kinds; ELSE supplied_encoding := true; END IF;
NEW."id" := nullif(NEW."id",'');
NEW."orderId" := nullif(NEW."orderId",'');
NEW."imageUrl" := nullif(NEW."imageUrl",'');
NEW."createdAt" := nullif(NEW."createdAt",'');
NEW."updatedAt" := nullif(NEW."updatedAt",'');
NEW."deletedAt" := nullif(NEW."deletedAt",'');
NEW."createdBy" := nullif(NEW."createdBy",'');
IF TG_OP='UPDATE' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW.row_order IS DISTINCT FROM OLD.row_order OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
IF NEW."id" IS DISTINCT FROM OLD."id" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,1,1) IN ('','z') OR NEW."id" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),1),'s') placing 's' from 1 for 1); END IF;
END IF;
IF NEW."orderId" IS DISTINCT FROM OLD."orderId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,2,1) IN ('','z') OR NEW."orderId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),2),'s') placing 's' from 2 for 1); END IF;
END IF;
IF NEW."imageUrl" IS DISTINCT FROM OLD."imageUrl" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,3,1) IN ('','z') OR NEW."imageUrl" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),3),'s') placing 's' from 3 for 1); END IF;
END IF;
IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,4,1) IN ('','z') OR NEW."createdAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),4),'s') placing 's' from 4 for 1); END IF;
END IF;
IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,5,1) IN ('','z') OR NEW."updatedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),5),'s') placing 's' from 5 for 1); END IF;
END IF;
IF NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,6,1) IN ('','z') OR NEW."deletedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),6),'s') placing 's' from 6 for 1); END IF;
END IF;
IF NEW."createdBy" IS DISTINCT FROM OLD."createdBy" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,7,1) IN ('','z') OR NEW."createdBy" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),7),'s') placing 's' from 7 for 1); END IF;
END IF;
END IF;
IF NEW.cell_kinds IS NOT NULL AND (length(NEW.cell_kinds)<1 OR length(NEW.cell_kinds)>7 OR NEW.cell_kinds !~ '^[snbz]+$') THEN RAISE EXCEPTION 'Invalid row encoding'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=0 AND NEW."id" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=1 AND NEW."orderId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=2 AND NEW."imageUrl" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=3 AND NEW."createdAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=4 AND NEW."updatedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=5 AND NEW."deletedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=6 AND NEW."createdBy" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
PERFORM stock_operational.project_order_bills(NEW);
RETURN NEW; END $$;
CREATE FUNCTION stock_operational.compat_order_bills() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND (TG_NAME='y_explicit_cells' OR NEW.business_cells IS DISTINCT FROM OLD.business_cells) AND NEW.business_cells IS DISTINCT FROM stock_operational.project_order_bills(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer: write named columns'; END IF; IF TG_OP='INSERT' AND NEW.business_cells IS NOT NULL AND NEW.business_cells IS DISTINCT FROM stock_operational.project_order_bills(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer'; END IF; NEW.business_cells := stock_operational.project_order_bills(NEW); RETURN NEW; END $$;
ALTER TABLE stock_operational.order_bills DISABLE TRIGGER map_cells;
ALTER TABLE stock_operational.order_bills DISABLE TRIGGER advance_revision;
UPDATE stock_operational.order_bills t SET cell_kinds=i.cell_kinds FROM (SELECT row_order AS source_order, (stock_operational.input_order_bills(business_cells)).* FROM stock_operational.order_bills) i WHERE t.row_order=i.source_order;
DO $$ BEGIN IF EXISTS(SELECT FROM stock_operational.order_bills t WHERE business_cells IS DISTINCT FROM stock_operational.project_order_bills(t)) THEN RAISE EXCEPTION 'Unrepresentable order_bills row; transition aborted'; END IF; END $$;
ALTER TABLE stock_operational.order_bills ENABLE TRIGGER advance_revision;
DROP TRIGGER map_cells ON stock_operational.order_bills;
ALTER TABLE stock_operational.order_bills ALTER COLUMN business_cells DROP NOT NULL;
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.order_bills FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_order_bills();
CREATE TRIGGER y_explicit_cells BEFORE UPDATE OF business_cells ON stock_operational.order_bills FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_order_bills();
CREATE TRIGGER z_compat BEFORE INSERT OR UPDATE ON stock_operational.order_bills FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_order_bills();
REVOKE ALL ON FUNCTION stock_operational.input_order_bills(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.input_order_bills(jsonb) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.project_order_bills(stock_operational.order_bills) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.project_order_bills(stock_operational.order_bills) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.validate_order_bills() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.validate_order_bills() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.compat_order_bills() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.compat_order_bills() TO stock_runtime;
ALTER TABLE stock_operational.shipments ADD COLUMN cell_kinds text;
ALTER TABLE stock_operational.shipments ADD COLUMN "shippingFee__lexeme" text;
CREATE FUNCTION stock_operational.input_shipments(cells jsonb) RETURNS stock_operational.shipments LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.shipments; BEGIN
IF jsonb_typeof(cells)<>'array' OR jsonb_array_length(cells)>13 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
r.cell_kinds := '';
IF jsonb_array_length(cells)>0 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->0)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."id" := nullif((cells->>0),'')::text;
IF jsonb_array_length(cells)>1 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->1)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."status" := nullif((cells->>1),'')::text;
IF jsonb_array_length(cells)>2 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->2)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."carrier" := nullif((cells->>2),'')::text;
IF jsonb_array_length(cells)>3 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->3)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."poNumber" := nullif((cells->>3),'')::text;
IF jsonb_array_length(cells)>4 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->4)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."shippingFee" := nullif((cells->>4),'')::numeric;
IF jsonb_typeof((cells->4))='string' AND (cells->>4)<>'' THEN r."shippingFee__lexeme" := (cells->>4); END IF;
IF jsonb_array_length(cells)>5 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->5)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."remark" := nullif((cells->>5),'')::text;
IF jsonb_array_length(cells)>6 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->6)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."shippedAt" := nullif((cells->>6),'')::text;
IF jsonb_array_length(cells)>7 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->7)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."deliveredAt" := nullif((cells->>7),'')::text;
IF jsonb_array_length(cells)>8 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->8)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdAt" := nullif((cells->>8),'')::text;
IF jsonb_array_length(cells)>9 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->9)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."updatedAt" := nullif((cells->>9),'')::text;
IF jsonb_array_length(cells)>10 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->10)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."deletedAt" := nullif((cells->>10),'')::text;
IF jsonb_array_length(cells)>11 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->11)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdBy" := nullif((cells->>11),'')::text;
IF jsonb_array_length(cells)>12 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->12)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."shippingBillUrl" := nullif((cells->>12),'')::text;
RETURN r; END $$;
CREATE FUNCTION stock_operational.project_shipments(r stock_operational.shipments) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(stock_operational.cell_projection(to_jsonb(r."id"),nullif(substr(r.cell_kinds,1,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."status"),nullif(substr(r.cell_kinds,2,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."carrier"),nullif(substr(r.cell_kinds,3,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."poNumber"),nullif(substr(r.cell_kinds,4,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."shippingFee"),nullif(substr(r.cell_kinds,5,1),''),r."shippingFee__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."remark"),nullif(substr(r.cell_kinds,6,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."shippedAt"),nullif(substr(r.cell_kinds,7,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."deliveredAt"),nullif(substr(r.cell_kinds,8,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdAt"),nullif(substr(r.cell_kinds,9,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."updatedAt"),nullif(substr(r.cell_kinds,10,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."deletedAt"),nullif(substr(r.cell_kinds,11,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdBy"),nullif(substr(r.cell_kinds,12,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."shippingBillUrl"),nullif(substr(r.cell_kinds,13,1),''),NULL,'text'))) WITH ORDINALITY a(v,n) WHERE n<=coalesce(length(r.cell_kinds),13) $$;
CREATE FUNCTION stock_operational.validate_shipments() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE supplied_encoding boolean;
BEGIN
IF TG_OP='UPDATE' THEN supplied_encoding := NEW.cell_kinds IS DISTINCT FROM OLD.cell_kinds; ELSE supplied_encoding := true; END IF;
NEW."id" := nullif(NEW."id",'');
NEW."status" := nullif(NEW."status",'');
NEW."carrier" := nullif(NEW."carrier",'');
NEW."poNumber" := nullif(NEW."poNumber",'');
NEW."remark" := nullif(NEW."remark",'');
NEW."shippedAt" := nullif(NEW."shippedAt",'');
NEW."deliveredAt" := nullif(NEW."deliveredAt",'');
NEW."createdAt" := nullif(NEW."createdAt",'');
NEW."updatedAt" := nullif(NEW."updatedAt",'');
NEW."deletedAt" := nullif(NEW."deletedAt",'');
NEW."createdBy" := nullif(NEW."createdBy",'');
NEW."shippingBillUrl" := nullif(NEW."shippingBillUrl",'');
IF TG_OP='UPDATE' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW.row_order IS DISTINCT FROM OLD.row_order OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
IF NEW."id" IS DISTINCT FROM OLD."id" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,1,1) IN ('','z') OR NEW."id" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),1),'s') placing 's' from 1 for 1); END IF;
END IF;
IF NEW."status" IS DISTINCT FROM OLD."status" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,2,1) IN ('','z') OR NEW."status" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),2),'s') placing 's' from 2 for 1); END IF;
END IF;
IF NEW."carrier" IS DISTINCT FROM OLD."carrier" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,3,1) IN ('','z') OR NEW."carrier" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),3),'s') placing 's' from 3 for 1); END IF;
END IF;
IF NEW."poNumber" IS DISTINCT FROM OLD."poNumber" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,4,1) IN ('','z') OR NEW."poNumber" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),4),'s') placing 's' from 4 for 1); END IF;
END IF;
IF NEW."shippingFee" IS DISTINCT FROM OLD."shippingFee" THEN
IF NEW."shippingFee__lexeme" IS NOT DISTINCT FROM OLD."shippingFee__lexeme" THEN NEW."shippingFee__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,5,1) IN ('','z') OR NEW."shippingFee" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),5),'s') placing 's' from 5 for 1); END IF;
END IF;
IF NEW."remark" IS DISTINCT FROM OLD."remark" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,6,1) IN ('','z') OR NEW."remark" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),6),'s') placing 's' from 6 for 1); END IF;
END IF;
IF NEW."shippedAt" IS DISTINCT FROM OLD."shippedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,7,1) IN ('','z') OR NEW."shippedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),7),'s') placing 's' from 7 for 1); END IF;
END IF;
IF NEW."deliveredAt" IS DISTINCT FROM OLD."deliveredAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,8,1) IN ('','z') OR NEW."deliveredAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),8),'s') placing 's' from 8 for 1); END IF;
END IF;
IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,9,1) IN ('','z') OR NEW."createdAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),9),'s') placing 's' from 9 for 1); END IF;
END IF;
IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,10,1) IN ('','z') OR NEW."updatedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),10),'s') placing 's' from 10 for 1); END IF;
END IF;
IF NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,11,1) IN ('','z') OR NEW."deletedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),11),'s') placing 's' from 11 for 1); END IF;
END IF;
IF NEW."createdBy" IS DISTINCT FROM OLD."createdBy" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,12,1) IN ('','z') OR NEW."createdBy" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),12),'s') placing 's' from 12 for 1); END IF;
END IF;
IF NEW."shippingBillUrl" IS DISTINCT FROM OLD."shippingBillUrl" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,13,1) IN ('','z') OR NEW."shippingBillUrl" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),13),'s') placing 's' from 13 for 1); END IF;
END IF;
END IF;
IF NEW.cell_kinds IS NOT NULL AND (length(NEW.cell_kinds)<1 OR length(NEW.cell_kinds)>13 OR NEW.cell_kinds !~ '^[snbz]+$') THEN RAISE EXCEPTION 'Invalid row encoding'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=0 AND NEW."id" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=1 AND NEW."status" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=2 AND NEW."carrier" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=3 AND NEW."poNumber" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=4 AND NEW."shippingFee" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=5 AND NEW."remark" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=6 AND NEW."shippedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=7 AND NEW."deliveredAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=8 AND NEW."createdAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=9 AND NEW."updatedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=10 AND NEW."deletedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=11 AND NEW."createdBy" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=12 AND NEW."shippingBillUrl" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
PERFORM stock_operational.project_shipments(NEW);
RETURN NEW; END $$;
CREATE FUNCTION stock_operational.compat_shipments() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND (TG_NAME='y_explicit_cells' OR NEW.business_cells IS DISTINCT FROM OLD.business_cells) AND NEW.business_cells IS DISTINCT FROM stock_operational.project_shipments(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer: write named columns'; END IF; IF TG_OP='INSERT' AND NEW.business_cells IS NOT NULL AND NEW.business_cells IS DISTINCT FROM stock_operational.project_shipments(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer'; END IF; NEW.business_cells := stock_operational.project_shipments(NEW); RETURN NEW; END $$;
ALTER TABLE stock_operational.shipments DISABLE TRIGGER map_cells;
ALTER TABLE stock_operational.shipments DISABLE TRIGGER advance_revision;
UPDATE stock_operational.shipments t SET cell_kinds=i.cell_kinds,"shippingFee__lexeme"=i."shippingFee__lexeme" FROM (SELECT row_order AS source_order, (stock_operational.input_shipments(business_cells)).* FROM stock_operational.shipments) i WHERE t.row_order=i.source_order;
DO $$ BEGIN IF EXISTS(SELECT FROM stock_operational.shipments t WHERE business_cells IS DISTINCT FROM stock_operational.project_shipments(t)) THEN RAISE EXCEPTION 'Unrepresentable shipments row; transition aborted'; END IF; END $$;
ALTER TABLE stock_operational.shipments ENABLE TRIGGER advance_revision;
DROP TRIGGER map_cells ON stock_operational.shipments;
ALTER TABLE stock_operational.shipments ALTER COLUMN business_cells DROP NOT NULL;
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.shipments FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_shipments();
CREATE TRIGGER y_explicit_cells BEFORE UPDATE OF business_cells ON stock_operational.shipments FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_shipments();
CREATE TRIGGER z_compat BEFORE INSERT OR UPDATE ON stock_operational.shipments FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_shipments();
REVOKE ALL ON FUNCTION stock_operational.input_shipments(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.input_shipments(jsonb) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.project_shipments(stock_operational.shipments) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.project_shipments(stock_operational.shipments) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.validate_shipments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.validate_shipments() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.compat_shipments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.compat_shipments() TO stock_runtime;
ALTER TABLE stock_operational.shipment_orders ADD COLUMN cell_kinds text;
CREATE FUNCTION stock_operational.input_shipment_orders(cells jsonb) RETURNS stock_operational.shipment_orders LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.shipment_orders; BEGIN
IF jsonb_typeof(cells)<>'array' OR jsonb_array_length(cells)>7 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
r.cell_kinds := '';
IF jsonb_array_length(cells)>0 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->0)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."id" := nullif((cells->>0),'')::text;
IF jsonb_array_length(cells)>1 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->1)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."shipmentId" := nullif((cells->>1),'')::text;
IF jsonb_array_length(cells)>2 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->2)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."orderId" := nullif((cells->>2),'')::text;
IF jsonb_array_length(cells)>3 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->3)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdAt" := nullif((cells->>3),'')::text;
IF jsonb_array_length(cells)>4 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->4)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."updatedAt" := nullif((cells->>4),'')::text;
IF jsonb_array_length(cells)>5 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->5)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."deletedAt" := nullif((cells->>5),'')::text;
IF jsonb_array_length(cells)>6 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->6)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdBy" := nullif((cells->>6),'')::text;
RETURN r; END $$;
CREATE FUNCTION stock_operational.project_shipment_orders(r stock_operational.shipment_orders) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(stock_operational.cell_projection(to_jsonb(r."id"),nullif(substr(r.cell_kinds,1,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."shipmentId"),nullif(substr(r.cell_kinds,2,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."orderId"),nullif(substr(r.cell_kinds,3,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdAt"),nullif(substr(r.cell_kinds,4,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."updatedAt"),nullif(substr(r.cell_kinds,5,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."deletedAt"),nullif(substr(r.cell_kinds,6,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdBy"),nullif(substr(r.cell_kinds,7,1),''),NULL,'text'))) WITH ORDINALITY a(v,n) WHERE n<=coalesce(length(r.cell_kinds),7) $$;
CREATE FUNCTION stock_operational.validate_shipment_orders() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE supplied_encoding boolean;
BEGIN
IF TG_OP='UPDATE' THEN supplied_encoding := NEW.cell_kinds IS DISTINCT FROM OLD.cell_kinds; ELSE supplied_encoding := true; END IF;
NEW."id" := nullif(NEW."id",'');
NEW."shipmentId" := nullif(NEW."shipmentId",'');
NEW."orderId" := nullif(NEW."orderId",'');
NEW."createdAt" := nullif(NEW."createdAt",'');
NEW."updatedAt" := nullif(NEW."updatedAt",'');
NEW."deletedAt" := nullif(NEW."deletedAt",'');
NEW."createdBy" := nullif(NEW."createdBy",'');
IF TG_OP='UPDATE' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW.row_order IS DISTINCT FROM OLD.row_order OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
IF NEW."id" IS DISTINCT FROM OLD."id" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,1,1) IN ('','z') OR NEW."id" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),1),'s') placing 's' from 1 for 1); END IF;
END IF;
IF NEW."shipmentId" IS DISTINCT FROM OLD."shipmentId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,2,1) IN ('','z') OR NEW."shipmentId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),2),'s') placing 's' from 2 for 1); END IF;
END IF;
IF NEW."orderId" IS DISTINCT FROM OLD."orderId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,3,1) IN ('','z') OR NEW."orderId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),3),'s') placing 's' from 3 for 1); END IF;
END IF;
IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,4,1) IN ('','z') OR NEW."createdAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),4),'s') placing 's' from 4 for 1); END IF;
END IF;
IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,5,1) IN ('','z') OR NEW."updatedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),5),'s') placing 's' from 5 for 1); END IF;
END IF;
IF NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,6,1) IN ('','z') OR NEW."deletedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),6),'s') placing 's' from 6 for 1); END IF;
END IF;
IF NEW."createdBy" IS DISTINCT FROM OLD."createdBy" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,7,1) IN ('','z') OR NEW."createdBy" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),7),'s') placing 's' from 7 for 1); END IF;
END IF;
END IF;
IF NEW.cell_kinds IS NOT NULL AND (length(NEW.cell_kinds)<1 OR length(NEW.cell_kinds)>7 OR NEW.cell_kinds !~ '^[snbz]+$') THEN RAISE EXCEPTION 'Invalid row encoding'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=0 AND NEW."id" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=1 AND NEW."shipmentId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=2 AND NEW."orderId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=3 AND NEW."createdAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=4 AND NEW."updatedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=5 AND NEW."deletedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=6 AND NEW."createdBy" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
PERFORM stock_operational.project_shipment_orders(NEW);
RETURN NEW; END $$;
CREATE FUNCTION stock_operational.compat_shipment_orders() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND (TG_NAME='y_explicit_cells' OR NEW.business_cells IS DISTINCT FROM OLD.business_cells) AND NEW.business_cells IS DISTINCT FROM stock_operational.project_shipment_orders(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer: write named columns'; END IF; IF TG_OP='INSERT' AND NEW.business_cells IS NOT NULL AND NEW.business_cells IS DISTINCT FROM stock_operational.project_shipment_orders(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer'; END IF; NEW.business_cells := stock_operational.project_shipment_orders(NEW); RETURN NEW; END $$;
ALTER TABLE stock_operational.shipment_orders DISABLE TRIGGER map_cells;
ALTER TABLE stock_operational.shipment_orders DISABLE TRIGGER advance_revision;
UPDATE stock_operational.shipment_orders t SET cell_kinds=i.cell_kinds FROM (SELECT row_order AS source_order, (stock_operational.input_shipment_orders(business_cells)).* FROM stock_operational.shipment_orders) i WHERE t.row_order=i.source_order;
DO $$ BEGIN IF EXISTS(SELECT FROM stock_operational.shipment_orders t WHERE business_cells IS DISTINCT FROM stock_operational.project_shipment_orders(t)) THEN RAISE EXCEPTION 'Unrepresentable shipment_orders row; transition aborted'; END IF; END $$;
ALTER TABLE stock_operational.shipment_orders ENABLE TRIGGER advance_revision;
DROP TRIGGER map_cells ON stock_operational.shipment_orders;
ALTER TABLE stock_operational.shipment_orders ALTER COLUMN business_cells DROP NOT NULL;
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.shipment_orders FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_shipment_orders();
CREATE TRIGGER y_explicit_cells BEFORE UPDATE OF business_cells ON stock_operational.shipment_orders FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_shipment_orders();
CREATE TRIGGER z_compat BEFORE INSERT OR UPDATE ON stock_operational.shipment_orders FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_shipment_orders();
REVOKE ALL ON FUNCTION stock_operational.input_shipment_orders(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.input_shipment_orders(jsonb) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.project_shipment_orders(stock_operational.shipment_orders) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.project_shipment_orders(stock_operational.shipment_orders) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.validate_shipment_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.validate_shipment_orders() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.compat_shipment_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.compat_shipment_orders() TO stock_runtime;
ALTER TABLE stock_operational.employees ADD COLUMN cell_kinds text;
CREATE FUNCTION stock_operational.input_employees(cells jsonb) RETURNS stock_operational.employees LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.employees; BEGIN
IF jsonb_typeof(cells)<>'array' OR jsonb_array_length(cells)>9 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
r.cell_kinds := '';
IF jsonb_array_length(cells)>0 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->0)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."id" := nullif((cells->>0),'')::text;
IF jsonb_array_length(cells)>1 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->1)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."name" := nullif((cells->>1),'')::text;
IF jsonb_array_length(cells)>2 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->2)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."phone" := nullif((cells->>2),'')::text;
IF jsonb_array_length(cells)>3 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->3)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."status" := nullif((cells->>3),'')::text;
IF jsonb_array_length(cells)>4 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->4)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."hiredDate" := nullif((cells->>4),'')::text;
IF jsonb_array_length(cells)>5 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->5)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."terminatedDate" := nullif((cells->>5),'')::text;
IF jsonb_array_length(cells)>6 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->6)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdAt" := nullif((cells->>6),'')::text;
IF jsonb_array_length(cells)>7 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->7)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."updatedAt" := nullif((cells->>7),'')::text;
IF jsonb_array_length(cells)>8 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->8)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdBy" := nullif((cells->>8),'')::text;
RETURN r; END $$;
CREATE FUNCTION stock_operational.project_employees(r stock_operational.employees) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(stock_operational.cell_projection(to_jsonb(r."id"),nullif(substr(r.cell_kinds,1,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."name"),nullif(substr(r.cell_kinds,2,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."phone"),nullif(substr(r.cell_kinds,3,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."status"),nullif(substr(r.cell_kinds,4,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."hiredDate"),nullif(substr(r.cell_kinds,5,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."terminatedDate"),nullif(substr(r.cell_kinds,6,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdAt"),nullif(substr(r.cell_kinds,7,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."updatedAt"),nullif(substr(r.cell_kinds,8,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdBy"),nullif(substr(r.cell_kinds,9,1),''),NULL,'text'))) WITH ORDINALITY a(v,n) WHERE n<=coalesce(length(r.cell_kinds),9) $$;
CREATE FUNCTION stock_operational.validate_employees() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE supplied_encoding boolean;
BEGIN
IF TG_OP='UPDATE' THEN supplied_encoding := NEW.cell_kinds IS DISTINCT FROM OLD.cell_kinds; ELSE supplied_encoding := true; END IF;
NEW."id" := nullif(NEW."id",'');
NEW."name" := nullif(NEW."name",'');
NEW."phone" := nullif(NEW."phone",'');
NEW."status" := nullif(NEW."status",'');
NEW."hiredDate" := nullif(NEW."hiredDate",'');
NEW."terminatedDate" := nullif(NEW."terminatedDate",'');
NEW."createdAt" := nullif(NEW."createdAt",'');
NEW."updatedAt" := nullif(NEW."updatedAt",'');
NEW."createdBy" := nullif(NEW."createdBy",'');
IF TG_OP='UPDATE' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW.row_order IS DISTINCT FROM OLD.row_order OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
IF NEW."id" IS DISTINCT FROM OLD."id" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,1,1) IN ('','z') OR NEW."id" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),1),'s') placing 's' from 1 for 1); END IF;
END IF;
IF NEW."name" IS DISTINCT FROM OLD."name" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,2,1) IN ('','z') OR NEW."name" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),2),'s') placing 's' from 2 for 1); END IF;
END IF;
IF NEW."phone" IS DISTINCT FROM OLD."phone" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,3,1) IN ('','z') OR NEW."phone" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),3),'s') placing 's' from 3 for 1); END IF;
END IF;
IF NEW."status" IS DISTINCT FROM OLD."status" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,4,1) IN ('','z') OR NEW."status" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),4),'s') placing 's' from 4 for 1); END IF;
END IF;
IF NEW."hiredDate" IS DISTINCT FROM OLD."hiredDate" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,5,1) IN ('','z') OR NEW."hiredDate" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),5),'s') placing 's' from 5 for 1); END IF;
END IF;
IF NEW."terminatedDate" IS DISTINCT FROM OLD."terminatedDate" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,6,1) IN ('','z') OR NEW."terminatedDate" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),6),'s') placing 's' from 6 for 1); END IF;
END IF;
IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,7,1) IN ('','z') OR NEW."createdAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),7),'s') placing 's' from 7 for 1); END IF;
END IF;
IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,8,1) IN ('','z') OR NEW."updatedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),8),'s') placing 's' from 8 for 1); END IF;
END IF;
IF NEW."createdBy" IS DISTINCT FROM OLD."createdBy" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,9,1) IN ('','z') OR NEW."createdBy" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),9),'s') placing 's' from 9 for 1); END IF;
END IF;
END IF;
IF NEW.cell_kinds IS NOT NULL AND (length(NEW.cell_kinds)<1 OR length(NEW.cell_kinds)>9 OR NEW.cell_kinds !~ '^[snbz]+$') THEN RAISE EXCEPTION 'Invalid row encoding'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=0 AND NEW."id" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=1 AND NEW."name" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=2 AND NEW."phone" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=3 AND NEW."status" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=4 AND NEW."hiredDate" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=5 AND NEW."terminatedDate" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=6 AND NEW."createdAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=7 AND NEW."updatedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=8 AND NEW."createdBy" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
PERFORM stock_operational.project_employees(NEW);
RETURN NEW; END $$;
CREATE FUNCTION stock_operational.compat_employees() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND (TG_NAME='y_explicit_cells' OR NEW.business_cells IS DISTINCT FROM OLD.business_cells) AND NEW.business_cells IS DISTINCT FROM stock_operational.project_employees(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer: write named columns'; END IF; IF TG_OP='INSERT' AND NEW.business_cells IS NOT NULL AND NEW.business_cells IS DISTINCT FROM stock_operational.project_employees(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer'; END IF; NEW.business_cells := stock_operational.project_employees(NEW); RETURN NEW; END $$;
ALTER TABLE stock_operational.employees DISABLE TRIGGER map_cells;
ALTER TABLE stock_operational.employees DISABLE TRIGGER advance_revision;
UPDATE stock_operational.employees t SET cell_kinds=i.cell_kinds FROM (SELECT row_order AS source_order, (stock_operational.input_employees(business_cells)).* FROM stock_operational.employees) i WHERE t.row_order=i.source_order;
DO $$ BEGIN IF EXISTS(SELECT FROM stock_operational.employees t WHERE business_cells IS DISTINCT FROM stock_operational.project_employees(t)) THEN RAISE EXCEPTION 'Unrepresentable employees row; transition aborted'; END IF; END $$;
ALTER TABLE stock_operational.employees ENABLE TRIGGER advance_revision;
DROP TRIGGER map_cells ON stock_operational.employees;
ALTER TABLE stock_operational.employees ALTER COLUMN business_cells DROP NOT NULL;
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.employees FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_employees();
CREATE TRIGGER y_explicit_cells BEFORE UPDATE OF business_cells ON stock_operational.employees FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_employees();
CREATE TRIGGER z_compat BEFORE INSERT OR UPDATE ON stock_operational.employees FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_employees();
REVOKE ALL ON FUNCTION stock_operational.input_employees(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.input_employees(jsonb) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.project_employees(stock_operational.employees) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.project_employees(stock_operational.employees) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.validate_employees() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.validate_employees() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.compat_employees() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.compat_employees() TO stock_runtime;
ALTER TABLE stock_operational.employee_compensations ADD COLUMN cell_kinds text;
ALTER TABLE stock_operational.employee_compensations ADD COLUMN "baseSalary__lexeme" text;
ALTER TABLE stock_operational.employee_compensations ADD COLUMN "commission__lexeme" text;
ALTER TABLE stock_operational.employee_compensations ADD COLUMN "commissionBucketSales__lexeme" text;
ALTER TABLE stock_operational.employee_compensations ADD COLUMN "commissionBucketAmount__lexeme" text;
ALTER TABLE stock_operational.employee_compensations ADD COLUMN "commissionRoundupThreshold__lexeme" text;
CREATE FUNCTION stock_operational.input_employee_compensations(cells jsonb) RETURNS stock_operational.employee_compensations LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.employee_compensations; BEGIN
IF jsonb_typeof(cells)<>'array' OR jsonb_array_length(cells)>12 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
r.cell_kinds := '';
IF jsonb_array_length(cells)>0 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->0)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."employeeId" := nullif((cells->>0),'')::text;
IF jsonb_array_length(cells)>1 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->1)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."baseSalary" := nullif((cells->>1),'')::numeric;
IF jsonb_typeof((cells->1))='string' AND (cells->>1)<>'' THEN r."baseSalary__lexeme" := (cells->>1); END IF;
IF jsonb_array_length(cells)>2 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->2)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."commission" := nullif((cells->>2),'')::numeric;
IF jsonb_typeof((cells->2))='string' AND (cells->>2)<>'' THEN r."commission__lexeme" := (cells->>2); END IF;
IF jsonb_array_length(cells)>3 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->3)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdAt" := nullif((cells->>3),'')::text;
IF jsonb_array_length(cells)>4 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->4)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."updatedAt" := nullif((cells->>4),'')::text;
IF jsonb_array_length(cells)>5 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->5)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."updatedBy" := nullif((cells->>5),'')::text;
IF jsonb_array_length(cells)>6 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->6)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."effectiveFrom" := nullif((cells->>6),'')::text;
IF jsonb_array_length(cells)>7 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->7)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."compensationType" := nullif((cells->>7),'')::text;
IF jsonb_array_length(cells)>8 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->8)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."commissionType" := nullif((cells->>8),'')::text;
IF jsonb_array_length(cells)>9 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->9)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."commissionBucketSales" := nullif((cells->>9),'')::numeric;
IF jsonb_typeof((cells->9))='string' AND (cells->>9)<>'' THEN r."commissionBucketSales__lexeme" := (cells->>9); END IF;
IF jsonb_array_length(cells)>10 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->10)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."commissionBucketAmount" := nullif((cells->>10),'')::numeric;
IF jsonb_typeof((cells->10))='string' AND (cells->>10)<>'' THEN r."commissionBucketAmount__lexeme" := (cells->>10); END IF;
IF jsonb_array_length(cells)>11 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->11)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."commissionRoundupThreshold" := nullif((cells->>11),'')::numeric;
IF jsonb_typeof((cells->11))='string' AND (cells->>11)<>'' THEN r."commissionRoundupThreshold__lexeme" := (cells->>11); END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.project_employee_compensations(r stock_operational.employee_compensations) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(stock_operational.cell_projection(to_jsonb(r."employeeId"),nullif(substr(r.cell_kinds,1,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."baseSalary"),nullif(substr(r.cell_kinds,2,1),''),r."baseSalary__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."commission"),nullif(substr(r.cell_kinds,3,1),''),r."commission__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."createdAt"),nullif(substr(r.cell_kinds,4,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."updatedAt"),nullif(substr(r.cell_kinds,5,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."updatedBy"),nullif(substr(r.cell_kinds,6,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."effectiveFrom"),nullif(substr(r.cell_kinds,7,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."compensationType"),nullif(substr(r.cell_kinds,8,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."commissionType"),nullif(substr(r.cell_kinds,9,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."commissionBucketSales"),nullif(substr(r.cell_kinds,10,1),''),r."commissionBucketSales__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."commissionBucketAmount"),nullif(substr(r.cell_kinds,11,1),''),r."commissionBucketAmount__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."commissionRoundupThreshold"),nullif(substr(r.cell_kinds,12,1),''),r."commissionRoundupThreshold__lexeme",'numeric'))) WITH ORDINALITY a(v,n) WHERE n<=coalesce(length(r.cell_kinds),12) $$;
CREATE FUNCTION stock_operational.validate_employee_compensations() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE supplied_encoding boolean;
BEGIN
IF TG_OP='UPDATE' THEN supplied_encoding := NEW.cell_kinds IS DISTINCT FROM OLD.cell_kinds; ELSE supplied_encoding := true; END IF;
NEW."employeeId" := nullif(NEW."employeeId",'');
NEW."createdAt" := nullif(NEW."createdAt",'');
NEW."updatedAt" := nullif(NEW."updatedAt",'');
NEW."updatedBy" := nullif(NEW."updatedBy",'');
NEW."effectiveFrom" := nullif(NEW."effectiveFrom",'');
NEW."compensationType" := nullif(NEW."compensationType",'');
NEW."commissionType" := nullif(NEW."commissionType",'');
IF TG_OP='UPDATE' THEN
IF NEW."migration_id" IS DISTINCT FROM OLD."migration_id" OR NEW.row_order IS DISTINCT FROM OLD.row_order OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
IF NEW."employeeId" IS DISTINCT FROM OLD."employeeId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,1,1) IN ('','z') OR NEW."employeeId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),1),'s') placing 's' from 1 for 1); END IF;
END IF;
IF NEW."baseSalary" IS DISTINCT FROM OLD."baseSalary" THEN
IF NEW."baseSalary__lexeme" IS NOT DISTINCT FROM OLD."baseSalary__lexeme" THEN NEW."baseSalary__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,2,1) IN ('','z') OR NEW."baseSalary" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),2),'s') placing 's' from 2 for 1); END IF;
END IF;
IF NEW."commission" IS DISTINCT FROM OLD."commission" THEN
IF NEW."commission__lexeme" IS NOT DISTINCT FROM OLD."commission__lexeme" THEN NEW."commission__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,3,1) IN ('','z') OR NEW."commission" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),3),'s') placing 's' from 3 for 1); END IF;
END IF;
IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,4,1) IN ('','z') OR NEW."createdAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),4),'s') placing 's' from 4 for 1); END IF;
END IF;
IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,5,1) IN ('','z') OR NEW."updatedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),5),'s') placing 's' from 5 for 1); END IF;
END IF;
IF NEW."updatedBy" IS DISTINCT FROM OLD."updatedBy" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,6,1) IN ('','z') OR NEW."updatedBy" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),6),'s') placing 's' from 6 for 1); END IF;
END IF;
IF NEW."effectiveFrom" IS DISTINCT FROM OLD."effectiveFrom" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,7,1) IN ('','z') OR NEW."effectiveFrom" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),7),'s') placing 's' from 7 for 1); END IF;
END IF;
IF NEW."compensationType" IS DISTINCT FROM OLD."compensationType" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,8,1) IN ('','z') OR NEW."compensationType" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),8),'s') placing 's' from 8 for 1); END IF;
END IF;
IF NEW."commissionType" IS DISTINCT FROM OLD."commissionType" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,9,1) IN ('','z') OR NEW."commissionType" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),9),'s') placing 's' from 9 for 1); END IF;
END IF;
IF NEW."commissionBucketSales" IS DISTINCT FROM OLD."commissionBucketSales" THEN
IF NEW."commissionBucketSales__lexeme" IS NOT DISTINCT FROM OLD."commissionBucketSales__lexeme" THEN NEW."commissionBucketSales__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,10,1) IN ('','z') OR NEW."commissionBucketSales" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),10),'s') placing 's' from 10 for 1); END IF;
END IF;
IF NEW."commissionBucketAmount" IS DISTINCT FROM OLD."commissionBucketAmount" THEN
IF NEW."commissionBucketAmount__lexeme" IS NOT DISTINCT FROM OLD."commissionBucketAmount__lexeme" THEN NEW."commissionBucketAmount__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,11,1) IN ('','z') OR NEW."commissionBucketAmount" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),11),'s') placing 's' from 11 for 1); END IF;
END IF;
IF NEW."commissionRoundupThreshold" IS DISTINCT FROM OLD."commissionRoundupThreshold" THEN
IF NEW."commissionRoundupThreshold__lexeme" IS NOT DISTINCT FROM OLD."commissionRoundupThreshold__lexeme" THEN NEW."commissionRoundupThreshold__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,12,1) IN ('','z') OR NEW."commissionRoundupThreshold" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),12),'s') placing 's' from 12 for 1); END IF;
END IF;
END IF;
IF NEW.cell_kinds IS NOT NULL AND (length(NEW.cell_kinds)<1 OR length(NEW.cell_kinds)>12 OR NEW.cell_kinds !~ '^[snbz]+$') THEN RAISE EXCEPTION 'Invalid row encoding'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=0 AND NEW."employeeId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=1 AND NEW."baseSalary" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=2 AND NEW."commission" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=3 AND NEW."createdAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=4 AND NEW."updatedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=5 AND NEW."updatedBy" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=6 AND NEW."effectiveFrom" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=7 AND NEW."compensationType" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=8 AND NEW."commissionType" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=9 AND NEW."commissionBucketSales" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=10 AND NEW."commissionBucketAmount" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=11 AND NEW."commissionRoundupThreshold" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
PERFORM stock_operational.project_employee_compensations(NEW);
RETURN NEW; END $$;
CREATE FUNCTION stock_operational.compat_employee_compensations() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND (TG_NAME='y_explicit_cells' OR NEW.business_cells IS DISTINCT FROM OLD.business_cells) AND NEW.business_cells IS DISTINCT FROM stock_operational.project_employee_compensations(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer: write named columns'; END IF; IF TG_OP='INSERT' AND NEW.business_cells IS NOT NULL AND NEW.business_cells IS DISTINCT FROM stock_operational.project_employee_compensations(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer'; END IF; NEW.business_cells := stock_operational.project_employee_compensations(NEW); RETURN NEW; END $$;
ALTER TABLE stock_operational.employee_compensations DISABLE TRIGGER map_cells;
ALTER TABLE stock_operational.employee_compensations DISABLE TRIGGER advance_revision;
UPDATE stock_operational.employee_compensations t SET cell_kinds=i.cell_kinds,"baseSalary__lexeme"=i."baseSalary__lexeme","commission__lexeme"=i."commission__lexeme","commissionBucketSales__lexeme"=i."commissionBucketSales__lexeme","commissionBucketAmount__lexeme"=i."commissionBucketAmount__lexeme","commissionRoundupThreshold__lexeme"=i."commissionRoundupThreshold__lexeme" FROM (SELECT row_order AS source_order, (stock_operational.input_employee_compensations(business_cells)).* FROM stock_operational.employee_compensations) i WHERE t.row_order=i.source_order;
DO $$ BEGIN IF EXISTS(SELECT FROM stock_operational.employee_compensations t WHERE business_cells IS DISTINCT FROM stock_operational.project_employee_compensations(t)) THEN RAISE EXCEPTION 'Unrepresentable employee_compensations row; transition aborted'; END IF; END $$;
ALTER TABLE stock_operational.employee_compensations ENABLE TRIGGER advance_revision;
DROP TRIGGER map_cells ON stock_operational.employee_compensations;
ALTER TABLE stock_operational.employee_compensations ALTER COLUMN business_cells DROP NOT NULL;
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.employee_compensations FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_employee_compensations();
CREATE TRIGGER y_explicit_cells BEFORE UPDATE OF business_cells ON stock_operational.employee_compensations FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_employee_compensations();
CREATE TRIGGER z_compat BEFORE INSERT OR UPDATE ON stock_operational.employee_compensations FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_employee_compensations();
REVOKE ALL ON FUNCTION stock_operational.input_employee_compensations(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.input_employee_compensations(jsonb) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.project_employee_compensations(stock_operational.employee_compensations) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.project_employee_compensations(stock_operational.employee_compensations) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.validate_employee_compensations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.validate_employee_compensations() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.compat_employee_compensations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.compat_employee_compensations() TO stock_runtime;
ALTER TABLE stock_operational.employee_timesheets ADD COLUMN cell_kinds text;
CREATE FUNCTION stock_operational.input_employee_timesheets(cells jsonb) RETURNS stock_operational.employee_timesheets LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.employee_timesheets; BEGIN
IF jsonb_typeof(cells)<>'array' OR jsonb_array_length(cells)>7 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
r.cell_kinds := '';
IF jsonb_array_length(cells)>0 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->0)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."id" := nullif((cells->>0),'')::text;
IF jsonb_array_length(cells)>1 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->1)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."employeeId" := nullif((cells->>1),'')::text;
IF jsonb_array_length(cells)>2 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->2)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."shopId" := nullif((cells->>2),'')::text;
IF jsonb_array_length(cells)>3 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->3)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."status" := nullif((cells->>3),'')::text;
IF jsonb_array_length(cells)>4 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->4)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdAt" := nullif((cells->>4),'')::text;
IF jsonb_array_length(cells)>5 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->5)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."updatedAt" := nullif((cells->>5),'')::text;
IF jsonb_array_length(cells)>6 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->6)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."workdayType" := nullif((cells->>6),'')::text;
RETURN r; END $$;
CREATE FUNCTION stock_operational.project_employee_timesheets(r stock_operational.employee_timesheets) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(stock_operational.cell_projection(to_jsonb(r."id"),nullif(substr(r.cell_kinds,1,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."employeeId"),nullif(substr(r.cell_kinds,2,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."shopId"),nullif(substr(r.cell_kinds,3,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."status"),nullif(substr(r.cell_kinds,4,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdAt"),nullif(substr(r.cell_kinds,5,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."updatedAt"),nullif(substr(r.cell_kinds,6,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."workdayType"),nullif(substr(r.cell_kinds,7,1),''),NULL,'text'))) WITH ORDINALITY a(v,n) WHERE n<=coalesce(length(r.cell_kinds),7) $$;
CREATE FUNCTION stock_operational.validate_employee_timesheets() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE supplied_encoding boolean;
BEGIN
IF TG_OP='UPDATE' THEN supplied_encoding := NEW.cell_kinds IS DISTINCT FROM OLD.cell_kinds; ELSE supplied_encoding := true; END IF;
NEW."id" := nullif(NEW."id",'');
NEW."employeeId" := nullif(NEW."employeeId",'');
NEW."shopId" := nullif(NEW."shopId",'');
NEW."status" := nullif(NEW."status",'');
NEW."createdAt" := nullif(NEW."createdAt",'');
NEW."updatedAt" := nullif(NEW."updatedAt",'');
NEW."workdayType" := nullif(NEW."workdayType",'');
IF TG_OP='UPDATE' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW.row_order IS DISTINCT FROM OLD.row_order OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
IF NEW."id" IS DISTINCT FROM OLD."id" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,1,1) IN ('','z') OR NEW."id" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),1),'s') placing 's' from 1 for 1); END IF;
END IF;
IF NEW."employeeId" IS DISTINCT FROM OLD."employeeId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,2,1) IN ('','z') OR NEW."employeeId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),2),'s') placing 's' from 2 for 1); END IF;
END IF;
IF NEW."shopId" IS DISTINCT FROM OLD."shopId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,3,1) IN ('','z') OR NEW."shopId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),3),'s') placing 's' from 3 for 1); END IF;
END IF;
IF NEW."status" IS DISTINCT FROM OLD."status" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,4,1) IN ('','z') OR NEW."status" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),4),'s') placing 's' from 4 for 1); END IF;
END IF;
IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,5,1) IN ('','z') OR NEW."createdAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),5),'s') placing 's' from 5 for 1); END IF;
END IF;
IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,6,1) IN ('','z') OR NEW."updatedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),6),'s') placing 's' from 6 for 1); END IF;
END IF;
IF NEW."workdayType" IS DISTINCT FROM OLD."workdayType" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,7,1) IN ('','z') OR NEW."workdayType" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),7),'s') placing 's' from 7 for 1); END IF;
END IF;
END IF;
IF NEW.cell_kinds IS NOT NULL AND (length(NEW.cell_kinds)<1 OR length(NEW.cell_kinds)>7 OR NEW.cell_kinds !~ '^[snbz]+$') THEN RAISE EXCEPTION 'Invalid row encoding'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=0 AND NEW."id" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=1 AND NEW."employeeId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=2 AND NEW."shopId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=3 AND NEW."status" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=4 AND NEW."createdAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=5 AND NEW."updatedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=6 AND NEW."workdayType" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
PERFORM stock_operational.project_employee_timesheets(NEW);
RETURN NEW; END $$;
CREATE FUNCTION stock_operational.compat_employee_timesheets() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND (TG_NAME='y_explicit_cells' OR NEW.business_cells IS DISTINCT FROM OLD.business_cells) AND NEW.business_cells IS DISTINCT FROM stock_operational.project_employee_timesheets(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer: write named columns'; END IF; IF TG_OP='INSERT' AND NEW.business_cells IS NOT NULL AND NEW.business_cells IS DISTINCT FROM stock_operational.project_employee_timesheets(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer'; END IF; NEW.business_cells := stock_operational.project_employee_timesheets(NEW); RETURN NEW; END $$;
ALTER TABLE stock_operational.employee_timesheets DISABLE TRIGGER map_cells;
ALTER TABLE stock_operational.employee_timesheets DISABLE TRIGGER advance_revision;
UPDATE stock_operational.employee_timesheets t SET cell_kinds=i.cell_kinds FROM (SELECT row_order AS source_order, (stock_operational.input_employee_timesheets(business_cells)).* FROM stock_operational.employee_timesheets) i WHERE t.row_order=i.source_order;
DO $$ BEGIN IF EXISTS(SELECT FROM stock_operational.employee_timesheets t WHERE business_cells IS DISTINCT FROM stock_operational.project_employee_timesheets(t)) THEN RAISE EXCEPTION 'Unrepresentable employee_timesheets row; transition aborted'; END IF; END $$;
ALTER TABLE stock_operational.employee_timesheets ENABLE TRIGGER advance_revision;
DROP TRIGGER map_cells ON stock_operational.employee_timesheets;
ALTER TABLE stock_operational.employee_timesheets ALTER COLUMN business_cells DROP NOT NULL;
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.employee_timesheets FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_employee_timesheets();
CREATE TRIGGER y_explicit_cells BEFORE UPDATE OF business_cells ON stock_operational.employee_timesheets FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_employee_timesheets();
CREATE TRIGGER z_compat BEFORE INSERT OR UPDATE ON stock_operational.employee_timesheets FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_employee_timesheets();
REVOKE ALL ON FUNCTION stock_operational.input_employee_timesheets(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.input_employee_timesheets(jsonb) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.project_employee_timesheets(stock_operational.employee_timesheets) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.project_employee_timesheets(stock_operational.employee_timesheets) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.validate_employee_timesheets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.validate_employee_timesheets() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.compat_employee_timesheets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.compat_employee_timesheets() TO stock_runtime;
ALTER TABLE stock_operational.employee_advances ADD COLUMN cell_kinds text;
ALTER TABLE stock_operational.employee_advances ADD COLUMN "requestedAmount__lexeme" text;
ALTER TABLE stock_operational.employee_advances ADD COLUMN "paidAmount__lexeme" text;
CREATE FUNCTION stock_operational.input_employee_advances(cells jsonb) RETURNS stock_operational.employee_advances LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.employee_advances; BEGIN
IF jsonb_typeof(cells)<>'array' OR jsonb_array_length(cells)>13 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
r.cell_kinds := '';
IF jsonb_array_length(cells)>0 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->0)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."id" := nullif((cells->>0),'')::text;
IF jsonb_array_length(cells)>1 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->1)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."employeeId" := nullif((cells->>1),'')::text;
IF jsonb_array_length(cells)>2 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->2)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."shopId" := nullif((cells->>2),'')::text;
IF jsonb_array_length(cells)>3 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->3)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."requestedDate" := nullif((cells->>3),'')::text;
IF jsonb_array_length(cells)>4 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->4)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."payrollMonth" := nullif((cells->>4),'')::text;
IF jsonb_array_length(cells)>5 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->5)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."requestedAmount" := nullif((cells->>5),'')::numeric;
IF jsonb_typeof((cells->5))='string' AND (cells->>5)<>'' THEN r."requestedAmount__lexeme" := (cells->>5); END IF;
IF jsonb_array_length(cells)>6 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->6)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."paidAmount" := nullif((cells->>6),'')::numeric;
IF jsonb_typeof((cells->6))='string' AND (cells->>6)<>'' THEN r."paidAmount__lexeme" := (cells->>6); END IF;
IF jsonb_array_length(cells)>7 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->7)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."status" := nullif((cells->>7),'')::text;
IF jsonb_array_length(cells)>8 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->8)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."paidDate" := nullif((cells->>8),'')::text;
IF jsonb_array_length(cells)>9 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->9)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."reference" := nullif((cells->>9),'')::text;
IF jsonb_array_length(cells)>10 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->10)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."note" := nullif((cells->>10),'')::text;
IF jsonb_array_length(cells)>11 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->11)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdAt" := nullif((cells->>11),'')::text;
IF jsonb_array_length(cells)>12 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->12)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."updatedAt" := nullif((cells->>12),'')::text;
RETURN r; END $$;
CREATE FUNCTION stock_operational.project_employee_advances(r stock_operational.employee_advances) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(stock_operational.cell_projection(to_jsonb(r."id"),nullif(substr(r.cell_kinds,1,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."employeeId"),nullif(substr(r.cell_kinds,2,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."shopId"),nullif(substr(r.cell_kinds,3,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."requestedDate"),nullif(substr(r.cell_kinds,4,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."payrollMonth"),nullif(substr(r.cell_kinds,5,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."requestedAmount"),nullif(substr(r.cell_kinds,6,1),''),r."requestedAmount__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."paidAmount"),nullif(substr(r.cell_kinds,7,1),''),r."paidAmount__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."status"),nullif(substr(r.cell_kinds,8,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."paidDate"),nullif(substr(r.cell_kinds,9,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."reference"),nullif(substr(r.cell_kinds,10,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."note"),nullif(substr(r.cell_kinds,11,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdAt"),nullif(substr(r.cell_kinds,12,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."updatedAt"),nullif(substr(r.cell_kinds,13,1),''),NULL,'text'))) WITH ORDINALITY a(v,n) WHERE n<=coalesce(length(r.cell_kinds),13) $$;
CREATE FUNCTION stock_operational.validate_employee_advances() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE supplied_encoding boolean;
BEGIN
IF TG_OP='UPDATE' THEN supplied_encoding := NEW.cell_kinds IS DISTINCT FROM OLD.cell_kinds; ELSE supplied_encoding := true; END IF;
NEW."id" := nullif(NEW."id",'');
NEW."employeeId" := nullif(NEW."employeeId",'');
NEW."shopId" := nullif(NEW."shopId",'');
NEW."requestedDate" := nullif(NEW."requestedDate",'');
NEW."payrollMonth" := nullif(NEW."payrollMonth",'');
NEW."status" := nullif(NEW."status",'');
NEW."paidDate" := nullif(NEW."paidDate",'');
NEW."reference" := nullif(NEW."reference",'');
NEW."note" := nullif(NEW."note",'');
NEW."createdAt" := nullif(NEW."createdAt",'');
NEW."updatedAt" := nullif(NEW."updatedAt",'');
IF TG_OP='UPDATE' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW.row_order IS DISTINCT FROM OLD.row_order OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
IF NEW."id" IS DISTINCT FROM OLD."id" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,1,1) IN ('','z') OR NEW."id" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),1),'s') placing 's' from 1 for 1); END IF;
END IF;
IF NEW."employeeId" IS DISTINCT FROM OLD."employeeId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,2,1) IN ('','z') OR NEW."employeeId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),2),'s') placing 's' from 2 for 1); END IF;
END IF;
IF NEW."shopId" IS DISTINCT FROM OLD."shopId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,3,1) IN ('','z') OR NEW."shopId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),3),'s') placing 's' from 3 for 1); END IF;
END IF;
IF NEW."requestedDate" IS DISTINCT FROM OLD."requestedDate" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,4,1) IN ('','z') OR NEW."requestedDate" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),4),'s') placing 's' from 4 for 1); END IF;
END IF;
IF NEW."payrollMonth" IS DISTINCT FROM OLD."payrollMonth" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,5,1) IN ('','z') OR NEW."payrollMonth" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),5),'s') placing 's' from 5 for 1); END IF;
END IF;
IF NEW."requestedAmount" IS DISTINCT FROM OLD."requestedAmount" THEN
IF NEW."requestedAmount__lexeme" IS NOT DISTINCT FROM OLD."requestedAmount__lexeme" THEN NEW."requestedAmount__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,6,1) IN ('','z') OR NEW."requestedAmount" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),6),'s') placing 's' from 6 for 1); END IF;
END IF;
IF NEW."paidAmount" IS DISTINCT FROM OLD."paidAmount" THEN
IF NEW."paidAmount__lexeme" IS NOT DISTINCT FROM OLD."paidAmount__lexeme" THEN NEW."paidAmount__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,7,1) IN ('','z') OR NEW."paidAmount" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),7),'s') placing 's' from 7 for 1); END IF;
END IF;
IF NEW."status" IS DISTINCT FROM OLD."status" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,8,1) IN ('','z') OR NEW."status" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),8),'s') placing 's' from 8 for 1); END IF;
END IF;
IF NEW."paidDate" IS DISTINCT FROM OLD."paidDate" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,9,1) IN ('','z') OR NEW."paidDate" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),9),'s') placing 's' from 9 for 1); END IF;
END IF;
IF NEW."reference" IS DISTINCT FROM OLD."reference" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,10,1) IN ('','z') OR NEW."reference" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),10),'s') placing 's' from 10 for 1); END IF;
END IF;
IF NEW."note" IS DISTINCT FROM OLD."note" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,11,1) IN ('','z') OR NEW."note" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),11),'s') placing 's' from 11 for 1); END IF;
END IF;
IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,12,1) IN ('','z') OR NEW."createdAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),12),'s') placing 's' from 12 for 1); END IF;
END IF;
IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,13,1) IN ('','z') OR NEW."updatedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),13),'s') placing 's' from 13 for 1); END IF;
END IF;
END IF;
IF NEW.cell_kinds IS NOT NULL AND (length(NEW.cell_kinds)<1 OR length(NEW.cell_kinds)>13 OR NEW.cell_kinds !~ '^[snbz]+$') THEN RAISE EXCEPTION 'Invalid row encoding'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=0 AND NEW."id" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=1 AND NEW."employeeId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=2 AND NEW."shopId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=3 AND NEW."requestedDate" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=4 AND NEW."payrollMonth" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=5 AND NEW."requestedAmount" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=6 AND NEW."paidAmount" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=7 AND NEW."status" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=8 AND NEW."paidDate" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=9 AND NEW."reference" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=10 AND NEW."note" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=11 AND NEW."createdAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=12 AND NEW."updatedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
PERFORM stock_operational.project_employee_advances(NEW);
RETURN NEW; END $$;
CREATE FUNCTION stock_operational.compat_employee_advances() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND (TG_NAME='y_explicit_cells' OR NEW.business_cells IS DISTINCT FROM OLD.business_cells) AND NEW.business_cells IS DISTINCT FROM stock_operational.project_employee_advances(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer: write named columns'; END IF; IF TG_OP='INSERT' AND NEW.business_cells IS NOT NULL AND NEW.business_cells IS DISTINCT FROM stock_operational.project_employee_advances(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer'; END IF; NEW.business_cells := stock_operational.project_employee_advances(NEW); RETURN NEW; END $$;
ALTER TABLE stock_operational.employee_advances DISABLE TRIGGER map_cells;
ALTER TABLE stock_operational.employee_advances DISABLE TRIGGER advance_revision;
UPDATE stock_operational.employee_advances t SET cell_kinds=i.cell_kinds,"requestedAmount__lexeme"=i."requestedAmount__lexeme","paidAmount__lexeme"=i."paidAmount__lexeme" FROM (SELECT row_order AS source_order, (stock_operational.input_employee_advances(business_cells)).* FROM stock_operational.employee_advances) i WHERE t.row_order=i.source_order;
DO $$ BEGIN IF EXISTS(SELECT FROM stock_operational.employee_advances t WHERE business_cells IS DISTINCT FROM stock_operational.project_employee_advances(t)) THEN RAISE EXCEPTION 'Unrepresentable employee_advances row; transition aborted'; END IF; END $$;
ALTER TABLE stock_operational.employee_advances ENABLE TRIGGER advance_revision;
DROP TRIGGER map_cells ON stock_operational.employee_advances;
ALTER TABLE stock_operational.employee_advances ALTER COLUMN business_cells DROP NOT NULL;
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.employee_advances FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_employee_advances();
CREATE TRIGGER y_explicit_cells BEFORE UPDATE OF business_cells ON stock_operational.employee_advances FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_employee_advances();
CREATE TRIGGER z_compat BEFORE INSERT OR UPDATE ON stock_operational.employee_advances FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_employee_advances();
REVOKE ALL ON FUNCTION stock_operational.input_employee_advances(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.input_employee_advances(jsonb) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.project_employee_advances(stock_operational.employee_advances) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.project_employee_advances(stock_operational.employee_advances) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.validate_employee_advances() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.validate_employee_advances() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.compat_employee_advances() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.compat_employee_advances() TO stock_runtime;
ALTER TABLE stock_operational.payroll_settlements ADD COLUMN cell_kinds text;
ALTER TABLE stock_operational.payroll_settlements ADD COLUMN "snapshot__lexeme" text;
CREATE FUNCTION stock_operational.input_payroll_settlements(cells jsonb) RETURNS stock_operational.payroll_settlements LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.payroll_settlements; BEGIN
IF jsonb_typeof(cells)<>'array' OR jsonb_array_length(cells)>7 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
r.cell_kinds := '';
IF jsonb_array_length(cells)>0 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->0)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."id" := nullif((cells->>0),'')::text;
IF jsonb_array_length(cells)>1 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->1)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."employeeId" := nullif((cells->>1),'')::text;
IF jsonb_array_length(cells)>2 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->2)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."month" := nullif((cells->>2),'')::text;
IF jsonb_array_length(cells)>3 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->3)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."paidDate" := nullif((cells->>3),'')::text;
IF jsonb_array_length(cells)>4 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->4)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."reference" := nullif((cells->>4),'')::text;
IF jsonb_array_length(cells)>5 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->5)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdAt" := nullif((cells->>5),'')::text;
IF jsonb_array_length(cells)>6 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->6)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."snapshot" := nullif(nullif((cells->>6),'')::jsonb,'null'::jsonb);
IF jsonb_typeof((cells->6))='string' AND (cells->>6)<>'' THEN r."snapshot__lexeme" := (cells->>6); END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.project_payroll_settlements(r stock_operational.payroll_settlements) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(stock_operational.cell_projection(to_jsonb(r."id"),nullif(substr(r.cell_kinds,1,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."employeeId"),nullif(substr(r.cell_kinds,2,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."month"),nullif(substr(r.cell_kinds,3,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."paidDate"),nullif(substr(r.cell_kinds,4,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."reference"),nullif(substr(r.cell_kinds,5,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdAt"),nullif(substr(r.cell_kinds,6,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."snapshot"),nullif(substr(r.cell_kinds,7,1),''),r."snapshot__lexeme",'jsonb'))) WITH ORDINALITY a(v,n) WHERE n<=coalesce(length(r.cell_kinds),7) $$;
CREATE FUNCTION stock_operational.validate_payroll_settlements() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE supplied_encoding boolean;
BEGIN
IF TG_OP='UPDATE' THEN supplied_encoding := NEW.cell_kinds IS DISTINCT FROM OLD.cell_kinds; ELSE supplied_encoding := true; END IF;
NEW."id" := nullif(NEW."id",'');
NEW."employeeId" := nullif(NEW."employeeId",'');
NEW."month" := nullif(NEW."month",'');
NEW."paidDate" := nullif(NEW."paidDate",'');
NEW."reference" := nullif(NEW."reference",'');
NEW."createdAt" := nullif(NEW."createdAt",'');
IF TG_OP='UPDATE' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW.row_order IS DISTINCT FROM OLD.row_order OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
IF NEW."id" IS DISTINCT FROM OLD."id" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,1,1) IN ('','z') OR NEW."id" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),1),'s') placing 's' from 1 for 1); END IF;
END IF;
IF NEW."employeeId" IS DISTINCT FROM OLD."employeeId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,2,1) IN ('','z') OR NEW."employeeId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),2),'s') placing 's' from 2 for 1); END IF;
END IF;
IF NEW."month" IS DISTINCT FROM OLD."month" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,3,1) IN ('','z') OR NEW."month" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),3),'s') placing 's' from 3 for 1); END IF;
END IF;
IF NEW."paidDate" IS DISTINCT FROM OLD."paidDate" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,4,1) IN ('','z') OR NEW."paidDate" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),4),'s') placing 's' from 4 for 1); END IF;
END IF;
IF NEW."reference" IS DISTINCT FROM OLD."reference" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,5,1) IN ('','z') OR NEW."reference" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),5),'s') placing 's' from 5 for 1); END IF;
END IF;
IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,6,1) IN ('','z') OR NEW."createdAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),6),'s') placing 's' from 6 for 1); END IF;
END IF;
IF NEW."snapshot" IS DISTINCT FROM OLD."snapshot" THEN
IF NEW."snapshot__lexeme" IS NOT DISTINCT FROM OLD."snapshot__lexeme" THEN NEW."snapshot__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,7,1) IN ('','z') OR NEW."snapshot" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),7),'s') placing 's' from 7 for 1); END IF;
END IF;
END IF;
IF NEW.cell_kinds IS NOT NULL AND (length(NEW.cell_kinds)<1 OR length(NEW.cell_kinds)>7 OR NEW.cell_kinds !~ '^[snbz]+$') THEN RAISE EXCEPTION 'Invalid row encoding'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=0 AND NEW."id" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=1 AND NEW."employeeId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=2 AND NEW."month" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=3 AND NEW."paidDate" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=4 AND NEW."reference" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=5 AND NEW."createdAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=6 AND NEW."snapshot" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
PERFORM stock_operational.project_payroll_settlements(NEW);
RETURN NEW; END $$;
CREATE FUNCTION stock_operational.compat_payroll_settlements() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND (TG_NAME='y_explicit_cells' OR NEW.business_cells IS DISTINCT FROM OLD.business_cells) AND NEW.business_cells IS DISTINCT FROM stock_operational.project_payroll_settlements(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer: write named columns'; END IF; IF TG_OP='INSERT' AND NEW.business_cells IS NOT NULL AND NEW.business_cells IS DISTINCT FROM stock_operational.project_payroll_settlements(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer'; END IF; NEW.business_cells := stock_operational.project_payroll_settlements(NEW); RETURN NEW; END $$;
ALTER TABLE stock_operational.payroll_settlements DISABLE TRIGGER map_cells;
ALTER TABLE stock_operational.payroll_settlements DISABLE TRIGGER advance_revision;
UPDATE stock_operational.payroll_settlements t SET cell_kinds=i.cell_kinds,"snapshot__lexeme"=i."snapshot__lexeme" FROM (SELECT row_order AS source_order, (stock_operational.input_payroll_settlements(business_cells)).* FROM stock_operational.payroll_settlements) i WHERE t.row_order=i.source_order;
DO $$ BEGIN IF EXISTS(SELECT FROM stock_operational.payroll_settlements t WHERE business_cells IS DISTINCT FROM stock_operational.project_payroll_settlements(t)) THEN RAISE EXCEPTION 'Unrepresentable payroll_settlements row; transition aborted'; END IF; END $$;
ALTER TABLE stock_operational.payroll_settlements ENABLE TRIGGER advance_revision;
DROP TRIGGER map_cells ON stock_operational.payroll_settlements;
ALTER TABLE stock_operational.payroll_settlements ALTER COLUMN business_cells DROP NOT NULL;
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.payroll_settlements FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_payroll_settlements();
CREATE TRIGGER y_explicit_cells BEFORE UPDATE OF business_cells ON stock_operational.payroll_settlements FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_payroll_settlements();
CREATE TRIGGER z_compat BEFORE INSERT OR UPDATE ON stock_operational.payroll_settlements FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_payroll_settlements();
REVOKE ALL ON FUNCTION stock_operational.input_payroll_settlements(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.input_payroll_settlements(jsonb) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.project_payroll_settlements(stock_operational.payroll_settlements) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.project_payroll_settlements(stock_operational.payroll_settlements) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.validate_payroll_settlements() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.validate_payroll_settlements() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.compat_payroll_settlements() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.compat_payroll_settlements() TO stock_runtime;
ALTER TABLE stock_operational.expenses ADD COLUMN cell_kinds text;
ALTER TABLE stock_operational.expenses ADD COLUMN "amount__lexeme" text;
CREATE FUNCTION stock_operational.input_expenses(cells jsonb) RETURNS stock_operational.expenses LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.expenses; BEGIN
IF jsonb_typeof(cells)<>'array' OR jsonb_array_length(cells)>13 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
r.cell_kinds := '';
IF jsonb_array_length(cells)>0 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->0)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."id" := nullif((cells->>0),'')::text;
IF jsonb_array_length(cells)>1 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->1)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."month" := nullif((cells->>1),'')::text;
IF jsonb_array_length(cells)>2 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->2)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."expenseDate" := nullif((cells->>2),'')::text;
IF jsonb_array_length(cells)>3 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->3)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."shopId" := nullif((cells->>3),'')::text;
IF jsonb_array_length(cells)>4 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->4)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."scope" := nullif((cells->>4),'')::text;
IF jsonb_array_length(cells)>5 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->5)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."categoryId" := nullif((cells->>5),'')::text;
IF jsonb_array_length(cells)>6 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->6)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."name" := nullif((cells->>6),'')::text;
IF jsonb_array_length(cells)>7 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->7)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."amount" := nullif((cells->>7),'')::numeric;
IF jsonb_typeof((cells->7))='string' AND (cells->>7)<>'' THEN r."amount__lexeme" := (cells->>7); END IF;
IF jsonb_array_length(cells)>8 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->8)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."note" := nullif((cells->>8),'')::text;
IF jsonb_array_length(cells)>9 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->9)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdAt" := nullif((cells->>9),'')::text;
IF jsonb_array_length(cells)>10 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->10)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."updatedAt" := nullif((cells->>10),'')::text;
IF jsonb_array_length(cells)>11 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->11)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdBy" := nullif((cells->>11),'')::text;
IF jsonb_array_length(cells)>12 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->12)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."deletedAt" := nullif((cells->>12),'')::text;
RETURN r; END $$;
CREATE FUNCTION stock_operational.project_expenses(r stock_operational.expenses) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(stock_operational.cell_projection(to_jsonb(r."id"),nullif(substr(r.cell_kinds,1,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."month"),nullif(substr(r.cell_kinds,2,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."expenseDate"),nullif(substr(r.cell_kinds,3,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."shopId"),nullif(substr(r.cell_kinds,4,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."scope"),nullif(substr(r.cell_kinds,5,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."categoryId"),nullif(substr(r.cell_kinds,6,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."name"),nullif(substr(r.cell_kinds,7,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."amount"),nullif(substr(r.cell_kinds,8,1),''),r."amount__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."note"),nullif(substr(r.cell_kinds,9,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdAt"),nullif(substr(r.cell_kinds,10,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."updatedAt"),nullif(substr(r.cell_kinds,11,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdBy"),nullif(substr(r.cell_kinds,12,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."deletedAt"),nullif(substr(r.cell_kinds,13,1),''),NULL,'text'))) WITH ORDINALITY a(v,n) WHERE n<=coalesce(length(r.cell_kinds),13) $$;
CREATE FUNCTION stock_operational.validate_expenses() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE supplied_encoding boolean;
BEGIN
IF TG_OP='UPDATE' THEN supplied_encoding := NEW.cell_kinds IS DISTINCT FROM OLD.cell_kinds; ELSE supplied_encoding := true; END IF;
NEW."id" := nullif(NEW."id",'');
NEW."month" := nullif(NEW."month",'');
NEW."expenseDate" := nullif(NEW."expenseDate",'');
NEW."shopId" := nullif(NEW."shopId",'');
NEW."scope" := nullif(NEW."scope",'');
NEW."categoryId" := nullif(NEW."categoryId",'');
NEW."name" := nullif(NEW."name",'');
NEW."note" := nullif(NEW."note",'');
NEW."createdAt" := nullif(NEW."createdAt",'');
NEW."updatedAt" := nullif(NEW."updatedAt",'');
NEW."createdBy" := nullif(NEW."createdBy",'');
NEW."deletedAt" := nullif(NEW."deletedAt",'');
IF TG_OP='UPDATE' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW.row_order IS DISTINCT FROM OLD.row_order OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
IF NEW."id" IS DISTINCT FROM OLD."id" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,1,1) IN ('','z') OR NEW."id" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),1),'s') placing 's' from 1 for 1); END IF;
END IF;
IF NEW."month" IS DISTINCT FROM OLD."month" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,2,1) IN ('','z') OR NEW."month" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),2),'s') placing 's' from 2 for 1); END IF;
END IF;
IF NEW."expenseDate" IS DISTINCT FROM OLD."expenseDate" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,3,1) IN ('','z') OR NEW."expenseDate" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),3),'s') placing 's' from 3 for 1); END IF;
END IF;
IF NEW."shopId" IS DISTINCT FROM OLD."shopId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,4,1) IN ('','z') OR NEW."shopId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),4),'s') placing 's' from 4 for 1); END IF;
END IF;
IF NEW."scope" IS DISTINCT FROM OLD."scope" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,5,1) IN ('','z') OR NEW."scope" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),5),'s') placing 's' from 5 for 1); END IF;
END IF;
IF NEW."categoryId" IS DISTINCT FROM OLD."categoryId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,6,1) IN ('','z') OR NEW."categoryId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),6),'s') placing 's' from 6 for 1); END IF;
END IF;
IF NEW."name" IS DISTINCT FROM OLD."name" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,7,1) IN ('','z') OR NEW."name" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),7),'s') placing 's' from 7 for 1); END IF;
END IF;
IF NEW."amount" IS DISTINCT FROM OLD."amount" THEN
IF NEW."amount__lexeme" IS NOT DISTINCT FROM OLD."amount__lexeme" THEN NEW."amount__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,8,1) IN ('','z') OR NEW."amount" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),8),'s') placing 's' from 8 for 1); END IF;
END IF;
IF NEW."note" IS DISTINCT FROM OLD."note" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,9,1) IN ('','z') OR NEW."note" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),9),'s') placing 's' from 9 for 1); END IF;
END IF;
IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,10,1) IN ('','z') OR NEW."createdAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),10),'s') placing 's' from 10 for 1); END IF;
END IF;
IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,11,1) IN ('','z') OR NEW."updatedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),11),'s') placing 's' from 11 for 1); END IF;
END IF;
IF NEW."createdBy" IS DISTINCT FROM OLD."createdBy" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,12,1) IN ('','z') OR NEW."createdBy" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),12),'s') placing 's' from 12 for 1); END IF;
END IF;
IF NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,13,1) IN ('','z') OR NEW."deletedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),13),'s') placing 's' from 13 for 1); END IF;
END IF;
END IF;
IF NEW.cell_kinds IS NOT NULL AND (length(NEW.cell_kinds)<1 OR length(NEW.cell_kinds)>13 OR NEW.cell_kinds !~ '^[snbz]+$') THEN RAISE EXCEPTION 'Invalid row encoding'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=0 AND NEW."id" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=1 AND NEW."month" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=2 AND NEW."expenseDate" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=3 AND NEW."shopId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=4 AND NEW."scope" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=5 AND NEW."categoryId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=6 AND NEW."name" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=7 AND NEW."amount" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=8 AND NEW."note" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=9 AND NEW."createdAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=10 AND NEW."updatedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=11 AND NEW."createdBy" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=12 AND NEW."deletedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
PERFORM stock_operational.project_expenses(NEW);
RETURN NEW; END $$;
CREATE FUNCTION stock_operational.compat_expenses() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND (TG_NAME='y_explicit_cells' OR NEW.business_cells IS DISTINCT FROM OLD.business_cells) AND NEW.business_cells IS DISTINCT FROM stock_operational.project_expenses(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer: write named columns'; END IF; IF TG_OP='INSERT' AND NEW.business_cells IS NOT NULL AND NEW.business_cells IS DISTINCT FROM stock_operational.project_expenses(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer'; END IF; NEW.business_cells := stock_operational.project_expenses(NEW); RETURN NEW; END $$;
ALTER TABLE stock_operational.expenses DISABLE TRIGGER map_cells;
ALTER TABLE stock_operational.expenses DISABLE TRIGGER advance_revision;
UPDATE stock_operational.expenses t SET cell_kinds=i.cell_kinds,"amount__lexeme"=i."amount__lexeme" FROM (SELECT row_order AS source_order, (stock_operational.input_expenses(business_cells)).* FROM stock_operational.expenses) i WHERE t.row_order=i.source_order;
DO $$ BEGIN IF EXISTS(SELECT FROM stock_operational.expenses t WHERE business_cells IS DISTINCT FROM stock_operational.project_expenses(t)) THEN RAISE EXCEPTION 'Unrepresentable expenses row; transition aborted'; END IF; END $$;
ALTER TABLE stock_operational.expenses ENABLE TRIGGER advance_revision;
DROP TRIGGER map_cells ON stock_operational.expenses;
ALTER TABLE stock_operational.expenses ALTER COLUMN business_cells DROP NOT NULL;
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.expenses FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_expenses();
CREATE TRIGGER y_explicit_cells BEFORE UPDATE OF business_cells ON stock_operational.expenses FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_expenses();
CREATE TRIGGER z_compat BEFORE INSERT OR UPDATE ON stock_operational.expenses FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_expenses();
REVOKE ALL ON FUNCTION stock_operational.input_expenses(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.input_expenses(jsonb) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.project_expenses(stock_operational.expenses) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.project_expenses(stock_operational.expenses) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.validate_expenses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.validate_expenses() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.compat_expenses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.compat_expenses() TO stock_runtime;
ALTER TABLE stock_operational.expense_categories ADD COLUMN cell_kinds text;
ALTER TABLE stock_operational.expense_categories ADD COLUMN "active__lexeme" text;
CREATE FUNCTION stock_operational.input_expense_categories(cells jsonb) RETURNS stock_operational.expense_categories LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.expense_categories; BEGIN
IF jsonb_typeof(cells)<>'array' OR jsonb_array_length(cells)>5 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
r.cell_kinds := '';
IF jsonb_array_length(cells)>0 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->0)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."id" := nullif((cells->>0),'')::text;
IF jsonb_array_length(cells)>1 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->1)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."name" := nullif((cells->>1),'')::text;
IF jsonb_array_length(cells)>2 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->2)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."active" := nullif((cells->>2),'')::boolean;
IF jsonb_typeof((cells->2))='string' AND (cells->>2)<>'' THEN r."active__lexeme" := (cells->>2); END IF;
IF jsonb_array_length(cells)>3 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->3)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdAt" := nullif((cells->>3),'')::text;
IF jsonb_array_length(cells)>4 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->4)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."updatedAt" := nullif((cells->>4),'')::text;
RETURN r; END $$;
CREATE FUNCTION stock_operational.project_expense_categories(r stock_operational.expense_categories) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(stock_operational.cell_projection(to_jsonb(r."id"),nullif(substr(r.cell_kinds,1,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."name"),nullif(substr(r.cell_kinds,2,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."active"),nullif(substr(r.cell_kinds,3,1),''),r."active__lexeme",'boolean'),stock_operational.cell_projection(to_jsonb(r."createdAt"),nullif(substr(r.cell_kinds,4,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."updatedAt"),nullif(substr(r.cell_kinds,5,1),''),NULL,'text'))) WITH ORDINALITY a(v,n) WHERE n<=coalesce(length(r.cell_kinds),5) $$;
CREATE FUNCTION stock_operational.validate_expense_categories() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE supplied_encoding boolean;
BEGIN
IF TG_OP='UPDATE' THEN supplied_encoding := NEW.cell_kinds IS DISTINCT FROM OLD.cell_kinds; ELSE supplied_encoding := true; END IF;
NEW."id" := nullif(NEW."id",'');
NEW."name" := nullif(NEW."name",'');
NEW."createdAt" := nullif(NEW."createdAt",'');
NEW."updatedAt" := nullif(NEW."updatedAt",'');
IF TG_OP='UPDATE' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW.row_order IS DISTINCT FROM OLD.row_order OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
IF NEW."id" IS DISTINCT FROM OLD."id" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,1,1) IN ('','z') OR NEW."id" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),1),'s') placing 's' from 1 for 1); END IF;
END IF;
IF NEW."name" IS DISTINCT FROM OLD."name" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,2,1) IN ('','z') OR NEW."name" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),2),'s') placing 's' from 2 for 1); END IF;
END IF;
IF NEW."active" IS DISTINCT FROM OLD."active" THEN
IF NEW."active__lexeme" IS NOT DISTINCT FROM OLD."active__lexeme" THEN NEW."active__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,3,1) IN ('','z') OR NEW."active" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),3),'s') placing 's' from 3 for 1); END IF;
END IF;
IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,4,1) IN ('','z') OR NEW."createdAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),4),'s') placing 's' from 4 for 1); END IF;
END IF;
IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,5,1) IN ('','z') OR NEW."updatedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),5),'s') placing 's' from 5 for 1); END IF;
END IF;
END IF;
IF NEW.cell_kinds IS NOT NULL AND (length(NEW.cell_kinds)<1 OR length(NEW.cell_kinds)>5 OR NEW.cell_kinds !~ '^[snbz]+$') THEN RAISE EXCEPTION 'Invalid row encoding'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=0 AND NEW."id" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=1 AND NEW."name" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=2 AND NEW."active" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=3 AND NEW."createdAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=4 AND NEW."updatedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
PERFORM stock_operational.project_expense_categories(NEW);
RETURN NEW; END $$;
CREATE FUNCTION stock_operational.compat_expense_categories() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND (TG_NAME='y_explicit_cells' OR NEW.business_cells IS DISTINCT FROM OLD.business_cells) AND NEW.business_cells IS DISTINCT FROM stock_operational.project_expense_categories(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer: write named columns'; END IF; IF TG_OP='INSERT' AND NEW.business_cells IS NOT NULL AND NEW.business_cells IS DISTINCT FROM stock_operational.project_expense_categories(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer'; END IF; NEW.business_cells := stock_operational.project_expense_categories(NEW); RETURN NEW; END $$;
ALTER TABLE stock_operational.expense_categories DISABLE TRIGGER map_cells;
ALTER TABLE stock_operational.expense_categories DISABLE TRIGGER advance_revision;
UPDATE stock_operational.expense_categories t SET cell_kinds=i.cell_kinds,"active__lexeme"=i."active__lexeme" FROM (SELECT row_order AS source_order, (stock_operational.input_expense_categories(business_cells)).* FROM stock_operational.expense_categories) i WHERE t.row_order=i.source_order;
DO $$ BEGIN IF EXISTS(SELECT FROM stock_operational.expense_categories t WHERE business_cells IS DISTINCT FROM stock_operational.project_expense_categories(t)) THEN RAISE EXCEPTION 'Unrepresentable expense_categories row; transition aborted'; END IF; END $$;
ALTER TABLE stock_operational.expense_categories ENABLE TRIGGER advance_revision;
DROP TRIGGER map_cells ON stock_operational.expense_categories;
ALTER TABLE stock_operational.expense_categories ALTER COLUMN business_cells DROP NOT NULL;
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.expense_categories FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_expense_categories();
CREATE TRIGGER y_explicit_cells BEFORE UPDATE OF business_cells ON stock_operational.expense_categories FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_expense_categories();
CREATE TRIGGER z_compat BEFORE INSERT OR UPDATE ON stock_operational.expense_categories FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_expense_categories();
REVOKE ALL ON FUNCTION stock_operational.input_expense_categories(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.input_expense_categories(jsonb) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.project_expense_categories(stock_operational.expense_categories) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.project_expense_categories(stock_operational.expense_categories) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.validate_expense_categories() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.validate_expense_categories() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.compat_expense_categories() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.compat_expense_categories() TO stock_runtime;
ALTER TABLE stock_operational.shops ADD COLUMN cell_kinds text;
ALTER TABLE stock_operational.shops ADD COLUMN "active__lexeme" text;
CREATE FUNCTION stock_operational.input_shops(cells jsonb) RETURNS stock_operational.shops LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.shops; BEGIN
IF jsonb_typeof(cells)<>'array' OR jsonb_array_length(cells)>6 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
r.cell_kinds := '';
IF jsonb_array_length(cells)>0 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->0)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."id" := nullif((cells->>0),'')::text;
IF jsonb_array_length(cells)>1 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->1)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."name" := nullif((cells->>1),'')::text;
IF jsonb_array_length(cells)>2 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->2)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."active" := nullif((cells->>2),'')::boolean;
IF jsonb_typeof((cells->2))='string' AND (cells->>2)<>'' THEN r."active__lexeme" := (cells->>2); END IF;
IF jsonb_array_length(cells)>3 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->3)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."loyverseAccountId" := nullif((cells->>3),'')::text;
IF jsonb_array_length(cells)>4 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->4)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdAt" := nullif((cells->>4),'')::text;
IF jsonb_array_length(cells)>5 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->5)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."updatedAt" := nullif((cells->>5),'')::text;
RETURN r; END $$;
CREATE FUNCTION stock_operational.project_shops(r stock_operational.shops) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(stock_operational.cell_projection(to_jsonb(r."id"),nullif(substr(r.cell_kinds,1,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."name"),nullif(substr(r.cell_kinds,2,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."active"),nullif(substr(r.cell_kinds,3,1),''),r."active__lexeme",'boolean'),stock_operational.cell_projection(to_jsonb(r."loyverseAccountId"),nullif(substr(r.cell_kinds,4,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdAt"),nullif(substr(r.cell_kinds,5,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."updatedAt"),nullif(substr(r.cell_kinds,6,1),''),NULL,'text'))) WITH ORDINALITY a(v,n) WHERE n<=coalesce(length(r.cell_kinds),6) $$;
CREATE FUNCTION stock_operational.validate_shops() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE supplied_encoding boolean;
BEGIN
IF TG_OP='UPDATE' THEN supplied_encoding := NEW.cell_kinds IS DISTINCT FROM OLD.cell_kinds; ELSE supplied_encoding := true; END IF;
NEW."id" := nullif(NEW."id",'');
NEW."name" := nullif(NEW."name",'');
NEW."loyverseAccountId" := nullif(NEW."loyverseAccountId",'');
NEW."createdAt" := nullif(NEW."createdAt",'');
NEW."updatedAt" := nullif(NEW."updatedAt",'');
IF TG_OP='UPDATE' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW.row_order IS DISTINCT FROM OLD.row_order OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
IF NEW."id" IS DISTINCT FROM OLD."id" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,1,1) IN ('','z') OR NEW."id" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),1),'s') placing 's' from 1 for 1); END IF;
END IF;
IF NEW."name" IS DISTINCT FROM OLD."name" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,2,1) IN ('','z') OR NEW."name" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),2),'s') placing 's' from 2 for 1); END IF;
END IF;
IF NEW."active" IS DISTINCT FROM OLD."active" THEN
IF NEW."active__lexeme" IS NOT DISTINCT FROM OLD."active__lexeme" THEN NEW."active__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,3,1) IN ('','z') OR NEW."active" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),3),'s') placing 's' from 3 for 1); END IF;
END IF;
IF NEW."loyverseAccountId" IS DISTINCT FROM OLD."loyverseAccountId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,4,1) IN ('','z') OR NEW."loyverseAccountId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),4),'s') placing 's' from 4 for 1); END IF;
END IF;
IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,5,1) IN ('','z') OR NEW."createdAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),5),'s') placing 's' from 5 for 1); END IF;
END IF;
IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,6,1) IN ('','z') OR NEW."updatedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),6),'s') placing 's' from 6 for 1); END IF;
END IF;
END IF;
IF NEW.cell_kinds IS NOT NULL AND (length(NEW.cell_kinds)<1 OR length(NEW.cell_kinds)>6 OR NEW.cell_kinds !~ '^[snbz]+$') THEN RAISE EXCEPTION 'Invalid row encoding'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=0 AND NEW."id" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=1 AND NEW."name" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=2 AND NEW."active" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=3 AND NEW."loyverseAccountId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=4 AND NEW."createdAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=5 AND NEW."updatedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
PERFORM stock_operational.project_shops(NEW);
RETURN NEW; END $$;
CREATE FUNCTION stock_operational.compat_shops() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND (TG_NAME='y_explicit_cells' OR NEW.business_cells IS DISTINCT FROM OLD.business_cells) AND NEW.business_cells IS DISTINCT FROM stock_operational.project_shops(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer: write named columns'; END IF; IF TG_OP='INSERT' AND NEW.business_cells IS NOT NULL AND NEW.business_cells IS DISTINCT FROM stock_operational.project_shops(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer'; END IF; NEW.business_cells := stock_operational.project_shops(NEW); RETURN NEW; END $$;
ALTER TABLE stock_operational.shops DISABLE TRIGGER map_cells;
ALTER TABLE stock_operational.shops DISABLE TRIGGER advance_revision;
UPDATE stock_operational.shops t SET cell_kinds=i.cell_kinds,"active__lexeme"=i."active__lexeme" FROM (SELECT row_order AS source_order, (stock_operational.input_shops(business_cells)).* FROM stock_operational.shops) i WHERE t.row_order=i.source_order;
DO $$ BEGIN IF EXISTS(SELECT FROM stock_operational.shops t WHERE business_cells IS DISTINCT FROM stock_operational.project_shops(t)) THEN RAISE EXCEPTION 'Unrepresentable shops row; transition aborted'; END IF; END $$;
ALTER TABLE stock_operational.shops ENABLE TRIGGER advance_revision;
DROP TRIGGER map_cells ON stock_operational.shops;
ALTER TABLE stock_operational.shops ALTER COLUMN business_cells DROP NOT NULL;
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.shops FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_shops();
CREATE TRIGGER y_explicit_cells BEFORE UPDATE OF business_cells ON stock_operational.shops FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_shops();
CREATE TRIGGER z_compat BEFORE INSERT OR UPDATE ON stock_operational.shops FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_shops();
REVOKE ALL ON FUNCTION stock_operational.input_shops(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.input_shops(jsonb) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.project_shops(stock_operational.shops) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.project_shops(stock_operational.shops) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.validate_shops() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.validate_shops() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.compat_shops() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.compat_shops() TO stock_runtime;
ALTER TABLE stock_operational.sales_receipts ADD COLUMN cell_kinds text;
ALTER TABLE stock_operational.sales_receipts ADD COLUMN "totalMoney__lexeme" text;
ALTER TABLE stock_operational.sales_receipts ADD COLUMN "totalTax__lexeme" text;
ALTER TABLE stock_operational.sales_receipts ADD COLUMN "totalDiscount__lexeme" text;
ALTER TABLE stock_operational.sales_receipts ADD COLUMN "tip__lexeme" text;
ALTER TABLE stock_operational.sales_receipts ADD COLUMN "surcharge__lexeme" text;
ALTER TABLE stock_operational.sales_receipts ADD COLUMN "pointsEarned__lexeme" text;
ALTER TABLE stock_operational.sales_receipts ADD COLUMN "pointsDeducted__lexeme" text;
CREATE FUNCTION stock_operational.input_sales_receipts(cells jsonb) RETURNS stock_operational.sales_receipts LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.sales_receipts; BEGIN
IF jsonb_typeof(cells)<>'array' OR jsonb_array_length(cells)>26 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
r.cell_kinds := '';
IF jsonb_array_length(cells)>0 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->0)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."id" := nullif((cells->>0),'')::text;
IF jsonb_array_length(cells)>1 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->1)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."salesDate" := nullif((cells->>1),'')::text;
IF jsonb_array_length(cells)>2 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->2)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."accountId" := nullif((cells->>2),'')::text;
IF jsonb_array_length(cells)>3 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->3)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."shopName" := nullif((cells->>3),'')::text;
IF jsonb_array_length(cells)>4 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->4)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."receiptNumber" := nullif((cells->>4),'')::text;
IF jsonb_array_length(cells)>5 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->5)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."receiptType" := nullif((cells->>5),'')::text;
IF jsonb_array_length(cells)>6 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->6)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."refundFor" := nullif((cells->>6),'')::text;
IF jsonb_array_length(cells)>7 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->7)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."order" := nullif((cells->>7),'')::text;
IF jsonb_array_length(cells)>8 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->8)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."receiptDate" := nullif((cells->>8),'')::text;
IF jsonb_array_length(cells)>9 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->9)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdAt" := nullif((cells->>9),'')::text;
IF jsonb_array_length(cells)>10 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->10)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."updatedAt" := nullif((cells->>10),'')::text;
IF jsonb_array_length(cells)>11 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->11)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."cancelledAt" := nullif((cells->>11),'')::text;
IF jsonb_array_length(cells)>12 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->12)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."source" := nullif((cells->>12),'')::text;
IF jsonb_array_length(cells)>13 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->13)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."storeId" := nullif((cells->>13),'')::text;
IF jsonb_array_length(cells)>14 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->14)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."employeeId" := nullif((cells->>14),'')::text;
IF jsonb_array_length(cells)>15 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->15)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."customerId" := nullif((cells->>15),'')::text;
IF jsonb_array_length(cells)>16 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->16)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."posDeviceId" := nullif((cells->>16),'')::text;
IF jsonb_array_length(cells)>17 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->17)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."diningOption" := nullif((cells->>17),'')::text;
IF jsonb_array_length(cells)>18 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->18)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."totalMoney" := nullif((cells->>18),'')::numeric;
IF jsonb_typeof((cells->18))='string' AND (cells->>18)<>'' THEN r."totalMoney__lexeme" := (cells->>18); END IF;
IF jsonb_array_length(cells)>19 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->19)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."totalTax" := nullif((cells->>19),'')::numeric;
IF jsonb_typeof((cells->19))='string' AND (cells->>19)<>'' THEN r."totalTax__lexeme" := (cells->>19); END IF;
IF jsonb_array_length(cells)>20 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->20)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."totalDiscount" := nullif((cells->>20),'')::numeric;
IF jsonb_typeof((cells->20))='string' AND (cells->>20)<>'' THEN r."totalDiscount__lexeme" := (cells->>20); END IF;
IF jsonb_array_length(cells)>21 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->21)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."tip" := nullif((cells->>21),'')::numeric;
IF jsonb_typeof((cells->21))='string' AND (cells->>21)<>'' THEN r."tip__lexeme" := (cells->>21); END IF;
IF jsonb_array_length(cells)>22 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->22)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."surcharge" := nullif((cells->>22),'')::numeric;
IF jsonb_typeof((cells->22))='string' AND (cells->>22)<>'' THEN r."surcharge__lexeme" := (cells->>22); END IF;
IF jsonb_array_length(cells)>23 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->23)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."pointsEarned" := nullif((cells->>23),'')::numeric;
IF jsonb_typeof((cells->23))='string' AND (cells->>23)<>'' THEN r."pointsEarned__lexeme" := (cells->>23); END IF;
IF jsonb_array_length(cells)>24 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->24)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."pointsDeducted" := nullif((cells->>24),'')::numeric;
IF jsonb_typeof((cells->24))='string' AND (cells->>24)<>'' THEN r."pointsDeducted__lexeme" := (cells->>24); END IF;
IF jsonb_array_length(cells)>25 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->25)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."syncedAt" := nullif((cells->>25),'')::text;
RETURN r; END $$;
CREATE FUNCTION stock_operational.project_sales_receipts(r stock_operational.sales_receipts) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(stock_operational.cell_projection(to_jsonb(r."id"),nullif(substr(r.cell_kinds,1,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."salesDate"),nullif(substr(r.cell_kinds,2,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."accountId"),nullif(substr(r.cell_kinds,3,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."shopName"),nullif(substr(r.cell_kinds,4,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."receiptNumber"),nullif(substr(r.cell_kinds,5,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."receiptType"),nullif(substr(r.cell_kinds,6,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."refundFor"),nullif(substr(r.cell_kinds,7,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."order"),nullif(substr(r.cell_kinds,8,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."receiptDate"),nullif(substr(r.cell_kinds,9,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdAt"),nullif(substr(r.cell_kinds,10,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."updatedAt"),nullif(substr(r.cell_kinds,11,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."cancelledAt"),nullif(substr(r.cell_kinds,12,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."source"),nullif(substr(r.cell_kinds,13,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."storeId"),nullif(substr(r.cell_kinds,14,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."employeeId"),nullif(substr(r.cell_kinds,15,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."customerId"),nullif(substr(r.cell_kinds,16,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."posDeviceId"),nullif(substr(r.cell_kinds,17,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."diningOption"),nullif(substr(r.cell_kinds,18,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."totalMoney"),nullif(substr(r.cell_kinds,19,1),''),r."totalMoney__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."totalTax"),nullif(substr(r.cell_kinds,20,1),''),r."totalTax__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."totalDiscount"),nullif(substr(r.cell_kinds,21,1),''),r."totalDiscount__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."tip"),nullif(substr(r.cell_kinds,22,1),''),r."tip__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."surcharge"),nullif(substr(r.cell_kinds,23,1),''),r."surcharge__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."pointsEarned"),nullif(substr(r.cell_kinds,24,1),''),r."pointsEarned__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."pointsDeducted"),nullif(substr(r.cell_kinds,25,1),''),r."pointsDeducted__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."syncedAt"),nullif(substr(r.cell_kinds,26,1),''),NULL,'text'))) WITH ORDINALITY a(v,n) WHERE n<=coalesce(length(r.cell_kinds),26) $$;
CREATE FUNCTION stock_operational.validate_sales_receipts() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE supplied_encoding boolean;
BEGIN
IF TG_OP='UPDATE' THEN supplied_encoding := NEW.cell_kinds IS DISTINCT FROM OLD.cell_kinds; ELSE supplied_encoding := true; END IF;
NEW."id" := nullif(NEW."id",'');
NEW."salesDate" := nullif(NEW."salesDate",'');
NEW."accountId" := nullif(NEW."accountId",'');
NEW."shopName" := nullif(NEW."shopName",'');
NEW."receiptNumber" := nullif(NEW."receiptNumber",'');
NEW."receiptType" := nullif(NEW."receiptType",'');
NEW."refundFor" := nullif(NEW."refundFor",'');
NEW."order" := nullif(NEW."order",'');
NEW."receiptDate" := nullif(NEW."receiptDate",'');
NEW."createdAt" := nullif(NEW."createdAt",'');
NEW."updatedAt" := nullif(NEW."updatedAt",'');
NEW."cancelledAt" := nullif(NEW."cancelledAt",'');
NEW."source" := nullif(NEW."source",'');
NEW."storeId" := nullif(NEW."storeId",'');
NEW."employeeId" := nullif(NEW."employeeId",'');
NEW."customerId" := nullif(NEW."customerId",'');
NEW."posDeviceId" := nullif(NEW."posDeviceId",'');
NEW."diningOption" := nullif(NEW."diningOption",'');
NEW."syncedAt" := nullif(NEW."syncedAt",'');
IF TG_OP='UPDATE' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW.row_order IS DISTINCT FROM OLD.row_order OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
IF NEW."id" IS DISTINCT FROM OLD."id" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,1,1) IN ('','z') OR NEW."id" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),1),'s') placing 's' from 1 for 1); END IF;
END IF;
IF NEW."salesDate" IS DISTINCT FROM OLD."salesDate" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,2,1) IN ('','z') OR NEW."salesDate" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),2),'s') placing 's' from 2 for 1); END IF;
END IF;
IF NEW."accountId" IS DISTINCT FROM OLD."accountId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,3,1) IN ('','z') OR NEW."accountId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),3),'s') placing 's' from 3 for 1); END IF;
END IF;
IF NEW."shopName" IS DISTINCT FROM OLD."shopName" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,4,1) IN ('','z') OR NEW."shopName" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),4),'s') placing 's' from 4 for 1); END IF;
END IF;
IF NEW."receiptNumber" IS DISTINCT FROM OLD."receiptNumber" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,5,1) IN ('','z') OR NEW."receiptNumber" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),5),'s') placing 's' from 5 for 1); END IF;
END IF;
IF NEW."receiptType" IS DISTINCT FROM OLD."receiptType" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,6,1) IN ('','z') OR NEW."receiptType" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),6),'s') placing 's' from 6 for 1); END IF;
END IF;
IF NEW."refundFor" IS DISTINCT FROM OLD."refundFor" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,7,1) IN ('','z') OR NEW."refundFor" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),7),'s') placing 's' from 7 for 1); END IF;
END IF;
IF NEW."order" IS DISTINCT FROM OLD."order" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,8,1) IN ('','z') OR NEW."order" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),8),'s') placing 's' from 8 for 1); END IF;
END IF;
IF NEW."receiptDate" IS DISTINCT FROM OLD."receiptDate" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,9,1) IN ('','z') OR NEW."receiptDate" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),9),'s') placing 's' from 9 for 1); END IF;
END IF;
IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,10,1) IN ('','z') OR NEW."createdAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),10),'s') placing 's' from 10 for 1); END IF;
END IF;
IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,11,1) IN ('','z') OR NEW."updatedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),11),'s') placing 's' from 11 for 1); END IF;
END IF;
IF NEW."cancelledAt" IS DISTINCT FROM OLD."cancelledAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,12,1) IN ('','z') OR NEW."cancelledAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),12),'s') placing 's' from 12 for 1); END IF;
END IF;
IF NEW."source" IS DISTINCT FROM OLD."source" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,13,1) IN ('','z') OR NEW."source" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),13),'s') placing 's' from 13 for 1); END IF;
END IF;
IF NEW."storeId" IS DISTINCT FROM OLD."storeId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,14,1) IN ('','z') OR NEW."storeId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),14),'s') placing 's' from 14 for 1); END IF;
END IF;
IF NEW."employeeId" IS DISTINCT FROM OLD."employeeId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,15,1) IN ('','z') OR NEW."employeeId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),15),'s') placing 's' from 15 for 1); END IF;
END IF;
IF NEW."customerId" IS DISTINCT FROM OLD."customerId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,16,1) IN ('','z') OR NEW."customerId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),16),'s') placing 's' from 16 for 1); END IF;
END IF;
IF NEW."posDeviceId" IS DISTINCT FROM OLD."posDeviceId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,17,1) IN ('','z') OR NEW."posDeviceId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),17),'s') placing 's' from 17 for 1); END IF;
END IF;
IF NEW."diningOption" IS DISTINCT FROM OLD."diningOption" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,18,1) IN ('','z') OR NEW."diningOption" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),18),'s') placing 's' from 18 for 1); END IF;
END IF;
IF NEW."totalMoney" IS DISTINCT FROM OLD."totalMoney" THEN
IF NEW."totalMoney__lexeme" IS NOT DISTINCT FROM OLD."totalMoney__lexeme" THEN NEW."totalMoney__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,19,1) IN ('','z') OR NEW."totalMoney" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),19),'s') placing 's' from 19 for 1); END IF;
END IF;
IF NEW."totalTax" IS DISTINCT FROM OLD."totalTax" THEN
IF NEW."totalTax__lexeme" IS NOT DISTINCT FROM OLD."totalTax__lexeme" THEN NEW."totalTax__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,20,1) IN ('','z') OR NEW."totalTax" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),20),'s') placing 's' from 20 for 1); END IF;
END IF;
IF NEW."totalDiscount" IS DISTINCT FROM OLD."totalDiscount" THEN
IF NEW."totalDiscount__lexeme" IS NOT DISTINCT FROM OLD."totalDiscount__lexeme" THEN NEW."totalDiscount__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,21,1) IN ('','z') OR NEW."totalDiscount" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),21),'s') placing 's' from 21 for 1); END IF;
END IF;
IF NEW."tip" IS DISTINCT FROM OLD."tip" THEN
IF NEW."tip__lexeme" IS NOT DISTINCT FROM OLD."tip__lexeme" THEN NEW."tip__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,22,1) IN ('','z') OR NEW."tip" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),22),'s') placing 's' from 22 for 1); END IF;
END IF;
IF NEW."surcharge" IS DISTINCT FROM OLD."surcharge" THEN
IF NEW."surcharge__lexeme" IS NOT DISTINCT FROM OLD."surcharge__lexeme" THEN NEW."surcharge__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,23,1) IN ('','z') OR NEW."surcharge" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),23),'s') placing 's' from 23 for 1); END IF;
END IF;
IF NEW."pointsEarned" IS DISTINCT FROM OLD."pointsEarned" THEN
IF NEW."pointsEarned__lexeme" IS NOT DISTINCT FROM OLD."pointsEarned__lexeme" THEN NEW."pointsEarned__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,24,1) IN ('','z') OR NEW."pointsEarned" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),24),'s') placing 's' from 24 for 1); END IF;
END IF;
IF NEW."pointsDeducted" IS DISTINCT FROM OLD."pointsDeducted" THEN
IF NEW."pointsDeducted__lexeme" IS NOT DISTINCT FROM OLD."pointsDeducted__lexeme" THEN NEW."pointsDeducted__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,25,1) IN ('','z') OR NEW."pointsDeducted" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),25),'s') placing 's' from 25 for 1); END IF;
END IF;
IF NEW."syncedAt" IS DISTINCT FROM OLD."syncedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,26,1) IN ('','z') OR NEW."syncedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),26),'s') placing 's' from 26 for 1); END IF;
END IF;
END IF;
IF NEW.cell_kinds IS NOT NULL AND (length(NEW.cell_kinds)<1 OR length(NEW.cell_kinds)>26 OR NEW.cell_kinds !~ '^[snbz]+$') THEN RAISE EXCEPTION 'Invalid row encoding'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=0 AND NEW."id" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=1 AND NEW."salesDate" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=2 AND NEW."accountId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=3 AND NEW."shopName" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=4 AND NEW."receiptNumber" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=5 AND NEW."receiptType" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=6 AND NEW."refundFor" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=7 AND NEW."order" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=8 AND NEW."receiptDate" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=9 AND NEW."createdAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=10 AND NEW."updatedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=11 AND NEW."cancelledAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=12 AND NEW."source" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=13 AND NEW."storeId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=14 AND NEW."employeeId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=15 AND NEW."customerId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=16 AND NEW."posDeviceId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=17 AND NEW."diningOption" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=18 AND NEW."totalMoney" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=19 AND NEW."totalTax" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=20 AND NEW."totalDiscount" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=21 AND NEW."tip" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=22 AND NEW."surcharge" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=23 AND NEW."pointsEarned" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=24 AND NEW."pointsDeducted" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=25 AND NEW."syncedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
PERFORM stock_operational.project_sales_receipts(NEW);
RETURN NEW; END $$;
CREATE FUNCTION stock_operational.compat_sales_receipts() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND (TG_NAME='y_explicit_cells' OR NEW.business_cells IS DISTINCT FROM OLD.business_cells) AND NEW.business_cells IS DISTINCT FROM stock_operational.project_sales_receipts(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer: write named columns'; END IF; IF TG_OP='INSERT' AND NEW.business_cells IS NOT NULL AND NEW.business_cells IS DISTINCT FROM stock_operational.project_sales_receipts(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer'; END IF; NEW.business_cells := stock_operational.project_sales_receipts(NEW); RETURN NEW; END $$;
ALTER TABLE stock_operational.sales_receipts DISABLE TRIGGER map_cells;
ALTER TABLE stock_operational.sales_receipts DISABLE TRIGGER advance_revision;
UPDATE stock_operational.sales_receipts t SET cell_kinds=i.cell_kinds,"totalMoney__lexeme"=i."totalMoney__lexeme","totalTax__lexeme"=i."totalTax__lexeme","totalDiscount__lexeme"=i."totalDiscount__lexeme","tip__lexeme"=i."tip__lexeme","surcharge__lexeme"=i."surcharge__lexeme","pointsEarned__lexeme"=i."pointsEarned__lexeme","pointsDeducted__lexeme"=i."pointsDeducted__lexeme" FROM (SELECT row_order AS source_order, (stock_operational.input_sales_receipts(business_cells)).* FROM stock_operational.sales_receipts) i WHERE t.row_order=i.source_order;
DO $$ BEGIN IF EXISTS(SELECT FROM stock_operational.sales_receipts t WHERE business_cells IS DISTINCT FROM stock_operational.project_sales_receipts(t)) THEN RAISE EXCEPTION 'Unrepresentable sales_receipts row; transition aborted'; END IF; END $$;
ALTER TABLE stock_operational.sales_receipts ENABLE TRIGGER advance_revision;
DROP TRIGGER map_cells ON stock_operational.sales_receipts;
ALTER TABLE stock_operational.sales_receipts ALTER COLUMN business_cells DROP NOT NULL;
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.sales_receipts FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_sales_receipts();
CREATE TRIGGER y_explicit_cells BEFORE UPDATE OF business_cells ON stock_operational.sales_receipts FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_sales_receipts();
CREATE TRIGGER z_compat BEFORE INSERT OR UPDATE ON stock_operational.sales_receipts FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_sales_receipts();
REVOKE ALL ON FUNCTION stock_operational.input_sales_receipts(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.input_sales_receipts(jsonb) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.project_sales_receipts(stock_operational.sales_receipts) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.project_sales_receipts(stock_operational.sales_receipts) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.validate_sales_receipts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.validate_sales_receipts() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.compat_sales_receipts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.compat_sales_receipts() TO stock_runtime;
ALTER TABLE stock_operational.sales_receipt_items ADD COLUMN cell_kinds text;
ALTER TABLE stock_operational.sales_receipt_items ADD COLUMN "quantity__lexeme" text;
ALTER TABLE stock_operational.sales_receipt_items ADD COLUMN "price__lexeme" text;
ALTER TABLE stock_operational.sales_receipt_items ADD COLUMN "grossTotalMoney__lexeme" text;
ALTER TABLE stock_operational.sales_receipt_items ADD COLUMN "totalDiscount__lexeme" text;
ALTER TABLE stock_operational.sales_receipt_items ADD COLUMN "totalMoney__lexeme" text;
ALTER TABLE stock_operational.sales_receipt_items ADD COLUMN "cost__lexeme" text;
ALTER TABLE stock_operational.sales_receipt_items ADD COLUMN "costTotal__lexeme" text;
ALTER TABLE stock_operational.sales_receipt_items ADD COLUMN "taxes__lexeme" text;
ALTER TABLE stock_operational.sales_receipt_items ADD COLUMN "lineDiscountsJson__lexeme" text;
ALTER TABLE stock_operational.sales_receipt_items ADD COLUMN "lineTaxesJson__lexeme" text;
ALTER TABLE stock_operational.sales_receipt_items ADD COLUMN "lineModifiersJson__lexeme" text;
CREATE FUNCTION stock_operational.input_sales_receipt_items(cells jsonb) RETURNS stock_operational.sales_receipt_items LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.sales_receipt_items; BEGIN
IF jsonb_typeof(cells)<>'array' OR jsonb_array_length(cells)>21 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
r.cell_kinds := '';
IF jsonb_array_length(cells)>0 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->0)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."id" := nullif((cells->>0),'')::text;
IF jsonb_array_length(cells)>1 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->1)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."receiptId" := nullif((cells->>1),'')::text;
IF jsonb_array_length(cells)>2 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->2)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."lineItemId" := nullif((cells->>2),'')::text;
IF jsonb_array_length(cells)>3 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->3)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."itemId" := nullif((cells->>3),'')::text;
IF jsonb_array_length(cells)>4 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->4)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."variantId" := nullif((cells->>4),'')::text;
IF jsonb_array_length(cells)>5 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->5)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."itemName" := nullif((cells->>5),'')::text;
IF jsonb_array_length(cells)>6 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->6)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."variantName" := nullif((cells->>6),'')::text;
IF jsonb_array_length(cells)>7 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->7)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."sku" := nullif((cells->>7),'')::text;
IF jsonb_array_length(cells)>8 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->8)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."quantity" := nullif((cells->>8),'')::numeric;
IF jsonb_typeof((cells->8))='string' AND (cells->>8)<>'' THEN r."quantity__lexeme" := (cells->>8); END IF;
IF jsonb_array_length(cells)>9 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->9)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."price" := nullif((cells->>9),'')::numeric;
IF jsonb_typeof((cells->9))='string' AND (cells->>9)<>'' THEN r."price__lexeme" := (cells->>9); END IF;
IF jsonb_array_length(cells)>10 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->10)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."grossTotalMoney" := nullif((cells->>10),'')::numeric;
IF jsonb_typeof((cells->10))='string' AND (cells->>10)<>'' THEN r."grossTotalMoney__lexeme" := (cells->>10); END IF;
IF jsonb_array_length(cells)>11 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->11)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."totalDiscount" := nullif((cells->>11),'')::numeric;
IF jsonb_typeof((cells->11))='string' AND (cells->>11)<>'' THEN r."totalDiscount__lexeme" := (cells->>11); END IF;
IF jsonb_array_length(cells)>12 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->12)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."totalMoney" := nullif((cells->>12),'')::numeric;
IF jsonb_typeof((cells->12))='string' AND (cells->>12)<>'' THEN r."totalMoney__lexeme" := (cells->>12); END IF;
IF jsonb_array_length(cells)>13 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->13)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."cost" := nullif((cells->>13),'')::numeric;
IF jsonb_typeof((cells->13))='string' AND (cells->>13)<>'' THEN r."cost__lexeme" := (cells->>13); END IF;
IF jsonb_array_length(cells)>14 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->14)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."costTotal" := nullif((cells->>14),'')::numeric;
IF jsonb_typeof((cells->14))='string' AND (cells->>14)<>'' THEN r."costTotal__lexeme" := (cells->>14); END IF;
IF jsonb_array_length(cells)>15 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->15)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."taxes" := nullif((cells->>15),'')::numeric;
IF jsonb_typeof((cells->15))='string' AND (cells->>15)<>'' THEN r."taxes__lexeme" := (cells->>15); END IF;
IF jsonb_array_length(cells)>16 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->16)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."lineNote" := nullif((cells->>16),'')::text;
IF jsonb_array_length(cells)>17 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->17)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."lineDiscountsJson" := nullif(nullif((cells->>17),'')::jsonb,'null'::jsonb);
IF jsonb_typeof((cells->17))='string' AND (cells->>17)<>'' THEN r."lineDiscountsJson__lexeme" := (cells->>17); END IF;
IF jsonb_array_length(cells)>18 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->18)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."lineTaxesJson" := nullif(nullif((cells->>18),'')::jsonb,'null'::jsonb);
IF jsonb_typeof((cells->18))='string' AND (cells->>18)<>'' THEN r."lineTaxesJson__lexeme" := (cells->>18); END IF;
IF jsonb_array_length(cells)>19 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->19)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."lineModifiersJson" := nullif(nullif((cells->>19),'')::jsonb,'null'::jsonb);
IF jsonb_typeof((cells->19))='string' AND (cells->>19)<>'' THEN r."lineModifiersJson__lexeme" := (cells->>19); END IF;
IF jsonb_array_length(cells)>20 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->20)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."syncedAt" := nullif((cells->>20),'')::text;
RETURN r; END $$;
CREATE FUNCTION stock_operational.project_sales_receipt_items(r stock_operational.sales_receipt_items) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(stock_operational.cell_projection(to_jsonb(r."id"),nullif(substr(r.cell_kinds,1,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."receiptId"),nullif(substr(r.cell_kinds,2,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."lineItemId"),nullif(substr(r.cell_kinds,3,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."itemId"),nullif(substr(r.cell_kinds,4,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."variantId"),nullif(substr(r.cell_kinds,5,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."itemName"),nullif(substr(r.cell_kinds,6,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."variantName"),nullif(substr(r.cell_kinds,7,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."sku"),nullif(substr(r.cell_kinds,8,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."quantity"),nullif(substr(r.cell_kinds,9,1),''),r."quantity__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."price"),nullif(substr(r.cell_kinds,10,1),''),r."price__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."grossTotalMoney"),nullif(substr(r.cell_kinds,11,1),''),r."grossTotalMoney__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."totalDiscount"),nullif(substr(r.cell_kinds,12,1),''),r."totalDiscount__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."totalMoney"),nullif(substr(r.cell_kinds,13,1),''),r."totalMoney__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."cost"),nullif(substr(r.cell_kinds,14,1),''),r."cost__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."costTotal"),nullif(substr(r.cell_kinds,15,1),''),r."costTotal__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."taxes"),nullif(substr(r.cell_kinds,16,1),''),r."taxes__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."lineNote"),nullif(substr(r.cell_kinds,17,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."lineDiscountsJson"),nullif(substr(r.cell_kinds,18,1),''),r."lineDiscountsJson__lexeme",'jsonb'),stock_operational.cell_projection(to_jsonb(r."lineTaxesJson"),nullif(substr(r.cell_kinds,19,1),''),r."lineTaxesJson__lexeme",'jsonb'),stock_operational.cell_projection(to_jsonb(r."lineModifiersJson"),nullif(substr(r.cell_kinds,20,1),''),r."lineModifiersJson__lexeme",'jsonb'),stock_operational.cell_projection(to_jsonb(r."syncedAt"),nullif(substr(r.cell_kinds,21,1),''),NULL,'text'))) WITH ORDINALITY a(v,n) WHERE n<=coalesce(length(r.cell_kinds),21) $$;
CREATE FUNCTION stock_operational.validate_sales_receipt_items() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE supplied_encoding boolean;
BEGIN
IF TG_OP='UPDATE' THEN supplied_encoding := NEW.cell_kinds IS DISTINCT FROM OLD.cell_kinds; ELSE supplied_encoding := true; END IF;
NEW."id" := nullif(NEW."id",'');
NEW."receiptId" := nullif(NEW."receiptId",'');
NEW."lineItemId" := nullif(NEW."lineItemId",'');
NEW."itemId" := nullif(NEW."itemId",'');
NEW."variantId" := nullif(NEW."variantId",'');
NEW."itemName" := nullif(NEW."itemName",'');
NEW."variantName" := nullif(NEW."variantName",'');
NEW."sku" := nullif(NEW."sku",'');
NEW."lineNote" := nullif(NEW."lineNote",'');
NEW."syncedAt" := nullif(NEW."syncedAt",'');
IF TG_OP='UPDATE' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW.row_order IS DISTINCT FROM OLD.row_order OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
IF NEW."id" IS DISTINCT FROM OLD."id" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,1,1) IN ('','z') OR NEW."id" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),1),'s') placing 's' from 1 for 1); END IF;
END IF;
IF NEW."receiptId" IS DISTINCT FROM OLD."receiptId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,2,1) IN ('','z') OR NEW."receiptId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),2),'s') placing 's' from 2 for 1); END IF;
END IF;
IF NEW."lineItemId" IS DISTINCT FROM OLD."lineItemId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,3,1) IN ('','z') OR NEW."lineItemId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),3),'s') placing 's' from 3 for 1); END IF;
END IF;
IF NEW."itemId" IS DISTINCT FROM OLD."itemId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,4,1) IN ('','z') OR NEW."itemId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),4),'s') placing 's' from 4 for 1); END IF;
END IF;
IF NEW."variantId" IS DISTINCT FROM OLD."variantId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,5,1) IN ('','z') OR NEW."variantId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),5),'s') placing 's' from 5 for 1); END IF;
END IF;
IF NEW."itemName" IS DISTINCT FROM OLD."itemName" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,6,1) IN ('','z') OR NEW."itemName" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),6),'s') placing 's' from 6 for 1); END IF;
END IF;
IF NEW."variantName" IS DISTINCT FROM OLD."variantName" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,7,1) IN ('','z') OR NEW."variantName" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),7),'s') placing 's' from 7 for 1); END IF;
END IF;
IF NEW."sku" IS DISTINCT FROM OLD."sku" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,8,1) IN ('','z') OR NEW."sku" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),8),'s') placing 's' from 8 for 1); END IF;
END IF;
IF NEW."quantity" IS DISTINCT FROM OLD."quantity" THEN
IF NEW."quantity__lexeme" IS NOT DISTINCT FROM OLD."quantity__lexeme" THEN NEW."quantity__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,9,1) IN ('','z') OR NEW."quantity" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),9),'s') placing 's' from 9 for 1); END IF;
END IF;
IF NEW."price" IS DISTINCT FROM OLD."price" THEN
IF NEW."price__lexeme" IS NOT DISTINCT FROM OLD."price__lexeme" THEN NEW."price__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,10,1) IN ('','z') OR NEW."price" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),10),'s') placing 's' from 10 for 1); END IF;
END IF;
IF NEW."grossTotalMoney" IS DISTINCT FROM OLD."grossTotalMoney" THEN
IF NEW."grossTotalMoney__lexeme" IS NOT DISTINCT FROM OLD."grossTotalMoney__lexeme" THEN NEW."grossTotalMoney__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,11,1) IN ('','z') OR NEW."grossTotalMoney" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),11),'s') placing 's' from 11 for 1); END IF;
END IF;
IF NEW."totalDiscount" IS DISTINCT FROM OLD."totalDiscount" THEN
IF NEW."totalDiscount__lexeme" IS NOT DISTINCT FROM OLD."totalDiscount__lexeme" THEN NEW."totalDiscount__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,12,1) IN ('','z') OR NEW."totalDiscount" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),12),'s') placing 's' from 12 for 1); END IF;
END IF;
IF NEW."totalMoney" IS DISTINCT FROM OLD."totalMoney" THEN
IF NEW."totalMoney__lexeme" IS NOT DISTINCT FROM OLD."totalMoney__lexeme" THEN NEW."totalMoney__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,13,1) IN ('','z') OR NEW."totalMoney" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),13),'s') placing 's' from 13 for 1); END IF;
END IF;
IF NEW."cost" IS DISTINCT FROM OLD."cost" THEN
IF NEW."cost__lexeme" IS NOT DISTINCT FROM OLD."cost__lexeme" THEN NEW."cost__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,14,1) IN ('','z') OR NEW."cost" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),14),'s') placing 's' from 14 for 1); END IF;
END IF;
IF NEW."costTotal" IS DISTINCT FROM OLD."costTotal" THEN
IF NEW."costTotal__lexeme" IS NOT DISTINCT FROM OLD."costTotal__lexeme" THEN NEW."costTotal__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,15,1) IN ('','z') OR NEW."costTotal" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),15),'s') placing 's' from 15 for 1); END IF;
END IF;
IF NEW."taxes" IS DISTINCT FROM OLD."taxes" THEN
IF NEW."taxes__lexeme" IS NOT DISTINCT FROM OLD."taxes__lexeme" THEN NEW."taxes__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,16,1) IN ('','z') OR NEW."taxes" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),16),'s') placing 's' from 16 for 1); END IF;
END IF;
IF NEW."lineNote" IS DISTINCT FROM OLD."lineNote" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,17,1) IN ('','z') OR NEW."lineNote" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),17),'s') placing 's' from 17 for 1); END IF;
END IF;
IF NEW."lineDiscountsJson" IS DISTINCT FROM OLD."lineDiscountsJson" THEN
IF NEW."lineDiscountsJson__lexeme" IS NOT DISTINCT FROM OLD."lineDiscountsJson__lexeme" THEN NEW."lineDiscountsJson__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,18,1) IN ('','z') OR NEW."lineDiscountsJson" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),18),'s') placing 's' from 18 for 1); END IF;
END IF;
IF NEW."lineTaxesJson" IS DISTINCT FROM OLD."lineTaxesJson" THEN
IF NEW."lineTaxesJson__lexeme" IS NOT DISTINCT FROM OLD."lineTaxesJson__lexeme" THEN NEW."lineTaxesJson__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,19,1) IN ('','z') OR NEW."lineTaxesJson" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),19),'s') placing 's' from 19 for 1); END IF;
END IF;
IF NEW."lineModifiersJson" IS DISTINCT FROM OLD."lineModifiersJson" THEN
IF NEW."lineModifiersJson__lexeme" IS NOT DISTINCT FROM OLD."lineModifiersJson__lexeme" THEN NEW."lineModifiersJson__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,20,1) IN ('','z') OR NEW."lineModifiersJson" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),20),'s') placing 's' from 20 for 1); END IF;
END IF;
IF NEW."syncedAt" IS DISTINCT FROM OLD."syncedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,21,1) IN ('','z') OR NEW."syncedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),21),'s') placing 's' from 21 for 1); END IF;
END IF;
END IF;
IF NEW.cell_kinds IS NOT NULL AND (length(NEW.cell_kinds)<1 OR length(NEW.cell_kinds)>21 OR NEW.cell_kinds !~ '^[snbz]+$') THEN RAISE EXCEPTION 'Invalid row encoding'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=0 AND NEW."id" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=1 AND NEW."receiptId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=2 AND NEW."lineItemId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=3 AND NEW."itemId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=4 AND NEW."variantId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=5 AND NEW."itemName" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=6 AND NEW."variantName" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=7 AND NEW."sku" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=8 AND NEW."quantity" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=9 AND NEW."price" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=10 AND NEW."grossTotalMoney" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=11 AND NEW."totalDiscount" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=12 AND NEW."totalMoney" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=13 AND NEW."cost" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=14 AND NEW."costTotal" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=15 AND NEW."taxes" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=16 AND NEW."lineNote" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=17 AND NEW."lineDiscountsJson" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=18 AND NEW."lineTaxesJson" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=19 AND NEW."lineModifiersJson" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=20 AND NEW."syncedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
PERFORM stock_operational.project_sales_receipt_items(NEW);
RETURN NEW; END $$;
CREATE FUNCTION stock_operational.compat_sales_receipt_items() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND (TG_NAME='y_explicit_cells' OR NEW.business_cells IS DISTINCT FROM OLD.business_cells) AND NEW.business_cells IS DISTINCT FROM stock_operational.project_sales_receipt_items(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer: write named columns'; END IF; IF TG_OP='INSERT' AND NEW.business_cells IS NOT NULL AND NEW.business_cells IS DISTINCT FROM stock_operational.project_sales_receipt_items(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer'; END IF; NEW.business_cells := stock_operational.project_sales_receipt_items(NEW); RETURN NEW; END $$;
ALTER TABLE stock_operational.sales_receipt_items DISABLE TRIGGER map_cells;
ALTER TABLE stock_operational.sales_receipt_items DISABLE TRIGGER advance_revision;
UPDATE stock_operational.sales_receipt_items t SET cell_kinds=i.cell_kinds,"quantity__lexeme"=i."quantity__lexeme","price__lexeme"=i."price__lexeme","grossTotalMoney__lexeme"=i."grossTotalMoney__lexeme","totalDiscount__lexeme"=i."totalDiscount__lexeme","totalMoney__lexeme"=i."totalMoney__lexeme","cost__lexeme"=i."cost__lexeme","costTotal__lexeme"=i."costTotal__lexeme","taxes__lexeme"=i."taxes__lexeme","lineDiscountsJson__lexeme"=i."lineDiscountsJson__lexeme","lineTaxesJson__lexeme"=i."lineTaxesJson__lexeme","lineModifiersJson__lexeme"=i."lineModifiersJson__lexeme" FROM (SELECT row_order AS source_order, (stock_operational.input_sales_receipt_items(business_cells)).* FROM stock_operational.sales_receipt_items) i WHERE t.row_order=i.source_order;
DO $$ BEGIN IF EXISTS(SELECT FROM stock_operational.sales_receipt_items t WHERE business_cells IS DISTINCT FROM stock_operational.project_sales_receipt_items(t)) THEN RAISE EXCEPTION 'Unrepresentable sales_receipt_items row; transition aborted'; END IF; END $$;
ALTER TABLE stock_operational.sales_receipt_items ENABLE TRIGGER advance_revision;
DROP TRIGGER map_cells ON stock_operational.sales_receipt_items;
ALTER TABLE stock_operational.sales_receipt_items ALTER COLUMN business_cells DROP NOT NULL;
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.sales_receipt_items FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_sales_receipt_items();
CREATE TRIGGER y_explicit_cells BEFORE UPDATE OF business_cells ON stock_operational.sales_receipt_items FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_sales_receipt_items();
CREATE TRIGGER z_compat BEFORE INSERT OR UPDATE ON stock_operational.sales_receipt_items FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_sales_receipt_items();
REVOKE ALL ON FUNCTION stock_operational.input_sales_receipt_items(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.input_sales_receipt_items(jsonb) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.project_sales_receipt_items(stock_operational.sales_receipt_items) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.project_sales_receipt_items(stock_operational.sales_receipt_items) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.validate_sales_receipt_items() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.validate_sales_receipt_items() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.compat_sales_receipt_items() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.compat_sales_receipt_items() TO stock_runtime;
ALTER TABLE stock_operational.sales_receipt_payments ADD COLUMN cell_kinds text;
ALTER TABLE stock_operational.sales_receipt_payments ADD COLUMN "paymentIndex__lexeme" text;
ALTER TABLE stock_operational.sales_receipt_payments ADD COLUMN "moneyAmount__lexeme" text;
ALTER TABLE stock_operational.sales_receipt_payments ADD COLUMN "paymentDetailsJson__lexeme" text;
CREATE FUNCTION stock_operational.input_sales_receipt_payments(cells jsonb) RETURNS stock_operational.sales_receipt_payments LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.sales_receipt_payments; BEGIN
IF jsonb_typeof(cells)<>'array' OR jsonb_array_length(cells)>10 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
r.cell_kinds := '';
IF jsonb_array_length(cells)>0 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->0)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."id" := nullif((cells->>0),'')::text;
IF jsonb_array_length(cells)>1 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->1)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."receiptId" := nullif((cells->>1),'')::text;
IF jsonb_array_length(cells)>2 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->2)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."paymentIndex" := nullif((cells->>2),'')::bigint;
IF jsonb_typeof((cells->2))='string' AND (cells->>2)<>'' THEN r."paymentIndex__lexeme" := (cells->>2); END IF;
IF jsonb_array_length(cells)>3 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->3)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."paymentTypeId" := nullif((cells->>3),'')::text;
IF jsonb_array_length(cells)>4 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->4)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."paymentName" := nullif((cells->>4),'')::text;
IF jsonb_array_length(cells)>5 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->5)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."paymentType" := nullif((cells->>5),'')::text;
IF jsonb_array_length(cells)>6 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->6)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."moneyAmount" := nullif((cells->>6),'')::numeric;
IF jsonb_typeof((cells->6))='string' AND (cells->>6)<>'' THEN r."moneyAmount__lexeme" := (cells->>6); END IF;
IF jsonb_array_length(cells)>7 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->7)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."paidAt" := nullif((cells->>7),'')::text;
IF jsonb_array_length(cells)>8 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->8)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."paymentDetailsJson" := nullif(nullif((cells->>8),'')::jsonb,'null'::jsonb);
IF jsonb_typeof((cells->8))='string' AND (cells->>8)<>'' THEN r."paymentDetailsJson__lexeme" := (cells->>8); END IF;
IF jsonb_array_length(cells)>9 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->9)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."syncedAt" := nullif((cells->>9),'')::text;
RETURN r; END $$;
CREATE FUNCTION stock_operational.project_sales_receipt_payments(r stock_operational.sales_receipt_payments) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(stock_operational.cell_projection(to_jsonb(r."id"),nullif(substr(r.cell_kinds,1,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."receiptId"),nullif(substr(r.cell_kinds,2,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."paymentIndex"),nullif(substr(r.cell_kinds,3,1),''),r."paymentIndex__lexeme",'bigint'),stock_operational.cell_projection(to_jsonb(r."paymentTypeId"),nullif(substr(r.cell_kinds,4,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."paymentName"),nullif(substr(r.cell_kinds,5,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."paymentType"),nullif(substr(r.cell_kinds,6,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."moneyAmount"),nullif(substr(r.cell_kinds,7,1),''),r."moneyAmount__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."paidAt"),nullif(substr(r.cell_kinds,8,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."paymentDetailsJson"),nullif(substr(r.cell_kinds,9,1),''),r."paymentDetailsJson__lexeme",'jsonb'),stock_operational.cell_projection(to_jsonb(r."syncedAt"),nullif(substr(r.cell_kinds,10,1),''),NULL,'text'))) WITH ORDINALITY a(v,n) WHERE n<=coalesce(length(r.cell_kinds),10) $$;
CREATE FUNCTION stock_operational.validate_sales_receipt_payments() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE supplied_encoding boolean;
BEGIN
IF TG_OP='UPDATE' THEN supplied_encoding := NEW.cell_kinds IS DISTINCT FROM OLD.cell_kinds; ELSE supplied_encoding := true; END IF;
NEW."id" := nullif(NEW."id",'');
NEW."receiptId" := nullif(NEW."receiptId",'');
NEW."paymentTypeId" := nullif(NEW."paymentTypeId",'');
NEW."paymentName" := nullif(NEW."paymentName",'');
NEW."paymentType" := nullif(NEW."paymentType",'');
NEW."paidAt" := nullif(NEW."paidAt",'');
NEW."syncedAt" := nullif(NEW."syncedAt",'');
IF TG_OP='UPDATE' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW.row_order IS DISTINCT FROM OLD.row_order OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
IF NEW."id" IS DISTINCT FROM OLD."id" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,1,1) IN ('','z') OR NEW."id" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),1),'s') placing 's' from 1 for 1); END IF;
END IF;
IF NEW."receiptId" IS DISTINCT FROM OLD."receiptId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,2,1) IN ('','z') OR NEW."receiptId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),2),'s') placing 's' from 2 for 1); END IF;
END IF;
IF NEW."paymentIndex" IS DISTINCT FROM OLD."paymentIndex" THEN
IF NEW."paymentIndex__lexeme" IS NOT DISTINCT FROM OLD."paymentIndex__lexeme" THEN NEW."paymentIndex__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,3,1) IN ('','z') OR NEW."paymentIndex" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),3),'s') placing 's' from 3 for 1); END IF;
END IF;
IF NEW."paymentTypeId" IS DISTINCT FROM OLD."paymentTypeId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,4,1) IN ('','z') OR NEW."paymentTypeId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),4),'s') placing 's' from 4 for 1); END IF;
END IF;
IF NEW."paymentName" IS DISTINCT FROM OLD."paymentName" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,5,1) IN ('','z') OR NEW."paymentName" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),5),'s') placing 's' from 5 for 1); END IF;
END IF;
IF NEW."paymentType" IS DISTINCT FROM OLD."paymentType" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,6,1) IN ('','z') OR NEW."paymentType" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),6),'s') placing 's' from 6 for 1); END IF;
END IF;
IF NEW."moneyAmount" IS DISTINCT FROM OLD."moneyAmount" THEN
IF NEW."moneyAmount__lexeme" IS NOT DISTINCT FROM OLD."moneyAmount__lexeme" THEN NEW."moneyAmount__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,7,1) IN ('','z') OR NEW."moneyAmount" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),7),'s') placing 's' from 7 for 1); END IF;
END IF;
IF NEW."paidAt" IS DISTINCT FROM OLD."paidAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,8,1) IN ('','z') OR NEW."paidAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),8),'s') placing 's' from 8 for 1); END IF;
END IF;
IF NEW."paymentDetailsJson" IS DISTINCT FROM OLD."paymentDetailsJson" THEN
IF NEW."paymentDetailsJson__lexeme" IS NOT DISTINCT FROM OLD."paymentDetailsJson__lexeme" THEN NEW."paymentDetailsJson__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,9,1) IN ('','z') OR NEW."paymentDetailsJson" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),9),'s') placing 's' from 9 for 1); END IF;
END IF;
IF NEW."syncedAt" IS DISTINCT FROM OLD."syncedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,10,1) IN ('','z') OR NEW."syncedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),10),'s') placing 's' from 10 for 1); END IF;
END IF;
END IF;
IF NEW.cell_kinds IS NOT NULL AND (length(NEW.cell_kinds)<1 OR length(NEW.cell_kinds)>10 OR NEW.cell_kinds !~ '^[snbz]+$') THEN RAISE EXCEPTION 'Invalid row encoding'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=0 AND NEW."id" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=1 AND NEW."receiptId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=2 AND NEW."paymentIndex" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=3 AND NEW."paymentTypeId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=4 AND NEW."paymentName" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=5 AND NEW."paymentType" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=6 AND NEW."moneyAmount" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=7 AND NEW."paidAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=8 AND NEW."paymentDetailsJson" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=9 AND NEW."syncedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
PERFORM stock_operational.project_sales_receipt_payments(NEW);
RETURN NEW; END $$;
CREATE FUNCTION stock_operational.compat_sales_receipt_payments() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND (TG_NAME='y_explicit_cells' OR NEW.business_cells IS DISTINCT FROM OLD.business_cells) AND NEW.business_cells IS DISTINCT FROM stock_operational.project_sales_receipt_payments(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer: write named columns'; END IF; IF TG_OP='INSERT' AND NEW.business_cells IS NOT NULL AND NEW.business_cells IS DISTINCT FROM stock_operational.project_sales_receipt_payments(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer'; END IF; NEW.business_cells := stock_operational.project_sales_receipt_payments(NEW); RETURN NEW; END $$;
ALTER TABLE stock_operational.sales_receipt_payments DISABLE TRIGGER map_cells;
ALTER TABLE stock_operational.sales_receipt_payments DISABLE TRIGGER advance_revision;
UPDATE stock_operational.sales_receipt_payments t SET cell_kinds=i.cell_kinds,"paymentIndex__lexeme"=i."paymentIndex__lexeme","moneyAmount__lexeme"=i."moneyAmount__lexeme","paymentDetailsJson__lexeme"=i."paymentDetailsJson__lexeme" FROM (SELECT row_order AS source_order, (stock_operational.input_sales_receipt_payments(business_cells)).* FROM stock_operational.sales_receipt_payments) i WHERE t.row_order=i.source_order;
DO $$ BEGIN IF EXISTS(SELECT FROM stock_operational.sales_receipt_payments t WHERE business_cells IS DISTINCT FROM stock_operational.project_sales_receipt_payments(t)) THEN RAISE EXCEPTION 'Unrepresentable sales_receipt_payments row; transition aborted'; END IF; END $$;
ALTER TABLE stock_operational.sales_receipt_payments ENABLE TRIGGER advance_revision;
DROP TRIGGER map_cells ON stock_operational.sales_receipt_payments;
ALTER TABLE stock_operational.sales_receipt_payments ALTER COLUMN business_cells DROP NOT NULL;
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.sales_receipt_payments FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_sales_receipt_payments();
CREATE TRIGGER y_explicit_cells BEFORE UPDATE OF business_cells ON stock_operational.sales_receipt_payments FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_sales_receipt_payments();
CREATE TRIGGER z_compat BEFORE INSERT OR UPDATE ON stock_operational.sales_receipt_payments FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_sales_receipt_payments();
REVOKE ALL ON FUNCTION stock_operational.input_sales_receipt_payments(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.input_sales_receipt_payments(jsonb) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.project_sales_receipt_payments(stock_operational.sales_receipt_payments) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.project_sales_receipt_payments(stock_operational.sales_receipt_payments) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.validate_sales_receipt_payments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.validate_sales_receipt_payments() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.compat_sales_receipt_payments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.compat_sales_receipt_payments() TO stock_runtime;
ALTER TABLE stock_operational.sales_receipt_syncs ADD COLUMN cell_kinds text;
ALTER TABLE stock_operational.sales_receipt_syncs ADD COLUMN "receiptCount__lexeme" text;
ALTER TABLE stock_operational.sales_receipt_syncs ADD COLUMN "itemCount__lexeme" text;
ALTER TABLE stock_operational.sales_receipt_syncs ADD COLUMN "paymentCount__lexeme" text;
CREATE FUNCTION stock_operational.input_sales_receipt_syncs(cells jsonb) RETURNS stock_operational.sales_receipt_syncs LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.sales_receipt_syncs; BEGIN
IF jsonb_typeof(cells)<>'array' OR jsonb_array_length(cells)>9 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
r.cell_kinds := '';
IF jsonb_array_length(cells)>0 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->0)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."id" := nullif((cells->>0),'')::text;
IF jsonb_array_length(cells)>1 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->1)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."salesDate" := nullif((cells->>1),'')::text;
IF jsonb_array_length(cells)>2 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->2)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."accountId" := nullif((cells->>2),'')::text;
IF jsonb_array_length(cells)>3 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->3)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."shopName" := nullif((cells->>3),'')::text;
IF jsonb_array_length(cells)>4 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->4)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."status" := nullif((cells->>4),'')::text;
IF jsonb_array_length(cells)>5 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->5)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."receiptCount" := nullif((cells->>5),'')::bigint;
IF jsonb_typeof((cells->5))='string' AND (cells->>5)<>'' THEN r."receiptCount__lexeme" := (cells->>5); END IF;
IF jsonb_array_length(cells)>6 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->6)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."itemCount" := nullif((cells->>6),'')::bigint;
IF jsonb_typeof((cells->6))='string' AND (cells->>6)<>'' THEN r."itemCount__lexeme" := (cells->>6); END IF;
IF jsonb_array_length(cells)>7 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->7)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."paymentCount" := nullif((cells->>7),'')::bigint;
IF jsonb_typeof((cells->7))='string' AND (cells->>7)<>'' THEN r."paymentCount__lexeme" := (cells->>7); END IF;
IF jsonb_array_length(cells)>8 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->8)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."syncedAt" := nullif((cells->>8),'')::text;
RETURN r; END $$;
CREATE FUNCTION stock_operational.project_sales_receipt_syncs(r stock_operational.sales_receipt_syncs) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(stock_operational.cell_projection(to_jsonb(r."id"),nullif(substr(r.cell_kinds,1,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."salesDate"),nullif(substr(r.cell_kinds,2,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."accountId"),nullif(substr(r.cell_kinds,3,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."shopName"),nullif(substr(r.cell_kinds,4,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."status"),nullif(substr(r.cell_kinds,5,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."receiptCount"),nullif(substr(r.cell_kinds,6,1),''),r."receiptCount__lexeme",'bigint'),stock_operational.cell_projection(to_jsonb(r."itemCount"),nullif(substr(r.cell_kinds,7,1),''),r."itemCount__lexeme",'bigint'),stock_operational.cell_projection(to_jsonb(r."paymentCount"),nullif(substr(r.cell_kinds,8,1),''),r."paymentCount__lexeme",'bigint'),stock_operational.cell_projection(to_jsonb(r."syncedAt"),nullif(substr(r.cell_kinds,9,1),''),NULL,'text'))) WITH ORDINALITY a(v,n) WHERE n<=coalesce(length(r.cell_kinds),9) $$;
CREATE FUNCTION stock_operational.validate_sales_receipt_syncs() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE supplied_encoding boolean;
BEGIN
IF TG_OP='UPDATE' THEN supplied_encoding := NEW.cell_kinds IS DISTINCT FROM OLD.cell_kinds; ELSE supplied_encoding := true; END IF;
NEW."id" := nullif(NEW."id",'');
NEW."salesDate" := nullif(NEW."salesDate",'');
NEW."accountId" := nullif(NEW."accountId",'');
NEW."shopName" := nullif(NEW."shopName",'');
NEW."status" := nullif(NEW."status",'');
NEW."syncedAt" := nullif(NEW."syncedAt",'');
IF TG_OP='UPDATE' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW.row_order IS DISTINCT FROM OLD.row_order OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
IF NEW."id" IS DISTINCT FROM OLD."id" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,1,1) IN ('','z') OR NEW."id" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),1),'s') placing 's' from 1 for 1); END IF;
END IF;
IF NEW."salesDate" IS DISTINCT FROM OLD."salesDate" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,2,1) IN ('','z') OR NEW."salesDate" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),2),'s') placing 's' from 2 for 1); END IF;
END IF;
IF NEW."accountId" IS DISTINCT FROM OLD."accountId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,3,1) IN ('','z') OR NEW."accountId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),3),'s') placing 's' from 3 for 1); END IF;
END IF;
IF NEW."shopName" IS DISTINCT FROM OLD."shopName" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,4,1) IN ('','z') OR NEW."shopName" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),4),'s') placing 's' from 4 for 1); END IF;
END IF;
IF NEW."status" IS DISTINCT FROM OLD."status" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,5,1) IN ('','z') OR NEW."status" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),5),'s') placing 's' from 5 for 1); END IF;
END IF;
IF NEW."receiptCount" IS DISTINCT FROM OLD."receiptCount" THEN
IF NEW."receiptCount__lexeme" IS NOT DISTINCT FROM OLD."receiptCount__lexeme" THEN NEW."receiptCount__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,6,1) IN ('','z') OR NEW."receiptCount" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),6),'s') placing 's' from 6 for 1); END IF;
END IF;
IF NEW."itemCount" IS DISTINCT FROM OLD."itemCount" THEN
IF NEW."itemCount__lexeme" IS NOT DISTINCT FROM OLD."itemCount__lexeme" THEN NEW."itemCount__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,7,1) IN ('','z') OR NEW."itemCount" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),7),'s') placing 's' from 7 for 1); END IF;
END IF;
IF NEW."paymentCount" IS DISTINCT FROM OLD."paymentCount" THEN
IF NEW."paymentCount__lexeme" IS NOT DISTINCT FROM OLD."paymentCount__lexeme" THEN NEW."paymentCount__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,8,1) IN ('','z') OR NEW."paymentCount" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),8),'s') placing 's' from 8 for 1); END IF;
END IF;
IF NEW."syncedAt" IS DISTINCT FROM OLD."syncedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,9,1) IN ('','z') OR NEW."syncedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),9),'s') placing 's' from 9 for 1); END IF;
END IF;
END IF;
IF NEW.cell_kinds IS NOT NULL AND (length(NEW.cell_kinds)<1 OR length(NEW.cell_kinds)>9 OR NEW.cell_kinds !~ '^[snbz]+$') THEN RAISE EXCEPTION 'Invalid row encoding'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=0 AND NEW."id" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=1 AND NEW."salesDate" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=2 AND NEW."accountId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=3 AND NEW."shopName" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=4 AND NEW."status" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=5 AND NEW."receiptCount" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=6 AND NEW."itemCount" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=7 AND NEW."paymentCount" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=8 AND NEW."syncedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
PERFORM stock_operational.project_sales_receipt_syncs(NEW);
RETURN NEW; END $$;
CREATE FUNCTION stock_operational.compat_sales_receipt_syncs() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND (TG_NAME='y_explicit_cells' OR NEW.business_cells IS DISTINCT FROM OLD.business_cells) AND NEW.business_cells IS DISTINCT FROM stock_operational.project_sales_receipt_syncs(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer: write named columns'; END IF; IF TG_OP='INSERT' AND NEW.business_cells IS NOT NULL AND NEW.business_cells IS DISTINCT FROM stock_operational.project_sales_receipt_syncs(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer'; END IF; NEW.business_cells := stock_operational.project_sales_receipt_syncs(NEW); RETURN NEW; END $$;
ALTER TABLE stock_operational.sales_receipt_syncs DISABLE TRIGGER map_cells;
ALTER TABLE stock_operational.sales_receipt_syncs DISABLE TRIGGER advance_revision;
UPDATE stock_operational.sales_receipt_syncs t SET cell_kinds=i.cell_kinds,"receiptCount__lexeme"=i."receiptCount__lexeme","itemCount__lexeme"=i."itemCount__lexeme","paymentCount__lexeme"=i."paymentCount__lexeme" FROM (SELECT row_order AS source_order, (stock_operational.input_sales_receipt_syncs(business_cells)).* FROM stock_operational.sales_receipt_syncs) i WHERE t.row_order=i.source_order;
DO $$ BEGIN IF EXISTS(SELECT FROM stock_operational.sales_receipt_syncs t WHERE business_cells IS DISTINCT FROM stock_operational.project_sales_receipt_syncs(t)) THEN RAISE EXCEPTION 'Unrepresentable sales_receipt_syncs row; transition aborted'; END IF; END $$;
ALTER TABLE stock_operational.sales_receipt_syncs ENABLE TRIGGER advance_revision;
DROP TRIGGER map_cells ON stock_operational.sales_receipt_syncs;
ALTER TABLE stock_operational.sales_receipt_syncs ALTER COLUMN business_cells DROP NOT NULL;
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.sales_receipt_syncs FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_sales_receipt_syncs();
CREATE TRIGGER y_explicit_cells BEFORE UPDATE OF business_cells ON stock_operational.sales_receipt_syncs FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_sales_receipt_syncs();
CREATE TRIGGER z_compat BEFORE INSERT OR UPDATE ON stock_operational.sales_receipt_syncs FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_sales_receipt_syncs();
REVOKE ALL ON FUNCTION stock_operational.input_sales_receipt_syncs(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.input_sales_receipt_syncs(jsonb) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.project_sales_receipt_syncs(stock_operational.sales_receipt_syncs) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.project_sales_receipt_syncs(stock_operational.sales_receipt_syncs) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.validate_sales_receipt_syncs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.validate_sales_receipt_syncs() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.compat_sales_receipt_syncs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.compat_sales_receipt_syncs() TO stock_runtime;
ALTER TABLE stock_operational.sales_profit_cost_overrides ADD COLUMN cell_kinds text;
ALTER TABLE stock_operational.sales_profit_cost_overrides ADD COLUMN "averageItemCost__lexeme" text;
CREATE FUNCTION stock_operational.input_sales_profit_cost_overrides(cells jsonb) RETURNS stock_operational.sales_profit_cost_overrides LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.sales_profit_cost_overrides; BEGIN
IF jsonb_typeof(cells)<>'array' OR jsonb_array_length(cells)>8 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
r.cell_kinds := '';
IF jsonb_array_length(cells)>0 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->0)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."id" := nullif((cells->>0),'')::text;
IF jsonb_array_length(cells)>1 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->1)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."month" := nullif((cells->>1),'')::text;
IF jsonb_array_length(cells)>2 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->2)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."accountId" := nullif((cells->>2),'')::text;
IF jsonb_array_length(cells)>3 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->3)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."averageItemCost" := nullif((cells->>3),'')::numeric;
IF jsonb_typeof((cells->3))='string' AND (cells->>3)<>'' THEN r."averageItemCost__lexeme" := (cells->>3); END IF;
IF jsonb_array_length(cells)>4 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->4)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."note" := nullif((cells->>4),'')::text;
IF jsonb_array_length(cells)>5 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->5)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdAt" := nullif((cells->>5),'')::text;
IF jsonb_array_length(cells)>6 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->6)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."updatedAt" := nullif((cells->>6),'')::text;
IF jsonb_array_length(cells)>7 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->7)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdBy" := nullif((cells->>7),'')::text;
RETURN r; END $$;
CREATE FUNCTION stock_operational.project_sales_profit_cost_overrides(r stock_operational.sales_profit_cost_overrides) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(stock_operational.cell_projection(to_jsonb(r."id"),nullif(substr(r.cell_kinds,1,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."month"),nullif(substr(r.cell_kinds,2,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."accountId"),nullif(substr(r.cell_kinds,3,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."averageItemCost"),nullif(substr(r.cell_kinds,4,1),''),r."averageItemCost__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."note"),nullif(substr(r.cell_kinds,5,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdAt"),nullif(substr(r.cell_kinds,6,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."updatedAt"),nullif(substr(r.cell_kinds,7,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdBy"),nullif(substr(r.cell_kinds,8,1),''),NULL,'text'))) WITH ORDINALITY a(v,n) WHERE n<=coalesce(length(r.cell_kinds),8) $$;
CREATE FUNCTION stock_operational.validate_sales_profit_cost_overrides() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE supplied_encoding boolean;
BEGIN
IF TG_OP='UPDATE' THEN supplied_encoding := NEW.cell_kinds IS DISTINCT FROM OLD.cell_kinds; ELSE supplied_encoding := true; END IF;
NEW."id" := nullif(NEW."id",'');
NEW."month" := nullif(NEW."month",'');
NEW."accountId" := nullif(NEW."accountId",'');
NEW."note" := nullif(NEW."note",'');
NEW."createdAt" := nullif(NEW."createdAt",'');
NEW."updatedAt" := nullif(NEW."updatedAt",'');
NEW."createdBy" := nullif(NEW."createdBy",'');
IF TG_OP='UPDATE' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW.row_order IS DISTINCT FROM OLD.row_order OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
IF NEW."id" IS DISTINCT FROM OLD."id" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,1,1) IN ('','z') OR NEW."id" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),1),'s') placing 's' from 1 for 1); END IF;
END IF;
IF NEW."month" IS DISTINCT FROM OLD."month" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,2,1) IN ('','z') OR NEW."month" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),2),'s') placing 's' from 2 for 1); END IF;
END IF;
IF NEW."accountId" IS DISTINCT FROM OLD."accountId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,3,1) IN ('','z') OR NEW."accountId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),3),'s') placing 's' from 3 for 1); END IF;
END IF;
IF NEW."averageItemCost" IS DISTINCT FROM OLD."averageItemCost" THEN
IF NEW."averageItemCost__lexeme" IS NOT DISTINCT FROM OLD."averageItemCost__lexeme" THEN NEW."averageItemCost__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,4,1) IN ('','z') OR NEW."averageItemCost" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),4),'s') placing 's' from 4 for 1); END IF;
END IF;
IF NEW."note" IS DISTINCT FROM OLD."note" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,5,1) IN ('','z') OR NEW."note" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),5),'s') placing 's' from 5 for 1); END IF;
END IF;
IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,6,1) IN ('','z') OR NEW."createdAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),6),'s') placing 's' from 6 for 1); END IF;
END IF;
IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,7,1) IN ('','z') OR NEW."updatedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),7),'s') placing 's' from 7 for 1); END IF;
END IF;
IF NEW."createdBy" IS DISTINCT FROM OLD."createdBy" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,8,1) IN ('','z') OR NEW."createdBy" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),8),'s') placing 's' from 8 for 1); END IF;
END IF;
END IF;
IF NEW.cell_kinds IS NOT NULL AND (length(NEW.cell_kinds)<1 OR length(NEW.cell_kinds)>8 OR NEW.cell_kinds !~ '^[snbz]+$') THEN RAISE EXCEPTION 'Invalid row encoding'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=0 AND NEW."id" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=1 AND NEW."month" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=2 AND NEW."accountId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=3 AND NEW."averageItemCost" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=4 AND NEW."note" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=5 AND NEW."createdAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=6 AND NEW."updatedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=7 AND NEW."createdBy" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
PERFORM stock_operational.project_sales_profit_cost_overrides(NEW);
RETURN NEW; END $$;
CREATE FUNCTION stock_operational.compat_sales_profit_cost_overrides() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND (TG_NAME='y_explicit_cells' OR NEW.business_cells IS DISTINCT FROM OLD.business_cells) AND NEW.business_cells IS DISTINCT FROM stock_operational.project_sales_profit_cost_overrides(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer: write named columns'; END IF; IF TG_OP='INSERT' AND NEW.business_cells IS NOT NULL AND NEW.business_cells IS DISTINCT FROM stock_operational.project_sales_profit_cost_overrides(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer'; END IF; NEW.business_cells := stock_operational.project_sales_profit_cost_overrides(NEW); RETURN NEW; END $$;
ALTER TABLE stock_operational.sales_profit_cost_overrides DISABLE TRIGGER map_cells;
ALTER TABLE stock_operational.sales_profit_cost_overrides DISABLE TRIGGER advance_revision;
UPDATE stock_operational.sales_profit_cost_overrides t SET cell_kinds=i.cell_kinds,"averageItemCost__lexeme"=i."averageItemCost__lexeme" FROM (SELECT row_order AS source_order, (stock_operational.input_sales_profit_cost_overrides(business_cells)).* FROM stock_operational.sales_profit_cost_overrides) i WHERE t.row_order=i.source_order;
DO $$ BEGIN IF EXISTS(SELECT FROM stock_operational.sales_profit_cost_overrides t WHERE business_cells IS DISTINCT FROM stock_operational.project_sales_profit_cost_overrides(t)) THEN RAISE EXCEPTION 'Unrepresentable sales_profit_cost_overrides row; transition aborted'; END IF; END $$;
ALTER TABLE stock_operational.sales_profit_cost_overrides ENABLE TRIGGER advance_revision;
DROP TRIGGER map_cells ON stock_operational.sales_profit_cost_overrides;
ALTER TABLE stock_operational.sales_profit_cost_overrides ALTER COLUMN business_cells DROP NOT NULL;
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.sales_profit_cost_overrides FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_sales_profit_cost_overrides();
CREATE TRIGGER y_explicit_cells BEFORE UPDATE OF business_cells ON stock_operational.sales_profit_cost_overrides FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_sales_profit_cost_overrides();
CREATE TRIGGER z_compat BEFORE INSERT OR UPDATE ON stock_operational.sales_profit_cost_overrides FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_sales_profit_cost_overrides();
REVOKE ALL ON FUNCTION stock_operational.input_sales_profit_cost_overrides(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.input_sales_profit_cost_overrides(jsonb) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.project_sales_profit_cost_overrides(stock_operational.sales_profit_cost_overrides) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.validate_sales_profit_cost_overrides() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.validate_sales_profit_cost_overrides() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.compat_sales_profit_cost_overrides() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.compat_sales_profit_cost_overrides() TO stock_runtime;
ALTER TABLE stock_operational.stock_counts ADD COLUMN cell_kinds text;
ALTER TABLE stock_operational.stock_counts ADD COLUMN "physicalCount__lexeme" text;
CREATE FUNCTION stock_operational.input_stock_counts(cells jsonb) RETURNS stock_operational.stock_counts LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.stock_counts; BEGIN
IF jsonb_typeof(cells)<>'array' OR jsonb_array_length(cells)>9 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
r.cell_kinds := '';
IF jsonb_array_length(cells)>0 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->0)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."id" := nullif((cells->>0),'')::text;
IF jsonb_array_length(cells)>1 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->1)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."month" := nullif((cells->>1),'')::text;
IF jsonb_array_length(cells)>2 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->2)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."accountId" := nullif((cells->>2),'')::text;
IF jsonb_array_length(cells)>3 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->3)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."shopName" := nullif((cells->>3),'')::text;
IF jsonb_array_length(cells)>4 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->4)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."physicalCount" := nullif((cells->>4),'')::numeric;
IF jsonb_typeof((cells->4))='string' AND (cells->>4)<>'' THEN r."physicalCount__lexeme" := (cells->>4); END IF;
IF jsonb_array_length(cells)>5 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->5)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."note" := nullif((cells->>5),'')::text;
IF jsonb_array_length(cells)>6 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->6)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."countedAt" := nullif((cells->>6),'')::text;
IF jsonb_array_length(cells)>7 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->7)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."updatedAt" := nullif((cells->>7),'')::text;
IF jsonb_array_length(cells)>8 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->8)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."updatedBy" := nullif((cells->>8),'')::text;
RETURN r; END $$;
CREATE FUNCTION stock_operational.project_stock_counts(r stock_operational.stock_counts) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(stock_operational.cell_projection(to_jsonb(r."id"),nullif(substr(r.cell_kinds,1,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."month"),nullif(substr(r.cell_kinds,2,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."accountId"),nullif(substr(r.cell_kinds,3,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."shopName"),nullif(substr(r.cell_kinds,4,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."physicalCount"),nullif(substr(r.cell_kinds,5,1),''),r."physicalCount__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."note"),nullif(substr(r.cell_kinds,6,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."countedAt"),nullif(substr(r.cell_kinds,7,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."updatedAt"),nullif(substr(r.cell_kinds,8,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."updatedBy"),nullif(substr(r.cell_kinds,9,1),''),NULL,'text'))) WITH ORDINALITY a(v,n) WHERE n<=coalesce(length(r.cell_kinds),9) $$;
CREATE FUNCTION stock_operational.validate_stock_counts() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE supplied_encoding boolean;
BEGIN
IF TG_OP='UPDATE' THEN supplied_encoding := NEW.cell_kinds IS DISTINCT FROM OLD.cell_kinds; ELSE supplied_encoding := true; END IF;
NEW."id" := nullif(NEW."id",'');
NEW."month" := nullif(NEW."month",'');
NEW."accountId" := nullif(NEW."accountId",'');
NEW."shopName" := nullif(NEW."shopName",'');
NEW."note" := nullif(NEW."note",'');
NEW."countedAt" := nullif(NEW."countedAt",'');
NEW."updatedAt" := nullif(NEW."updatedAt",'');
NEW."updatedBy" := nullif(NEW."updatedBy",'');
IF TG_OP='UPDATE' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW.row_order IS DISTINCT FROM OLD.row_order OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
IF NEW."id" IS DISTINCT FROM OLD."id" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,1,1) IN ('','z') OR NEW."id" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),1),'s') placing 's' from 1 for 1); END IF;
END IF;
IF NEW."month" IS DISTINCT FROM OLD."month" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,2,1) IN ('','z') OR NEW."month" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),2),'s') placing 's' from 2 for 1); END IF;
END IF;
IF NEW."accountId" IS DISTINCT FROM OLD."accountId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,3,1) IN ('','z') OR NEW."accountId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),3),'s') placing 's' from 3 for 1); END IF;
END IF;
IF NEW."shopName" IS DISTINCT FROM OLD."shopName" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,4,1) IN ('','z') OR NEW."shopName" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),4),'s') placing 's' from 4 for 1); END IF;
END IF;
IF NEW."physicalCount" IS DISTINCT FROM OLD."physicalCount" THEN
IF NEW."physicalCount__lexeme" IS NOT DISTINCT FROM OLD."physicalCount__lexeme" THEN NEW."physicalCount__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,5,1) IN ('','z') OR NEW."physicalCount" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),5),'s') placing 's' from 5 for 1); END IF;
END IF;
IF NEW."note" IS DISTINCT FROM OLD."note" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,6,1) IN ('','z') OR NEW."note" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),6),'s') placing 's' from 6 for 1); END IF;
END IF;
IF NEW."countedAt" IS DISTINCT FROM OLD."countedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,7,1) IN ('','z') OR NEW."countedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),7),'s') placing 's' from 7 for 1); END IF;
END IF;
IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,8,1) IN ('','z') OR NEW."updatedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),8),'s') placing 's' from 8 for 1); END IF;
END IF;
IF NEW."updatedBy" IS DISTINCT FROM OLD."updatedBy" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,9,1) IN ('','z') OR NEW."updatedBy" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),9),'s') placing 's' from 9 for 1); END IF;
END IF;
END IF;
IF NEW.cell_kinds IS NOT NULL AND (length(NEW.cell_kinds)<1 OR length(NEW.cell_kinds)>9 OR NEW.cell_kinds !~ '^[snbz]+$') THEN RAISE EXCEPTION 'Invalid row encoding'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=0 AND NEW."id" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=1 AND NEW."month" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=2 AND NEW."accountId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=3 AND NEW."shopName" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=4 AND NEW."physicalCount" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=5 AND NEW."note" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=6 AND NEW."countedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=7 AND NEW."updatedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=8 AND NEW."updatedBy" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
PERFORM stock_operational.project_stock_counts(NEW);
RETURN NEW; END $$;
CREATE FUNCTION stock_operational.compat_stock_counts() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND (TG_NAME='y_explicit_cells' OR NEW.business_cells IS DISTINCT FROM OLD.business_cells) AND NEW.business_cells IS DISTINCT FROM stock_operational.project_stock_counts(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer: write named columns'; END IF; IF TG_OP='INSERT' AND NEW.business_cells IS NOT NULL AND NEW.business_cells IS DISTINCT FROM stock_operational.project_stock_counts(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer'; END IF; NEW.business_cells := stock_operational.project_stock_counts(NEW); RETURN NEW; END $$;
ALTER TABLE stock_operational.stock_counts DISABLE TRIGGER map_cells;
ALTER TABLE stock_operational.stock_counts DISABLE TRIGGER advance_revision;
UPDATE stock_operational.stock_counts t SET cell_kinds=i.cell_kinds,"physicalCount__lexeme"=i."physicalCount__lexeme" FROM (SELECT row_order AS source_order, (stock_operational.input_stock_counts(business_cells)).* FROM stock_operational.stock_counts) i WHERE t.row_order=i.source_order;
DO $$ BEGIN IF EXISTS(SELECT FROM stock_operational.stock_counts t WHERE business_cells IS DISTINCT FROM stock_operational.project_stock_counts(t)) THEN RAISE EXCEPTION 'Unrepresentable stock_counts row; transition aborted'; END IF; END $$;
ALTER TABLE stock_operational.stock_counts ENABLE TRIGGER advance_revision;
DROP TRIGGER map_cells ON stock_operational.stock_counts;
ALTER TABLE stock_operational.stock_counts ALTER COLUMN business_cells DROP NOT NULL;
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.stock_counts FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_stock_counts();
CREATE TRIGGER y_explicit_cells BEFORE UPDATE OF business_cells ON stock_operational.stock_counts FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_stock_counts();
CREATE TRIGGER z_compat BEFORE INSERT OR UPDATE ON stock_operational.stock_counts FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_stock_counts();
REVOKE ALL ON FUNCTION stock_operational.input_stock_counts(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.input_stock_counts(jsonb) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.project_stock_counts(stock_operational.stock_counts) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.project_stock_counts(stock_operational.stock_counts) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.validate_stock_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.validate_stock_counts() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.compat_stock_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.compat_stock_counts() TO stock_runtime;
ALTER TABLE stock_operational.stock_adjustments ADD COLUMN cell_kinds text;
ALTER TABLE stock_operational.stock_adjustments ADD COLUMN "quantity__lexeme" text;
ALTER TABLE stock_operational.stock_adjustments ADD COLUMN "notInLoyverse__lexeme" text;
CREATE FUNCTION stock_operational.input_stock_adjustments(cells jsonb) RETURNS stock_operational.stock_adjustments LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.stock_adjustments; BEGIN
IF jsonb_typeof(cells)<>'array' OR jsonb_array_length(cells)>17 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
r.cell_kinds := '';
IF jsonb_array_length(cells)>0 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->0)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."id" := nullif((cells->>0),'')::text;
IF jsonb_array_length(cells)>1 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->1)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."accountId" := nullif((cells->>1),'')::text;
IF jsonb_array_length(cells)>2 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->2)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."shopName" := nullif((cells->>2),'')::text;
IF jsonb_array_length(cells)>3 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->3)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."date" := nullif((cells->>3),'')::text;
IF jsonb_array_length(cells)>4 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->4)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."direction" := nullif((cells->>4),'')::text;
IF jsonb_array_length(cells)>5 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->5)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."reason" := nullif((cells->>5),'')::text;
IF jsonb_array_length(cells)>6 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->6)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."employeeId" := nullif((cells->>6),'')::text;
IF jsonb_array_length(cells)>7 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->7)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."employeeName" := nullif((cells->>7),'')::text;
IF jsonb_array_length(cells)>8 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->8)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."quantity" := nullif((cells->>8),'')::numeric;
IF jsonb_typeof((cells->8))='string' AND (cells->>8)<>'' THEN r."quantity__lexeme" := (cells->>8); END IF;
IF jsonb_array_length(cells)>9 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->9)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."itemDescription" := nullif((cells->>9),'')::text;
IF jsonb_array_length(cells)>10 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->10)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."photoUrl" := nullif((cells->>10),'')::text;
IF jsonb_array_length(cells)>11 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->11)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."note" := nullif((cells->>11),'')::text;
IF jsonb_array_length(cells)>12 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->12)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."reversesId" := nullif((cells->>12),'')::text;
IF jsonb_array_length(cells)>13 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->13)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."replacesId" := nullif((cells->>13),'')::text;
IF jsonb_array_length(cells)>14 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->14)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdAt" := nullif((cells->>14),'')::text;
IF jsonb_array_length(cells)>15 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->15)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdBy" := nullif((cells->>15),'')::text;
IF jsonb_array_length(cells)>16 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->16)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."notInLoyverse" := nullif((cells->>16),'')::boolean;
IF jsonb_typeof((cells->16))='string' AND (cells->>16)<>'' THEN r."notInLoyverse__lexeme" := (cells->>16); END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.project_stock_adjustments(r stock_operational.stock_adjustments) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(stock_operational.cell_projection(to_jsonb(r."id"),nullif(substr(r.cell_kinds,1,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."accountId"),nullif(substr(r.cell_kinds,2,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."shopName"),nullif(substr(r.cell_kinds,3,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."date"),nullif(substr(r.cell_kinds,4,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."direction"),nullif(substr(r.cell_kinds,5,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."reason"),nullif(substr(r.cell_kinds,6,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."employeeId"),nullif(substr(r.cell_kinds,7,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."employeeName"),nullif(substr(r.cell_kinds,8,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."quantity"),nullif(substr(r.cell_kinds,9,1),''),r."quantity__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."itemDescription"),nullif(substr(r.cell_kinds,10,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."photoUrl"),nullif(substr(r.cell_kinds,11,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."note"),nullif(substr(r.cell_kinds,12,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."reversesId"),nullif(substr(r.cell_kinds,13,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."replacesId"),nullif(substr(r.cell_kinds,14,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdAt"),nullif(substr(r.cell_kinds,15,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdBy"),nullif(substr(r.cell_kinds,16,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."notInLoyverse"),nullif(substr(r.cell_kinds,17,1),''),r."notInLoyverse__lexeme",'boolean'))) WITH ORDINALITY a(v,n) WHERE n<=coalesce(length(r.cell_kinds),17) $$;
CREATE FUNCTION stock_operational.validate_stock_adjustments() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE supplied_encoding boolean;
BEGIN
IF TG_OP='UPDATE' THEN supplied_encoding := NEW.cell_kinds IS DISTINCT FROM OLD.cell_kinds; ELSE supplied_encoding := true; END IF;
NEW."id" := nullif(NEW."id",'');
NEW."accountId" := nullif(NEW."accountId",'');
NEW."shopName" := nullif(NEW."shopName",'');
NEW."date" := nullif(NEW."date",'');
NEW."direction" := nullif(NEW."direction",'');
NEW."reason" := nullif(NEW."reason",'');
NEW."employeeId" := nullif(NEW."employeeId",'');
NEW."employeeName" := nullif(NEW."employeeName",'');
NEW."itemDescription" := nullif(NEW."itemDescription",'');
NEW."photoUrl" := nullif(NEW."photoUrl",'');
NEW."note" := nullif(NEW."note",'');
NEW."reversesId" := nullif(NEW."reversesId",'');
NEW."replacesId" := nullif(NEW."replacesId",'');
NEW."createdAt" := nullif(NEW."createdAt",'');
NEW."createdBy" := nullif(NEW."createdBy",'');
IF TG_OP='UPDATE' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW.row_order IS DISTINCT FROM OLD.row_order OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
IF NEW."id" IS DISTINCT FROM OLD."id" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,1,1) IN ('','z') OR NEW."id" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),1),'s') placing 's' from 1 for 1); END IF;
END IF;
IF NEW."accountId" IS DISTINCT FROM OLD."accountId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,2,1) IN ('','z') OR NEW."accountId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),2),'s') placing 's' from 2 for 1); END IF;
END IF;
IF NEW."shopName" IS DISTINCT FROM OLD."shopName" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,3,1) IN ('','z') OR NEW."shopName" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),3),'s') placing 's' from 3 for 1); END IF;
END IF;
IF NEW."date" IS DISTINCT FROM OLD."date" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,4,1) IN ('','z') OR NEW."date" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),4),'s') placing 's' from 4 for 1); END IF;
END IF;
IF NEW."direction" IS DISTINCT FROM OLD."direction" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,5,1) IN ('','z') OR NEW."direction" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),5),'s') placing 's' from 5 for 1); END IF;
END IF;
IF NEW."reason" IS DISTINCT FROM OLD."reason" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,6,1) IN ('','z') OR NEW."reason" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),6),'s') placing 's' from 6 for 1); END IF;
END IF;
IF NEW."employeeId" IS DISTINCT FROM OLD."employeeId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,7,1) IN ('','z') OR NEW."employeeId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),7),'s') placing 's' from 7 for 1); END IF;
END IF;
IF NEW."employeeName" IS DISTINCT FROM OLD."employeeName" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,8,1) IN ('','z') OR NEW."employeeName" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),8),'s') placing 's' from 8 for 1); END IF;
END IF;
IF NEW."quantity" IS DISTINCT FROM OLD."quantity" THEN
IF NEW."quantity__lexeme" IS NOT DISTINCT FROM OLD."quantity__lexeme" THEN NEW."quantity__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,9,1) IN ('','z') OR NEW."quantity" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),9),'s') placing 's' from 9 for 1); END IF;
END IF;
IF NEW."itemDescription" IS DISTINCT FROM OLD."itemDescription" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,10,1) IN ('','z') OR NEW."itemDescription" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),10),'s') placing 's' from 10 for 1); END IF;
END IF;
IF NEW."photoUrl" IS DISTINCT FROM OLD."photoUrl" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,11,1) IN ('','z') OR NEW."photoUrl" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),11),'s') placing 's' from 11 for 1); END IF;
END IF;
IF NEW."note" IS DISTINCT FROM OLD."note" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,12,1) IN ('','z') OR NEW."note" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),12),'s') placing 's' from 12 for 1); END IF;
END IF;
IF NEW."reversesId" IS DISTINCT FROM OLD."reversesId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,13,1) IN ('','z') OR NEW."reversesId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),13),'s') placing 's' from 13 for 1); END IF;
END IF;
IF NEW."replacesId" IS DISTINCT FROM OLD."replacesId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,14,1) IN ('','z') OR NEW."replacesId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),14),'s') placing 's' from 14 for 1); END IF;
END IF;
IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,15,1) IN ('','z') OR NEW."createdAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),15),'s') placing 's' from 15 for 1); END IF;
END IF;
IF NEW."createdBy" IS DISTINCT FROM OLD."createdBy" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,16,1) IN ('','z') OR NEW."createdBy" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),16),'s') placing 's' from 16 for 1); END IF;
END IF;
IF NEW."notInLoyverse" IS DISTINCT FROM OLD."notInLoyverse" THEN
IF NEW."notInLoyverse__lexeme" IS NOT DISTINCT FROM OLD."notInLoyverse__lexeme" THEN NEW."notInLoyverse__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,17,1) IN ('','z') OR NEW."notInLoyverse" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),17),'s') placing 's' from 17 for 1); END IF;
END IF;
END IF;
IF NEW.cell_kinds IS NOT NULL AND (length(NEW.cell_kinds)<1 OR length(NEW.cell_kinds)>17 OR NEW.cell_kinds !~ '^[snbz]+$') THEN RAISE EXCEPTION 'Invalid row encoding'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=0 AND NEW."id" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=1 AND NEW."accountId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=2 AND NEW."shopName" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=3 AND NEW."date" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=4 AND NEW."direction" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=5 AND NEW."reason" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=6 AND NEW."employeeId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=7 AND NEW."employeeName" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=8 AND NEW."quantity" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=9 AND NEW."itemDescription" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=10 AND NEW."photoUrl" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=11 AND NEW."note" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=12 AND NEW."reversesId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=13 AND NEW."replacesId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=14 AND NEW."createdAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=15 AND NEW."createdBy" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=16 AND NEW."notInLoyverse" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
PERFORM stock_operational.project_stock_adjustments(NEW);
RETURN NEW; END $$;
CREATE FUNCTION stock_operational.compat_stock_adjustments() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND (TG_NAME='y_explicit_cells' OR NEW.business_cells IS DISTINCT FROM OLD.business_cells) AND NEW.business_cells IS DISTINCT FROM stock_operational.project_stock_adjustments(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer: write named columns'; END IF; IF TG_OP='INSERT' AND NEW.business_cells IS NOT NULL AND NEW.business_cells IS DISTINCT FROM stock_operational.project_stock_adjustments(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer'; END IF; NEW.business_cells := stock_operational.project_stock_adjustments(NEW); RETURN NEW; END $$;
ALTER TABLE stock_operational.stock_adjustments DISABLE TRIGGER map_cells;
ALTER TABLE stock_operational.stock_adjustments DISABLE TRIGGER advance_revision;
UPDATE stock_operational.stock_adjustments t SET cell_kinds=i.cell_kinds,"quantity__lexeme"=i."quantity__lexeme","notInLoyverse__lexeme"=i."notInLoyverse__lexeme" FROM (SELECT row_order AS source_order, (stock_operational.input_stock_adjustments(business_cells)).* FROM stock_operational.stock_adjustments) i WHERE t.row_order=i.source_order;
DO $$ BEGIN IF EXISTS(SELECT FROM stock_operational.stock_adjustments t WHERE business_cells IS DISTINCT FROM stock_operational.project_stock_adjustments(t)) THEN RAISE EXCEPTION 'Unrepresentable stock_adjustments row; transition aborted'; END IF; END $$;
ALTER TABLE stock_operational.stock_adjustments ENABLE TRIGGER advance_revision;
DROP TRIGGER map_cells ON stock_operational.stock_adjustments;
ALTER TABLE stock_operational.stock_adjustments ALTER COLUMN business_cells DROP NOT NULL;
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.stock_adjustments FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_stock_adjustments();
CREATE TRIGGER y_explicit_cells BEFORE UPDATE OF business_cells ON stock_operational.stock_adjustments FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_stock_adjustments();
CREATE TRIGGER z_compat BEFORE INSERT OR UPDATE ON stock_operational.stock_adjustments FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_stock_adjustments();
REVOKE ALL ON FUNCTION stock_operational.input_stock_adjustments(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.input_stock_adjustments(jsonb) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.project_stock_adjustments(stock_operational.stock_adjustments) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.project_stock_adjustments(stock_operational.stock_adjustments) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.validate_stock_adjustments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.validate_stock_adjustments() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.compat_stock_adjustments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.compat_stock_adjustments() TO stock_runtime;
ALTER TABLE stock_operational.movements ADD COLUMN cell_kinds text;
ALTER TABLE stock_operational.movements ADD COLUMN "totalQuantity__lexeme" text;
CREATE FUNCTION stock_operational.input_movements(cells jsonb) RETURNS stock_operational.movements LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.movements; BEGIN
IF jsonb_typeof(cells)<>'array' OR jsonb_array_length(cells)>8 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
r.cell_kinds := '';
IF jsonb_array_length(cells)>0 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->0)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."id" := nullif((cells->>0),'')::text;
IF jsonb_array_length(cells)>1 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->1)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."userId" := nullif((cells->>1),'')::text;
IF jsonb_array_length(cells)>2 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->2)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."packingDate" := nullif((cells->>2),'')::text;
IF jsonb_array_length(cells)>3 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->3)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."deliverDateTime" := nullif((cells->>3),'')::text;
IF jsonb_array_length(cells)>4 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->4)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."status" := nullif((cells->>4),'')::text;
IF jsonb_array_length(cells)>5 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->5)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."totalQuantity" := nullif((cells->>5),'')::numeric;
IF jsonb_typeof((cells->5))='string' AND (cells->>5)<>'' THEN r."totalQuantity__lexeme" := (cells->>5); END IF;
IF jsonb_array_length(cells)>6 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->6)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdAt" := nullif((cells->>6),'')::text;
IF jsonb_array_length(cells)>7 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->7)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."updatedAt" := nullif((cells->>7),'')::text;
RETURN r; END $$;
CREATE FUNCTION stock_operational.project_movements(r stock_operational.movements) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(stock_operational.cell_projection(to_jsonb(r."id"),nullif(substr(r.cell_kinds,1,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."userId"),nullif(substr(r.cell_kinds,2,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."packingDate"),nullif(substr(r.cell_kinds,3,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."deliverDateTime"),nullif(substr(r.cell_kinds,4,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."status"),nullif(substr(r.cell_kinds,5,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."totalQuantity"),nullif(substr(r.cell_kinds,6,1),''),r."totalQuantity__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."createdAt"),nullif(substr(r.cell_kinds,7,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."updatedAt"),nullif(substr(r.cell_kinds,8,1),''),NULL,'text'))) WITH ORDINALITY a(v,n) WHERE n<=coalesce(length(r.cell_kinds),8) $$;
CREATE FUNCTION stock_operational.validate_movements() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE supplied_encoding boolean;
BEGIN
IF TG_OP='UPDATE' THEN supplied_encoding := NEW.cell_kinds IS DISTINCT FROM OLD.cell_kinds; ELSE supplied_encoding := true; END IF;
NEW."id" := nullif(NEW."id",'');
NEW."userId" := nullif(NEW."userId",'');
NEW."packingDate" := nullif(NEW."packingDate",'');
NEW."deliverDateTime" := nullif(NEW."deliverDateTime",'');
NEW."status" := nullif(NEW."status",'');
NEW."createdAt" := nullif(NEW."createdAt",'');
NEW."updatedAt" := nullif(NEW."updatedAt",'');
IF TG_OP='UPDATE' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW.row_order IS DISTINCT FROM OLD.row_order OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
IF NEW."id" IS DISTINCT FROM OLD."id" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,1,1) IN ('','z') OR NEW."id" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),1),'s') placing 's' from 1 for 1); END IF;
END IF;
IF NEW."userId" IS DISTINCT FROM OLD."userId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,2,1) IN ('','z') OR NEW."userId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),2),'s') placing 's' from 2 for 1); END IF;
END IF;
IF NEW."packingDate" IS DISTINCT FROM OLD."packingDate" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,3,1) IN ('','z') OR NEW."packingDate" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),3),'s') placing 's' from 3 for 1); END IF;
END IF;
IF NEW."deliverDateTime" IS DISTINCT FROM OLD."deliverDateTime" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,4,1) IN ('','z') OR NEW."deliverDateTime" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),4),'s') placing 's' from 4 for 1); END IF;
END IF;
IF NEW."status" IS DISTINCT FROM OLD."status" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,5,1) IN ('','z') OR NEW."status" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),5),'s') placing 's' from 5 for 1); END IF;
END IF;
IF NEW."totalQuantity" IS DISTINCT FROM OLD."totalQuantity" THEN
IF NEW."totalQuantity__lexeme" IS NOT DISTINCT FROM OLD."totalQuantity__lexeme" THEN NEW."totalQuantity__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,6,1) IN ('','z') OR NEW."totalQuantity" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),6),'s') placing 's' from 6 for 1); END IF;
END IF;
IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,7,1) IN ('','z') OR NEW."createdAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),7),'s') placing 's' from 7 for 1); END IF;
END IF;
IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,8,1) IN ('','z') OR NEW."updatedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),8),'s') placing 's' from 8 for 1); END IF;
END IF;
END IF;
IF NEW.cell_kinds IS NOT NULL AND (length(NEW.cell_kinds)<1 OR length(NEW.cell_kinds)>8 OR NEW.cell_kinds !~ '^[snbz]+$') THEN RAISE EXCEPTION 'Invalid row encoding'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=0 AND NEW."id" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=1 AND NEW."userId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=2 AND NEW."packingDate" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=3 AND NEW."deliverDateTime" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=4 AND NEW."status" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=5 AND NEW."totalQuantity" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=6 AND NEW."createdAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=7 AND NEW."updatedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
PERFORM stock_operational.project_movements(NEW);
RETURN NEW; END $$;
CREATE FUNCTION stock_operational.compat_movements() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND (TG_NAME='y_explicit_cells' OR NEW.business_cells IS DISTINCT FROM OLD.business_cells) AND NEW.business_cells IS DISTINCT FROM stock_operational.project_movements(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer: write named columns'; END IF; IF TG_OP='INSERT' AND NEW.business_cells IS NOT NULL AND NEW.business_cells IS DISTINCT FROM stock_operational.project_movements(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer'; END IF; NEW.business_cells := stock_operational.project_movements(NEW); RETURN NEW; END $$;
ALTER TABLE stock_operational.movements DISABLE TRIGGER map_cells;
ALTER TABLE stock_operational.movements DISABLE TRIGGER advance_revision;
UPDATE stock_operational.movements t SET cell_kinds=i.cell_kinds,"totalQuantity__lexeme"=i."totalQuantity__lexeme" FROM (SELECT row_order AS source_order, (stock_operational.input_movements(business_cells)).* FROM stock_operational.movements) i WHERE t.row_order=i.source_order;
DO $$ BEGIN IF EXISTS(SELECT FROM stock_operational.movements t WHERE business_cells IS DISTINCT FROM stock_operational.project_movements(t)) THEN RAISE EXCEPTION 'Unrepresentable movements row; transition aborted'; END IF; END $$;
ALTER TABLE stock_operational.movements ENABLE TRIGGER advance_revision;
DROP TRIGGER map_cells ON stock_operational.movements;
ALTER TABLE stock_operational.movements ALTER COLUMN business_cells DROP NOT NULL;
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.movements FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_movements();
CREATE TRIGGER y_explicit_cells BEFORE UPDATE OF business_cells ON stock_operational.movements FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_movements();
CREATE TRIGGER z_compat BEFORE INSERT OR UPDATE ON stock_operational.movements FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_movements();
REVOKE ALL ON FUNCTION stock_operational.input_movements(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.input_movements(jsonb) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.project_movements(stock_operational.movements) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.project_movements(stock_operational.movements) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.validate_movements() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.validate_movements() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.compat_movements() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.compat_movements() TO stock_runtime;
ALTER TABLE stock_operational.movement_details ADD COLUMN cell_kinds text;
ALTER TABLE stock_operational.movement_details ADD COLUMN "quantity__lexeme" text;
ALTER TABLE stock_operational.movement_details ADD COLUMN "stockCounted__lexeme" text;
ALTER TABLE stock_operational.movement_details ADD COLUMN "isNewArrival__lexeme" text;
CREATE FUNCTION stock_operational.input_movement_details(cells jsonb) RETURNS stock_operational.movement_details LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.movement_details; BEGIN
IF jsonb_typeof(cells)<>'array' OR jsonb_array_length(cells)>14 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
r.cell_kinds := '';
IF jsonb_array_length(cells)>0 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->0)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."id" := nullif((cells->>0),'')::text;
IF jsonb_array_length(cells)>1 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->1)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."movementMasterId" := nullif((cells->>1),'')::text;
IF jsonb_array_length(cells)>2 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->2)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."shopName" := nullif((cells->>2),'')::text;
IF jsonb_array_length(cells)>3 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->3)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."quantity" := nullif((cells->>3),'')::numeric;
IF jsonb_typeof((cells->3))='string' AND (cells->>3)<>'' THEN r."quantity__lexeme" := (cells->>3); END IF;
IF jsonb_array_length(cells)>4 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->4)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."remark" := nullif((cells->>4),'')::text;
IF jsonb_array_length(cells)>5 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->5)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."fromLocation" := nullif((cells->>5),'')::text;
IF jsonb_array_length(cells)>6 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->6)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."toLocation" := nullif((cells->>6),'')::text;
IF jsonb_array_length(cells)>7 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->7)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."productImageUrl" := nullif((cells->>7),'')::text;
IF jsonb_array_length(cells)>8 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->8)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."purchaseDetailId" := nullif((cells->>8),'')::text;
IF jsonb_array_length(cells)>9 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->9)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."status" := nullif((cells->>9),'')::text;
IF jsonb_array_length(cells)>10 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->10)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdAt" := nullif((cells->>10),'')::text;
IF jsonb_array_length(cells)>11 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->11)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."updatedAt" := nullif((cells->>11),'')::text;
IF jsonb_array_length(cells)>12 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->12)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."stockCounted" := nullif((cells->>12),'')::boolean;
IF jsonb_typeof((cells->12))='string' AND (cells->>12)<>'' THEN r."stockCounted__lexeme" := (cells->>12); END IF;
IF jsonb_array_length(cells)>13 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->13)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."isNewArrival" := nullif((cells->>13),'')::boolean;
IF jsonb_typeof((cells->13))='string' AND (cells->>13)<>'' THEN r."isNewArrival__lexeme" := (cells->>13); END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.project_movement_details(r stock_operational.movement_details) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(stock_operational.cell_projection(to_jsonb(r."id"),nullif(substr(r.cell_kinds,1,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."movementMasterId"),nullif(substr(r.cell_kinds,2,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."shopName"),nullif(substr(r.cell_kinds,3,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."quantity"),nullif(substr(r.cell_kinds,4,1),''),r."quantity__lexeme",'numeric'),stock_operational.cell_projection(to_jsonb(r."remark"),nullif(substr(r.cell_kinds,5,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."fromLocation"),nullif(substr(r.cell_kinds,6,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."toLocation"),nullif(substr(r.cell_kinds,7,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."productImageUrl"),nullif(substr(r.cell_kinds,8,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."purchaseDetailId"),nullif(substr(r.cell_kinds,9,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."status"),nullif(substr(r.cell_kinds,10,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdAt"),nullif(substr(r.cell_kinds,11,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."updatedAt"),nullif(substr(r.cell_kinds,12,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."stockCounted"),nullif(substr(r.cell_kinds,13,1),''),r."stockCounted__lexeme",'boolean'),stock_operational.cell_projection(to_jsonb(r."isNewArrival"),nullif(substr(r.cell_kinds,14,1),''),r."isNewArrival__lexeme",'boolean'))) WITH ORDINALITY a(v,n) WHERE n<=coalesce(length(r.cell_kinds),14) $$;
CREATE FUNCTION stock_operational.validate_movement_details() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE supplied_encoding boolean;
BEGIN
IF TG_OP='UPDATE' THEN supplied_encoding := NEW.cell_kinds IS DISTINCT FROM OLD.cell_kinds; ELSE supplied_encoding := true; END IF;
NEW."id" := nullif(NEW."id",'');
NEW."movementMasterId" := nullif(NEW."movementMasterId",'');
NEW."shopName" := nullif(NEW."shopName",'');
NEW."remark" := nullif(NEW."remark",'');
NEW."fromLocation" := nullif(NEW."fromLocation",'');
NEW."toLocation" := nullif(NEW."toLocation",'');
NEW."productImageUrl" := nullif(NEW."productImageUrl",'');
NEW."purchaseDetailId" := nullif(NEW."purchaseDetailId",'');
NEW."status" := nullif(NEW."status",'');
NEW."createdAt" := nullif(NEW."createdAt",'');
NEW."updatedAt" := nullif(NEW."updatedAt",'');
IF TG_OP='UPDATE' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW.row_order IS DISTINCT FROM OLD.row_order OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
IF NEW."id" IS DISTINCT FROM OLD."id" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,1,1) IN ('','z') OR NEW."id" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),1),'s') placing 's' from 1 for 1); END IF;
END IF;
IF NEW."movementMasterId" IS DISTINCT FROM OLD."movementMasterId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,2,1) IN ('','z') OR NEW."movementMasterId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),2),'s') placing 's' from 2 for 1); END IF;
END IF;
IF NEW."shopName" IS DISTINCT FROM OLD."shopName" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,3,1) IN ('','z') OR NEW."shopName" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),3),'s') placing 's' from 3 for 1); END IF;
END IF;
IF NEW."quantity" IS DISTINCT FROM OLD."quantity" THEN
IF NEW."quantity__lexeme" IS NOT DISTINCT FROM OLD."quantity__lexeme" THEN NEW."quantity__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,4,1) IN ('','z') OR NEW."quantity" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),4),'s') placing 's' from 4 for 1); END IF;
END IF;
IF NEW."remark" IS DISTINCT FROM OLD."remark" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,5,1) IN ('','z') OR NEW."remark" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),5),'s') placing 's' from 5 for 1); END IF;
END IF;
IF NEW."fromLocation" IS DISTINCT FROM OLD."fromLocation" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,6,1) IN ('','z') OR NEW."fromLocation" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),6),'s') placing 's' from 6 for 1); END IF;
END IF;
IF NEW."toLocation" IS DISTINCT FROM OLD."toLocation" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,7,1) IN ('','z') OR NEW."toLocation" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),7),'s') placing 's' from 7 for 1); END IF;
END IF;
IF NEW."productImageUrl" IS DISTINCT FROM OLD."productImageUrl" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,8,1) IN ('','z') OR NEW."productImageUrl" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),8),'s') placing 's' from 8 for 1); END IF;
END IF;
IF NEW."purchaseDetailId" IS DISTINCT FROM OLD."purchaseDetailId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,9,1) IN ('','z') OR NEW."purchaseDetailId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),9),'s') placing 's' from 9 for 1); END IF;
END IF;
IF NEW."status" IS DISTINCT FROM OLD."status" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,10,1) IN ('','z') OR NEW."status" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),10),'s') placing 's' from 10 for 1); END IF;
END IF;
IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,11,1) IN ('','z') OR NEW."createdAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),11),'s') placing 's' from 11 for 1); END IF;
END IF;
IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,12,1) IN ('','z') OR NEW."updatedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),12),'s') placing 's' from 12 for 1); END IF;
END IF;
IF NEW."stockCounted" IS DISTINCT FROM OLD."stockCounted" THEN
IF NEW."stockCounted__lexeme" IS NOT DISTINCT FROM OLD."stockCounted__lexeme" THEN NEW."stockCounted__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,13,1) IN ('','z') OR NEW."stockCounted" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),13),'s') placing 's' from 13 for 1); END IF;
END IF;
IF NEW."isNewArrival" IS DISTINCT FROM OLD."isNewArrival" THEN
IF NEW."isNewArrival__lexeme" IS NOT DISTINCT FROM OLD."isNewArrival__lexeme" THEN NEW."isNewArrival__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,14,1) IN ('','z') OR NEW."isNewArrival" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),14),'s') placing 's' from 14 for 1); END IF;
END IF;
END IF;
IF NEW.cell_kinds IS NOT NULL AND (length(NEW.cell_kinds)<1 OR length(NEW.cell_kinds)>14 OR NEW.cell_kinds !~ '^[snbz]+$') THEN RAISE EXCEPTION 'Invalid row encoding'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=0 AND NEW."id" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=1 AND NEW."movementMasterId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=2 AND NEW."shopName" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=3 AND NEW."quantity" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=4 AND NEW."remark" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=5 AND NEW."fromLocation" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=6 AND NEW."toLocation" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=7 AND NEW."productImageUrl" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=8 AND NEW."purchaseDetailId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=9 AND NEW."status" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=10 AND NEW."createdAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=11 AND NEW."updatedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=12 AND NEW."stockCounted" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=13 AND NEW."isNewArrival" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
PERFORM stock_operational.project_movement_details(NEW);
RETURN NEW; END $$;
CREATE FUNCTION stock_operational.compat_movement_details() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND (TG_NAME='y_explicit_cells' OR NEW.business_cells IS DISTINCT FROM OLD.business_cells) AND NEW.business_cells IS DISTINCT FROM stock_operational.project_movement_details(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer: write named columns'; END IF; IF TG_OP='INSERT' AND NEW.business_cells IS NOT NULL AND NEW.business_cells IS DISTINCT FROM stock_operational.project_movement_details(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer'; END IF; NEW.business_cells := stock_operational.project_movement_details(NEW); RETURN NEW; END $$;
ALTER TABLE stock_operational.movement_details DISABLE TRIGGER map_cells;
ALTER TABLE stock_operational.movement_details DISABLE TRIGGER advance_revision;
UPDATE stock_operational.movement_details t SET cell_kinds=i.cell_kinds,"quantity__lexeme"=i."quantity__lexeme","stockCounted__lexeme"=i."stockCounted__lexeme","isNewArrival__lexeme"=i."isNewArrival__lexeme" FROM (SELECT row_order AS source_order, (stock_operational.input_movement_details(business_cells)).* FROM stock_operational.movement_details) i WHERE t.row_order=i.source_order;
DO $$ BEGIN IF EXISTS(SELECT FROM stock_operational.movement_details t WHERE business_cells IS DISTINCT FROM stock_operational.project_movement_details(t)) THEN RAISE EXCEPTION 'Unrepresentable movement_details row; transition aborted'; END IF; END $$;
ALTER TABLE stock_operational.movement_details ENABLE TRIGGER advance_revision;
DROP TRIGGER map_cells ON stock_operational.movement_details;
ALTER TABLE stock_operational.movement_details ALTER COLUMN business_cells DROP NOT NULL;
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.movement_details FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_movement_details();
CREATE TRIGGER y_explicit_cells BEFORE UPDATE OF business_cells ON stock_operational.movement_details FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_movement_details();
CREATE TRIGGER z_compat BEFORE INSERT OR UPDATE ON stock_operational.movement_details FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_movement_details();
REVOKE ALL ON FUNCTION stock_operational.input_movement_details(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.input_movement_details(jsonb) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.project_movement_details(stock_operational.movement_details) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.project_movement_details(stock_operational.movement_details) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.validate_movement_details() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.validate_movement_details() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.compat_movement_details() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.compat_movement_details() TO stock_runtime;
ALTER TABLE stock_operational.user_state ADD COLUMN cell_kinds text;
ALTER TABLE stock_operational.user_state ADD COLUMN "context__lexeme" text;
CREATE FUNCTION stock_operational.input_user_state(cells jsonb) RETURNS stock_operational.user_state LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r stock_operational.user_state; BEGIN
IF jsonb_typeof(cells)<>'array' OR jsonb_array_length(cells)>8 OR jsonb_array_length(cells)<1 THEN RAISE EXCEPTION 'Invalid row width'; END IF;
r.cell_kinds := '';
IF jsonb_array_length(cells)>0 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->0)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."id" := nullif((cells->>0),'')::text;
IF jsonb_array_length(cells)>1 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->1)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."userId" := nullif((cells->>1),'')::text;
IF jsonb_array_length(cells)>2 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->2)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."flowname" := nullif((cells->>2),'')::text;
IF jsonb_array_length(cells)>3 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->3)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."referenceId" := nullif((cells->>3),'')::text;
IF jsonb_array_length(cells)>4 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->4)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."state" := nullif((cells->>4),'')::text;
IF jsonb_array_length(cells)>5 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->5)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."createdAt" := nullif((cells->>5),'')::text;
IF jsonb_array_length(cells)>6 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->6)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."updatedAt" := nullif((cells->>6),'')::text;
IF jsonb_array_length(cells)>7 THEN r.cell_kinds := r.cell_kinds || CASE jsonb_typeof((cells->7)) WHEN 'string' THEN 's' WHEN 'number' THEN 'n' WHEN 'boolean' THEN 'b' WHEN 'null' THEN 'z' ELSE '?' END; END IF;
r."context" := nullif(nullif((cells->>7),'')::jsonb,'null'::jsonb);
IF jsonb_typeof((cells->7))='string' AND (cells->>7)<>'' THEN r."context__lexeme" := (cells->>7); END IF;
RETURN r; END $$;
CREATE FUNCTION stock_operational.project_user_state(r stock_operational.user_state) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(stock_operational.cell_projection(to_jsonb(r."id"),nullif(substr(r.cell_kinds,1,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."userId"),nullif(substr(r.cell_kinds,2,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."flowname"),nullif(substr(r.cell_kinds,3,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."referenceId"),nullif(substr(r.cell_kinds,4,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."state"),nullif(substr(r.cell_kinds,5,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."createdAt"),nullif(substr(r.cell_kinds,6,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."updatedAt"),nullif(substr(r.cell_kinds,7,1),''),NULL,'text'),stock_operational.cell_projection(to_jsonb(r."context"),nullif(substr(r.cell_kinds,8,1),''),r."context__lexeme",'jsonb'))) WITH ORDINALITY a(v,n) WHERE n<=coalesce(length(r.cell_kinds),8) $$;
CREATE FUNCTION stock_operational.validate_user_state() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE supplied_encoding boolean;
BEGIN
IF TG_OP='UPDATE' THEN supplied_encoding := NEW.cell_kinds IS DISTINCT FROM OLD.cell_kinds; ELSE supplied_encoding := true; END IF;
NEW."id" := nullif(NEW."id",'');
NEW."userId" := nullif(NEW."userId",'');
NEW."flowname" := nullif(NEW."flowname",'');
NEW."referenceId" := nullif(NEW."referenceId",'');
NEW."state" := nullif(NEW."state",'');
NEW."createdAt" := nullif(NEW."createdAt",'');
NEW."updatedAt" := nullif(NEW."updatedAt",'');
IF TG_OP='UPDATE' THEN
IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW.row_order IS DISTINCT FROM OLD.row_order OR OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable identity, order or archived record'; END IF;
NEW.revision := OLD.revision+1;
IF NEW."id" IS DISTINCT FROM OLD."id" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,1,1) IN ('','z') OR NEW."id" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),1),'s') placing 's' from 1 for 1); END IF;
END IF;
IF NEW."userId" IS DISTINCT FROM OLD."userId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,2,1) IN ('','z') OR NEW."userId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),2),'s') placing 's' from 2 for 1); END IF;
END IF;
IF NEW."flowname" IS DISTINCT FROM OLD."flowname" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,3,1) IN ('','z') OR NEW."flowname" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),3),'s') placing 's' from 3 for 1); END IF;
END IF;
IF NEW."referenceId" IS DISTINCT FROM OLD."referenceId" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,4,1) IN ('','z') OR NEW."referenceId" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),4),'s') placing 's' from 4 for 1); END IF;
END IF;
IF NEW."state" IS DISTINCT FROM OLD."state" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,5,1) IN ('','z') OR NEW."state" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),5),'s') placing 's' from 5 for 1); END IF;
END IF;
IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,6,1) IN ('','z') OR NEW."createdAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),6),'s') placing 's' from 6 for 1); END IF;
END IF;
IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" THEN
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,7,1) IN ('','z') OR NEW."updatedAt" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),7),'s') placing 's' from 7 for 1); END IF;
END IF;
IF NEW."context" IS DISTINCT FROM OLD."context" THEN
IF NEW."context__lexeme" IS NOT DISTINCT FROM OLD."context__lexeme" THEN NEW."context__lexeme" := NULL; END IF;
IF NOT supplied_encoding AND NEW.cell_kinds IS NOT NULL AND (substr(NEW.cell_kinds,8,1) IN ('','z') OR NEW."context" IS NULL) THEN NEW.cell_kinds := overlay(rpad(coalesce(NEW.cell_kinds,''),greatest(coalesce(length(NEW.cell_kinds),0),8),'s') placing 's' from 8 for 1); END IF;
END IF;
END IF;
IF NEW.cell_kinds IS NOT NULL AND (length(NEW.cell_kinds)<1 OR length(NEW.cell_kinds)>8 OR NEW.cell_kinds !~ '^[snbz]+$') THEN RAISE EXCEPTION 'Invalid row encoding'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=0 AND NEW."id" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=1 AND NEW."userId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=2 AND NEW."flowname" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=3 AND NEW."referenceId" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=4 AND NEW."state" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=5 AND NEW."createdAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=6 AND NEW."updatedAt" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
IF NEW.cell_kinds IS NOT NULL AND length(NEW.cell_kinds)<=7 AND NEW."context" IS NOT NULL THEN RAISE EXCEPTION 'Row shape hides a named value'; END IF;
PERFORM stock_operational.project_user_state(NEW);
RETURN NEW; END $$;
CREATE FUNCTION stock_operational.compat_user_state() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND (TG_NAME='y_explicit_cells' OR NEW.business_cells IS DISTINCT FROM OLD.business_cells) AND NEW.business_cells IS DISTINCT FROM stock_operational.project_user_state(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer: write named columns'; END IF; IF TG_OP='INSERT' AND NEW.business_cells IS NOT NULL AND NEW.business_cells IS DISTINCT FROM stock_operational.project_user_state(NEW) THEN RAISE EXCEPTION 'Legacy or inconsistent dual writer'; END IF; NEW.business_cells := stock_operational.project_user_state(NEW); RETURN NEW; END $$;
ALTER TABLE stock_operational.user_state DISABLE TRIGGER map_cells;
ALTER TABLE stock_operational.user_state DISABLE TRIGGER advance_revision;
UPDATE stock_operational.user_state t SET cell_kinds=i.cell_kinds,"context__lexeme"=i."context__lexeme" FROM (SELECT row_order AS source_order, (stock_operational.input_user_state(business_cells)).* FROM stock_operational.user_state) i WHERE t.row_order=i.source_order;
DO $$ BEGIN IF EXISTS(SELECT FROM stock_operational.user_state t WHERE business_cells IS DISTINCT FROM stock_operational.project_user_state(t)) THEN RAISE EXCEPTION 'Unrepresentable user_state row; transition aborted'; END IF; END $$;
ALTER TABLE stock_operational.user_state ENABLE TRIGGER advance_revision;
DROP TRIGGER map_cells ON stock_operational.user_state;
ALTER TABLE stock_operational.user_state ALTER COLUMN business_cells DROP NOT NULL;
CREATE TRIGGER a_validate BEFORE INSERT OR UPDATE ON stock_operational.user_state FOR EACH ROW EXECUTE FUNCTION stock_operational.validate_user_state();
CREATE TRIGGER y_explicit_cells BEFORE UPDATE OF business_cells ON stock_operational.user_state FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_user_state();
CREATE TRIGGER z_compat BEFORE INSERT OR UPDATE ON stock_operational.user_state FOR EACH ROW EXECUTE FUNCTION stock_operational.compat_user_state();
REVOKE ALL ON FUNCTION stock_operational.input_user_state(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.input_user_state(jsonb) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.project_user_state(stock_operational.user_state) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.project_user_state(stock_operational.user_state) TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.validate_user_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.validate_user_state() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.compat_user_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.compat_user_state() TO stock_runtime;
REVOKE ALL ON FUNCTION stock_operational.cell_projection(jsonb,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stock_operational.cell_projection(jsonb,text,text,text) TO stock_runtime;
-- Preserve existing private SELECT readers without granting public execution.
DO $$ DECLARE t text; reader text; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='stock_operational' AND tablename IN ('orders','order_items','order_bills','shipments','shipment_orders','employees','employee_compensations','employee_timesheets','employee_advances','payroll_settlements','expenses','expense_categories','shops','sales_receipts','sales_receipt_items','sales_receipt_payments','sales_receipt_syncs','sales_profit_cost_overrides','stock_counts','stock_adjustments','movements','movement_details','user_state') LOOP
  FOR reader IN SELECT rolname FROM pg_roles WHERE has_schema_privilege(oid,'stock_operational','USAGE') AND has_table_privilege(oid,format('stock_operational.%I',t),'SELECT') LOOP
   EXECUTE format('GRANT EXECUTE ON FUNCTION stock_operational.project_%I(stock_operational.%I) TO %I',t,t,reader);
   EXECUTE format('GRANT EXECUTE ON FUNCTION stock_operational.cell_projection(jsonb,text,text,text) TO %I',reader);
  END LOOP;
 END LOOP;
END $$;
COMMIT;
