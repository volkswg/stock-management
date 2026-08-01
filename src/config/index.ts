export type AppConfig = {
  googleSheets: {
    spreadsheetId: string;
    ordersWorksheetName: string;
    orderDetailsWorksheetName: string;
    purchasesWorksheetName: string;
  };
  googleService: {
    accountEmail: string;
    accountPrivateKey: string;
  };
};

export function getConfig(): AppConfig {
  return {
    googleSheets: {
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "",
      ordersWorksheetName:
        process.env.GOOGLE_SHEETS_ORDERS_WORKSHEET_NAME || "orders",
      orderDetailsWorksheetName:
        process.env.GOOGLE_SHEETS_ORDER_DETAILS_WORKSHEET_NAME ||
        "order_details",
      purchasesWorksheetName:
        process.env.GOOGLE_SHEETS_PURCHASES_WORKSHEET_NAME || "purchases",
    },
    googleService: {
      accountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
      accountPrivateKey: normalizePrivateKey(
        process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "",
      ),
    },
  };
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n");
}
