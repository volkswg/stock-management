import type { AppConfig } from "../../../config";
import { GoogleSheetsService } from "./GoogleSheetsService";

export function createGoogleSheetsServiceFromConfig(
  config: AppConfig,
): GoogleSheetsService {
  return new GoogleSheetsService({
    spreadsheetId: config.googleSheets.spreadsheetId,
    ordersWorksheetName: config.googleSheets.ordersWorksheetName,
    orderBillsWorksheetName: config.googleSheets.orderBillsWorksheetName,
    orderItemsWorksheetName: config.googleSheets.orderItemsWorksheetName,
    purchasesWorksheetName: config.googleSheets.purchasesWorksheetName,
    shipmentOrdersWorksheetName:
      config.googleSheets.shipmentOrdersWorksheetName,
    shipmentsWorksheetName: config.googleSheets.shipmentsWorksheetName,
    userStateWorksheetName: config.googleSheets.userStateWorksheetName,
    serviceAccountEmail: config.googleService.accountEmail,
    serviceAccountPrivateKey: config.googleService.accountPrivateKey,
  });
}
