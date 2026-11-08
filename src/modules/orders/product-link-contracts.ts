// Public browser-safe product association DTO; existing Order API shapes stay stable.
export type OrderItemProductLink = { orderId: string; itemId: string; productId: string | null; revision: string };

export type OrderItemProductSummary = { itemId: string; productId: string | null; productCode: string; imageUrl: string };
