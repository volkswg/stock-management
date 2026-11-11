import "server-only";
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { installReadOnlyProviderGuard } = await import("./infrastructure/runtime/staging-read-only");
    installReadOnlyProviderGuard();
  }
}
