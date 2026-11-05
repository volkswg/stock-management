import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { enumBefore, enumHash, enumParse, enumPrint, originalEnumGraph } from "./helpers/shipments-enum-history.mjs";
import { shipmentServices, fakeShipmentSheets, shipmentRow } from "./helpers/shipments.mjs";
import { plain } from "./helpers/load-source.mjs";

test("original enum source/AST, eight DTO declarations and captured sources retain independent historical hashes", () => {
  for (const [file, record] of Object.entries(enumBefore.sources)) assert.equal(enumHash(record.source), record.sha256, file);
  const file = "src/services/shipments/types.ts", original = enumParse(file, enumBefore.sources[file].source);
  const node = original.statements.find(ts.isEnumDeclaration);
  assert.equal(node.getText(original), enumBefore.enum.source);
  assert.equal(enumPrint(node, original), enumBefore.enum.ast); assert.equal(enumHash(enumPrint(node, original)), enumBefore.enum.sha256);
  const current = enumParse(file);
  for (const [name, saved] of Object.entries(enumBefore.dtos)) {
    const declaration = current.statements.find(n => ts.isTypeAliasDeclaration(n) && n.name.text === name);
    assert.equal(enumPrint(declaration, current), saved.ast, name); assert.equal(enumHash(saved.ast), saved.sha256);
  }
  assert.equal(Object.keys(enumBefore.dtos).length, 8);
});

test("saved original isolated imports expose one enum object with original keys, values, entries and JSON", () => {
  const { load, evaluations } = originalEnumGraph();
  const contract = load("src/modules/shipments/contracts.ts"), leaf = load("src/services/shipments/types.ts"), barrel = load("src/services/shipments/index.ts");
  assert.equal(contract.ShipmentStatus, leaf.ShipmentStatus); assert.equal(contract.ShipmentStatus, barrel.ShipmentStatus);
  assert.equal(load("src/modules/shipments/contracts.ts"), contract);
  assert.deepEqual(Object.keys(contract), enumBefore.enum.exports);
  assert.deepEqual(Object.keys(contract.ShipmentStatus), enumBefore.enum.keys);
  assert.deepEqual(Object.values(contract.ShipmentStatus), enumBefore.enum.values);
  assert.deepEqual(Object.entries(contract.ShipmentStatus), enumBefore.enum.keys.map((key,i) => [key, enumBefore.enum.values[i]]));
  assert.equal(evaluations.filter(f => f.endsWith("/types.ts")).length, 1);
  assert.equal(JSON.stringify({status: contract.ShipmentStatus.Draft}), JSON.stringify(enumBefore.examples.draft));
});

test("actual original/public/legacy enum values and repeated imports match the captured runtime graph", () => {
  const { load, services } = shipmentServices();
  const publicModule = load("src/modules/shipments/contracts.ts"), legacy = load("src/services/shipments/types.ts");
  assert.equal(publicModule.ShipmentStatus, legacy.ShipmentStatus); assert.equal(services.ShipmentStatus, publicModule.ShipmentStatus);
  assert.equal(load("src/services/shipments/types.ts"), legacy);
  assert.deepEqual(Object.keys(publicModule), enumBefore.enum.exports);
  assert.deepEqual(Object.keys(publicModule.ShipmentStatus), enumBefore.enum.keys);
  assert.deepEqual(Object.values(publicModule.ShipmentStatus), enumBefore.enum.values);
});

test("original creation and list filtering use the characterized enum values without changing wire JSON", async () => {
  const { services } = shipmentServices();
  const fake = fakeShipmentSheets();
  const created = await services.createShipment({ googleSheetsService: fake.sheets, poNumber: " PO ", createdBy: " actor " });
  assert.equal(created.status, services.ShipmentStatus.Draft); assert.equal(created.shippingFee, null);
  assert.deepEqual(fake.events.map(e=>e.slice(0,3)), [["append","shipments","A:M"]]);
  const data = fakeShipmentSheets({ shipments: enumBefore.enum.values.map((status,i)=>shipmentRow({id:`s${i}`,status})) });
  const list = await services.listShipments({googleSheetsService:data.sheets,includeOrders:false,excludeStatuses:[services.ShipmentStatus.Shipping,services.ShipmentStatus.Delivered,services.ShipmentStatus.Canceled]});
  assert.deepEqual(plain(list.map(s=>s.status)), ["ready_to_ship","draft"]);
  assert.deepEqual(data.events, [["read","shipments"]]);
});

test("original status lifecycle, invalid status and repeated transitions preserve Sheets setup and outcomes", async () => {
  const { services } = shipmentServices();
  for (const current of enumBefore.enum.values.concat("unknown")) for (const next of enumBefore.enum.values) {
    const fake = fakeShipmentSheets({shipments:[shipmentRow({status:current})]});
    const result = await services.updateShipmentStatus({googleSheetsService:fake.sheets,shipmentId:"s/1",status:next,poNumber:" PO ",deliveryFee:0});
    const valid = [["draft","ready_to_ship"],["ready_to_ship","shipping"],["shipping","delivered"]].some(([a,b])=>a===current&&b===next);
    assert.equal(result.outcome, valid?"updated":"invalid_transition",`${current}->${next}`);
    assert.deepEqual(fake.events.slice(0,2), [["update","shipments","M1",[["shippingBillUrl"]]],["read","shipments","A2:M"]]);
    if(valid) { assert.equal(result.shipment.status,next); assert.equal(fake.events[2][2],"B2:M2"); }
    else assert.equal(fake.events.length,2);
  }
});
