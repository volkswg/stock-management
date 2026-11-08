import { NextResponse } from "next/server";
import { readProductStaffSettings } from "@/config/product-master-access";
import { assertProductWriteOrigin, issueProductStaffSession, productStaffCookie, ProductAccessError, readProductStaffSession } from "@/infrastructure/security/product-staff-session";
import { readBoundedJson } from "@/infrastructure/http/read-json";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { const settings = readProductStaffSettings();return NextResponse.json({ staff: readProductStaffSession(request, settings, Math.floor(Date.now() / 1000)) ?? null, enabled: Boolean(settings?.staff.length) }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Product Master staff access is not configured correctly." }, { status: 503 }); }
}
export async function POST(request: Request) {
  try {
    assertProductWriteOrigin(request);
    const settings = readProductStaffSettings();if (!settings?.staff.length) throw new ProductAccessError("Product Master staff access is disabled. Contact the owner.", 503);
    const body = await readBoundedJson(request, 4096);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ProductAccessError("Staff ID and access key are required.", 400);
    const input = body as Record<string, unknown>, token = issueProductStaffSession(settings, input.staffId, input.accessKey, Math.floor(Date.now() / 1000), new URL(request.url).origin);
    return NextResponse.json({ staff: { id: input.staffId } }, { headers: { "Set-Cookie": productStaffCookie(request, token), "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof ProductAccessError ? error.message : "Staff access is unavailable." }, { status: error instanceof ProductAccessError ? error.status : 503 }); }
}
export async function DELETE(request: Request) {
  try { assertProductWriteOrigin(request);return NextResponse.json({ staff: null }, { headers: { "Set-Cookie": productStaffCookie(request, "", true), "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Same-origin HTTPS requests are required." }, { status: 403 }); }
}
