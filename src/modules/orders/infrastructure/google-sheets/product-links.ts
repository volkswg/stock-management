import "server-only";
import { isRequestId } from "@/shared/lib/request-id";
import type { GoogleSheetsClient } from "@/infrastructure/persistence/google-sheets/client";
import { enteredRows, guardedWrite, parseGuard, stableFingerprint, GuardConflictError } from "@/infrastructure/persistence/google-sheets/guarded-write";
import { ORDERS_SHEET_HEADERS } from "./orders/const";
import { ORDER_ITEMS_SHEET_HEADERS } from "./order-items/const";
import type { OrderItemProductLinks } from "../../application/ports/product-links";
import type { OrderItemProductLink } from "../../product-link-contracts";
export const LINKED_ORDER_ITEM_HEADERS = [...ORDER_ITEMS_SHEET_HEADERS, "productId"] as const;
export function createOrderItemProductLinks(client: GoogleSheetsClient, worksheetName: string, ordersWorksheetName: string): OrderItemProductLinks {
  const keyFor = (orderId: string, itemId: string) => `pm:link:${stableFingerprint([orderId, itemId])}`;
  async function hasOrder(orderId: string): Promise<boolean> {
    const orders = await client.getValues(ordersWorksheetName, "A:I");
    if (orders[0]?.join("|") !== ORDERS_SHEET_HEADERS.join("|")) throw new Error("Order worksheet headers require operator review.");
    const parents = orders.slice(1).filter(row => String(row[0] ?? "").trim() === orderId && !String(row[7] ?? "").trim());
    if (parents.length > 1) throw new Error("Duplicate Order IDs require operator review.");
    return parents.length === 1;
  }
  async function snapshot(orderId: string, itemId: string) {
    if (!await hasOrder(orderId)) return undefined;
    const rows = await client.getValues(worksheetName, "A:K");
    if (rows[0]?.join("|") !== LINKED_ORDER_ITEM_HEADERS.join("|")) throw new Error("Order Item product linking requires the existing A–J headers and productId in K1.");
    const matches = rows.map((row, index) => ({ row, index })).filter(({ row, index }) => index > 0 && String(row[0] ?? "").trim() === itemId);
    if (matches.length > 1) throw new Error("Duplicate Order Item IDs require operator review.");
    const target = matches[0];
    if (!target || String(target.row[1] ?? "").trim() !== orderId || String(target.row[8] ?? "").trim()) return undefined;
    const records = (await client.findMetadata({ metadataKey: keyFor(orderId, itemId) })).map(parseGuard);
    const byPrevious = new Map<string, typeof records[number]>();
    for (const record of records) {
      if (byPrevious.has(record.identity) || !(record.identity === "initial" || isRequestId(record.identity)) || !isRequestId(record.data?.revision) || !(record.data.productId === null || typeof record.data.productId === "string")) throw new Error("Order Item association history is invalid.");
      byPrevious.set(record.identity, record);
    }
    let revision = "initial", productId: string | null = String(target.row[10] ?? "").trim() || null;
    const visited = new Set<string>();
    while (byPrevious.has(revision)) {
      if (visited.has(revision)) throw new Error("Order Item association history contains a cycle.");
      visited.add(revision);const data = byPrevious.get(revision)!.data!;revision = data.revision!;productId = data.productId;
    }
    if (visited.size !== records.length || (records.length && productId !== (String(target.row[10] ?? "").trim() || null))) throw new GuardConflictError();
    return { link: { orderId, itemId, productId, revision } as OrderItemProductLink, rowIndex: target.index };
  }
  return {
    async list(orderId) {
      if (!await hasOrder(orderId)) return [];
      const rows = await client.getValues(worksheetName, "A:K");
      if (rows[0]?.join("|") !== LINKED_ORDER_ITEM_HEADERS.join("|")) throw new Error("Order Item product linking requires productId in K1; existing columns must remain unchanged.");
      const seen = new Set<string>();
      return rows.slice(1).filter(row => String(row[1] ?? "").trim() === orderId && !String(row[8] ?? "").trim()).map(row => {
        const itemId = String(row[0] ?? "").trim();
        if (!itemId || seen.has(itemId)) throw new Error("Order Item identities are invalid or duplicated.");
        seen.add(itemId);return { itemId, productId: String(row[10] ?? "").trim() || null, productCode: String(row[5] ?? ""), imageUrl: String(row[2] ?? "") };
      });
    },
    read: async (orderId, itemId) => (await snapshot(orderId, itemId))?.link,
    async save(input) {
      const current = await snapshot(input.orderId, input.itemId);
      if (!current) throw new Error("Order item not found.");
      const key = keyFor(input.orderId, input.itemId), fingerprint = stableFingerprint([input.requestId, input.productId]);
      const history = (await client.findMetadata({ metadataKey: key })).map(parseGuard);
      const previous = history.find(record => record.identity === input.revision);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new GuardConflictError();
        return current.link;
      }
      if (current.link.revision !== input.revision || history.some(record => record.data?.revision === input.requestId)) throw new GuardConflictError();
      const sheetId = await client.worksheetId(worksheetName);
      await guardedWrite(client, { key, identity: input.revision, fingerprint, data: { revision: input.requestId, productId: input.productId } }, [
        { updateCells: { range: { sheetId, startRowIndex: current.rowIndex, endRowIndex: current.rowIndex + 1, startColumnIndex: 10, endColumnIndex: 11 }, rows: enteredRows([[input.productId ?? ""]]), fields: "userEnteredValue" } },
      ]);
      const published = await snapshot(input.orderId, input.itemId);
      if (!published) throw new Error("Order item is unavailable after linking. Refresh before retrying.");
      return published.link;
    },
  };
}
