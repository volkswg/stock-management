import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { getShipmentDetail } from "@/services/shipments";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const shipmentId = id.trim();
  if (!shipmentId) {
    return NextResponse.json(
      { error: "Shipment ID is required." },
      { status: 400 },
    );
  }

  try {
    const googleSheetsService = createGoogleSheetsServiceFromConfig(
      getConfig(),
    );
    const shipment = await getShipmentDetail({
      googleSheetsService,
      shipmentId,
    });

    if (!shipment) {
      return NextResponse.json(
        { error: "Shipment was not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ shipment });
  } catch (error) {
    console.error("Failed to load shipment", {
      error: error instanceof Error ? error.message : String(error),
      shipmentId,
    });
    return NextResponse.json(
      { error: "Failed to load shipment." },
      { status: 500 },
    );
  }
}
