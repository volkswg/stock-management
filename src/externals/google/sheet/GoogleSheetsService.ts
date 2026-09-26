import { GoogleServiceAccountAuth } from "../auth/GoogleServiceAccountAuth";
import { GoogleSheetsClient } from "./client";
import { GOOGLE_SHEETS_SCOPE } from "./const";
import {
  EmployeesSheet,
  EmployeeTimesheetsSheet,
  OrderBillsSheet,
  OrderItemsSheet,
  OrdersSheet,
  SalesReceiptItemsSheet,
  SalesProfitCostOverridesSheet,
  SalesReceiptPaymentsSheet,
  SalesProfitExpensesSheet,
  SalesReceiptsSheet,
  SalesReceiptSyncsSheet,
  ShipmentOrdersSheet,
  ShipmentsSheet,
  UserStateSheet,
} from "./sheets";
import { MovementSheet } from "./sheets/movements/MovementSheet";
import type { GoogleSheetsConfig, IGoogleSheetsService } from "./types";

export class GoogleSheetsService implements IGoogleSheetsService {
  readonly employees: EmployeesSheet;
  readonly employeeTimesheets: EmployeeTimesheetsSheet;
  readonly orders: OrdersSheet;
  readonly orderBills: OrderBillsSheet;
  readonly orderItems: OrderItemsSheet;
  readonly salesReceiptItems: SalesReceiptItemsSheet;
  readonly salesProfitCostOverrides: SalesProfitCostOverridesSheet;
  readonly salesReceiptPayments: SalesReceiptPaymentsSheet;
  readonly salesProfitExpenses: SalesProfitExpensesSheet;
  readonly salesReceipts: SalesReceiptsSheet;
  readonly salesReceiptSyncs: SalesReceiptSyncsSheet;
  readonly shipmentOrders: ShipmentOrdersSheet;
  readonly shipments: ShipmentsSheet;
  readonly movementMasters: MovementSheet;
  readonly movementDetails: MovementSheet;
  readonly userState: UserStateSheet;

  private readonly client: GoogleSheetsClient;

  constructor(config: GoogleSheetsConfig) {
    if (!config.spreadsheetId.trim()) {
      throw new Error("Google Sheets spreadsheet id is required.");
    }

    const auth = new GoogleServiceAccountAuth({
      serviceAccountEmail: config.serviceAccountEmail,
      serviceAccountPrivateKey: config.serviceAccountPrivateKey,
      scopes: [GOOGLE_SHEETS_SCOPE],
    });
    this.client = new GoogleSheetsClient(auth, config.spreadsheetId);
    this.employees = new EmployeesSheet(
      this.client,
      config.employeesWorksheetName,
    );
    this.employeeTimesheets = new EmployeeTimesheetsSheet(
      this.client,
      config.employeeTimesheetsWorksheetName,
    );
    this.orders = new OrdersSheet(this.client, config.ordersWorksheetName);
    this.orderBills = new OrderBillsSheet(
      this.client,
      config.orderBillsWorksheetName,
    );
    this.orderItems = new OrderItemsSheet(
      this.client,
      config.orderItemsWorksheetName,
    );
    this.salesReceipts = new SalesReceiptsSheet(
      this.client,
      config.salesReceiptsWorksheetName,
    );
    this.salesReceiptItems = new SalesReceiptItemsSheet(
      this.client,
      config.salesReceiptItemsWorksheetName,
    );
    this.salesProfitCostOverrides = new SalesProfitCostOverridesSheet(
      this.client,
      config.salesProfitCostOverridesWorksheetName,
    );
    this.salesReceiptPayments = new SalesReceiptPaymentsSheet(
      this.client,
      config.salesReceiptPaymentsWorksheetName,
    );
    this.salesProfitExpenses = new SalesProfitExpensesSheet(
      this.client,
      config.salesProfitExpensesWorksheetName,
    );
    this.salesReceiptSyncs = new SalesReceiptSyncsSheet(
      this.client,
      config.salesReceiptSyncsWorksheetName,
    );
    this.shipmentOrders = new ShipmentOrdersSheet(
      this.client,
      config.shipmentOrdersWorksheetName,
    );
    this.shipments = new ShipmentsSheet(
      this.client,
      config.shipmentsWorksheetName,
    );
    this.movementMasters = new MovementSheet(this.client, config.movementMasterWorksheetName);
    this.movementDetails = new MovementSheet(this.client, config.movementDetailWorksheetName);
    this.userState = new UserStateSheet(
      this.client,
      config.userStateWorksheetName,
    );
  }

  async checkConnection(): Promise<void> {
    await Promise.all([
      this.employees.checkConnection(),
      this.employeeTimesheets.checkConnection(),
      this.orders.checkConnection(),
      this.orderBills.checkConnection(),
      this.orderItems.checkConnection(),
      this.salesReceiptItems.checkConnection(),
      this.salesProfitCostOverrides.checkConnection(),
      this.salesReceiptPayments.checkConnection(),
      this.salesProfitExpenses.checkConnection(),
      this.salesReceipts.checkConnection(),
      this.salesReceiptSyncs.checkConnection(),
      this.shipmentOrders.checkConnection(),
      this.shipments.checkConnection(),
      this.userState.checkConnection(),
    ]);
  }
}
