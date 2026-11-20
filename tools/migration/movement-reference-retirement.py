"""Offline, operator-only removal of the unused operational movement reference.
Historical source tables/migrations, record IDs and all identity sequences stay intact.
"""
from pathlib import Path
import re
import runpy
import sys
ROOT=Path(__file__).resolve().parents[2]
ITEM=runpy.run_path(str(ROOT/'tools/migration/order-item-identity.py'))
SD=ITEM['SD'];MU=SD['MU'];literal=MU['literal']
BEFORE=ITEM['AFTER']
entry="('movement_details','purchaseDetailId','bigint'),"
assert BEFORE.count(entry)==1
AFTER=BEFORE.replace(entry,'')
match=re.search(r'IF valid<>(\d+)',AFTER);assert match
AFTER=AFTER.replace(match[0],'IF valid<>'+str(int(match[1])-1),1)
AFTER=AFTER.replace('BEGIN\n',"BEGIN\n IF EXISTS(SELECT FROM pg_attribute WHERE attrelid='stock_operational.movement_details'::regclass AND attname='purchaseDetailId' AND NOT attisdropped) THEN RAISE EXCEPTION 'Retired movement reference is present'; END IF;\n",1)
bodies=dict(MU['installed_functions']())
INPUT_SIG='typed_input_movement_details(jsonb)'
PROJECT_SIG='typed_project_movement_details(stock_operational.movement_details)'
INPUT_BEFORE=bodies[INPUT_SIG];PROJECT_BEFORE=bodies[PROJECT_SIG]
assignment='r."purchaseDetailId" := nullif((cells->>8),\'\')::text;'
assert INPUT_BEFORE.count(assignment)==1
INPUT_AFTER=INPUT_BEFORE.replace(assignment,"IF nullif(cells->>8,'') IS NOT NULL THEN RAISE EXCEPTION 'Movement purchase reference is retired'; END IF;")
projection='to_jsonb(coalesce(r."purchaseDetailId",\'\'))'
assert PROJECT_BEFORE.count(projection)==1
PROJECT_AFTER=PROJECT_BEFORE.replace(projection,"to_jsonb(''::text)")
FK='FOREIGN KEY ("purchaseDetailId") REFERENCES stock_operational.order_items(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED'
INDEX='CREATE INDEX "movement_details_purchaseDetailId_idx" ON stock_operational.movement_details USING btree ("purchaseDetailId")'
BEFORE_FUNCTIONS=[('lexeme_mapping_contract_v1()',BEFORE),(INPUT_SIG,INPUT_BEFORE),(PROJECT_SIG,PROJECT_BEFORE)]
AFTER_FUNCTIONS=[('lexeme_mapping_contract_v1()',AFTER),(INPUT_SIG,INPUT_AFTER),(PROJECT_SIG,PROJECT_AFTER)]


def header(phase):
 return f'''-- OPERATOR ONLY: separately approved supervised window; all writers drained.
-- Deploy the reference-independent app first; preserve API's blank field.
-- Fresh private business/configuration/three-sequence recovery must be restored.
BEGIN;
SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='120s';
SET LOCAL standard_conforming_strings=on;
SELECT 1/coalesce(current_setting('stock.allow_movement_reference_{phase}',true)='reviewed-null-movement-reference-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.movement_reference_restore_verified',true)='business-and-config-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.movement_reference_source',true)~'^[a-f0-9]{{40}}$' AND current_setting('stock.movement_reference_source',true)<>repeat('0',40),false)::int;
SELECT 1/coalesce(current_setting('stock.movement_reference_fingerprint',true)~'^[a-f0-9]{{64}}$' AND current_setting('stock.movement_reference_fingerprint',true)<>repeat('0',64),false)::int;
SELECT pg_advisory_xact_lock(835107241); SELECT pg_advisory_xact_lock(835107242);
LOCK TABLE stock_operational.order_items,stock_operational.movement_details IN ACCESS EXCLUSIVE MODE;
SELECT 1/coalesce((SELECT isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true) AND purpose IN ('production','isolated-staging') FROM stock_operational.environment WHERE singleton),false)::int;
SELECT 1/coalesce((SELECT value::text=current_setting('stock.movement_reference_revision',true) FROM stock_operational.revision WHERE singleton FOR UPDATE),false)::int;
SELECT 1/(NOT EXISTS(SELECT FROM pg_prepared_xacts WHERE database=current_database()))::int;
SELECT 1/(NOT EXISTS(SELECT FROM pg_inherits WHERE inhparent='stock_operational.movement_details'::regclass OR inhrelid='stock_operational.movement_details'::regclass))::int;
SELECT 1/coalesce((SELECT relkind='r' AND NOT relispartition AND relowner=current_user::regrole AND relrowsecurity AND NOT relforcerowsecurity FROM pg_class WHERE oid='stock_operational.movement_details'::regclass),false)::int;
SELECT 1/(stock_operational.soft_delete_contract_v1()='deletedAt' AND stock_operational.media_record_contract_v1()='id-only' AND stock_operational.lexeme_mapping_contract_v1()='typed')::int;
'''


def replace_functions(functions):
 return ''.join(MU['replace_body'](sig,body) for sig,body in functions)


def forward():
 s=header('retirement')+MU['witness'](BEFORE_FUNCTIONS)
 s+=f'''SELECT 1/coalesce((SELECT atttypid='bigint'::regtype AND attidentity='' AND attgenerated='' AND NOT attnotnull AND NOT atthasdef AND coalesce(cardinality(attacl),0)=0 AND col_description(attrelid,attnum) IS NULL FROM pg_attribute WHERE attrelid='stock_operational.movement_details'::regclass AND attname='purchaseDetailId' AND NOT attisdropped),false)::int;
-- Include deleted rows. Never discard a relationship populated since review.
SELECT 1/(NOT EXISTS(SELECT FROM stock_operational.movement_details WHERE "purchaseDetailId" IS NOT NULL))::int;
SELECT 1/coalesce((SELECT convalidated AND conislocal AND coninhcount=0 AND obj_description(oid,'pg_constraint') IS NULL AND pg_get_constraintdef(oid)={literal(FK)} FROM pg_constraint WHERE conrelid='stock_operational.movement_details'::regclass AND conname='movement_details_purchaseDetailId_fkey' AND contype='f'),false)::int;
SELECT 1/coalesce((SELECT i.indisvalid AND i.indisready AND NOT i.indisunique AND NOT i.indisprimary AND c.relowner=current_user::regrole AND obj_description(c.oid,'pg_class') IS NULL AND pg_get_indexdef(c.oid)={literal(INDEX)} FROM pg_class c JOIN pg_index i ON i.indexrelid=c.oid WHERE c.oid=to_regclass('stock_operational."movement_details_purchaseDetailId_idx"')),false)::int;
-- Refuse unknown views, indexes, CHECKs and other catalog dependencies.
SELECT 1/(NOT EXISTS(SELECT FROM pg_depend d WHERE d.refclassid='pg_class'::regclass AND d.refobjid='stock_operational.movement_details'::regclass AND d.refobjsubid=(SELECT attnum FROM pg_attribute WHERE attrelid=d.refobjid AND attname='purchaseDetailId' AND NOT attisdropped) AND NOT(d.classid='pg_constraint'::regclass AND d.objid=(SELECT oid FROM pg_constraint WHERE conrelid=d.refobjid AND conname='movement_details_purchaseDetailId_fkey')) AND NOT(d.classid='pg_class'::regclass AND d.objid=to_regclass('stock_operational."movement_details_purchaseDetailId_idx"'))))::int;
-- Quoted SQL/PLpgSQL bodies may not have catalog column dependencies.
SELECT 1/(NOT EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND position('purchaseDetailId' IN p.prosrc)>0 AND p.oid NOT IN ('stock_operational.lexeme_mapping_contract_v1()'::regprocedure,'stock_operational.{INPUT_SIG}'::regprocedure,'stock_operational.{PROJECT_SIG}'::regprocedure)))::int;
ALTER TABLE stock_operational.movement_details DROP CONSTRAINT "movement_details_purchaseDetailId_fkey";
DROP INDEX stock_operational."movement_details_purchaseDetailId_idx";
ALTER TABLE stock_operational.movement_details DROP COLUMN "purchaseDetailId" RESTRICT;
'''
 s+=replace_functions(AFTER_FUNCTIONS)
 return s+"SELECT 1/(stock_operational.lexeme_mapping_contract_v1()='typed')::int;\nCOMMIT;\n"


def inverse():
 s=header('inverse')+MU['witness'](AFTER_FUNCTIONS)
 s+='''SELECT 1/(NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='stock_operational.movement_details'::regclass AND attname='purchaseDetailId' AND NOT attisdropped))::int;
SELECT 1/(to_regclass('stock_operational."movement_details_purchaseDetailId_idx"') IS NULL AND NOT EXISTS(SELECT FROM pg_constraint WHERE conrelid='stock_operational.movement_details'::regclass AND conname='movement_details_purchaseDetailId_fkey'))::int;
-- Logical inverse only: PostgreSQL appends the restored NULL column at the end.
-- No old records are restored, no revisions incremented and no sequences reset.
ALTER TABLE stock_operational.movement_details ADD COLUMN "purchaseDetailId" bigint;
'''
 s+=INDEX+';\nALTER TABLE stock_operational.movement_details ADD CONSTRAINT "movement_details_purchaseDetailId_fkey" '+FK+';\n'
 # Match pg_restore when reconstituting only these witnessed predecessor bodies.
 # The inactive predecessor projector predates PR93's bigint reference type.
 s+='SET LOCAL check_function_bodies=off;\n'
 s+=replace_functions(BEFORE_FUNCTIONS)
 s+='SET LOCAL check_function_bodies=on;\n'
 return s+"SELECT 1/(stock_operational.lexeme_mapping_contract_v1()='typed')::int;\nCOMMIT;\n"


if __name__=='__main__':
 if len(sys.argv)!=2 or sys.argv[1] not in ('forward','inverse'):raise SystemExit('Choose forward or inverse; offline generation only')
 print(forward() if sys.argv[1]=='forward' else inverse(),end='')
