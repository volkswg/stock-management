import "server-only";
import type { LoyverseAccountConfig } from "@/config";
import type { LoyverseAccountMetadata } from "@/shared/types/loyverse-account";
import { currentTransaction, transaction } from "@/infrastructure/persistence/postgres/database";

type MetadataRow = { id: string; shopName: string; active: boolean; sortOrder: number };
type CredentialRow = MetadataRow & { storeId: string | null; accessToken: string | null };

// Configuration is separate from the business aggregate and its mutation journal.
// Metadata queries never select credentials, including in read-only deployments.
export class PostgresLoyverseAccounts {
  async listMetadata(): Promise<LoyverseAccountMetadata[]> {
    const rows = await this.read<MetadataRow>(false);
    return rows.filter(row => row.active).map(({ id, shopName }) => ({ id, shopName }));
  }

  async readAccounts(): Promise<LoyverseAccountConfig[]> {
    const rows = await this.read<CredentialRow>(true);
    return rows.filter(row => row.active).map(({ id, shopName, storeId, accessToken }) => ({
      id, shopName, storeId: storeId?.trim() || undefined, accessToken: accessToken!.trim(),
    }));
  }

  private async read<Row extends MetadataRow>(credentials: boolean): Promise<Row[]> {
    try {
      return await transaction(false, async () => {
        const columns = credentials
          ? 'id,"shopName","storeId","accessToken",active,"sortOrder"::float8 AS "sortOrder"'
          : 'id,"shopName",active,"sortOrder"::float8 AS "sortOrder"';
        const { rows } = await currentTransaction().query<Row>(
          `SELECT ${columns} FROM stock_configuration.loyverse_accounts ORDER BY "sortOrder"`,
        );
        if (!rows.length) throw new Error("Account configuration is empty.");
        const ids = new Set<string>(), orders = new Set<number>();
        for (const row of rows) {
          if (typeof row.id !== "string" || !row.id.trim() || row.id !== row.id.trim()
            || typeof row.shopName !== "string" || !row.shopName.trim() || row.shopName !== row.shopName.trim()
            || typeof row.active !== "boolean" || !Number.isSafeInteger(row.sortOrder) || row.sortOrder < 0
            || ids.has(row.id) || orders.has(row.sortOrder)) throw new Error("Invalid account configuration.");
          ids.add(row.id); orders.add(row.sortOrder);
          if (credentials) {
            const account = row as unknown as CredentialRow;
            if (account.storeId !== null && typeof account.storeId !== "string"
              || account.accessToken !== null && typeof account.accessToken !== "string"
              || account.active && !account.accessToken?.trim()) throw new Error("Invalid credentials.");
          }
        }
        return rows;
      });
    } catch {
      // Driver errors can contain SQL/bind values. Never forward their bodies,
      // properties or causes, and never try another configuration source.
      throw new Error("Unable to read private Loyverse account storage. Check PostgreSQL configuration and permissions.");
    }
  }
}
