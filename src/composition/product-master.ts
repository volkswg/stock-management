import "server-only";
import { getConfig } from "@/config";
import { GoogleSheetsClient } from "@/infrastructure/persistence/google-sheets/client";
import { GoogleServiceAccountAuth } from "@/infrastructure/persistence/google-sheets/google-auth/GoogleServiceAccountAuth";
import { GOOGLE_SHEETS_SCOPE } from "@/infrastructure/persistence/google-sheets/const";
import { createProductsService } from "@/modules/products/server";
import { createOrderProductLinkService } from "@/modules/orders/product-link-server";
export function createProductMasterServices() {
  const config = getConfig();
  const auth = new GoogleServiceAccountAuth({ serviceAccountEmail: config.googleService.accountEmail, serviceAccountPrivateKey: config.googleService.accountPrivateKey, scopes: [GOOGLE_SHEETS_SCOPE] });
  const client = new GoogleSheetsClient(auth, config.googleSheets.spreadsheetId);
  const products = createProductsService(client);
  const links = createOrderProductLinkService(client, { orderItems: config.googleSheets.orderItemsWorksheetName, orders: config.googleSheets.ordersWorksheetName }, { findById: products.findById });
  return { products, links };
}
