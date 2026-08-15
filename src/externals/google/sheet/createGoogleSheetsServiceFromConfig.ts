import type { AppConfig } from "../../../config";
import { GoogleSheetsService } from "./GoogleSheetsService";

export function createGoogleSheetsServiceFromConfig(
  config: AppConfig,
): GoogleSheetsService {
  return new GoogleSheetsService({
    spreadsheetId: config.googleSheets.spreadsheetId,
    ordersWorksheetName: config.googleSheets.ordersWorksheetName,
    orderBillsWorksheetName: config.googleSheets.orderBillsWorksheetName,
    purchasesWorksheetName: config.googleSheets.purchasesWorksheetName,
    userStateWorksheetName: config.googleSheets.userStateWorksheetName,
    serviceAccountEmail: config.googleService.accountEmail,
    serviceAccountPrivateKey: config.googleService.accountPrivateKey,
  });
}
