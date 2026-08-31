import { isRecord } from "@/features/backend/shared/utils";

export type LoyverseAccountConfig = {
  id: string;
  shopName: string;
  accessToken: string;
  storeId?: string;
};

export type AppConfig = {
  line: {
    channelSecret: string;
    channelAccessToken: string;
    legacyWebhookUrl: string;
  };
  publicBaseUrl: string;
  loyverse: {
    accounts: LoyverseAccountConfig[];
  };
  googleSheets: {
    spreadsheetId: string;
    ordersWorksheetName: string;
    orderBillsWorksheetName: string;
    orderItemsWorksheetName: string;
    purchasesWorksheetName: string;
    salesReceiptItemsWorksheetName: string;
    salesReceiptPaymentsWorksheetName: string;
    salesReceiptsWorksheetName: string;
    salesReceiptSyncsWorksheetName: string;
    shipmentOrdersWorksheetName: string;
    shipmentsWorksheetName: string;
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
    loyverse: {
      accounts: parseLoyverseAccounts(process.env.LOYVERSE_ACCOUNTS_JSON),
    },
    googleSheets: {
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "",
      ordersWorksheetName:
        process.env.GOOGLE_SHEETS_ORDERS_WORKSHEET_NAME || "orders",
      orderBillsWorksheetName:
        process.env.GOOGLE_SHEETS_ORDER_BILLS_WORKSHEET_NAME || "order_bills",
      orderItemsWorksheetName:
        process.env.GOOGLE_SHEETS_ORDER_ITEMS_WORKSHEET_NAME || "order_items",
      purchasesWorksheetName:
        process.env.GOOGLE_SHEETS_PURCHASES_WORKSHEET_NAME || "purchases",
      salesReceiptItemsWorksheetName:
        process.env.GOOGLE_SHEETS_SALES_RECEIPT_ITEMS_WORKSHEET_NAME ||
        "sales_receipt_items",
      salesReceiptPaymentsWorksheetName:
        process.env.GOOGLE_SHEETS_SALES_RECEIPT_PAYMENTS_WORKSHEET_NAME ||
        "sales_receipt_payments",
      salesReceiptsWorksheetName:
        process.env.GOOGLE_SHEETS_SALES_RECEIPTS_WORKSHEET_NAME ||
        "sales_receipts",
      salesReceiptSyncsWorksheetName:
        process.env.GOOGLE_SHEETS_SALES_RECEIPT_SYNCS_WORKSHEET_NAME ||
        "sales_receipt_syncs",
      shipmentOrdersWorksheetName:
        process.env.GOOGLE_SHEETS_SHIPMENT_ORDERS_WORKSHEET_NAME ||
        "shipment_orders",
      shipmentsWorksheetName:
        process.env.GOOGLE_SHEETS_SHIPMENTS_WORKSHEET_NAME || "shipments",
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

function parseLoyverseAccounts(
  value: string | undefined,
): LoyverseAccountConfig[] {
  if (!value?.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("LOYVERSE_ACCOUNTS_JSON must be valid JSON.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("LOYVERSE_ACCOUNTS_JSON must be a JSON array.");
  }

  const accounts = parsed.map((entry, index) => {
    const account = isRecord(entry) ? entry : {};
    const id = toTrimmedString(account.id);
    const shopName = toTrimmedString(account.shopName);
    const accessToken = toTrimmedString(account.accessToken);
    const storeId = toTrimmedString(account.storeId) || undefined;
    if (!id || !shopName || !accessToken) {
      throw new Error(
        `LOYVERSE_ACCOUNTS_JSON entry ${index + 1} requires id, shopName, and accessToken.`,
      );
    }
    return { id, shopName, accessToken, storeId };
  });

  if (new Set(accounts.map((account) => account.id)).size !== accounts.length) {
    throw new Error("LOYVERSE_ACCOUNTS_JSON account ids must be unique.");
  }
  return accounts;
}

function toTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
