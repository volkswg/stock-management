import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { browserOwnership, ownershipEdges } from "./helpers/browser-ownership.mjs";

const reverse = traces => traces.filter(t => t.from === "orders" && t.to === "shipments");

test("runtime module ownership remains Shipments -> Orders, including paths through app/legacy intermediaries", () => {
  const traces = browserOwnership();
  assert.deepEqual(ownershipEdges(traces), ["shipments->orders"]);
  assert.deepEqual(reverse(traces), []);
  assert.ok(traces.some(t => t.path.at(-1) === "src/modules/orders/ui/OrderImageGallery.tsx"));
});

test("type ownership removes the inherited reverse Orders trace and has no module cycle", () => {
  const traces = browserOwnership({ types: true });
  assert.deepEqual(ownershipEdges(traces), ["shipments->orders"]);
  assert.deepEqual(reverse(traces), []);
});

test("reintroducing the old Orders direct import plus a forwarding shim exposes a forbidden module cycle", () => {
  const virtual = {
    "src/modules/orders/ui/[id]/OrderDetailPage.tsx": readFileSync("src/modules/orders/ui/[id]/OrderDetailPage.tsx", "utf8") + '\nimport { getShipments } from "@/app/shipments/api";',
    "src/app/shipments/api.ts": 'export { getShipments, createShipmentMaster, linkOrderToShipment } from "@/modules/shipments/ui/api";',
    "src/modules/shipments/ui/api.ts": readFileSync("src/app/shipments/api.ts", "utf8"),
  };
  const traces = browserOwnership({ virtual });
  assert.deepEqual(ownershipEdges(traces), ["orders->shipments", "shipments->orders"]);
  assert.ok(reverse(traces).some(t => !t.erased && t.path.join(" -> ") === "src/modules/orders/ui/[id]/OrderDetailPage.tsx -> src/app/shipments/api.ts -> src/modules/shipments/ui/api.ts"));
});

test("after picker injection a hypothetical client relocation preserves one-way ownership, without shipping that move", () => {
  const virtual = {
    "src/app/shipments/api.ts": 'export { getShipments, getShipment, advanceShipmentStatus } from "@/modules/shipments/ui/api";',
    "src/modules/shipments/ui/api.ts": readFileSync("src/app/shipments/api.ts", "utf8"),
  };
  for (const types of [false, true]) {
    const traces = browserOwnership({ types, virtual });
    assert.deepEqual(ownershipEdges(traces), ["shipments->orders"]);
    assert.deepEqual(reverse(traces), []);
  }
});
