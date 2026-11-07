export type SalesValue = string | number | boolean | null;
export type SalesRecord = Record<string, SalesValue>;
export interface SalesReader {
  receipts(): Promise<SalesRecord[]>;
  items(): Promise<SalesRecord[]>;
  payments(): Promise<SalesRecord[]>;
  syncs(): Promise<SalesRecord[]>;
}
