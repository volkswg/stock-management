import { withPersistence } from "@/composition/postgres/route";
import { listLoyverseAccounts } from "@/composition/loyverse-accounts";
import { NextResponse } from "next/server";
import { getConfig } from "@/config";

export const runtime = "nodejs";

async function GETOperation(): Promise<NextResponse> {
  try {
    const accounts = (await listLoyverseAccounts(getConfig())).map(({ id, shopName }) => ({
      id,
      shopName,
    }));

    return NextResponse.json({ ok: true, accounts });
  } catch (error) {
    console.error("Failed to load Loyverse accounts", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { ok: false, error: "Failed to load Loyverse accounts." },
      { status: 500 },
    );
  }
}

export const GET = withPersistence(GETOperation);
