import { ShipmentStatus } from "@/services/shipments";

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export function isUpdatableStatus(value: unknown): value is ShipmentStatus {
  return (
    value === ShipmentStatus.ReadyToShip ||
    value === ShipmentStatus.Shipping ||
    value === ShipmentStatus.Delivered
  );
}

export function isValidDeliveryFee(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1_000_000_000
  );
}

export function isValidPoNumber(value: unknown): value is string {
  return (
    typeof value === "string" && Boolean(value.trim()) && value.length <= 100
  );
}
