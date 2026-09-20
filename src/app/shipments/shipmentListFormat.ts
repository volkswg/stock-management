import { OrderStatus } from "@/services/orders";
import { ShipmentStatus } from "@/services/shipments";

const THB_FORMATTER = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatShipmentCurrency(
  value: number | null | undefined,
): string {
  return value === null || value === undefined
    ? "—"
    : THB_FORMATTER.format(value);
}

export function formatShipmentDate(value: string): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatShipmentStatus(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getShipmentStatusColor(status: ShipmentStatus): string {
  switch (status) {
    case ShipmentStatus.ReadyToShip:
      return "warning";
    case ShipmentStatus.Shipping:
      return "processing";
    case ShipmentStatus.Delivered:
      return "success";
    case ShipmentStatus.Canceled:
      return "error";
    default:
      return "default";
  }
}

export function getShipmentOrderStatusColor(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.Complete:
    case OrderStatus.Delivered:
      return "success";
    case OrderStatus.Canceled:
      return "error";
    case OrderStatus.Paid:
    case OrderStatus.Shipped:
      return "processing";
    default:
      return "warning";
  }
}
