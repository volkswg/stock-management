import { isRecord } from "@/shared/lib/is-record";

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
  };
  publicBaseUrl: string;
  movementPublicBaseUrl: string;
  movementCreateMode: "quantity_photo" | "photo_only";
  loyverse: {
    accounts: LoyverseAccountConfig[];
    accountSource?: "env" | "postgres";
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
  const accountSource = parseLoyverseAccountSource(process.env.LOYVERSE_ACCOUNT_SOURCE);
  return {
    line: {
      channelSecret: process.env.LINE_CHANNEL_SECRET || "",
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
    },
    publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
    movementPublicBaseUrl: process.env.MOVEMENT_PUBLIC_BASE_URL?.trim() || "",
    movementCreateMode: parseMovementCreateMode(process.env.MOVEMENT_CREATE_MODE),
    loyverse: {
      accountSource,
      accounts: accountSource === "env"
        ? parseLoyverseAccounts(process.env.LOYVERSE_ACCOUNTS_JSON) : [],
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

function parseLoyverseAccountSource(value: string | undefined): "env" | "postgres" {
  const source = value?.trim() || "env";
  if (source !== "env" && source !== "postgres") {
    throw new Error("LOYVERSE_ACCOUNT_SOURCE must be env or postgres.");
  }
  return source;
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

function parseMovementCreateMode(value: string | undefined): AppConfig["movementCreateMode"] {
  const mode = value?.trim() || "quantity_photo";
  if (mode !== "quantity_photo" && mode !== "photo_only") {
    throw new Error("MOVEMENT_CREATE_MODE must be quantity_photo or photo_only.");
  }
  return mode;
}
