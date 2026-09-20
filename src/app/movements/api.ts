import type {
  ProductMovementMasterRecord,
  ProductMovementRecord,
} from "@/services/movements";

export async function getMovements(
  filters: { date?: string; fromDate?: string; toDate?: string },
  signal?: AbortSignal,
): Promise<ProductMovementMasterRecord[]> {
  const query = new URLSearchParams();
  if (filters.date) query.set("date", filters.date);
  if (filters.fromDate) query.set("fromDate", filters.fromDate);
  if (filters.toDate) query.set("toDate", filters.toDate);
  const payload = await request<{ records: ProductMovementMasterRecord[] }>(
    `/api/movements?${query.toString()}`,
    { signal },
  );
  return payload.records;
}

export async function getMovement(
  movementMasterId: string,
  signal?: AbortSignal,
): Promise<ProductMovementRecord[]> {
  const payload = await request<{ records: ProductMovementRecord[] }>(
    `/api/movements/${encodeURIComponent(movementMasterId)}`,
    { signal },
  );
  return payload.records;
}

export function deliverMovement(movementMasterId: string): Promise<{
  movementMaster: ProductMovementMasterRecord;
  records: ProductMovementRecord[];
}> {
  return request(`/api/movements/${encodeURIComponent(movementMasterId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "delivered" }),
  });
}

export function saveMovementItem({
  movementMasterId,
  movementId,
  quantity,
  remark,
  stockCounted,
}: {
  movementMasterId: string;
  movementId: string;
  quantity?: string;
  remark?: string;
  stockCounted?: boolean;
}): Promise<{ records: ProductMovementRecord[] }> {
  return request(
    `/api/movements/${encodeURIComponent(movementMasterId)}/items/${encodeURIComponent(movementId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity, remark, stockCounted }),
    },
  );
}

export function saveMovementImage({
  movementMasterId,
  movementId,
  file,
}: {
  movementMasterId: string;
  movementId: string;
  file: File;
}): Promise<{ records: ProductMovementRecord[] }> {
  return request(
    `/api/movements/${encodeURIComponent(movementMasterId)}/items/${encodeURIComponent(movementId)}/image`,
    {
      method: "PATCH",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    },
  );
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { Accept: "application/json", ...init?.headers },
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(
      isRecord(body) && typeof body.error === "string"
        ? body.error
        : "Movement request failed.",
    );
  }
  return body as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
