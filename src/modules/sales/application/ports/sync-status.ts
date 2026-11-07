import type { SalesSyncStatusRow } from "../../contracts";
export interface SyncStatusReader { read(): Promise<{records(): SalesSyncStatusRow[]}>; }
