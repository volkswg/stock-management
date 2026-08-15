export type AppConfig = {
  line: {
    channelSecret: string;
    channelAccessToken: string;
    legacyWebhookUrl: string;
  };
  publicBaseUrl: string;
  googleSheets: {
    spreadsheetId: string;
    ordersWorksheetName: string;
    orderBillsWorksheetName: string;
    purchasesWorksheetName: string;
    userStateWorksheetName: string;
  };
  googleDrive: {
    folderId: string;
    makeFilesReadableByLink: boolean;
  };
  googleOAuth: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  };
  googleService: {
    accountEmail: string;
    accountPrivateKey: string;
  };
};

export function getConfig(): AppConfig {
  return {
    line: {
      channelSecret: process.env.LINE_CHANNEL_SECRET || "",
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
      legacyWebhookUrl: process.env.LINE_LEGACY_WEBHOOK_URL || "",
    },
    publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
    googleSheets: {
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "",
      ordersWorksheetName:
        process.env.GOOGLE_SHEETS_ORDERS_WORKSHEET_NAME || "orders",
      orderBillsWorksheetName:
        process.env.GOOGLE_SHEETS_ORDER_BILLS_WORKSHEET_NAME || "order_bills",
      purchasesWorksheetName:
        process.env.GOOGLE_SHEETS_PURCHASES_WORKSHEET_NAME || "purchases",
      userStateWorksheetName:
        process.env.GOOGLE_SHEETS_USER_STATE_WORKSHEET_NAME || "user_state",
    },
    googleDrive: {
      folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || "",
      makeFilesReadableByLink:
        process.env.GOOGLE_DRIVE_MAKE_FILES_READABLE_BY_LINK === "true",
    },
    googleOAuth: {
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
      refreshToken: process.env.GOOGLE_OAUTH_REFRESH_TOKEN || "",
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
