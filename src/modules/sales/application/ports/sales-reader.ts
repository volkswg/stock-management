export type SalesValue = string | number | boolean | null;
export type SalesRecord = Record<string, SalesValue>;
export type SalesReadScope = {
  fromDate?: string;
  toDate?: string;
  year?: string;
  accountIds?: readonly string[];
};
export interface SalesReader {
  receipts(): Promise<SalesRecord[]>;
  items(): Promise<SalesRecord[]>;
  payments(): Promise<SalesRecord[]>;
  syncs(): Promise<SalesRecord[]>;
}
