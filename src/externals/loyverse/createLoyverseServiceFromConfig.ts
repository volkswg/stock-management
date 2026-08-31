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
  return config.loyverse.accounts.map((account) => ({
    id: account.id,
    shopName: account.shopName,
    storeId: account.storeId,
    service: new LoyverseService({ accessToken: account.accessToken }),
  }));
}
