"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { OrderItemProductSummary } from "../product-link-contracts";
import type { ReactNode } from "react";
const Context = createContext<{ items: OrderItemProductSummary[]; error?: string; reload(): void; status(itemId: string): { loaded: boolean; productId: string | null; error?: string }; update(itemId: string, productId: string | null): void } | null>(null);
export function OrderProductLinkProvider({ orderId, itemIds, children }: { orderId: string; itemIds: string; children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ orderId: string; items: Record<string, OrderItemProductSummary>; error?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/orders/${encodeURIComponent(orderId)}/product-links`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const body = await response.json();if (!response.ok) throw new Error(body.error ?? "Product identification status is unavailable.");
      if (!controller.signal.aborted) setState({ orderId, items: Object.fromEntries(body.links.map((link: OrderItemProductSummary) => [link.itemId, link])) });
    }).catch(reason => { if (!controller.signal.aborted) setState({ orderId, items: {}, error: reason instanceof Error ? reason.message : "Product identification status is unavailable." }); });
    return () => controller.abort();
  }, [orderId, itemIds, version]);
  return <Context.Provider value={{ items: state?.orderId === orderId ? Object.values(state.items) : [], error: state?.error, reload: () => setVersion(value => value + 1), status: itemId => ({ loaded: state?.orderId === orderId && Object.hasOwn(state.items, itemId), productId: state?.items[itemId]?.productId ?? null, error: state?.orderId === orderId ? state.error : undefined }), update: (itemId, productId) => setState(previous => ({ orderId, items: { ...previous?.items, [itemId]: { ...(previous?.items[itemId] ?? { itemId, productCode: "", imageUrl: "" }), productId } } })) }}>{children}</Context.Provider>;
}
export function useOrderProductLinks() { const context = useContext(Context);if (!context) throw new Error("Product link provider is required.");return context; }
