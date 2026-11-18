import type {
  CreatedOrder,
  OrderDetail,
  OrderItemQuantityType,
  OrderListItem,
  OrderBillImage,
  OrderProductImage,
  OrderProductUpdate,
  UpdatedOrderProduct,
  ReplacedOrderProductImage,
  OrderStatus,
} from "@/modules/orders/contracts";

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
  billImages: File[];
  productImages: File[];
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

export type UpdateOrderItemProductCodeResponse = {
  item: {
    id: string;
    productCode: string;
    updatedAt: string;
  };
};

export type UpdateOrderProductsResponse = {
  items: UpdatedOrderProduct[];
};

export type ReplaceOrderProductImageResponse = {
  item: ReplacedOrderProductImage;
};

export type OrderImageType = "bill" | "product";

export type UploadOrderImageResponse =
  | { imageType: "bill"; record: OrderBillImage }
  | { imageType: "product"; record: OrderProductImage };

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
  const formData = new FormData();
  if (input.seller !== undefined) formData.set("seller", input.seller);
  if (input.totalPrice !== undefined && input.totalPrice !== null) {
    formData.set("totalPrice", String(input.totalPrice));
  }
  if (input.remark !== undefined) formData.set("remark", input.remark);
  for (const image of input.billImages) {
    formData.append("billImages", image);
  }
  for (const image of input.productImages) {
    formData.append("productImages", image);
  }

  const fingerprint = fingerprintOrderCreation(formData);
  const active = orderCreationInFlight;
  if (active) {
    if ((await fingerprint) !== (await active.fingerprint)) {
      throw pendingOrderError();
    }
    return active.response;
  }
  const operation = {
    fingerprint,
    response: sendOrderCreation(formData, fingerprint),
  };
  orderCreationInFlight = operation;
  try {
    return await operation.response;
  } finally {
    if (orderCreationInFlight === operation) orderCreationInFlight = undefined;
  }
}

type PendingOrderCreation = {
  version: 1;
  key: string;
  fingerprint: string;
  phase: "prepared" | "pending" | "review" | "rejected";
  retrySafe: boolean;
};
const pendingOrderStorageKey = "stock-orders-pending-creation:v1";
let orderCreationInFlight: {
  fingerprint: Promise<string>;
  response: Promise<CreateOrderResponse>;
} | undefined;

function pendingOrderError(key?: string): Error {
  return new Error(`A previous order still needs confirmation. Restore the same details and images to check its outcome; do not start another order.${key ? ` Reference: ${key}.` : ""}`);
}
function readPendingOrder(): PendingOrderCreation | undefined {
  try {
    const raw = sessionStorage.getItem(pendingOrderStorageKey);
    if (raw === null) return undefined;
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value) || value.version !== 1 ||
      typeof value.key !== "string" || !/^order-create:[a-f0-9-]{36}$/.test(value.key) ||
      typeof value.fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(value.fingerprint) ||
      typeof value.retrySafe !== "boolean" || typeof value.phase !== "string" ||
      !["prepared", "pending", "review", "rejected"].includes(value.phase)
    ) throw new Error();
    return value as PendingOrderCreation;
  } catch {
    throw new Error("This browser cannot recover a pending order safely. Review any previous attempt before creating another order.");
  }
}
function savePendingOrder(value: PendingOrderCreation): void {
  try {
    const raw = JSON.stringify(value);
    sessionStorage.setItem(pendingOrderStorageKey, raw);
    if (sessionStorage.getItem(pendingOrderStorageKey) !== raw) throw new Error();
  } catch {
    throw new Error("This browser cannot preserve the order reference. Enable session storage before submitting an order.");
  }
}
export function getPendingOrderCreationNotice(): string | undefined {
  try {
    const pending = readPendingOrder();
    if (!pending || pending.phase === "rejected") return undefined;
    return pending.phase === "review"
      ? `The previous upload outcome needs review. Contact the operator before checking this same request again. Reference: ${pending.key}.`
      : `A previous order is unconfirmed. Reselect the same images and restore the same details to check its outcome. Reference: ${pending.key}.`;
  } catch (error) {
    return error instanceof Error ? error.message : "Review the previous order before submitting again.";
  }
}
async function fingerprintOrderCreation(form: FormData): Promise<string> {
  if (typeof crypto === "undefined" || !crypto?.subtle || typeof crypto.randomUUID !== "function") {
    throw new Error("A secure browser is required to preserve an order reference safely.");
  }
  const digest = async (bytes: BufferSource) => Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    b => b.toString(16).padStart(2, "0"),
  ).join("");
  const entries: unknown[] = [];
  for (const [name, value] of form.entries()) {
    entries.push(typeof value === "string" ? [name, value] : [name, value.name, value.type, await digest(await value.arrayBuffer())]);
  }
  return digest(new TextEncoder().encode(JSON.stringify([
    "POST", "/api/orders/with-images", "", entries,
  ])));
}
async function orderCreationRevision(): Promise<{ value: string; scope?: string } | undefined> {
  try {
    // HEAD is read-only and carries the existing PostgreSQL revision header.
    // Pin support before the first POST: a Sheets-era uncertainty must not be
    // retried just because the application later switches storage backends.
    const response = await fetch("/api/orders", { method: "HEAD", cache: "no-store" });
    const edit = response.headers.get("x-stock-edit-revision");
    if (response.ok && response.headers.get("x-stock-edit-scope") === "/api/orders" && edit && /^"stock-edit-v1-[a-f0-9]{64}"$/.test(edit)) {
      return { value: edit, scope: "/api/orders" };
    }
    const revision = response.headers.get("x-stock-revision");
    return response.ok && revision && /^"stock-v2-\d+"$/.test(revision) ? { value: revision } : undefined;
  } catch { return undefined; }
}
async function sendOrderCreation(formData: FormData, fingerprint: Promise<string>): Promise<CreateOrderResponse> {
  const intent = await fingerprint;
  let pending = readPendingOrder();
  if (pending && pending.fingerprint !== intent && pending.phase !== "rejected") throw pendingOrderError(pending.key);
  if (!pending || pending.fingerprint !== intent) {
    // Older versions left keys in the global fetch helper's namespace. Do not
    // replace one with a fresh key: its original backend/outcome is unproven.
    const legacyKey = sessionStorage.getItem(`stock-pending-operation:${intent}`);
    if (legacyKey !== null) throw pendingOrderError(legacyKey);
    pending = {
      version: 1,
      key: `order-create:${crypto.randomUUID()}`,
      fingerprint: intent,
      phase: "prepared",
      retrySafe: false,
    };
    savePendingOrder(pending);
  }
  const retry = pending.phase !== "prepared" && pending.phase !== "rejected";
  if (retry && !pending.retrySafe) throw new Error(`The previous request cannot be retried safely on this storage backend. Review the order and uploads with the operator. Reference: ${pending.key}.`);
  const revision = await orderCreationRevision();
  if (retry && !revision) throw new Error(`Cannot confirm safe retry support. Keep this order pending and contact the operator. Reference: ${pending.key}.`);
  pending = { ...pending, phase: "pending", retrySafe: revision !== undefined };
  savePendingOrder(pending); // Must persist before any multipart POST can leave.
  let response: Response, body: unknown;
  try {
    response = await fetch("/api/orders/with-images", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Idempotency-Key": pending.key,
        ...(revision ? { "If-Match": revision.value, ...(revision.scope ? { "x-stock-edit-scope": revision.scope } : {}) } : {}),
      },
      body: formData,
    });
    body = await response.json();
  } catch {
    throw pendingOrderError(pending.key); // Lost HTTP/JSON acknowledgement is not proof of rollback.
  }
  if (!response.ok) {
    // This route's 400 validation runs before any upload/business operation.
    pending.phase = response.status === 400 ? "rejected" : "review";
    savePendingOrder(pending);
    if (response.status === 400) throw new Error(getErrorMessage(body));
    const reason = response.status < 500 ? getErrorMessage(body) : "The order or upload outcome needs review.";
    throw new Error(`${reason} Check this same request after reviewing the saved result; do not create another order. Reference: ${pending.key}.`);
  }
  if (!isCreateOrderResponse(body)) throw pendingOrderError(pending.key);
  sessionStorage.removeItem(pendingOrderStorageKey); // Only a validated successful acknowledgement ends the intent.
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

export async function replaceOrderProductImage(
  orderId: string,
  itemId: string,
  image: File,
): Promise<ReplaceOrderProductImageResponse> {
  const formData = new FormData();
  formData.set("image", image);
  const response = await fetch(
    `/api/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/image`,
    { method: "PATCH", headers: { Accept: "application/json" }, body: formData },
  );
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(getErrorMessage(body));
  if (!isRecord(body) || !isRecord(body.item) ||
    typeof body.item.id !== "string" || typeof body.item.imageUrl !== "string" ||
    typeof body.item.updatedAt !== "string") {
    throw new Error("The image replacement API returned an invalid response.");
  }
  return { item: { id: body.item.id, imageUrl: body.item.imageUrl, updatedAt: body.item.updatedAt } };
}

export async function updateOrderProducts(
  orderId: string,
  items: OrderProductUpdate[],
): Promise<UpdateOrderProductsResponse> {
  const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/items`, {
    method: "PATCH",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(getErrorMessage(body));
  if (!isUpdateOrderProductsResponse(body)) {
    throw new Error("The product updates API returned an invalid response.");
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

export async function updateOrderItemProductCode(
  orderId: string,
  orderItemId: string,
  productCode: string,
): Promise<UpdateOrderItemProductCodeResponse> {
  const response = await fetch(
    `/api/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(orderItemId)}`,
    {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ productCode }),
    },
  );

  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(body));
  }
  if (!isUpdateOrderItemProductCodeResponse(body)) {
    throw new Error("The product code API returned an invalid response.");
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
  return isRecord(value) && isRecord(value.order) && typeof value.order.id === "string" && value.order.id.trim().length > 0;
}

function isUpdateOrderProductsResponse(value: unknown): value is UpdateOrderProductsResponse {
  return isRecord(value) && Array.isArray(value.items) && value.items.every((item: unknown) =>
    isRecord(item) &&
    typeof item.id === "string" &&
    typeof item.productCode === "string" &&
    typeof item.quoteQuantity === "string" &&
    typeof item.deliveredQuantity === "string" &&
    typeof item.updatedAt === "string",
  );
}

function isUploadOrderImageResponse(
  value: unknown,
): value is UploadOrderImageResponse {
  if (!isRecord(value) || !isRecord(value.record)) return false;
  const record = value.record;
  if (
    typeof record.id !== "string" ||
    typeof record.orderId !== "string" ||
    typeof record.imageUrl !== "string" ||
    typeof record.createdAt !== "string"
  ) {
    return false;
  }

  return (
    value.imageType === "bill" ||
    (value.imageType === "product" &&
      typeof record.quoteQuantity === "string" &&
      typeof record.deliveredQuantity === "string" &&
      typeof record.productCode === "string")
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

function isUpdateOrderItemProductCodeResponse(
  value: unknown,
): value is UpdateOrderItemProductCodeResponse {
  return (
    isRecord(value) &&
    isRecord(value.item) &&
    typeof value.item.id === "string" &&
    typeof value.item.productCode === "string" &&
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
