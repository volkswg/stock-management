import "server-only";
// Installed only in the isolated read-only Supabase process. No provider URL,
// request body or credential is included in the error or normal logs.
export function installReadOnlyProviderGuard() {
  const readOnly = process.env.VERCEL_ENV === "production" ? process.env.STOCK_PRODUCTION_READ_ONLY !== "false" : process.env.STOCK_STAGING_READ_ONLY === "true";
  if (process.env.STOCK_STORAGE !== "supabase" || !readOnly) return;
  globalThis.fetch = async () => { throw new Error("External requests are disabled in read-only staging."); };
}
