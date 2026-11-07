import {readArchive} from "./helpers/retirement-history.mjs";
import {canonicalPath} from "./helpers/retirement-history.mjs";
import { completionExtraFiles, completionNewFiles, assertCompletionHistory } from "./helpers/hr-application-history.mjs";
import { hrFiles, hrNewFiles, assertHRHistory } from "./helpers/hr-payroll-history.mjs";
import { expensesFiles, expensesNewFiles, assertExpensesHistory } from "./helpers/expenses-business-history.mjs";
import { remainingFiles, remainingDestinations, assertRemainingHistory } from "./helpers/remaining-worksheet-history.mjs";
import { userStateFiles, userStateDestinations, assertUserStateHistory } from "./helpers/user-state-worksheet-history.mjs";
import { salesQueryFiles, salesQueryNewFiles, assertSalesQueryHistory } from "./helpers/inventory-sales-query-history.mjs";
import { movementSchemaFiles, movementSchemaNewFiles, assertMovementSchemaHistory } from "./helpers/movement-schema-history.mjs";
import { inventoryWorksheetFiles, inventoryWorksheetDestinations, assertInventoryWorksheetHistory } from "./helpers/inventory-worksheet-history.mjs";
import { hrWorksheetFiles, hrWorksheetDestinations, assertHrWorksheetHistory } from "./helpers/hr-worksheet-history.mjs";
import { directoryFiles, directoryNewFiles, assertDirectoryHistory } from "./helpers/employee-directory-history.mjs";
import { salesWorksheetFiles, salesWorksheetDestinations, assertSalesWorksheetHistory } from "./helpers/sales-worksheet-history.mjs";
import { worksheetFiles, worksheetDestinations, assertWorksheetHistory } from "./helpers/worksheet-history.mjs";
import { sheetTypeFiles, assertOrdersSheetTypeHistory } from "./helpers/orders-sheet-type-history.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { googleBefore,googleGraph,declarations,hash } from "./helpers/google-infrastructure.mjs";
const old="src/externals/google/";
for(const historical of [true,false]) {
 const label=historical?"saved original":"production";
 test(`${label} OAuth token cache preserves the strict 60 second boundary, form body and failure identity`,async()=>{
  let time=1000;const requests=[];class Clock{static now(){return time;}}
  const g=googleGraph({historical,globals:{Date:Clock,fetch:async(url,init)=>{requests.push([url,init]);return Response.json({access_token:`token${requests.length}`,expires_in:120});}}});
  const {GoogleOAuthRefreshTokenAuth:Auth}=g.load(canonicalPath(old+"auth/GoogleOAuthRefreshTokenAuth.ts")),auth=new Auth({clientId:"id",clientSecret:"secret",refreshToken:"refresh"});
  assert.equal(await auth.getAccessToken(),"token1");time=60999;assert.equal(await auth.getAccessToken(),"token1");time=61000;assert.equal(await auth.getAccessToken(),"token2");assert.equal(requests.length,2);
  assert.equal(requests[0][0],"https://oauth2.googleapis.com/token");assert.equal(requests[0][1].method,"POST");assert.equal(requests[0][1].body.toString(),"client_id=id&client_secret=secret&refresh_token=refresh&grant_type=refresh_token");
  const error=new Error("offline");const bad=googleGraph({historical,globals:{fetch:async()=>{throw error;}}}).load(canonicalPath(old+"auth/GoogleOAuthRefreshTokenAuth.ts"));await assert.rejects(new bad.GoogleOAuthRefreshTokenAuth({}).getAccessToken(),e=>e===error);
 });
 test(`${label} OAuth errors retain parsed description and raw fallback without retries`,async()=>{
  for(const [body,expected] of [['{"error":"invalid_grant"}',"invalid_grant: No description"],["denied","denied"]]){
   let calls=0;const {GoogleOAuthRefreshTokenAuth:Auth}=googleGraph({historical,globals:{fetch:async()=>{calls++;return new Response(body,{status:400});}}}).load(canonicalPath(old+"auth/GoogleOAuthRefreshTokenAuth.ts"));
   await assert.rejects(new Auth({}).getAccessToken(),{message:`Google OAuth refresh failed: 400 ${expected}`});assert.equal(calls,1);
  }
 });
 test(`${label} JWT preserves RS256 signing input, JSON order and base64url bytes`,()=>{
  const events=[];const crypto={createSign(algorithm){events.push(algorithm);return {update(value){events.push(value);return this;},sign(key){events.push(key);return Buffer.from([251,255]);}};}};
  const {signJwt}=googleGraph({historical,crypto}).load(canonicalPath(old+"utils/jwt.ts"));const result=signJwt({alg:"RS256",typ:"JWT"},{iss:"synthetic",iat:1},"synthetic-key");
  const parts=result.split(".");assert.deepEqual(events,["RSA-SHA256",parts.slice(0,2).join("."),"synthetic-key"]);assert.deepEqual(JSON.parse(Buffer.from(parts[1],"base64url")),{iss:"synthetic",iat:1});assert.equal(parts[2],"-_8");
 });
 test(`${label} Drive factory is lazy, OAuth-first and preserves absent-folder/auth outcomes`,()=>{
  const g=googleGraph({historical});const {createGoogleDriveServiceFromConfig:create}=g.load(canonicalPath(old+"drive/createGoogleDriveServiceFromConfig.ts"));
  assert.equal(create({googleDrive:{folderId:""},get googleOAuth(){assert.fail("Eager auth access");}}),undefined);
  const config={googleDrive:{folderId:"folder"},googleOAuth:{clientId:"id",clientSecret:"secret",refreshToken:"refresh"},googleService:{accountEmail:"email",accountPrivateKey:"key"}};
  const service=create(config);assert.ok(service instanceof g.load(canonicalPath(old+"drive/GoogleDriveService.ts")).GoogleDriveService);
  assert.ok(service.config.auth instanceof g.load(canonicalPath(old+"auth/GoogleOAuthRefreshTokenAuth.ts")).GoogleOAuthRefreshTokenAuth);
  config.googleOAuth={};assert.ok(create(config).config.auth instanceof g.load(canonicalPath(old+"auth/GoogleServiceAccountAuth.ts")).GoogleServiceAccountAuth);config.googleService={};assert.equal(create(config),undefined);
 });
}
test("captured original providers have immutable raw hashes and declaration evidence",()=>{
 for(const entry of Object.values(googleBefore.moves)){assert.equal(hash(entry.source),entry.sha256);assert.ok(declarations(entry.source).length||entry.source.includes("export"));}
 assert.equal(hash(googleBefore.types.source),googleBefore.types.sha256);assert.equal(googleBefore.base,"9388f8a89f23e7547731ee649baf84af92c892e6");
 assert.equal(readArchive("tests/fixtures/google-infrastructure-before.json","utf8").includes("productionHashes"),true);
});

test("all legacy named forwards evaluate the same cached runtime constructors/functions and preserve export keys",()=>{
 const graph=googleGraph();
 for(const [old,entry] of Object.entries(googleBefore.moves)){
  const legacy=graph.load(canonicalPath(old)),physical=graph.load(canonicalPath(entry.to)),original=googleGraph({historical:true}).load(canonicalPath(old));
  assert.deepEqual(Object.keys(legacy),Object.keys(original));
  for(const key of Object.keys(legacy))assert.equal(legacy[key],physical[key],`${old}:${key}`);
  assert.equal(graph.load(canonicalPath(old)),legacy);
 }
});

test("every reviewed physical move restores its entire original source and no other production bytes change",async()=>{
 const {assertGoogleHistory,googleFiles,googleDestinations}=await import("./helpers/google-infrastructure.mjs");
 for(const [file,expected] of Object.entries(googleBefore.productionHashes)){
  if(completionExtraFiles.has(file))assertCompletionHistory(file,expected);else if(hrFiles.has(file))assertHRHistory(file,expected);else if(expensesFiles.has(file))assertExpensesHistory(file,expected);else if(remainingFiles.has(file))assertRemainingHistory(file,expected);else if(userStateFiles.has(file))assertUserStateHistory(file,expected);else if(salesQueryFiles.has(file))assertSalesQueryHistory(file,expected);else if(movementSchemaFiles.has(file))assertMovementSchemaHistory(file,expected);else if(inventoryWorksheetFiles.has(file))assertInventoryWorksheetHistory(file,expected);else if(hrWorksheetFiles.has(file))assertHrWorksheetHistory(file,expected);else if(directoryFiles.has(file))assertDirectoryHistory(file,expected);else if(salesWorksheetFiles.has(file))assertSalesWorksheetHistory(file,expected);else if(worksheetFiles.has(file))assertWorksheetHistory(file,expected);else if(sheetTypeFiles.has(file))assertOrdersSheetTypeHistory(file,expected);else if(googleFiles.has(file))assertGoogleHistory(file,expected);else assert.equal(hash(readArchive(file)),expected,file);
 }
 const {readdirSync}=await import("node:fs");const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]);
 assert.deepEqual(walk("src").filter(f=>!f.endsWith(".tsbuildinfo")&&!Object.hasOwn(googleBefore.productionHashes,f)).sort(),[...googleDestinations,...worksheetDestinations,...salesWorksheetDestinations,...directoryNewFiles,...hrWorksheetDestinations,...inventoryWorksheetDestinations,...movementSchemaNewFiles,...salesQueryNewFiles,...completionNewFiles,...hrNewFiles,...expensesNewFiles,...remainingDestinations,...userStateDestinations].sort());
});

for(const historical of [true,false])test(`${historical?"original":"production"} service-account validates lazily, signs exact claims and retains payload/cache failures`,async()=>{
 let time=1700000000123;const events=[],requests=[];class Clock{static now(){events.push("clock");return time;}}
 const crypto={createSign(){return {update(input){events.push(JSON.parse(Buffer.from(input.split(".")[1],"base64url")));return this;},sign(){return Buffer.from("signature");}};}};
 const g=googleGraph({historical,crypto,globals:{Date:Clock,fetch:async(url,init)=>{requests.push([url,init]);return Response.json({access_token:"service-token",expires_in:3600});}}});
 const {GoogleServiceAccountAuth:Auth}=g.load(canonicalPath(old+"auth/GoogleServiceAccountAuth.ts"));
 for(const [config,message] of [[{serviceAccountEmail:" ",serviceAccountPrivateKey:"",scopes:[]},"Google service account email is required."],[{serviceAccountEmail:"e",serviceAccountPrivateKey:" ",scopes:[]},"Google service account private key is required."],[{serviceAccountEmail:"e",serviceAccountPrivateKey:"k",scopes:[]},"At least one Google OAuth scope is required."]])assert.throws(()=>new Auth(config),{message});
 const auth=new Auth({serviceAccountEmail:"email",serviceAccountPrivateKey:"synthetic-key",scopes:["scope1","scope2"]});assert.deepEqual(events,[]);
 assert.equal(await auth.getAccessToken(),"service-token");assert.deepEqual(events,["clock",{iss:"email",scope:"scope1 scope2",aud:"https://oauth2.googleapis.com/token",exp:1700003600,iat:1700000000},"clock"]);
 assert.equal(requests[0][1].body.get("grant_type"),"urn:ietf:params:oauth:grant-type:jwt-bearer");time+=1000;assert.equal(await auth.getAccessToken(),"service-token");assert.equal(requests.length,1);
 for(const [payload,message] of [[null,"Google OAuth token response must be an object."],[[],"Google OAuth token response must be an object."],[{},"Google OAuth token response is missing access token data."]]){
  const bad=googleGraph({historical,crypto,globals:{fetch:async()=>Response.json(payload)}}).load(canonicalPath(old+"auth/GoogleServiceAccountAuth.ts"));
  await assert.rejects(new bad.GoogleServiceAccountAuth({serviceAccountEmail:"e",serviceAccountPrivateKey:"k",scopes:["s"]}).getAccessToken(),{message});
 }
});

for(const historical of [true,false])test(`${historical?"original":"production"} Sheets preserves quoted URLs, modes, batches, row deletion, ensure and no retry`,async()=>{
 const calls=[],queue=[];const g=googleGraph({historical,globals:{fetch:async(url,init)=>{calls.push({url,init});return queue.shift()??Response.json({});}}});
 const {GoogleSheetsClient:Client}=g.load(canonicalPath(old+"sheet/client/GoogleSheetsClient.ts"));const auth={getAccessToken:async()=>"synthetic"};const client=new Client(auth,"id/space");
 assert.equal((await client.getValuesBatch([])).length,0);await client.batchUpdateValues("O' Sheet",[]);assert.equal(calls.length,0);
 queue.push(Response.json({valueRanges:[{values:[[1]]},{}]}));assert.equal(JSON.stringify(await client.getValuesBatch([{worksheetName:"O' Sheet",range:"A:I"},{worksheetName:"b",range:"A:G"}])),"[[[1]],[]]");
 assert.ok(calls[0].url.endsWith("/values:batchGet?ranges=%27O%27%27+Sheet%27%21A%3AI&ranges=%27b%27%21A%3AG"));
 queue.push(Response.json({valueRanges:[]}));await assert.rejects(client.getValuesBatch([{worksheetName:"x",range:"A:M"}]),/incomplete set/);
 await client.appendValues("O' Sheet","A:M",[[0,null]]);assert.ok(calls.at(-1).url.includes("'O''%20Sheet'!A%3AM:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS"));
 await client.updateValues("x","M1",[["shippingBillUrl"]],"RAW");assert.equal(calls.at(-1).init.method,"PUT");assert.ok(calls.at(-1).url.endsWith("?valueInputOption=RAW"));
 await client.batchUpdateValues("x",[{range:"B2:M2",values:[[1]]}]);assert.deepEqual(JSON.parse(calls.at(-1).init.body),{valueInputOption:"USER_ENTERED",data:[{range:"'x'!B2:M2",majorDimension:"ROWS",values:[[1]]}]});
 const count=calls.length;await assert.rejects(client.deleteRow("x",1),/Only data rows/);assert.equal(calls.length,count);
 queue.push(Response.json({sheets:[{properties:{title:"x",sheetId:7}}]}),new Response(null,{status:204}));await client.deleteRow("x",3);assert.deepEqual(JSON.parse(calls.at(-1).init.body),{requests:[{deleteDimension:{range:{sheetId:7,dimension:"ROWS",startIndex:2,endIndex:3}}}]});
 queue.push(Response.json({sheets:[]}));await client.ensureWorksheet("new");assert.deepEqual(JSON.parse(calls.at(-1).init.body),{requests:[{addSheet:{properties:{title:"new"}}}]});
 for(const c of calls){assert.ok(c.url.startsWith("https://sheets.googleapis.com/v4/spreadsheets/id%2Fspace"));assert.equal(c.init.headers.Authorization,"Bearer synthetic");}
 queue.push(new Response("denied",{status:403}));const before=calls.length;await assert.rejects(client.getValues("x","A:M"),{message:"Google Sheets API request failed: 403 denied"});assert.equal(calls.length,before+1);
});

test("unchanged aggregate factory and feature worksheets use the same relocated client/base/auth without IO at construction",()=>{
 const g=googleGraph();const {createGoogleSheetsServiceFromConfig:create}=g.load(canonicalPath(old+"sheet/createGoogleSheetsServiceFromConfig.ts"));
 const settings=new Proxy({spreadsheetId:"synthetic"},{get:(target,key)=>target[key]??String(key)});
 const service=create({googleSheets:settings,googleService:{accountEmail:"email",accountPrivateKey:"synthetic"}});
 assert.ok(service instanceof g.load(canonicalPath(old+"sheet/GoogleSheetsService.ts")).GoogleSheetsService);
 assert.ok(service.client instanceof g.load(canonicalPath(googleBefore.moves[old+"sheet/client/GoogleSheetsClient.ts"].to)).GoogleSheetsClient);
 assert.ok(service.client.auth instanceof g.load(canonicalPath(googleBefore.moves[old+"auth/GoogleServiceAccountAuth.ts"].to)).GoogleServiceAccountAuth);
 assert.deepEqual(Array.from(service.client.auth.config.scopes),[g.load(canonicalPath(old+"sheet/const.ts")).GOOGLE_SHEETS_SCOPE]);
 assert.ok(service.shipments instanceof g.load(canonicalPath(googleBefore.moves[old+"sheet/sheets/BaseGoogleSheet.ts"].to)).BaseGoogleSheet);
});
