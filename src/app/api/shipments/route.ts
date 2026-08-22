import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import {
  createShipment,
  listShipments,
  ShipmentStatus,
} from "@/services/shipments";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const searchParams = new URL(request.url).searchParams;
  const excludeStatuses = parseExcludedStatuses(searchParams);
  if (!excludeStatuses) {
    return NextResponse.json(
      { error: "excludeStatuses contains an invalid shipment status." },
      { status: 400 },
    );
  }

  try {
    const includeOrders = searchParams.get("includeOrders") !== "false";
    const googleSheetsService = createGoogleSheetsServiceFromConfig(getConfig());
    const shipments = await listShipments({
      googleSheetsService,
      includeOrders,
      excludeStatuses,
    });

    return NextResponse.json({ shipments, total: shipments.length });
  } catch (error) {
    console.error("Failed to list shipments", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to load shipments." },
      { status: 500 },
    );
  }
}

function parseExcludedStatuses(
  searchParams: URLSearchParams,
): ShipmentStatus[] | undefined {
  const value = searchParams.get("excludeStatuses");
  if (!value?.trim()) return [];

  const statuses = value
    .split(",")
    .map((status) => status.trim())
    .filter(Boolean);
  if (!statuses.every(isShipmentStatus)) return undefined;

  return [...new Set(statuses)];
}

function isShipmentStatus(value: string): value is ShipmentStatus {
  return Object.values(ShipmentStatus).includes(value as ShipmentStatus);
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const input = parseCreateShipmentInput(body);
  if (!input) {
    return NextResponse.json(
      { error: "PO number is required and carrier must be text." },
      { status: 400 },
    );
  }

  try {
    const googleSheetsService = createGoogleSheetsServiceFromConfig(getConfig());
    const shipment = await createShipment({
      googleSheetsService,
      poNumber: input.poNumber,
      carrier: input.carrier,
      createdBy: "web",
    });

    return NextResponse.json({ shipment }, { status: 201 });
  } catch (error) {
    console.error("Failed to create shipment", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to create shipment." },
      { status: 500 },
    );
  }
}

function parseCreateShipmentInput(
  value: unknown,
): { poNumber: string; carrier?: string } | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const poNumber = value.poNumber;
  const carrier = value.carrier;
  if (
    typeof poNumber !== "string" ||
    !poNumber.trim() ||
    poNumber.length > 100 ||
    (carrier !== undefined && typeof carrier !== "string") ||
    (typeof carrier === "string" && carrier.length > 100)
  ) {
    return undefined;
  }

  return {
    poNumber: poNumber.trim(),
    carrier: typeof carrier === "string" ? carrier.trim() : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
