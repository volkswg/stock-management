import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { getMovementItems, markMovementDelivered } from "@/services/movements";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const movementMasterId = (await params).id.trim();
  if (!movementMasterId) {
    return NextResponse.json(
      { error: "Movement ID is required." },
      { status: 400 },
    );
  }
  try {
    const records = await getMovementItems({
      googleSheetsService: createGoogleSheetsServiceFromConfig(getConfig()),
      movementMasterId,
    });
    if (records.length === 0) {
      return NextResponse.json(
        { error: "Movement was not found." },
        { status: 404 },
      );
    }
    return NextResponse.json({ records });
  } catch (error) {
    return movementError("load", movementMasterId, error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const movementMasterId = (await params).id.trim();
  const body = await readJson(request);
  if (!movementMasterId || body?.status !== "delivered") {
    return NextResponse.json(
      { error: "Movement ID and delivered status are required." },
      { status: 400 },
    );
  }
  try {
    const result = await markMovementDelivered({
      googleSheetsService: createGoogleSheetsServiceFromConfig(getConfig()),
      movementMasterId,
    });
    if (!result) {
      return NextResponse.json(
        { error: "Movement was not found." },
        { status: 404 },
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    return movementError("update", movementMasterId, error);
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

function movementError(
  operation: string,
  movementMasterId: string,
  error: unknown,
): NextResponse {
  console.error(`Failed to ${operation} movement`, {
    error: error instanceof Error ? error.message : String(error),
    movementMasterId,
  });
  return NextResponse.json(
    { error: `Failed to ${operation} movement.` },
    { status: 500 },
  );
}
