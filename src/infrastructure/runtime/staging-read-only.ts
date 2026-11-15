import "server-only";
import { getConfig } from "@/config";
// Installed only in the read-only Supabase process. No provider URL,
// request body or credential is included in the error or normal logs.
export function installReadOnlyProviderGuard() {
  const readOnly = process.env.VERCEL_ENV === "production" ? process.env.STOCK_PRODUCTION_READ_ONLY !== "false" : process.env.STOCK_STAGING_READ_ONLY === "true";
  if (process.env.STOCK_STORAGE !== "supabase" || !readOnly) return;
  const fetch = globalThis.fetch;
  const config = process.env.VERCEL_ENV === "production" ? getConfig() : undefined;
  const accountConfiguration = config?.loyverse.accountSource === "sheet" ? {
    spreadsheetId: config.googleSheets.spreadsheetId.trim(),
    principal: config.googleService.accountEmail,
  } : undefined;
  globalThis.fetch = async (input, init) => {
    if (accountConfiguration && isReadOnlyAccountRequest(input, init, accountConfiguration)) {
      return fetch(input, { ...init, redirect: "error" });
    }
    throw new Error("External requests are disabled in read-only staging.");
  };
}


// A production read-only app still needs its existing private account metadata.
// This permits only the current reader's fixed range and readonly OAuth scope;
// it does not permit business-sheet reads, provider operations or redirects.
function isReadOnlyAccountRequest(input: RequestInfo | URL, init: RequestInit | undefined, identity: { spreadsheetId: string; principal: string }): boolean {
  if (typeof input !== "string") return false;
  const { spreadsheetId, principal } = identity;
  if (!/^[\w-]+$/.test(spreadsheetId) || !principal.trim()) return false;
  const method = (init?.method || "GET").toUpperCase();
  const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent("'loyverse_accounts'!A:F")}`;
  if (input === valuesUrl) return method === "GET" && init?.body == null;
  if (input !== "https://oauth2.googleapis.com/token" || method !== "POST"
    || !(init?.body instanceof URLSearchParams)) return false;
  const form = init.body;
  if ([...form].length !== 2 || form.get("grant_type") !== "urn:ietf:params:oauth:grant-type:jwt-bearer") return false;
  try {
    const parts = form.get("assertion")?.split(".");
    if (!parts || parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return false;
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    // Google verifies the signature. Here the guard prevents broader scopes,
    // impersonation or another principal/audience from crossing this exception.
    return header?.alg === "RS256" && claims?.iss === principal
      && claims?.aud === input && claims?.sub === undefined
      && claims?.scope === "https://www.googleapis.com/auth/spreadsheets.readonly";
  } catch {
    return false;
  }
}
