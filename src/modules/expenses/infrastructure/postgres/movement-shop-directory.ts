import "server-only";
import { currentTransaction } from "@/infrastructure/persistence/postgres/database";
// Include inactive/deleted masters for historical stock attribution. Only active,
// non-deleted records are eligible for a new LINE destination selection.
export async function readMovementShopDirectory(): Promise<Array<{ id: string; name: string; active: boolean; loyverseAccountId: string; deleted: boolean }>> {
  return (await currentTransaction().query<{ id: string; name: string; active: boolean; loyverseAccountId: string; deleted: boolean }>(
    `SELECT id,coalesce(name,'') AS name,coalesce(active,false) AS active,coalesce("loyverseAccountId",'') AS "loyverseAccountId", "deletedAt" IS NOT NULL AS deleted FROM stock_operational.shops ORDER BY "createdAt" ASC NULLS LAST,id COLLATE "C"`,
  )).rows;
}
