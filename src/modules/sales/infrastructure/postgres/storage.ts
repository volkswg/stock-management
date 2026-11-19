import type { salesTables } from "./tables";
import type { RecordStore } from "@/infrastructure/persistence/postgres/native-records";
export type Storage = { readonly [K in keyof ReturnType<typeof salesTables>]: RecordStore };
