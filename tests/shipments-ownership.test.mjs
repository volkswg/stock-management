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

test("type ownership exposes the exact inherited Orders app-client -> Shipment contract exception", () => {
  const traces = browserOwnership({ types: true });
  assert.deepEqual(ownershipEdges(traces), ["orders->shipments", "shipments->orders"]);
  assert.deepEqual(reverse(traces), [{ from: "orders", to: "shipments", erased: true, path: ["src/modules/orders/ui/[id]/OrderDetailPage.tsx", "src/app/shipments/api.ts", "src/modules/shipments/contracts.ts"] }]);
  // This baseline type-only ownership cycle is explicit debt, not a claim of
  // decoupling. No extra reverse path or new runtime cycle is permitted.
});

test("a proposed app forwarding shim with a relocated client is rejected at module ownership level", () => {
  const virtual = {
    "src/app/shipments/api.ts": 'export { getShipments, createShipmentMaster, linkOrderToShipment } from "@/modules/shipments/ui/api";',
    "src/modules/shipments/ui/api.ts": readFileSync("src/app/shipments/api.ts", "utf8"),
  };
  const traces = browserOwnership({ virtual });
  assert.deepEqual(ownershipEdges(traces), ["orders->shipments", "shipments->orders"]);
  assert.ok(reverse(traces).some(t => !t.erased && t.path.join(" -> ") === "src/modules/orders/ui/[id]/OrderDetailPage.tsx -> src/app/shipments/api.ts -> src/modules/shipments/ui/api.ts"));
});
