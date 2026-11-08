import { StockAdjustmentsSheet } from "@/modules/inventory/infrastructure/google-sheets/stock-adjustments/StockAdjustmentsSheet";
import { PayrollRecordsSheet } from "@/modules/hr/infrastructure/google-sheets/employee-advances/PayrollRecordsSheet";
import { RecordsSheet } from "@/modules/expenses/infrastructure/google-sheets/expenses/RecordsSheet";
import { GoogleServiceAccountAuth } from "@/infrastructure/persistence/google-sheets/google-auth/GoogleServiceAccountAuth";
import { GoogleSheetsClient } from "@/infrastructure/persistence/google-sheets/client";
import { GOOGLE_SHEETS_SCOPE } from "@/infrastructure/persistence/google-sheets/const";
import { EmployeeCompensationsSheet } from "@/modules/hr/infrastructure/google-sheets/employee-compensations/EmployeeCompensationsSheet";
import { EmployeesSheet } from "@/modules/hr/infrastructure/google-sheets/employees/EmployeesSheet";
import { EmployeeTimesheetsSheet } from "@/modules/hr/infrastructure/google-sheets/employee-timesheets/EmployeeTimesheetsSheet";
import { OrderBillsSheet } from "@/modules/orders/infrastructure/google-sheets/order-bills/OrderBillsSheet";
import { OrderItemsSheet } from "@/modules/orders/infrastructure/google-sheets/order-items/OrderItemsSheet";
import { OrdersSheet } from "@/modules/orders/infrastructure/google-sheets/orders/OrdersSheet";
import { SalesReceiptItemsSheet } from "@/modules/sales/infrastructure/google-sheets/receipt-items/SalesReceiptItemsSheet";
import { SalesProfitCostOverridesSheet } from "@/modules/sales/infrastructure/google-sheets/profit-cost-overrides/SalesProfitCostOverridesSheet";
import { SalesReceiptPaymentsSheet } from "@/modules/sales/infrastructure/google-sheets/receipt-payments/SalesReceiptPaymentsSheet";
import { SalesReceiptsSheet } from "@/modules/sales/infrastructure/google-sheets/receipts/SalesReceiptsSheet";
import { SalesReceiptSyncsSheet } from "@/modules/sales/infrastructure/google-sheets/receipt-syncs/SalesReceiptSyncsSheet";
import { ShipmentOrdersSheet } from "@/modules/shipments/infrastructure/google-sheets/shipment-orders/ShipmentOrdersSheet";
import { ShipmentsSheet } from "@/modules/shipments/infrastructure/google-sheets/shipments/ShipmentsSheet";
import { StockCountsSheet } from "@/modules/inventory/infrastructure/google-sheets/stock-counts/StockCountsSheet";
import { UserStateSheet } from "@/modules/line-workflows/infrastructure/google-sheets/user-state/UserStateSheet";
import { MovementSheet } from "@/modules/inventory/infrastructure/google-sheets/movements/MovementSheet";
import type { GoogleSheetsConfig, SalesSyncWrite, GoogleSheetRow, MovementRange, MovementWorksheet, IGoogleSheetsService } from "@/infrastructure/persistence/google-sheets/service-contracts";

export class GoogleSheetsService implements IGoogleSheetsService {
  readonly employeeCompensations: EmployeeCompensationsSheet;
  readonly employees: EmployeesSheet;
  readonly employeeTimesheets: EmployeeTimesheetsSheet;
  readonly employeeAdvances: PayrollRecordsSheet;
  readonly payrollSettlements: PayrollRecordsSheet;
  readonly orders: OrdersSheet;
  readonly orderBills: OrderBillsSheet;
  readonly orderItems: OrderItemsSheet;
  readonly salesReceiptItems: SalesReceiptItemsSheet;
  readonly salesProfitCostOverrides: SalesProfitCostOverridesSheet;
  readonly salesReceiptPayments: SalesReceiptPaymentsSheet;
  readonly expenses: RecordsSheet;
  readonly expenseCategories: RecordsSheet;
  readonly shops: RecordsSheet;
  readonly salesReceipts: SalesReceiptsSheet;
  readonly salesReceiptSyncs: SalesReceiptSyncsSheet;
  readonly shipmentOrders: ShipmentOrdersSheet;
  readonly shipments: ShipmentsSheet;
  readonly stockCounts: StockCountsSheet;
  readonly stockAdjustments: StockAdjustmentsSheet;
  readonly movementMasters: MovementSheet;
  readonly movementDetails: MovementSheet;
  readonly userState: UserStateSheet;

  private readonly client: GoogleSheetsClient;
  private readonly salesWorksheetNames = {} as Record<SalesSyncWrite["sheet"], string>;
  private readonly movementWorksheetNames: Record<MovementWorksheet, string>;

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
    this.movementWorksheetNames = {
      userState: config.userStateWorksheetName,
      movementDetails: config.movementDetailWorksheetName,
      movementMasters: config.movementMasterWorksheetName,
    };
    this.employeeAdvances = new PayrollRecordsSheet(this.client, config.employeeAdvancesWorksheetName);
    this.payrollSettlements = new PayrollRecordsSheet(this.client, config.payrollSettlementsWorksheetName);
    this.stockAdjustments = new StockAdjustmentsSheet(this.client, config.stockAdjustmentsWorksheetName);
    this.expenses = new RecordsSheet(this.client, config.expensesWorksheetName);
    this.expenseCategories = new RecordsSheet(this.client, config.expenseCategoriesWorksheetName);
    this.shops = new RecordsSheet(this.client, config.shopsWorksheetName);
    this.employeeCompensations = new EmployeeCompensationsSheet(
      this.client,
      config.employeeCompensationsWorksheetName,
    );
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
      this.salesWorksheetNames.salesReceipts = config.salesReceiptsWorksheetName,
    );
    this.salesReceiptItems = new SalesReceiptItemsSheet(
      this.client,
      this.salesWorksheetNames.salesReceiptItems = config.salesReceiptItemsWorksheetName,
    );
    this.salesProfitCostOverrides = new SalesProfitCostOverridesSheet(
      this.client,
      config.salesProfitCostOverridesWorksheetName,
    );
    this.salesReceiptPayments = new SalesReceiptPaymentsSheet(
      this.client,
      this.salesWorksheetNames.salesReceiptPayments = config.salesReceiptPaymentsWorksheetName,
    );
    this.salesReceiptSyncs = new SalesReceiptSyncsSheet(
      this.client,
      this.salesWorksheetNames.salesReceiptSyncs = config.salesReceiptSyncsWorksheetName,
    );
    this.shipmentOrders = new ShipmentOrdersSheet(
      this.client,
      config.shipmentOrdersWorksheetName,
    );
    this.shipments = new ShipmentsSheet(
      this.client,
      config.shipmentsWorksheetName,
    );
    this.stockCounts = new StockCountsSheet(
      this.client,
      config.stockCountsWorksheetName,
    );
    this.movementMasters = new MovementSheet(this.client, config.movementMasterWorksheetName);
    this.movementDetails = new MovementSheet(this.client, config.movementDetailWorksheetName);
    this.userState = new UserStateSheet(
      this.client,
      config.userStateWorksheetName,
    );
  }

  async writeSalesSync(updates: SalesSyncWrite[], beforeWrite: () => Promise<void>): Promise<void> {
    return this.client.batchUpdateWorkbookValues(updates.map(({ sheet, range, values }) => ({
      worksheetName: this.salesWorksheetNames[sheet], range, values,
    })), beforeWrite);
  }

  async readMovementRanges(ranges: MovementRange[]): Promise<GoogleSheetRow[][]> {
    return this.client.getValuesBatch(ranges.map(({ sheet, range }) => ({
      worksheetName: this.movementWorksheetNames[sheet], range,
    })));
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
      this.expenses.checkConnection(),
      this.expenseCategories.checkConnection(),
      this.shops.checkConnection(),
      this.salesReceipts.checkConnection(),
      this.salesReceiptSyncs.checkConnection(),
      this.shipmentOrders.checkConnection(),
      this.shipments.checkConnection(),
      this.userState.checkConnection(),
    ]);
  }
}
