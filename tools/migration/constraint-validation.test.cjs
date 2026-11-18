/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic local SQL characterization. */
const test=require('node:test'),assert=require('node:assert/strict');
const {Client}=require('pg');
const {readFileSync}=require('node:fs');
const catalog=JSON.parse(readFileSync('tools/migration/worksheets.json','utf8'));
const policy=JSON.parse(readFileSync('tools/migration/cell-kinds-policy.json','utf8')).tables;
const url=new URL(process.env.STOCK_DATABASE_URL);
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/cv_after');
const ident=s=>'"'+s.replaceAll('"','""')+'"';
const clients=[];
async function connect(database){const u=new URL(url);u.username='postgres';u.pathname='/'+database;const c=new Client({connectionString:u.toString()});await c.connect();clients.push(c);return c;}
let before,after,required,foreign;
test.before(async()=>{
 before=await connect('cv_before');after=await connect('cv_after');
 required=new Set((await before.query("SELECT c.relname||'.'||a.attname name FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='stock_operational'::regnamespace AND a.attnotnull AND NOT a.attisdropped")).rows.map(r=>r.name));
 foreign=new Map((await before.query("SELECT c.relname||'.'||a.attname name,parent.relname parent FROM pg_constraint f JOIN pg_class c ON c.oid=f.conrelid JOIN pg_class parent ON parent.oid=f.confrelid JOIN pg_attribute a ON a.attrelid=f.conrelid AND a.attnum=f.conkey[1] WHERE f.connamespace='stock_operational'::regnamespace AND f.contype='f'")).rows.map(r=>[r.name,r.parent]));
 for(const c of [before,after]){
  await c.query('BEGIN');
  for(const t of Object.keys(catalog)){const initial=seed(t,'CV_PARENT_'+t);await c.query(initial.sql,initial.args);}
  await c.query('COMMIT');
 }
});
test.after(async()=>{await Promise.all(clients.map(c=>c.end()));});
const row=async(c,t,id)=>(await c.query(`SELECT to_jsonb(t)::text value FROM stock_operational.${t} t WHERE ${ident(catalog[t].key)}=$1`,[id])).rows[0]?.value;
async function attempt(c,sql,args){await c.query('BEGIN');try{await c.query(sql,args);await c.query('COMMIT');return true;}catch{await c.query('ROLLBACK');return false;}}
async function revision(c){return (await c.query('SELECT value::text v FROM stock_operational.revision WHERE singleton')).rows[0].v;}
function seed(t,id,overrides={}){
 const values={[catalog[t].key]:id};
 for(const f of policy[t].fields){
  if(f.name===catalog[t].key)continue;
  values[f.name]=foreign.has(t+'.'+f.name)?(required.has(t+'.'+f.name)?'CV_PARENT_'+foreign.get(t+'.'+f.name):null):f.type==='text'?(required.has(t+'.'+f.name)?'Synthetic':''):
   f.type==='timestamptz'?'2026-11-18T00:00:00.123456Z':f.type==='boolean'?true:
   f.type==='jsonb'?'{"exact":9007199254740993.0100,"array":[null,true]}':f.type==='numeric'?'9007199254740993.0100':'1';
 }
 Object.assign(values,overrides);
 const columns=Object.keys(values);
 return {sql:`INSERT INTO stock_operational.${t}(${columns.map(ident)}) VALUES(${columns.map((_,i)=>'$'+(i+1))})`,args:Object.values(values)};
}
test('74 operational functions become52; constraints validate47 timestamps and existing revision triggers remain',async()=>{
 assert.equal((await after.query("SELECT count(*)::int n FROM pg_proc WHERE pronamespace='stock_operational'::regnamespace")).rows[0].n,52);
 assert.equal((await after.query("SELECT count(*)::int n FROM pg_constraint WHERE connamespace='stock_operational'::regnamespace AND conname LIKE '%_lifecycle_range' AND convalidated")).rows[0].n,23);
 assert.equal((await after.query("SELECT count(*)::int n FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace='stock_operational'::regnamespace)")).rows[0].n,46);
 assert.equal((await after.query("SELECT count(*)::int n FROM pg_proc WHERE pronamespace='stock_operational'::regnamespace AND prosecdef")).rows[0].n,0);
});
test('all23 table writes match predecessor normalization, numeric/JSON fidelity, identity and archive rules',async()=>{
 for(const [t,spec] of Object.entries(catalog)){
  const key=ident(spec.key),id='CV_'+t,fields=policy[t].fields;
  const texts=fields.filter(f=>f.type==='text').map(f=>f.name);
  const numeric=fields.filter(f=>f.type==='numeric');
  const json=fields.filter(f=>f.type==='jsonb');
  const assignments=[...texts.filter(n=>n!==spec.key&&!required.has(t+'.'+n)).map(n=>`${ident(n)}=''`),...numeric.map(f=>`${ident(f.name)}=9007199254740993.0100`),...json.map(f=>`${ident(f.name)}='{"exact":9007199254740993.0100,"array":[null,true]}'::jsonb`)];
  for(const c of [before,after]){
   const initial=seed(t,id);await c.query(initial.sql,initial.args);
   await c.query(`UPDATE stock_operational.${t} SET ${assignments.join(',')},revision=999 WHERE ${key}=$1`,[id]);
  }
  assert.deepEqual(await row(after,t,id),await row(before,t,id),t);
  const r=await row(after,t,id);assert.equal(JSON.parse(r).revision,2,t);
  if(numeric.length||json.length)assert.ok(r.includes('9007199254740993.0100'),t+' exact decimal text');
  for(const c of [before,after]){
   assert.equal(await attempt(c,`UPDATE stock_operational.${t} SET ${key}=$1 WHERE ${key}=$2`,[id+'_changed',id]),false,t);
   assert.equal(await attempt(c,`INSERT INTO stock_operational.${t}(${key}) VALUES($1)`,[id]),false,t);
   for(const n of texts.filter(n=>required.has(t+'.'+n)))assert.equal(await attempt(c,`UPDATE stock_operational.${t} SET ${ident(n)}='' WHERE ${key}=$1`,[id]),false,t+'.'+n);
   // Archive first, then prove neither no-op edits nor unarchiving are allowed.
   await c.query(`UPDATE stock_operational.${t} SET archived_at='2026-11-18T00:00:00Z' WHERE ${key}=$1`,[id]);
   assert.equal(await attempt(c,`UPDATE stock_operational.${t} SET revision=revision WHERE ${key}=$1`,[id]),false,t);
   assert.equal(await attempt(c,`UPDATE stock_operational.${t} SET archived_at=NULL WHERE ${key}=$1`,[id]),false,t);
  }
  assert.deepEqual(await row(after,t,id),await row(before,t,id),t);
  assert.equal(await revision(after),await revision(before),t);
 }
});
test('all47 timestamp checks agree with old validators across UTC bounds, NULL, infinity and session timezones',async()=>{
 const values=[null,'0001-01-01T00:00:00Z','9999-12-31T23:59:59.999999Z','2026-11-18T00:00:00.123456+07:00','infinity','-infinity','0001-01-01 00:00:00+00 BC','10000-01-01T00:00:00Z'];
 for(const zone of ['UTC','Asia/Bangkok','America/Los_Angeles']){
  for(const c of [before,after])await c.query('SELECT set_config(\'TimeZone\',$1,false)',[zone]);
  for(const t of Object.keys(catalog))for(const field of policy[t].fields.filter(f=>f.type==='timestamptz'))for(const value of values){
   const input=seed(t,'CV_DATE',{[field.name]:value});
   const outcomes=[];
   for(const c of [before,after]){await c.query('BEGIN');try{await c.query(input.sql,input.args);outcomes.push(true);}catch{outcomes.push(false);}finally{await c.query('ROLLBACK');}}
   assert.equal(outcomes[1],outcomes[0],`${t}.${field.name}:${zone}:${value}`);
   assert.equal(outcomes[0],value===null?!required.has(t+'.'+field.name):!['infinity','-infinity','0001-01-01 00:00:00+00 BC','10000-01-01T00:00:00Z'].includes(value),`${t}.${field.name}:${zone}:${value} baseline domain`);
  }
 }
});
test('multi-row, zero-row, DELETE and failed statements preserve statement/global and per-row revisions',async()=>{
 for(const c of [before,after]){
  await c.query("INSERT INTO stock_operational.orders(id,remark) VALUES ('CV_MULTI_A',' '),('CV_MULTI_B','')");
  assert.equal(JSON.parse(await row(c,'orders','CV_MULTI_A')).remark,' ');
  assert.equal(JSON.parse(await row(c,'orders','CV_MULTI_B')).remark,null);
  await c.query("UPDATE stock_operational.orders SET remark='bulk' WHERE id LIKE 'CV_MULTI_%'");
  await c.query("UPDATE stock_operational.orders SET remark='none' WHERE id='CV_NEVER'");
  await c.query("DELETE FROM stock_operational.orders WHERE id='CV_MULTI_A'");
  assert.equal(await attempt(c,"UPDATE stock_operational.orders SET \"createdAt\"='infinity' WHERE id='CV_MULTI_B'"),false);
 }
 assert.deepEqual(await row(after,'orders','CV_MULTI_B'),await row(before,'orders','CV_MULTI_B'));
 assert.equal(await revision(after),await revision(before));
});
test('new guard inherits exact validator ACL, owner and settings; table-scoped reader gains no writes',async()=>{
 const old=(await before.query("SELECT proowner::regrole::text owner,proacl::text acl,proconfig,prosecdef FROM pg_proc WHERE oid='stock_operational.validate_orders()'::regprocedure")).rows[0];
 const current=(await after.query("SELECT proowner::regrole::text owner,proacl::text acl,proconfig,prosecdef FROM pg_proc WHERE oid='stock_operational.prepare_record_write()'::regprocedure")).rows[0];
 assert.deepEqual(current,old);
 assert.equal((await after.query("SELECT has_table_privilege('lexeme_reader','stock_operational.orders','UPDATE') allowed")).rows[0].allowed,false);
 assert.equal((await after.query("SELECT has_function_privilege('lexeme_reader','stock_operational.prepare_record_write()','EXECUTE') allowed")).rows[0].allowed,false);
 for(const role of ['anon','authenticated'])assert.equal((await after.query("SELECT has_function_privilege($1,'stock_operational.prepare_record_write()','EXECUTE') allowed",[role])).rows[0].allowed,false);
});
