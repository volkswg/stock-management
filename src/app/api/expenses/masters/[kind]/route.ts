import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/composition/google-sheets";
import { isRecord } from "@/shared/lib/is-record";
import { ExpenseError, listExpenseCategories, listExpenseShops, saveExpenseMaster } from "@/modules/expenses/server";
export const runtime = "nodejs";
type Context = { params: Promise<{ kind: string }> };
function fail(error: unknown) { return NextResponse.json({ ok: false, error: error instanceof ExpenseError ? error.message : "Master data operation failed. Please retry." }, { status: error instanceof ExpenseError ? error.status : 500 }); }
function validKind(kind: string): asserts kind is "shops" | "categories" { if (!["shops", "categories"].includes(kind)) throw new ExpenseError("Master not found.", 404); }
export async function GET(_request: Request, context: Context) {
  try { const { kind } = await context.params; validKind(kind); const config = getConfig(), service = createGoogleSheetsServiceFromConfig(config);
    const records = kind === "shops" ? await listExpenseShops(service) : await listExpenseCategories(service);
    return NextResponse.json({ ok: true, records, accounts: kind === "shops" ? config.loyverse.accounts.map(({ id, shopName }) => ({ id, shopName })) : [] });
  } catch (error) { return fail(error); }
}
export async function POST(request: Request, context: Context) {
  try { const { kind } = await context.params; validKind(kind); const body: unknown = await request.json().catch(() => null);
    if (!isRecord(body) || typeof body.name !== "string" || typeof body.active !== "boolean") throw new ExpenseError("Enter a name and active status.");
    const config = getConfig(); const mapping = typeof body.loyverseAccountId === "string" ? body.loyverseAccountId.trim() : "";
    // Existing mappings remain editable even if their account has since left configuration.
    const service = createGoogleSheetsServiceFromConfig(config);
    if (kind === "shops" && mapping && !config.loyverse.accounts.some(account => account.id === mapping)) {
      const existing = (await listExpenseShops(service)).find(shop => shop.id === body.id);
      if (existing?.loyverseAccountId !== mapping) throw new ExpenseError("Select a configured Loyverse account or leave the mapping empty.");
    }
    const id = await saveExpenseMaster(service, kind, { id: typeof body.id === "string" ? body.id : undefined, name: body.name, active: body.active, loyverseAccountId: mapping });
    return NextResponse.json({ ok: true, id });
  } catch (error) { return fail(error); }
}
