import type { expensesTables } from "./tables";
import type { RecordStore } from "@/infrastructure/persistence/postgres/native-records";
export type Storage = { readonly [K in keyof ReturnType<typeof expensesTables>]: RecordStore };
