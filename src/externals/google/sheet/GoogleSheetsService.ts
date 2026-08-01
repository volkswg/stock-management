import { GoogleServiceAccountAuth } from "../auth/GoogleServiceAccountAuth";
import { GoogleSheetsClient } from "./client";
import { GOOGLE_SHEETS_SCOPE } from "./const";
import { OrderDetailsSheet, OrdersSheet, PurchasesSheet } from "./sheets";
import type { GoogleSheetsConfig, IGoogleSheetsService } from "./types";

export class GoogleSheetsService implements IGoogleSheetsService {
  readonly orders: OrdersSheet;
  readonly orderDetails: OrderDetailsSheet;
  readonly purchases: PurchasesSheet;

  private readonly client: GoogleSheetsClient;

  constructor(config: GoogleSheetsConfig) {
    if (!config.spreadsheetId.trim()) {
      throw new Error("Google Sheets spreadsheet id is required.");
    }

    if (!config.ordersWorksheetName.trim()) {
      throw new Error("Google Sheets orders worksheet name is required.");
    }

    if (!config.orderDetailsWorksheetName.trim()) {
      throw new Error(
        "Google Sheets order details worksheet name is required.",
      );
    }

    if (!config.purchasesWorksheetName.trim()) {
      throw new Error("Google Sheets purchases worksheet name is required.");
    }

    const auth = new GoogleServiceAccountAuth({
      serviceAccountEmail: config.serviceAccountEmail,
      serviceAccountPrivateKey: config.serviceAccountPrivateKey,
      scopes: [GOOGLE_SHEETS_SCOPE],
    });
    this.client = new GoogleSheetsClient(auth, config.spreadsheetId);
    this.orders = new OrdersSheet(this.client, config.ordersWorksheetName);
    this.orderDetails = new OrderDetailsSheet(
      this.client,
      config.orderDetailsWorksheetName,
    );
    this.purchases = new PurchasesSheet(
      this.client,
      config.purchasesWorksheetName,
    );
  }

  async checkConnection(): Promise<void> {
    await Promise.all([
      this.orders.checkConnection(),
      this.orderDetails.checkConnection(),
      this.purchases.checkConnection(),
    ]);
  }
}
