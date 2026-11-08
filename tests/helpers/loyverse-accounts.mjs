import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {externalGraph} from './external-source.mjs';

export const accountsBefore=JSON.parse(readFileSync('tests/fixtures/loyverse-accounts-before.json','utf8'));
export const accountsComposition='src/composition/loyverse-accounts.ts';
export const accountsReader='src/infrastructure/configuration/google-sheets/loyverse-accounts.ts';
export const accountHeaders=['id','shopName','storeId','accessToken','active','sortOrder'];
export const exampleAccounts=[{id:'first',shopName:'First Shop',accessToken:'synthetic-first-secret',storeId:'store-1'},{id:'second',shopName:'Second Shop',accessToken:'synthetic-second-secret'}];
export const accountRows=()=>[accountHeaders, ['second','Second Shop','','synthetic-second-secret',true,20], ['disabled','Old Shop','','',false,30], ['first','First Shop','store-1','synthetic-first-secret','TRUE','10']];
export const envConfig=()=>({loyverse:{accounts:structuredClone(exampleAccounts)},googleSheets:{spreadsheetId:'operations'},googleService:{accountEmail:'fake@example.test',accountPrivateKey:'synthetic-key'}});
export const sheetConfig=()=>({...envConfig(),loyverse:{accountSource:'sheet',accountsSpreadsheetId:'private-accounts',accounts:[]}});

// A closed loader for actual configuration/reader/composition and captured HTTP.
// Only provider classes, operational Sheets and feature endpoints are injected.
export function accountGraph({original=false,config=envConfig(),env={},rows=accountRows(),read,Client,imports={},events=[],globals={}}={}){
  const cache=new Map();
  class FakeAuth {constructor(input){events.push(['account-auth',input.scopes]);}}
  class FakeSheets {
    constructor(_auth,id){events.push(['account-client',id]);}
    async getValues(tab,range){events.push(['account-read',tab,range]);return read?read(tab,range):structuredClone(rows);}
  }
  class FakeLoyverse {
    constructor(input){events.push(['loyverse-client',input.accessToken]);}
    async getReceipts(query){events.push(['receipts',query]);return [];}
    async getReceipt(number){events.push(['receipt',number]);return {};}
    async getSalesByItem(query){events.push(['items',query]);return {};}
    async checkConnection(){events.push(['connection']);}
  }
  const external=externalGraph().load('src/infrastructure/external/loyverse/index.ts');
  function load(file){
    assert.ok([accountsComposition,accountsReader,'src/shared/lib/is-record.ts',...Object.keys(accountsBefore.files)].includes(file),`Unapproved account source: ${file}`);
    if(cache.has(file))return cache.get(file);
    const source=original&&accountsBefore.files[file]?accountsBefore.files[file].source:readFileSync(file,'utf8');
    const exports={};cache.set(file,exports);
    const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    new vm.Script(code,{filename:file}).runInNewContext({exports,Error,Date,Request,Response,URL,URLSearchParams,process:{env},console:{error:(...args)=>events.push(['log',...args])},fetch:()=>assert.fail('Live IO forbidden'),...globals,require(spec){
      if(spec==='server-only')return {};
      if(spec==='@/composition/loyverse-accounts')return load(accountsComposition);
      if(spec==='@/infrastructure/configuration/google-sheets/loyverse-accounts')return load(accountsReader);
      if(spec==='@/infrastructure/persistence/google-sheets/google-auth/GoogleServiceAccountAuth')return {GoogleServiceAccountAuth:FakeAuth};
      if(spec==='@/infrastructure/persistence/google-sheets/client/GoogleSheetsClient')return {GoogleSheetsClient:FakeSheets};
      if(spec==='./LoyverseService')return {LoyverseService:Client??FakeLoyverse};
      if(spec==='@/infrastructure/external/loyverse')return {...external,LoyverseService:Client??FakeLoyverse,...load('src/infrastructure/external/loyverse/createLoyverseServiceFromConfig.ts')};
      if(spec==='@/config')return {getConfig:()=>{events.push(['config']);return config;}};
      if(spec==='next/server')return {NextResponse:Response};
      if(spec==='@/shared/lib/is-record')return load('src/shared/lib/is-record.ts');
      if(Object.hasOwn(imports,spec))return imports[spec];
      throw new Error(`Unstubbed account dependency ${spec} in ${file}`);
    }});
    return exports;
  }
  return {load,events,access:()=>load(accountsComposition),reader:()=>load(accountsReader)};
}
