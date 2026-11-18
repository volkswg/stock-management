"""Reproduce explicitly gated media-ID compatibility, column retirement and inverses.
No provider IO, automatic discovery, role changes or public access grants.
"""
import hashlib
import re
import runpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
CV=runpy.run_path(str(ROOT/'tools/migration/constraint-validation.py'))
MC=runpy.run_path(str(ROOT/'tools/migration/media-catalog.py'))
REFS=MC['REFERENCES'];literal=CV['literal'];BODIES=CV['BODIES']
MEDIA={m[1]:m[2] for m in re.findall(r'(CREATE FUNCTION stock_operational\.(\w+)\(.*? AS \$\$(.*?)\$\$;)',MC['render'](),re.S)}
# Preserve every existing function's owner/config/ACL while replacing its body.
replace_group=CV['TYPED']['LF']['replace_group']

def replace_body(signature,body,volatility=None):
 s=f'''DO $replace$ DECLARE definition text; old_body text; BEGIN
 SELECT pg_get_functiondef(oid),prosrc INTO STRICT definition,old_body FROM pg_proc WHERE oid='stock_operational.{signature}'::regprocedure;
 IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'Ambiguous function body'; END IF;
 EXECUTE replace(definition,old_body,{literal(body)});
END $replace$;\n'''
 if volatility:s+=f'ALTER FUNCTION stock_operational.{signature} {volatility};\n'
 return s

def header(phase):
 tables=','.join('stock_operational.'+t for t,_,_ in REFS)+',stock_operational.media'
 return f'''-- OPERATOR ONLY. Separate live maintenance approval and fresh52-table recovery.
-- URL alias normalization to media.sourceUrl was explicitly approved. Files stay intact.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='120s';
SET LOCAL standard_conforming_strings=on;
SELECT 1/coalesce(current_setting('stock.allow_media_url_{phase}',true)='reviewed-media-ids-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.media_url_restore_verified',true)='52-tables-15-metadata-v1',false)::int;
SELECT 1/coalesce(current_setting('stock.media_url_source',true)~'^[a-f0-9]{{40}}$' AND current_setting('stock.media_url_source',true)<>repeat('0',40),false)::int;
SELECT 1/coalesce(current_setting('stock.media_url_fingerprint',true)~'^[a-f0-9]{{64}}$',false)::int;
SELECT 1/coalesce(current_setting('stock.media_url_alias_policy',true)='use-media-sourceUrl',false)::int;
SELECT 1/coalesce((SELECT isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose=current_setting('stock.expected_purpose',true) AND purpose IN ('production','isolated-staging') FROM stock_operational.environment),false)::int;
SELECT pg_advisory_xact_lock(835107241); SELECT pg_advisory_xact_lock(835107242);
LOCK TABLE {tables} IN ACCESS EXCLUSIVE MODE;
SELECT 1/coalesce((SELECT value::text=current_setting('stock.media_url_revision',true) FROM stock_operational.revision WHERE singleton FOR UPDATE),false)::int;
SELECT 1/(NOT EXISTS(SELECT FROM pg_prepared_xacts WHERE database=current_database()))::int;
SELECT 1/((SELECT count(*)=5 FROM pg_trigger WHERE tgname='a_validate' AND tgenabled='O' AND tgfoid='stock_operational.prepare_record_write()'::regprocedure AND tgrelid IN ({','.join(literal('stock_operational.'+t)+'::regclass' for t,_,_ in REFS)})))::int;
'''

URL_BODY='''
DECLARE url text;
BEGIN
 IF media_id IS NULL THEN RETURN ''; END IF;
 SELECT "sourceUrl" INTO url FROM stock_operational.media WHERE id=media_id AND "deletedAt" IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Missing, hidden or deleted media reference'; END IF;
 RETURN url;
END '''
REF_BODY='''
DECLARE item stock_operational.media; location record;
BEGIN
 IF url IS NULL OR url='' THEN RETURN NULL; END IF;
 SELECT * INTO item FROM stock_operational.media WHERE md5("sourceUrl")=md5(url) AND "sourceUrl"=url FOR SHARE;
 IF FOUND THEN
  IF item."deletedAt" IS NOT NULL THEN RAISE EXCEPTION 'Referenced media is deleted'; END IF;
  RETURN item.id;
 END IF;
 SELECT * INTO location FROM stock_operational.media_location_v1(url);
 RETURN stock_operational.media_for_location_v1(location.provider,location.file_id,url);
END '''

def record_contract():
 refs=','.join('('+literal(t)+','+literal(r)+')' for t,_,r in REFS)
 urls=','.join('('+literal(t)+','+literal(u)+')' for t,u,_ in REFS)
 return f'''
DECLARE refs integer; urls integer; triggers integer;
BEGIN
 SELECT count(*) INTO refs FROM (VALUES {refs}) e(t,c) JOIN pg_attribute a ON a.attrelid=to_regclass('stock_operational.'||e.t) AND a.attname=e.c AND NOT a.attisdropped AND a.atttypid='uuid'::regtype;
 SELECT count(*) INTO urls FROM (VALUES {urls}) e(t,c) JOIN pg_attribute a ON a.attrelid=to_regclass('stock_operational.'||e.t) AND a.attname=e.c AND NOT a.attisdropped AND a.atttypid='text'::regtype;
 SELECT count(*) INTO triggers FROM pg_trigger WHERE tgname='b_media_reference' AND tgenabled='O' AND tgfoid='stock_operational.bind_media_v1()'::regprocedure AND tgrelid IN ({','.join(literal('stock_operational.'+t)+'::regclass' for t,_,_ in REFS)}) AND tgnargs=CASE WHEN urls=5 THEN 2 ELSE 1 END;
 IF refs<>5 OR triggers<>5
 OR (SELECT count(*)<>11 FROM pg_attribute WHERE attrelid=to_regclass('stock_operational.media') AND attnum>0 AND NOT attisdropped)
 OR (SELECT count(*)<>5 FROM pg_constraint WHERE confrelid=to_regclass('stock_operational.media') AND contype='f' AND convalidated AND confdeltype='r')
 OR to_regclass('stock_operational.media') IS NULL OR to_regprocedure('stock_operational.media_url_v1(uuid)') IS NULL OR to_regprocedure('stock_operational.media_ref_for_url_v1(text)') IS NULL THEN RAISE EXCEPTION 'Incomplete media record schema'; END IF;
 IF urls=5 THEN RETURN 'retained'; END IF;
 IF urls=0 THEN RETURN 'id-only'; END IF;
 RAISE EXCEPTION 'Partial media URL retirement';
END '''

def project(table,url,ref):
 old=f'to_jsonb(coalesce(r."{url}",\'\'))';body=BODIES['typed_project_'+table];assert body.count(old)==1
 return body.replace(old,f'to_jsonb(stock_operational.media_url_v1(r."{ref}"))')

def input_body(table,url,ref):
 body=BODIES['typed_input_'+table]
 match=re.search(r'r\."'+url+r'" := (.*?);',body);assert match
 expr=match[1]
 return body[:match.start()]+f'''-- JSON population ignores this compatibility key after the physical column is retired.
r := jsonb_populate_record(r,jsonb_build_object('{url}',{expr}));
r."{ref}" := stock_operational.media_ref_for_url_v1({expr});'''+body[match.end():]

def typed_contract():
 body=BODIES['lexeme_mapping_contract_v1']
 for table,url,_ in REFS:
  needle=literal(table)+','+literal(url)+",'text'"
  # Remove only each explicitly reviewed retired field from the required set.
  body,n=re.subn(r'\('+re.escape(needle)+r'\),','',body);assert n==1
 m=re.search(r'IF valid<>(\d+)',body);assert m
 body=body[:m.start()]+body[m.start():].replace(m[0],f'IF valid<>{int(m[1])-5}',1)
 return body.replace('BEGIN\n','BEGIN\n PERFORM stock_operational.media_record_contract_v1();\n',1)

def bind_body():
 old=MEDIA['bind_media_v1']
 block='''
 IF TG_NARGS=1 THEN
  ref:=(shape->>TG_ARGV[0])::uuid;
  IF ref IS NOT NULL THEN
   SELECT * INTO item FROM stock_operational.media WHERE id=ref FOR SHARE;
   IF NOT FOUND OR item."deletedAt" IS NOT NULL THEN RAISE EXCEPTION 'Missing or deleted media reference'; END IF;
  END IF;
  RETURN NEW;
 END IF;
'''
 return old.replace('BEGIN\n','BEGIN\n'+block,1)

def catalog_body():
 # A mixed/partial trigger layout must fail before registering upload metadata.
 old=MEDIA['media_catalog_v1']
 return old.replace("THEN 'media-v1'", "THEN CASE stock_operational.media_record_contract_v1() WHEN 'retained' THEN 'media-v1' WHEN 'id-only' THEN 'media-v2' ELSE 'unsupported-media-layout' END")

def witness(items):
 values=','.join('('+literal(sig)+','+literal(hashlib.md5(body.encode()).hexdigest())+')' for sig,body in items)
 return '''DO $witness$ DECLARE item record; BEGIN
 FOR item IN SELECT * FROM (VALUES '''+values+''') e(sig,hash) LOOP
  IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('stock_operational.'||item.sig) AND md5(prosrc)=item.hash AND NOT prosecdef) THEN RAISE EXCEPTION 'Unreviewed media function drift: %',item.sig; END IF;
 END LOOP;
END $witness$;\n'''

def original_functions():
 result=[]
 for table,_,_ in REFS:
  result += [(f'typed_project_{table}(stock_operational.{table})',BODIES['typed_project_'+table]),(f'typed_input_{table}(jsonb)',BODIES['typed_input_'+table])]
 return result+[('lexeme_mapping_contract_v1()',BODIES['lexeme_mapping_contract_v1']),('bind_media_v1()',MEDIA['bind_media_v1']),('media_catalog_v1()',MEDIA['media_catalog_v1']),('prepare_record_write()',CV['GUARD'])]

def changed_functions():
 result=[]
 for table,url,ref in REFS:
  result += [(f'typed_project_{table}(stock_operational.{table})',project(table,url,ref)),(f'typed_input_{table}(jsonb)',input_body(table,url,ref))]
 return result+[('lexeme_mapping_contract_v1()',typed_contract()),('bind_media_v1()',bind_body()),('media_catalog_v1()',catalog_body())]

def installed_functions():
 return changed_functions()+[('media_url_v1(uuid)',URL_BODY),('media_ref_for_url_v1(text)',REF_BODY),('media_record_contract_v1()',record_contract()),('prepare_record_write()',CV['GUARD'])]

def reader_guard():
 # Fail instead of expanding catalog grants or bypassing RLS for a limited reader.
 return '''SELECT 1/(NOT EXISTS(SELECT FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
 WHERE c.oid IN ('''+','.join(literal('stock_operational.'+t)+'::regclass' for t,_,_ in REFS)+''') AND a.privilege_type='SELECT' AND a.grantee<>c.relowner
 AND (a.grantee=0 OR NOT has_table_privilege(a.grantee,'stock_operational.media','SELECT') OR NOT EXISTS(
 SELECT FROM pg_policy p WHERE p.polrelid='stock_operational.media'::regclass AND p.polcmd IN ('r','*') AND p.polpermissive AND pg_get_expr(p.polqual,p.polrelid)='true' AND EXISTS(SELECT FROM unnest(p.polroles) r WHERE CASE WHEN r=0 THEN true ELSE pg_has_role(a.grantee,r,'USAGE') END))
 OR EXISTS(SELECT FROM pg_policy p WHERE p.polrelid='stock_operational.media'::regclass AND p.polcmd IN ('r','*') AND NOT p.polpermissive AND EXISTS(SELECT FROM unnest(p.polroles) r WHERE CASE WHEN r=0 THEN true ELSE pg_has_role(a.grantee,r,'USAGE') END)))))::int;\n'''

def compatibility():
 s=header('compatibility')+"SELECT 1/(stock_operational.media_catalog_v1()='media-v1' AND stock_operational.lexeme_mapping_contract_v1()='typed' AND to_regprocedure('stock_operational.media_record_contract_v1()') IS NULL)::int;\n"+witness(original_functions())+reader_guard()
 for name,args,returns,body,vol in [('media_url_v1','media_id uuid','text',URL_BODY,'STABLE'),('media_ref_for_url_v1','url text','uuid',REF_BODY,'VOLATILE'),('media_record_contract_v1','','text',record_contract(),'STABLE')]:
  s+=f"CREATE FUNCTION stock_operational.{name}({args}) RETURNS {returns} LANGUAGE plpgsql {vol} SECURITY INVOKER SET search_path='' AS $$"+body+'$$;\n'
  sig=name+'('+('uuid' if name=='media_url_v1' else 'text' if name=='media_ref_for_url_v1' else '')+')'
  s+=f'REVOKE ALL ON FUNCTION stock_operational.{sig} FROM PUBLIC,anon,authenticated;\n'
  # Existing typed callers only; input capability is not granted to readers.
  basis='typed_input_order_items(jsonb)' if name=='media_ref_for_url_v1' else 'lexeme_mapping_contract_v1()'
  s+=f'''DO $acl$ DECLARE a record; BEGIN
 FOR a IN SELECT grantee FROM aclexplode(coalesce((SELECT proacl FROM pg_proc WHERE oid='stock_operational.{basis}'::regprocedure),acldefault('f',(SELECT proowner FROM pg_proc WHERE oid='stock_operational.{basis}'::regprocedure)))) WHERE privilege_type='EXECUTE' AND grantee<>0 LOOP
  IF pg_get_userbyid(a.grantee) IN ('anon','authenticated') THEN RAISE EXCEPTION 'Unreviewed public mapper grant'; END IF;
  EXECUTE format('GRANT EXECUTE ON FUNCTION stock_operational.{sig} TO %I',pg_get_userbyid(a.grantee));
 END LOOP;
END $acl$;\n'''
 for sig,body in changed_functions():
  vol='STABLE' if sig.startswith('typed_project_') else 'VOLATILE' if sig.startswith('typed_input_') else None
  s+=replace_body(sig,body,vol)
 return s+"SELECT 1/(stock_operational.media_record_contract_v1()='retained' AND stock_operational.lexeme_mapping_contract_v1()='typed')::int;\nCOMMIT;\n"

def retirement():
 s=header('retirement')+"SELECT 1/(stock_operational.media_record_contract_v1()='retained')::int;\n"+witness(installed_functions())+reader_guard()
 allowed=','.join(literal('stock_operational.'+sig)+'::regprocedure' for sig,_ in changed_functions())+",'stock_operational.media_record_contract_v1()'::regprocedure"
 for table,url,ref in REFS:
  s+=f'''-- Do not silently delete custom indexes/constraints/column ACLs or external consumers.
SELECT 1/(NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='stock_operational.{table}'::regclass AND attname='{url}' AND attacl IS NOT NULL))::int;
SELECT 1/(NOT EXISTS(SELECT FROM pg_depend d JOIN pg_attribute a ON a.attrelid=d.refobjid AND a.attnum=d.refobjsubid WHERE a.attrelid='stock_operational.{table}'::regclass AND a.attname='{url}' AND NOT (d.classid='pg_trigger'::regclass AND d.objid IN (SELECT oid FROM pg_trigger WHERE tgrelid=a.attrelid AND tgname='b_media_reference'))))::int;
SELECT 1/(NOT EXISTS(SELECT FROM stock_operational.{table} t LEFT JOIN stock_operational.media m ON m.id=t."{ref}" LEFT JOIN LATERAL stock_operational.media_location_v1(t."{url}") l ON true WHERE (coalesce(t."{url}",'')='' AND t."{ref}" IS NOT NULL) OR (coalesce(t."{url}",'')<>'' AND (m.id IS NULL OR m."deletedAt" IS NOT NULL OR (m."sourceUrl"<>t."{url}" AND NOT(m.provider='google_drive' AND l.provider='google_drive' AND m."providerFileId"=l.file_id))))))::int;
'''
 s+='''SELECT 1/(NOT EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND p.prokind IN ('f','p') AND p.oid NOT IN ('''+allowed+''') AND lower(p.prosrc) ~ '(^|[^a-z_])(imageurl|productimageurl|shippingbillurl|photourl)([^a-z_]|$)'))::int;\n'''
 for table,url,ref in REFS:
  s+=f'''DROP TRIGGER b_media_reference ON stock_operational.{table};
ALTER TABLE stock_operational.{table} DROP COLUMN "{url}" RESTRICT;
CREATE TRIGGER b_media_reference BEFORE INSERT OR UPDATE OF "{ref}" ON stock_operational.{table} FOR EACH ROW EXECUTE FUNCTION stock_operational.bind_media_v1('{ref}');
'''
 return s+"SELECT 1/(stock_operational.media_record_contract_v1()='id-only' AND stock_operational.lexeme_mapping_contract_v1()='typed' AND stock_operational.media_catalog_v1()='media-v2')::int;\nCOMMIT;\n"

def inverse():
 s=header('rollback')+"SELECT 1/(stock_operational.media_record_contract_v1()='id-only')::int;\n"+witness(installed_functions())
 for table,url,ref in REFS:
  s+=f'''DROP TRIGGER b_media_reference ON stock_operational.{table};
ALTER TABLE stock_operational.{table} ADD COLUMN "{url}" text;
-- Reconstruct the approved canonical URL; retain all other values/revisions/timestamps.
ALTER TABLE stock_operational.{table} DISABLE TRIGGER a_validate;
UPDATE stock_operational.{table} SET "{url}"=nullif(stock_operational.media_url_v1("{ref}"),'');
ALTER TABLE stock_operational.{table} ENABLE TRIGGER a_validate;
CREATE TRIGGER b_media_reference BEFORE INSERT OR UPDATE OF "{url}","{ref}" ON stock_operational.{table} FOR EACH ROW EXECUTE FUNCTION stock_operational.bind_media_v1('{url}','{ref}');
'''
 return s+"SELECT 1/(stock_operational.media_record_contract_v1()='retained' AND stock_operational.media_catalog_v1()='media-v1')::int;\nCOMMIT;\n"

if __name__=='__main__':
 import sys
 print({'compatibility':compatibility,'retirement':retirement,'rollback':inverse}[sys.argv[1]](),end='')
