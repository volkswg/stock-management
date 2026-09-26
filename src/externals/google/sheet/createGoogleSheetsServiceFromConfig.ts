import type { AppConfig } from "../../../config";
import { GoogleSheetsService } from "./GoogleSheetsService";

export function createGoogleSheetsServiceFromConfig(
  config: AppConfig,
): GoogleSheetsService {
  return new GoogleSheetsService({
    spreadsheetId: config.googleSheets.spreadsheetId,
    employeesWorksheetName: config.googleSheets.employeesWorksheetName,
    employeeTimesheetsWorksheetName:
      config.googleSheets.employeeTimesheetsWorksheetName,
    ordersWorksheetName: config.googleSheets.ordersWorksheetName,
    orderBillsWorksheetName: config.googleSheets.orderBillsWorksheetName,
    orderItemsWorksheetName: config.googleSheets.orderItemsWorksheetName,
    salesReceiptItemsWorksheetName:
      config.googleSheets.salesReceiptItemsWorksheetName,
    salesProfitCostOverridesWorksheetName:
      config.googleSheets.salesProfitCostOverridesWorksheetName,
    salesReceiptPaymentsWorksheetName:
      config.googleSheets.salesReceiptPaymentsWorksheetName,
    salesProfitExpensesWorksheetName:
      config.googleSheets.salesProfitExpensesWorksheetName,
    salesReceiptsWorksheetName: config.googleSheets.salesReceiptsWorksheetName,
    salesReceiptSyncsWorksheetName:
      config.googleSheets.salesReceiptSyncsWorksheetName,
    shipmentOrdersWorksheetName:
      config.googleSheets.shipmentOrdersWorksheetName,
    shipmentsWorksheetName: config.googleSheets.shipmentsWorksheetName,
    movementMasterWorksheetName: config.googleSheets.movementMasterWorksheetName,
    movementDetailWorksheetName: config.googleSheets.movementDetailWorksheetName,
    userStateWorksheetName: config.googleSheets.userStateWorksheetName,
    serviceAccountEmail: config.googleService.accountEmail,
    serviceAccountPrivateKey: config.googleService.accountPrivateKey,
  });
}
