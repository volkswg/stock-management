import type { AppConfig } from "@/config";
import { LoyverseService } from "./LoyverseService";

export type ConfiguredLoyverseAccount = {
  id: string;
  shopName: string;
  storeId?: string;
  service: LoyverseService;
};

export function createLoyverseAccountsFromConfig(
  config: AppConfig,
): ConfiguredLoyverseAccount[] {
  if (config.loyverse.accountSource && config.loyverse.accountSource !== "env") {
    throw new Error("PostgreSQL Loyverse accounts require the server account reader.");
  }
  return config.loyverse.accounts.map((account) => ({
    id: account.id,
    shopName: account.shopName,
    storeId: account.storeId,
    service: new LoyverseService({ accessToken: account.accessToken }),
  }));
}
