export type AppConfig = {
  googleSheets: {
    spreadsheetId: string;
    stockWorksheetName: string;
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
      stockWorksheetName: process.env.GOOGLE_SHEETS_STOCK_WORKSHEET_NAME || "",
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
