import type { inventoryTables } from "./tables";
import type { RecordStore } from "@/infrastructure/persistence/postgres/native-records";
export type Storage = { readonly [K in keyof ReturnType<typeof inventoryTables>]: RecordStore } & { employees: RecordStore; employeeCompensations: RecordStore; employeeTimesheets: RecordStore; salesReceipts: RecordStore; salesReceiptItems: RecordStore; salesReceiptPayments: RecordStore; salesReceiptSyncs: RecordStore };
