import type {
  CreatedOrder,
  OrderDetail,
  OrderListItem,
} from "@/services/orders";

export type OrdersResponse = {
  orders: OrderListItem[];
  total: number;
};

export type OrderResponse = {
  order: OrderDetail;
};

export type CreateOrderInput = {
  seller: string;
  totalPrice?: number | null;
  remark?: string;
};

export type CreateOrderResponse = {
  order: CreatedOrder;
};

export async function getOrders({
  signal,
}: {
  signal?: AbortSignal;
} = {}): Promise<OrdersResponse> {
  const response = await fetch("/api/orders", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });

  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(body));
  }
  if (!isOrdersResponse(body)) {
    throw new Error("The orders API returned an invalid response.");
  }

  return body;
}

export async function getOrder(
  orderId: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<OrderResponse> {
  const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });

  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(body));
  }
  if (!isOrderResponse(body)) {
    throw new Error("The order API returned an invalid response.");
  }

  return body;
}

export async function createOrder(
  input: CreateOrderInput,
): Promise<CreateOrderResponse> {
  const response = await fetch("/api/orders", {
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
  if (!isCreateOrderResponse(body)) {
    throw new Error("The order API returned an invalid response.");
  }

  return body;
}

function isOrdersResponse(value: unknown): value is OrdersResponse {
  if (!isRecord(value)) {
    return false;
  }
  return Array.isArray(value.orders) && typeof value.total === "number";
}

function isOrderResponse(value: unknown): value is OrderResponse {
  return isRecord(value) && isRecord(value.order);
}

function isCreateOrderResponse(value: unknown): value is CreateOrderResponse {
  return isRecord(value) && isRecord(value.order);
}

function getErrorMessage(value: unknown): string {
  if (isRecord(value) && typeof value.error === "string") {
    return value.error;
  }
  return "Failed to load orders.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
