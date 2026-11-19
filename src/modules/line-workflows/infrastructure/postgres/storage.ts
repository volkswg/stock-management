import type { line_workflowsTables } from "./tables";
import type { RecordStore } from "@/infrastructure/persistence/postgres/native-records";
export type Storage = { readonly [K in keyof ReturnType<typeof line_workflowsTables>]: RecordStore } & { shipmentOrders: RecordStore; movementMasters: RecordStore; movementDetails: RecordStore; orders: RecordStore; orderItems: RecordStore; orderBills: RecordStore };
