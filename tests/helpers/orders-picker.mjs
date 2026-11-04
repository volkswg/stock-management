import { loadSource } from "./load-source.mjs";
import { shipmentServices } from "./shipments.mjs";

// Execute the production client composition, not a test reimplementation of its
// filtering/HTTP adapter. Tests can supply real browser exports or fake operations.
export function pickerComposition(http, OrderDetailPage = function OrderDetailPage() {}) {
  const { load } = shipmentServices();
  const compositionModule = loadSource("src/app/orders/[id]/OrderDetailClient.tsx", {
    imports: {
      "react/jsx-runtime": { jsx: (type, props) => ({ type, props }) },
      "@/modules/orders/ui/[id]/OrderDetailPage": { OrderDetailPage },
      "@/app/shipments/api": http,
      "@/modules/shipments/contracts": load("src/modules/shipments/contracts.ts"),
    },
  });
  return { module: compositionModule, render: orderId => compositionModule.OrderDetailClient({ orderId }) };
}
export const pickerFromHttp = http => pickerComposition(http).render("synthetic").props.shipmentPicker;
export const unusedPicker = {
  listLinkableShipments: async () => { throw new Error("Unexpected picker list in this test"); },
  createShipmentMaster: async () => { throw new Error("Unexpected picker create in this test"); },
  linkOrderToShipment: async () => { throw new Error("Unexpected picker link in this test"); },
};
