import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { updateMovementItem } from "@/services/movements";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
): Promise<NextResponse> {
  const { id, itemId } = await params;
  const movementMasterId = id.trim();
  const movementId = itemId.trim();
  const body = await readJson(request);
  const quantity = optionalString(body?.quantity);
  const remark = optionalString(body?.remark);
  const stockCounted = optionalBoolean(body?.stockCounted);

  if (!movementMasterId || !movementId || !body) {
    return badRequest("Movement and item IDs are required.");
  }
  if (body.stockCounted !== undefined && stockCounted === undefined) {
    return badRequest("Stock counted must be true or false.");
  }
  if (quantity === undefined && remark === undefined && stockCounted === undefined) {
    return badRequest("Quantity, note, or stock counted is required.");
  }
  if (body.quantity !== undefined && !quantity) {
    return badRequest("Quantity is required.");
  }

  try {
    const records = await updateMovementItem({
      googleSheetsService: createGoogleSheetsServiceFromConfig(getConfig()),
      movementId,
      movementMasterId,
      quantity,
      remark,
      stockCounted,
    });
    if (!records) {
      return NextResponse.json(
        { error: "Movement item was not found." },
        { status: 404 },
      );
    }
    return NextResponse.json({
      record: records.find(
        (record) => record.movementId.toUpperCase() === movementId.toUpperCase(),
      ),
      records,
    });
  } catch (error) {
    console.error("Failed to update movement item", {
      error: error instanceof Error ? error.message : String(error),
      movementId,
      movementMasterId,
    });
    return NextResponse.json(
      { error: "Failed to update movement item." },
      { status: 500 },
    );
  }
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function badRequest(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}
