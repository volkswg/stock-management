import { GoogleServiceAccountAuth } from "../auth/GoogleServiceAccountAuth";
import { GoogleSheetsClient } from "./client";
import { GOOGLE_SHEETS_SCOPE } from "./const";
import {
  OrderBillsSheet,
  OrderItemsSheet,
  OrdersSheet,
  PurchasesSheet,
  UserStateSheet,
} from "./sheets";
import type { GoogleSheetsConfig, IGoogleSheetsService } from "./types";

export class GoogleSheetsService implements IGoogleSheetsService {
  readonly orders: OrdersSheet;
  readonly orderBills: OrderBillsSheet;
  readonly orderItems: OrderItemsSheet;
  readonly purchases: PurchasesSheet;
  readonly userState: UserStateSheet;

  private readonly client: GoogleSheetsClient;

  constructor(config: GoogleSheetsConfig) {
    if (!config.spreadsheetId.trim()) {
      throw new Error("Google Sheets spreadsheet id is required.");
    }

    if (!config.ordersWorksheetName.trim()) {
      throw new Error("Google Sheets orders worksheet name is required.");
    }

    if (!config.orderBillsWorksheetName.trim()) {
      throw new Error("Google Sheets order bills worksheet name is required.");
    }

    if (!config.orderItemsWorksheetName.trim()) {
      throw new Error("Google Sheets order items worksheet name is required.");
    }

    if (!config.purchasesWorksheetName.trim()) {
      throw new Error("Google Sheets purchases worksheet name is required.");
    }

    if (!config.userStateWorksheetName.trim()) {
      throw new Error("Google Sheets user state worksheet name is required.");
    }

    const auth = new GoogleServiceAccountAuth({
      serviceAccountEmail: config.serviceAccountEmail,
      serviceAccountPrivateKey: config.serviceAccountPrivateKey,
      scopes: [GOOGLE_SHEETS_SCOPE],
    });
    this.client = new GoogleSheetsClient(auth, config.spreadsheetId);
    this.orders = new OrdersSheet(this.client, config.ordersWorksheetName);
    this.orderBills = new OrderBillsSheet(
      this.client,
      config.orderBillsWorksheetName,
    );
    this.orderItems = new OrderItemsSheet(
      this.client,
      config.orderItemsWorksheetName,
    );
    this.purchases = new PurchasesSheet(
      this.client,
      config.purchasesWorksheetName,
    );
    this.userState = new UserStateSheet(
      this.client,
      config.userStateWorksheetName,
    );
  }

  async checkConnection(): Promise<void> {
    await Promise.all([
      this.orders.checkConnection(),
      this.orderBills.checkConnection(),
      this.orderItems.checkConnection(),
      this.purchases.checkConnection(),
      this.userState.checkConnection(),
    ]);
  }
}
