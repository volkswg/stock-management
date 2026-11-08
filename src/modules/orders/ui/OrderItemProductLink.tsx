"use client";
import { Fragment, useState } from "react";
import { Alert, Button, Modal, Space, Tag } from "antd";
import type { OrderProductPickerPort } from "./[id]/product-picker-port";
import { useOrderProductLinks } from "./OrderProductLinkProvider";
import type { OrderItemProductLink as Link } from "../product-link-contracts";
export function OrderItemProductLink({ orderId, itemId, productCode, imageUrl, picker }: {
  orderId: string;itemId: string;productCode: string;imageUrl: string;picker: OrderProductPickerPort;
}) {
  const [open, setOpen] = useState(false), [link, setLink] = useState<Link>(), [error, setError] = useState<string>(), [loading, setLoading] = useState(false);
  const statuses = useOrderProductLinks(), status = statuses.status(itemId);
  const [pendingLink, setPendingLink] = useState<{ requestId: string; productId: string | null; revision: string }>();
  const url = `/api/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/product`;
  async function load() {
    setLoading(true);setError(undefined);
    try { const response = await fetch(url, { cache: "no-store" });const body = await response.json();if (!response.ok) throw new Error(body.error ?? "Unable to load the product association.");setLink(body.link);statuses.update(itemId, body.link.productId);
      const stored = sessionStorage.getItem(`product-link:v1:${orderId}:${itemId}`);
      if (stored) setPendingLink(JSON.parse(stored));
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load product association."); }
    finally { setLoading(false); }
  }
  async function save(productId: string | null) {
    if (!link) throw new Error("Reload the association before saving.");
    const key = `product-link:v1:${orderId}:${itemId}`;
    let pending: { requestId: string; productId: string | null; revision: string };
    try {
      const stored = sessionStorage.getItem(key);pending = stored ? JSON.parse(stored) : { requestId: crypto.randomUUID(), productId, revision: link.revision };
      if (pending.productId !== productId) throw new Error("A previous association save is unresolved. Retry that selection before making another change.");
      sessionStorage.setItem(key, JSON.stringify(pending));setPendingLink(pending);
    } catch (reason) { throw new Error(reason instanceof Error ? reason.message : "Browser storage is required to retain the pending operation safely."); }
    const response = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pending) });
    const body = await response.json();
    if (!response.ok) {
      if (body.code === "conflict") {
        // A different permanent guard already won this revision. This request
        // can no longer commit, so it is safe to release its browser intent.
        sessionStorage.removeItem(key);setPendingLink(undefined);await load();
      }
      throw Object.assign(new Error(body.error ?? "Product association could not be saved. Retry the same selection."), { status: response.status });
    }
    setLink(body.link);statuses.update(itemId, body.link.productId);sessionStorage.removeItem(key);setPendingLink(undefined);
  }
  return <Space orientation="vertical" size="small">
    {status.loaded ? <Tag color={status.productId ? "green" : "default"}>{status.productId ? "Linked" : "Unlinked"}</Tag> : <Tag>{status.error ? "Identification unavailable" : "Loading identity…"}</Tag>}
    <Button size="small" onClick={() => { setOpen(true);void load(); }}>Identify product</Button>
    <Modal open={open} title="Product Master association" footer={null} onCancel={() => setOpen(false)} destroyOnHidden>
      {error ? <Alert type="error" title={error} action={<Button onClick={() => void load()}>Reload</Button>} /> : null}
      {pendingLink ? <Alert type="warning" title={`Pending association: ${pendingLink.productId ?? "Unlinked"}`} action={<Button onClick={() => void save(pendingLink.productId).catch(reason => setError(reason instanceof Error ? reason.message : "Retry failed."))}>Retry pending association</Button>} /> : null}
      {loading ? <p role="status">Loading association…</p> : link ? <Fragment key={link.revision}>{picker.render({ contextKey: `${orderId}:${itemId}`, linkedId: link.productId, initialCode: productCode, initialImage: imageUrl, onSave: save })}</Fragment> : null}
    </Modal>
  </Space>;
}
