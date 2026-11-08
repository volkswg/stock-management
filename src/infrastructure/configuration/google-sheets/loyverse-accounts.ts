import "server-only";
import type { LoyverseAccountConfig } from "@/config";
import type { GoogleSheetsClient } from "@/infrastructure/persistence/google-sheets/client/GoogleSheetsClient";

const headers = ["id", "shopName", "storeId", "accessToken", "active", "sortOrder"];

// Deliberately read-only and separate from the operational worksheet registry.
// Never repair headers, write rows, log cells or propagate provider error bodies.
export class GoogleSheetsLoyverseAccounts {
  constructor(private readonly reader: Pick<GoogleSheetsClient, "getValues">) {}

  async readAccounts(): Promise<LoyverseAccountConfig[]> {
    let rows;
    try {
      rows = await this.reader.getValues("loyverse_accounts", "A:F");
    } catch {
      throw new Error("Unable to read private Loyverse account storage. Check spreadsheet access and worksheet configuration.");
    }
    if (!Array.isArray(rows) || !Array.isArray(rows[0]) || rows[0].length !== headers.length
      || headers.some((header, index) => text(rows[0][index]) !== header)) {
      throw new Error("Private Loyverse account storage has invalid headers.");
    }
    const ids = new Set<string>(), orders = new Set<number>();
    const accounts: Array<{ account: LoyverseAccountConfig; active: boolean; sortOrder: number }> = [];
    for (const row of rows.slice(1)) {
      if (!Array.isArray(row)) throw invalidRecord();
      if (row.every(value => value === null || value === undefined || value === "" || typeof value === "string" && !value.trim())) continue;
      const [rawId, rawName, rawStore, rawToken, rawActive, rawOrder] = row;
      const id = text(rawId), shopName = text(rawName), accessToken = text(rawToken);
      const storeId = text(rawStore) || undefined;
      const active = typeof rawActive === "boolean" ? rawActive : text(rawActive).toLowerCase() === "true"
        ? true : text(rawActive).toLowerCase() === "false" ? false : undefined;
      const sortOrder = typeof rawOrder === "number" ? rawOrder : /^\d+$/.test(text(rawOrder)) ? Number(text(rawOrder)) : NaN;
      if (!id || !shopName || active === undefined || active && !accessToken
        || !Number.isSafeInteger(sortOrder) || sortOrder < 0 || row.length > headers.length
        || rawStore != null && rawStore !== "" && typeof rawStore !== "string"
        || rawToken != null && rawToken !== "" && typeof rawToken !== "string") throw invalidRecord();
      if (ids.has(id)) throw new Error("Private Loyverse account IDs must be unique.");
      if (orders.has(sortOrder)) throw new Error("Private Loyverse account sort orders must be unique.");
      ids.add(id); orders.add(sortOrder);
      accounts.push({ account: { id, shopName, accessToken, storeId }, active, sortOrder });
    }
    if (!accounts.length) throw new Error("Private Loyverse account storage has no account records.");
    return accounts.sort((a, b) => a.sortOrder - b.sortOrder).filter(row => row.active).map(row => row.account);
  }
}

function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function invalidRecord(): Error { return new Error("Private Loyverse account storage has an invalid record."); }
