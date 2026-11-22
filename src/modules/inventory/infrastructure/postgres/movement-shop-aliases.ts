import "server-only";
import { currentTransaction } from "@/infrastructure/persistence/postgres/database";
export async function readMovementShopAliases(): Promise<Array<{ shopId: string; label: string }>> {
  return (await currentTransaction().query<{ shopId: string; label: string }>(
    `SELECT DISTINCT "shopId", "shopName" AS label FROM stock_operational.movement_details WHERE "shopId" IS NOT NULL AND nullif(btrim("shopName"),'') IS NOT NULL`,
  )).rows;
}
