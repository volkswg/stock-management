import type {
  Shipment,
  ShipmentListItem,
  ShipmentOrder,
  ShipmentStatus,
  ShipmentStatusUpdate,
} from "@/services/shipments";

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

export type ShipmentDetailResponse = {
  shipment: ShipmentListItem;
};

export type UpdateShipmentStatusResponse = {
  shipment: ShipmentStatusUpdate;
};

export type AdvanceShipmentStatusInput = {
  status: ShipmentStatus;
  deliveryFee?: number;
  poNumber?: string;
};

export type LinkOrderToShipmentResponse = {
  shipmentOrder: ShipmentOrder;
  created: boolean;
};

export async function getShipments({
  excludeStatuses = [],
  includeOrders = true,
  signal,
}: {
  excludeStatuses?: readonly ShipmentStatus[];
  includeOrders?: boolean;
  signal?: AbortSignal;
} = {}): Promise<ShipmentsResponse> {
  const searchParams = new URLSearchParams();
  if (!includeOrders) searchParams.set("includeOrders", "false");
  if (excludeStatuses.length > 0) {
    searchParams.set("excludeStatuses", excludeStatuses.join(","));
  }
  const query = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
  const response = await fetch(`/api/shipments${query}`, {
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

export async function getShipment(
  shipmentId: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<ShipmentDetailResponse> {
  const response = await fetch(
    `/api/shipments/${encodeURIComponent(shipmentId)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    },
  );

  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(body));
  }
  if (!isShipmentDetailResponse(body)) {
    throw new Error("The shipment API returned an invalid response.");
  }

  return body;
}

export async function advanceShipmentStatus(
  shipmentId: string,
  input: AdvanceShipmentStatusInput,
): Promise<UpdateShipmentStatusResponse> {
  const response = await fetch(
    `/api/shipments/${encodeURIComponent(shipmentId)}`,
    {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(body));
  }
  if (!isUpdateShipmentStatusResponse(body)) {
    throw new Error("The shipment API returned an invalid response.");
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

export async function linkOrderToShipment(
  shipmentId: string,
  orderId: string,
): Promise<LinkOrderToShipmentResponse> {
  const response = await fetch(
    `/api/shipments/${encodeURIComponent(shipmentId)}/orders`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderId }),
    },
  );

  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(body));
  }
  if (!isLinkOrderToShipmentResponse(body)) {
    throw new Error("The shipment link API returned an invalid response.");
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

function isShipmentDetailResponse(
  value: unknown,
): value is ShipmentDetailResponse {
  return (
    isRecord(value) &&
    isRecord(value.shipment) &&
    Array.isArray(value.shipment.orders)
  );
}

function isUpdateShipmentStatusResponse(
  value: unknown,
): value is UpdateShipmentStatusResponse {
  return (
    isRecord(value) &&
    isRecord(value.shipment) &&
    typeof value.shipment.status === "string" &&
    typeof value.shipment.updatedAt === "string"
  );
}

function isLinkOrderToShipmentResponse(
  value: unknown,
): value is LinkOrderToShipmentResponse {
  return (
    isRecord(value) &&
    isRecord(value.shipmentOrder) &&
    typeof value.created === "boolean"
  );
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
