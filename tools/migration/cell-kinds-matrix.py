"""Synthetic exhaustive per-field retained input/projection comparison, SQL only."""
import json,runpy,random
from pathlib import Path
m=runpy.run_path(str(Path(__file__).with_name('cell-kinds.py')))
literal=lambda s:"'"+s.replace("'","''")+"'"
for table,entry in m['POLICY']['tables'].items():
    fields=[f for f in entry['fields'] if f['position'] is not None]
    values=[]
    for f in fields:
        values.append({'text':'synthetic ไทย\\n','numeric':'9007199254740993.0100','bigint':'9007199254740993','boolean':'TRUE','jsonb':' { "amount" : 9007199254740993.01, "x": [true] } ','timestamptz':'2026-11-17T09:00:00.123456+07:00'}[f['type']])
    variants=[values,values[:1]]
    for i,f in enumerate(fields):
        for value in ['',None,42,1,True,False,'0','null']:
            row=list(values);row[i]=value;variants.append(row)
    randomizer=random.Random(731)
    choices={'text':['synthetic ไทย','',None,42,True,False],
             'numeric':['9007199254740993.0100','',None,1.25,0],
             'bigint':['9007199254740993','',None,1,0],
             'boolean':['TRUE','FALSE','',None,True,False,1,0],
             'jsonb':[' { "x": [true] } ','null','',None,7,True,'[]'],
             'timestamptz':['2026-11-17T09:00:00.123456+07:00','',None,'2026-11-17']}
    for _ in range(16):variants.append([randomizer.choice(choices[f['type']]) for f in fields])
    encoded=','.join('('+literal(json.dumps(v,ensure_ascii=False))+ '::jsonb)' for v in variants)
    expected=[('2026-11-17T02:00:00.123456Z' if f['type']=='timestamptz' else v) for f,v in zip(fields,values)]
    full=literal(json.dumps(values,ensure_ascii=False))+'::jsonb'
    canonical=literal(json.dumps(expected,ensure_ascii=False))+'::jsonb'
    blanks=literal(json.dumps(['']*len(fields)))+'::jsonb'
    nulls=literal(json.dumps([None]*len(fields)))+'::jsonb'
    print(f"SELECT 1 / (stock_operational.column_project_{table}(stock_operational.column_input_{table}({full}))={canonical})::int;")
    print(f"SELECT 1 / (stock_operational.column_project_{table}(stock_operational.column_input_{table}({blanks}))={blanks})::int;")
    print(f"SELECT 1 / (stock_operational.column_project_{table}(stock_operational.column_input_{table}({nulls}))={blanks})::int;")
    print(f"SELECT 1 / (stock_operational.column_compatible_{table}(stock_operational.column_input_{table}({nulls}))={nulls})::int;")
    print(f'''DO $matrix$
DECLARE item record; old_value jsonb; new_value jsonb; old_projection jsonb; new_projection jsonb; old_error text; new_error text;
BEGIN
 FOR item IN SELECT * FROM (VALUES {encoded}) cases(cells) LOOP
  old_error:=NULL;new_error:=NULL;
  BEGIN SELECT to_jsonb(stock_operational.input_{table}(item.cells)) INTO old_value; EXCEPTION WHEN OTHERS THEN old_error:=SQLSTATE; END;
  BEGIN SELECT to_jsonb(stock_operational.column_input_{table}(item.cells)) INTO new_value; EXCEPTION WHEN OTHERS THEN new_error:=SQLSTATE; END;
  IF old_error IS DISTINCT FROM new_error THEN RAISE EXCEPTION 'Input acceptance changed for {table}'; END IF;
  IF old_error IS NULL THEN
   IF old_value IS DISTINCT FROM new_value THEN RAISE EXCEPTION 'Named/lexeme/encoding input changed for {table}'; END IF;
   BEGIN
    SELECT stock_operational.project_{table}(stock_operational.input_{table}(item.cells)) INTO old_projection;
    SELECT stock_operational.column_compatible_{table}(stock_operational.column_input_{table}(item.cells)) INTO new_projection;
    IF old_projection IS DISTINCT FROM new_projection THEN RAISE EXCEPTION 'Retained projection changed for {table}'; END IF;
   EXCEPTION WHEN invalid_text_representation THEN
    -- Some scalar kinds parse to named values but cannot project; both must
    -- reject them, never silently reinterpret their original representation.
    BEGIN PERFORM stock_operational.column_compatible_{table}(stock_operational.column_input_{table}(item.cells)); RAISE EXCEPTION 'Projection rejection changed for {table}'; EXCEPTION WHEN invalid_text_representation THEN NULL; END;
   END;
  END IF;
 END LOOP;
END $matrix$;''')
print("SELECT 'PASS: all248 interface fields, valid/error scalar variants, exact named values/lexemes/encoding and retained projection; short rows included';")
print('''BEGIN;
CREATE OR REPLACE FUNCTION stock_operational.project_orders(r stock_operational.orders) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'synthetic legacy path'; END $$;
DO $$ BEGIN
 IF stock_operational.column_compatible_orders(stock_operational.column_input_orders('["CK_FAST","waiting_for_total_price","synthetic",12.5,"","2026-11-17T02:00:00.000Z","","",""]')) IS DISTINCT FROM '["CK_FAST","waiting_for_total_price","synthetic",12.5,"","2026-11-17T02:00:00.000Z","","",""]'::jsonb THEN RAISE EXCEPTION 'Canonical fast path changed'; END IF;
 BEGIN PERFORM stock_operational.column_compatible_orders(stock_operational.column_input_orders('["CK_SHORT"]')); RAISE EXCEPTION 'Missing explicit legacy path'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'synthetic legacy path' THEN RAISE; END IF; END;
END $$;
CREATE OR REPLACE FUNCTION stock_operational.column_project_orders(r stock_operational.orders) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'synthetic candidate failure'; END $$;
DO $$ BEGIN
 BEGIN PERFORM stock_operational.column_compatible_orders(stock_operational.column_input_orders('["CK_ERROR","waiting_for_total_price","synthetic",12.5,"","2026-11-17T02:00:00.000Z","","",""]')); RAISE EXCEPTION 'Candidate error hidden'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'synthetic candidate failure' THEN RAISE; END IF; END;
END $$;
ROLLBACK;
SELECT 'PASS: canonical path avoids old decoding; legacy path is explicit; candidate errors propagate without fallback';''')
