import "server-only";
import type { AppConfig, LoyverseAccountConfig } from "@/config";
import type { LoyverseAccountMetadata } from "@/shared/types/loyverse-account";
import { GoogleServiceAccountAuth } from "@/infrastructure/persistence/google-sheets/google-auth/GoogleServiceAccountAuth";
import { GoogleSheetsClient } from "@/infrastructure/persistence/google-sheets/client/GoogleSheetsClient";
import { GoogleSheetsLoyverseAccounts } from "@/infrastructure/configuration/google-sheets/loyverse-accounts";
import { LoyverseService, type ILoyverseService } from "@/infrastructure/external/loyverse";

// The metadata seam used by Sales, Expenses, Inventory and attendance HTTP composition.
// No caller of this function receives credentials or provider clients.
export async function listLoyverseAccounts(config: AppConfig): Promise<LoyverseAccountMetadata[]> {
  return (await readAccounts(config)).map(({ id, shopName }) => ({ id, shopName }));
}

// Only Loyverse read/sync composition needs client capabilities, never raw tokens.
export async function createLoyverseAccounts(config: AppConfig): Promise<Array<LoyverseAccountMetadata & {
  storeId?: string; service: ILoyverseService;
}>> {
  const accounts = await readAccounts(config);
  const secrets = accounts.map(account => account.accessToken);
  return accounts.map(({ id, shopName, storeId, accessToken }) => {
    let client: ILoyverseService;
    try { client = new LoyverseService({ accessToken }); }
    catch (error) { throw safeError(error, secrets); }
    async function request<T>(operation: () => Promise<T>): Promise<T> {
      try { return await operation(); }
      catch (error) {
        throw safeError(error, secrets);
      }
    }
    const service: ILoyverseService = {
      checkConnection: () => request(() => client.checkConnection()),
      getReceipt: receiptNumber => request(() => client.getReceipt(receiptNumber)),
      getReceipts: query => request(() => client.getReceipts(query)),
      getSalesByItem: query => request(() => client.getSalesByItem(query)),
    };
    return { id, shopName, storeId, service };
  });
}

function safeError(error: unknown, secrets: string[]): Error {
  // Discard the original cause/properties/stack: provider bodies may echo tokens.
  let message: string;
  try { message = error instanceof Error ? error.message : String(error); }
  catch { message = "Loyverse request failed."; }
  for (const secret of secrets.toSorted((a, b) => b.length - a.length)) {
    if (secret) {
      for (const value of [secret, encodeURIComponent(secret), JSON.stringify(secret).slice(1, -1)]) {
        message = message.replaceAll(value, "[REDACTED]");
      }
    }
  }
  return new Error(message);
}

async function readAccounts(config: AppConfig): Promise<LoyverseAccountConfig[]> {
  if (!config.loyverse.accountSource || config.loyverse.accountSource === "env") return config.loyverse.accounts;
  if (config.loyverse.accountSource !== "sheet") throw new Error("LOYVERSE_ACCOUNT_SOURCE must be env or sheet.");
  const spreadsheetId = config.googleSheets.spreadsheetId.trim();
  if (!spreadsheetId || !/^[\w-]+$/.test(spreadsheetId)) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID must identify the Loyverse account spreadsheet.");
  }
  let reader;
  try {
    const auth = new GoogleServiceAccountAuth({
      serviceAccountEmail: config.googleService.accountEmail,
      serviceAccountPrivateKey: config.googleService.accountPrivateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    reader = new GoogleSheetsLoyverseAccounts(new GoogleSheetsClient(auth, spreadsheetId));
  } catch {
    throw new Error("Private Loyverse account storage authentication is not configured.");
  }
  return reader.readAccounts();
}
