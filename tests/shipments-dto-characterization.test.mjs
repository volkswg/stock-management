import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dtoBefore,dtoHash,currentDtoDeclarations,dtoPureGraph } from "./helpers/shipments-dto-history.mjs";
import { shipmentServices,fakeShipmentSheets } from "./helpers/shipments.mjs";
import { plain } from "./helpers/load-source.mjs";

test("original eight DTO declaration texts/ASTs/hashes match the independent older enum witness before and after ownership transfer",()=>{
  assert.equal(dtoBefore.base,"703d55f5c67dab8392fcc29a757cef4b2766a975");
  for(const record of Object.values(dtoBefore.sources))assert.equal(dtoHash(record.source),record.sha256);
  const older=JSON.parse(readFileSync("tests/fixtures/shipments-enum-before.json","utf8"));
  assert.equal(currentDtoDeclarations().length,8);
  for(const [name,saved]of Object.entries(dtoBefore.dtos)){assert.equal(dtoHash(saved.ast),saved.sha256);assert.equal(saved.ast,older.dtos[name].ast);assert.equal(saved.sha256,older.dtos[name].sha256);}
});

test("original and actual pure import graphs have one cached enum, exact runtime names and no DTO runtime values or IO",()=>{
  for(const original of [true,false]){
    const {load,evaluations}=dtoPureGraph({original});
    const physical=load("src/modules/shipments/status.ts");
    for(const [file,key]of [["src/modules/shipments/contracts.ts","public"],["src/services/shipments/types.ts","legacy"],["src/services/shipments/index.ts","barrel"]]){
      const loaded=load(file);assert.equal(loaded.ShipmentStatus,physical.ShipmentStatus);assert.equal(load(file),loaded);assert.deepEqual(Object.keys(loaded),dtoBefore.runtime[key]);
    }
    assert.deepEqual(Object.keys(physical.ShipmentStatus),dtoBefore.runtime.enumKeys);assert.deepEqual(Object.values(physical.ShipmentStatus),dtoBefore.runtime.enumValues);
    assert.equal(evaluations.filter(f=>f==="src/modules/shipments/status.ts").length,1);
    assert.ok(Object.values(dtoBefore.runtime.identities).every(Boolean));
  }
});

test("actual creation/list/detail DTO JSON, nullability, associations and worksheet events match original captured responses",async()=>{
  const {services}=shipmentServices(),read=JSON.parse(readFileSync("tests/fixtures/shipments-read.json","utf8"));
  for(const [name,run,rows]of [["list",s=>services.listShipments({googleSheetsService:s}),read.rows],["detail",s=>services.getShipmentDetail({googleSheetsService:s,shipmentId:"s/1"}),read.rows],["create",s=>services.createShipment({googleSheetsService:s,poNumber:" PO ",carrier:" Carrier ",createdBy:" actor "}),{}]]){
    const fake=fakeShipmentSheets(rows);assert.deepEqual(plain(await run(fake.sheets)),dtoBefore.examples[name].result,name);assert.deepEqual(fake.events,dtoBefore.examples[name].events,name);
  }
});
