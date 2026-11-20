"""Offline operator-only coupled order-item identity/reference conversion.
Requires the released order-bill AND user-state identity contracts. No IO to providers.
"""
from pathlib import Path
import runpy
import sys

ROOT = Path(__file__).resolve().parents[2]
SESSION = runpy.run_path(str(ROOT / 'tools/migration/user-state-identity.py'))
SD = SESSION['SD']
BEFORE = SESSION['AFTER']
AFTER = BEFORE
for entry in ["('order_items','id','text')", "('movement_details','purchaseDetailId','text')"]:
    assert AFTER.count(entry) == 1
    AFTER = AFTER.replace(entry, entry.replace("'text'", "'bigint'"))


def header(phase):
    return f'''-- OPERATOR ONLY: separate supervised maintenance approval; all writers drained.
-- Deploy the dual-layout application BEFORE this SQL. Never run old app on bigint.
-- Verify fresh business AND private configuration recovery, plus local inverse.
BEGIN;
SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='120s';
SET LOCAL standard_conforming_strings=on;
SELECT 1/coalesce(current_setting('stock.allow_item_identity_{phase}',true)='reviewed-order-item-bigint-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.item_identity_restore_verified',true)='business-and-config-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.item_identity_source',true)~'^[a-f0-9]{{40}}$' AND current_setting('stock.item_identity_source',true)<>repeat('0',40),false)::int;
SELECT 1/coalesce(current_setting('stock.item_identity_fingerprint',true)~'^[a-f0-9]{{64}}$' AND current_setting('stock.item_identity_fingerprint',true)<>repeat('0',64),false)::int;
SELECT pg_advisory_xact_lock(835107241); SELECT pg_advisory_xact_lock(835107242);
LOCK TABLE stock_operational.order_items,stock_operational.movement_details IN ACCESS EXCLUSIVE MODE;
SELECT 1/coalesce((SELECT isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true) AND purpose IN ('production','isolated-staging') FROM stock_operational.environment WHERE singleton),false)::int;
SELECT 1/coalesce((SELECT value::text=current_setting('stock.item_identity_revision',true) FROM stock_operational.revision WHERE singleton FOR UPDATE),false)::int;
SELECT 1/(NOT EXISTS(SELECT FROM pg_prepared_xacts WHERE database=current_database()))::int;
SELECT 1/((SELECT relowner=current_user::regrole AND relrowsecurity AND NOT relforcerowsecurity FROM pg_class WHERE oid='stock_operational.order_items'::regclass))::int;
SELECT 1/((SELECT relowner=current_user::regrole AND relrowsecurity AND NOT relforcerowsecurity FROM pg_class WHERE oid='stock_operational.movement_details'::regclass))::int;
-- Exactly the released, validated, optional movement-to-item relationship only.
SELECT 1/coalesce((SELECT count(*)=1 AND bool_and(conrelid='stock_operational.movement_details'::regclass AND conname='movement_details_purchaseDetailId_fkey' AND convalidated AND conislocal AND coninhcount=0 AND obj_description(oid,'pg_constraint') IS NULL AND pg_get_constraintdef(oid)=$fk$FOREIGN KEY ("purchaseDetailId") REFERENCES stock_operational.order_items(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED$fk$) FROM pg_constraint WHERE contype='f' AND confrelid='stock_operational.order_items'::regclass),false)::int;
'''


def forward():
    s = header('conversion')
    s += SD['witness']('lexeme_mapping_contract_v1()', BEFORE)
    s += '''SELECT 1/(stock_operational.lexeme_mapping_contract_v1()='typed' AND stock_operational.soft_delete_contract_v1()='deletedAt' AND stock_operational.media_record_contract_v1()='id-only')::int;
SELECT 1/coalesce((SELECT atttypid='text'::regtype AND attidentity='' AND attnotnull AND NOT atthasdef FROM pg_attribute WHERE attrelid='stock_operational.order_items'::regclass AND attname='id' AND NOT attisdropped),false)::int;
SELECT 1/(to_regclass('stock_operational.order_items_id_seq') IS NULL)::int;
-- Replace only the exact released text-only CHECK; never drop unknown checks.
SELECT 1/((SELECT count(*)=1 AND bool_and(convalidated AND conislocal AND coninhcount=0 AND NOT connoinherit AND obj_description(oid,'pg_constraint') IS NULL AND pg_get_expr(conbin,conrelid)=$expr$(id <> ''::text)$expr$) FROM pg_constraint WHERE conrelid='stock_operational.order_items'::regclass AND conname='order_items_id_check' AND contype='c'))::int;
-- Include soft-deleted rows; reject aliases, overflow and exhausted capacity.
SELECT 1/(NOT EXISTS(SELECT FROM stock_operational.order_items WHERE NOT CASE WHEN id ~ '^(0|[1-9][0-9]{0,18})$' THEN id::numeric<9223372036854775807 ELSE false END))::int;
SELECT 1/coalesce((SELECT atttypid='text'::regtype AND attidentity='' AND NOT attnotnull AND NOT atthasdef FROM pg_attribute WHERE attrelid='stock_operational.movement_details'::regclass AND attname='purchaseDetailId' AND NOT attisdropped),false)::int;
SELECT 1/(NOT EXISTS(SELECT FROM stock_operational.movement_details WHERE "purchaseDetailId" IS NOT NULL AND NOT CASE WHEN "purchaseDetailId" ~ '^(0|[1-9][0-9]{0,18})$' THEN "purchaseDetailId"::numeric<9223372036854775807 ELSE false END))::int;
SELECT 1/(NOT EXISTS(SELECT FROM stock_operational.movement_details d LEFT JOIN stock_operational.order_items i ON i.id=d."purchaseDetailId" WHERE d."purchaseDetailId" IS NOT NULL AND i.id IS NULL))::int;
ALTER TABLE stock_operational.movement_details DROP CONSTRAINT "movement_details_purchaseDetailId_fkey";
ALTER TABLE stock_operational.order_items DROP CONSTRAINT order_items_id_check;
ALTER TABLE stock_operational.order_items ALTER COLUMN id TYPE bigint USING id::bigint;
ALTER TABLE stock_operational.movement_details ALTER COLUMN "purchaseDetailId" TYPE bigint USING "purchaseDetailId"::bigint;
ALTER TABLE stock_operational.order_items ADD CONSTRAINT order_items_id_check CHECK(id>=0);
ALTER TABLE stock_operational.order_items ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (SEQUENCE NAME stock_operational.order_items_id_seq START WITH 2 MINVALUE 1 NO CYCLE);
-- New sequence only: never alter another table's sequence or row/global revision.
SELECT setval('stock_operational.order_items_id_seq',greatest(coalesce(max(id),1),1),true) FROM stock_operational.order_items;
REVOKE ALL ON SEQUENCE stock_operational.order_items_id_seq FROM PUBLIC,anon,authenticated;
-- Default ACLs must not silently add unreviewed readers/writers to this object.
SELECT 1/(NOT EXISTS(SELECT FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('S',c.relowner))) a WHERE c.oid='stock_operational.order_items_id_seq'::regclass AND a.grantee<>c.relowner AND a.grantee NOT IN(SELECT oid FROM pg_roles WHERE rolname IN('stock_runtime','stock_prod_backup'))))::int;
REVOKE ALL ON SEQUENCE stock_operational.order_items_id_seq FROM stock_runtime;
GRANT USAGE ON SEQUENCE stock_operational.order_items_id_seq TO stock_runtime;
DO $$BEGIN
 IF EXISTS(SELECT FROM pg_roles WHERE rolname='stock_prod_backup') THEN
  REVOKE ALL ON SEQUENCE stock_operational.order_items_id_seq FROM stock_prod_backup;
  GRANT SELECT ON SEQUENCE stock_operational.order_items_id_seq TO stock_prod_backup;
 END IF;
END$$;
'''
    s += 'ALTER TABLE stock_operational.movement_details ADD CONSTRAINT "movement_details_purchaseDetailId_fkey" FOREIGN KEY ("purchaseDetailId") REFERENCES stock_operational.order_items(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;\n'
    s += SD['MU']['replace_body']('lexeme_mapping_contract_v1()', AFTER)
    return s + "SELECT 1/(stock_operational.lexeme_mapping_contract_v1()='typed')::int;\nCOMMIT;\n"


def inverse():
    s = header('inverse')
    s += SD['witness']('lexeme_mapping_contract_v1()', AFTER)
    s += '''SELECT 1/(stock_operational.lexeme_mapping_contract_v1()='typed')::int;
SELECT 1/coalesce((SELECT atttypid='bigint'::regtype AND attidentity='d' AND attnotnull FROM pg_attribute WHERE attrelid='stock_operational.order_items'::regclass AND attname='id' AND NOT attisdropped),false)::int;
SELECT 1/(pg_get_serial_sequence('stock_operational.order_items','id')='stock_operational.order_items_id_seq')::int;
SELECT 1/((SELECT count(*)=1 AND bool_and(convalidated AND conislocal AND coninhcount=0 AND NOT connoinherit AND obj_description(oid,'pg_constraint') IS NULL AND pg_get_expr(conbin,conrelid)=$expr$(id >= 0)$expr$) FROM pg_constraint WHERE conrelid='stock_operational.order_items'::regclass AND conname='order_items_id_check' AND contype='c'))::int;
SELECT 1/coalesce((SELECT atttypid='bigint'::regtype AND attidentity='' AND NOT attnotnull AND NOT atthasdef FROM pg_attribute WHERE attrelid='stock_operational.movement_details'::regclass AND attname='purchaseDetailId' AND NOT attisdropped),false)::int;
ALTER TABLE stock_operational.movement_details DROP CONSTRAINT "movement_details_purchaseDetailId_fkey";
ALTER TABLE stock_operational.order_items DROP CONSTRAINT order_items_id_check;
ALTER TABLE stock_operational.order_items ALTER COLUMN id DROP IDENTITY;
ALTER TABLE stock_operational.order_items ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE stock_operational.movement_details ALTER COLUMN "purchaseDetailId" TYPE text USING "purchaseDetailId"::text;
ALTER TABLE stock_operational.order_items ADD CONSTRAINT order_items_id_check CHECK(id<>'');
'''
    s += 'ALTER TABLE stock_operational.movement_details ADD CONSTRAINT "movement_details_purchaseDetailId_fkey" FOREIGN KEY ("purchaseDetailId") REFERENCES stock_operational.order_items(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;\n'
    s += SD['MU']['replace_body']('lexeme_mapping_contract_v1()', BEFORE)
    return s + "SELECT 1/(stock_operational.lexeme_mapping_contract_v1()='typed')::int;\nCOMMIT;\n"


if __name__ == '__main__':
    if len(sys.argv) != 2 or sys.argv[1] not in ('forward', 'inverse'):
        raise SystemExit('Choose forward or inverse; offline SQL generation only')
    print(forward() if sys.argv[1] == 'forward' else inverse(), end='')
