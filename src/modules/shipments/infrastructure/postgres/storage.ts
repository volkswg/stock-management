import type { shipmentsTables } from "./tables";
import type { RecordStore } from "@/infrastructure/persistence/postgres/native-records";
export type Storage = { readonly [K in keyof ReturnType<typeof shipmentsTables>]: RecordStore } & { orders: RecordStore; orderItems: RecordStore };
