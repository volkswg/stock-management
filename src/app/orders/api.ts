import type {
  CreatedOrder,
  OrderDetail,
  OrderListItem,
  OrderStatus,
} from "@/services/orders";

export type OrdersResponse = {
  orders: OrderListItem[];
  total: number;
};

export type OrderResponse = {
  order: OrderDetail;
};

export type CreateOrderInput = {
  seller?: string;
  totalPrice?: number | null;
  remark?: string;
};

export type CreateOrderResponse = {
  order: CreatedOrder;
};

export type UpdateOrderPriceResponse = {
  order: {
    id: string;
    status: OrderStatus.Complete;
    totalPrice: number;
    updatedAt: string;
  };
};

export type UpdateOrderItemQuoteQuantityResponse = {
  item: {
    id: string;
    quoteQuantity: string;
    updatedAt: string;
  };
};

export type OrderImageType = "bill" | "product";

export type UploadOrderImageResponse = {
  imageType: OrderImageType;
  record: Record<string, unknown>;
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

export async function uploadOrderImage(
  orderId: string,
  image: File,
  imageType: OrderImageType,
): Promise<UploadOrderImageResponse> {
  const formData = new FormData();
  formData.set("image", image);
  formData.set("imageType", imageType);

  const response = await fetch(
    `/api/orders/${encodeURIComponent(orderId)}/images`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData,
    },
  );

  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(body));
  }
  if (!isUploadOrderImageResponse(body)) {
    throw new Error("The image upload API returned an invalid response.");
  }

  return body;
}

export async function updateOrderPrice(
  orderId: string,
  totalPrice: number,
): Promise<UpdateOrderPriceResponse> {
  const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ totalPrice }),
  });

  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(body));
  }
  if (!isUpdateOrderPriceResponse(body)) {
    throw new Error("The order price API returned an invalid response.");
  }

  return body;
}

export async function updateOrderItemQuoteQuantity(
  orderId: string,
  orderItemId: string,
  quoteQuantity: number,
): Promise<UpdateOrderItemQuoteQuantityResponse> {
  const response = await fetch(
    `/api/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(orderItemId)}`,
    {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ quoteQuantity }),
    },
  );

  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(body));
  }
  if (!isUpdateOrderItemQuoteQuantityResponse(body)) {
    throw new Error("The quote quantity API returned an invalid response.");
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

function isUploadOrderImageResponse(
  value: unknown,
): value is UploadOrderImageResponse {
  return (
    isRecord(value) &&
    (value.imageType === "bill" || value.imageType === "product") &&
    isRecord(value.record)
  );
}

function isUpdateOrderPriceResponse(
  value: unknown,
): value is UpdateOrderPriceResponse {
  return (
    isRecord(value) &&
    isRecord(value.order) &&
    typeof value.order.id === "string" &&
    value.order.status === "complete" &&
    typeof value.order.totalPrice === "number" &&
    typeof value.order.updatedAt === "string"
  );
}

function isUpdateOrderItemQuoteQuantityResponse(
  value: unknown,
): value is UpdateOrderItemQuoteQuantityResponse {
  return (
    isRecord(value) &&
    isRecord(value.item) &&
    typeof value.item.id === "string" &&
    typeof value.item.quoteQuantity === "string" &&
    typeof value.item.updatedAt === "string"
  );
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
