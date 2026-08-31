import { NextResponse } from "next/server";
import { getConfig } from "@/config";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const accounts = getConfig().loyverse.accounts.map(({ id, shopName }) => ({
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
