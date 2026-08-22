import type { Shipment, ShipmentListItem } from "@/services/shipments";

export type ShipmentsResponse = {
  shipments: ShipmentListItem[];
  total: number;
};

export type CreateShipmentInput = {
  poNumber: string;
  carrier?: string;
};

export type ShipmentResponse = {
  shipment: Shipment;
};

export async function getShipments({
  signal,
}: {
  signal?: AbortSignal;
} = {}): Promise<ShipmentsResponse> {
  const response = await fetch("/api/shipments", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });

  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(body));
  }
  if (!isShipmentsResponse(body)) {
    throw new Error("The shipments API returned an invalid response.");
  }

  return body;
}

export async function createShipmentMaster(
  input: CreateShipmentInput,
): Promise<ShipmentResponse> {
  const response = await fetch("/api/shipments", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(body));
  }
  if (!isShipmentResponse(body)) {
    throw new Error("The shipment API returned an invalid response.");
  }

  return body;
}

function isShipmentsResponse(value: unknown): value is ShipmentsResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.shipments) &&
    typeof value.total === "number"
  );
}

function isShipmentResponse(value: unknown): value is ShipmentResponse {
  return isRecord(value) && isRecord(value.shipment);
}

function getErrorMessage(value: unknown): string {
  if (isRecord(value) && typeof value.error === "string") {
    return value.error;
  }
  return "Failed to load shipments.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
