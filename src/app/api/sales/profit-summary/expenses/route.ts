import { NextResponse } from "next/server";
export const runtime = "nodejs";
// Monthly-total writes must not overwrite individual expense entries after migration.
export async function POST() { return NextResponse.json({ ok: false, error: "Manage individual expense entries on the Expenses page." }, { status: 409 }); }
export async function DELETE() { return POST(); }
