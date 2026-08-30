import type {
  CreatedOrder,
  OrderDetail,
  OrderItemQuantityType,
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

export type UpdateOrderDetailsInput = {
  totalPrice?: number;
  remark?: string;
};

export type UpdateOrderDetailsResponse = {
  order: {
    id: string;
    status: OrderStatus;
    totalPrice: number | null;
    remark: string;
    updatedAt: string;
  };
};

export type UpdateOrderItemQuantityResponse = {
  item: {
    id: string;
    quantity: string;
    quantityType: OrderItemQuantityType;
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

export async function updateOrderDetails(
  orderId: string,
  input: UpdateOrderDetailsInput,
): Promise<UpdateOrderDetailsResponse> {
  const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
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
  if (!isUpdateOrderDetailsResponse(body)) {
    throw new Error("The order details API returned an invalid response.");
  }

  return body;
}

export async function updateOrderItemQuantity(
  orderId: string,
  orderItemId: string,
  quantityType: OrderItemQuantityType,
  quantity: number,
): Promise<UpdateOrderItemQuantityResponse> {
  const response = await fetch(
    `/api/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(orderItemId)}`,
    {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ quantity, quantityType }),
    },
  );

  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(body));
  }
  if (!isUpdateOrderItemQuantityResponse(body)) {
    throw new Error("The product quantity API returned an invalid response.");
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

function isUpdateOrderDetailsResponse(
  value: unknown,
): value is UpdateOrderDetailsResponse {
  return (
    isRecord(value) &&
    isRecord(value.order) &&
    typeof value.order.id === "string" &&
    typeof value.order.status === "string" &&
    (value.order.totalPrice === null ||
      typeof value.order.totalPrice === "number") &&
    typeof value.order.remark === "string" &&
    typeof value.order.updatedAt === "string"
  );
}

function isUpdateOrderItemQuantityResponse(
  value: unknown,
): value is UpdateOrderItemQuantityResponse {
  return (
    isRecord(value) &&
    isRecord(value.item) &&
    typeof value.item.id === "string" &&
    typeof value.item.quantity === "string" &&
    (value.item.quantityType === "quote" ||
      value.item.quantityType === "delivered") &&
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
