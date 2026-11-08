import "server-only";
import { NextResponse } from "next/server";
import { ProductValidationError, ProductDuplicatesError, ProductNotFoundError, ProductCreationCancelledError } from "@/modules/products/server";
import { OrderProductLinkError } from "@/modules/orders/product-link-server";
import { GuardConflictError, GuardOutcomeUnknownError } from "@/infrastructure/persistence/google-sheets/guarded-write";
import { ProductAccessError, requireProductStaff } from "@/infrastructure/security/product-staff-session";
import { readProductStaffSettings } from "@/config/product-master-access";
export function productWriteActor(request: Request): string {
  try { return requireProductStaff(request, readProductStaffSettings(), Math.floor(Date.now() / 1000)).id; }
  catch (error) { if (error instanceof ProductAccessError) throw error;throw new ProductAccessError("Product Master staff access is not configured correctly.", 503); }
}
export function productHttpError(error: unknown) {
  const headers = { "Cache-Control": "no-store" };
  if (error instanceof ProductAccessError || error instanceof OrderProductLinkError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
  if (error instanceof ProductCreationCancelledError) return NextResponse.json({ error: error.message, code: "creation_cancelled" }, { status: 409, headers });
  if (error instanceof ProductNotFoundError) return NextResponse.json({ error: error.message }, { status: 404, headers });
  if (error instanceof ProductValidationError) return NextResponse.json({ error: error.message, code: "validation" }, { status: 400, headers });
  if (error instanceof ProductDuplicatesError) return NextResponse.json({ error: error.message, code: "duplicate_suggestions", suggestions: error.suggestions }, { status: 409, headers });
  if (error instanceof GuardConflictError) return NextResponse.json({ error: error.message, code: "conflict" }, { status: 409, headers });
  if (error instanceof GuardOutcomeUnknownError) return NextResponse.json({ error: error.message, code: "outcome_unconfirmed" }, { status: 503, headers });
  return NextResponse.json({ error: "Product Master storage is unavailable. Check worksheet setup, or retry the same operation without changing its request ID.", code: "storage_unavailable" }, { status: 503, headers });
}
export function productJson(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } }); }
