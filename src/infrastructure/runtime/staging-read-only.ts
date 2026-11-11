import "server-only";
// Installed only in the isolated read-only Supabase process. No provider URL,
// request body or credential is included in the error or normal logs.
export function installReadOnlyProviderGuard() {
  if (process.env.STOCK_STORAGE !== "supabase" || process.env.STOCK_STAGING_READ_ONLY !== "true") return;
  globalThis.fetch = async () => { throw new Error("External requests are disabled in read-only staging."); };
}
