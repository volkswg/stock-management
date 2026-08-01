import type { AppConfig } from "../../../config";
import { GoogleSheetsService } from "./GoogleSheetsService";

export function createGoogleSheetsServiceFromConfig(
  config: AppConfig,
): GoogleSheetsService {
  return new GoogleSheetsService({
    spreadsheetId: config.googleSheets.spreadsheetId,
    ordersWorksheetName: config.googleSheets.ordersWorksheetName,
    orderDetailsWorksheetName: config.googleSheets.orderDetailsWorksheetName,
    purchasesWorksheetName: config.googleSheets.purchasesWorksheetName,
    serviceAccountEmail: config.googleService.accountEmail,
    serviceAccountPrivateKey: config.googleService.accountPrivateKey,
  });
}
