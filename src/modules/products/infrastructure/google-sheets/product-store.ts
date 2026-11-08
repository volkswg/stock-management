import "server-only";
import type { GoogleSheetsClient } from "@/infrastructure/persistence/google-sheets/client";
import { enteredRows, guardedWrite, parseGuard, stableFingerprint, GuardConflictError } from "@/infrastructure/persistence/google-sheets/guarded-write";
import type { Product } from "../../contracts";
import type { ProductStore } from "../../application/ports/product-store";
import { validateProductInput, ProductNotFoundError, ProductCreationCancelledError } from "../../domain/validation";
export const PRODUCT_HEADERS = ["id", "productCode", "productName", "variant", "referenceImageUrl", "active", "createdAt", "updatedAt", "createdBy"] as const;
export function createProductStore(client: GoogleSheetsClient): ProductStore {
  async function read() {
    const rows = await client.getValues("products", "A:I");
    if (rows[0]?.join("|") !== PRODUCT_HEADERS.join("|")) throw new Error("Product Master setup is required: review the products worksheet headers.");
    const products: Product[] = [], locations = new Map<string, number>();
    for (const [index, row] of rows.entries()) {
      if (!index || row.every(cell => cell === "" || cell === null)) continue;
      const [id, productCode, productName, variant, referenceImageUrl, active, createdAt, updatedAt, createdBy] = row.map(cell => String(cell ?? ""));
      if (!id || !productName || !createdAt || !updatedAt || !createdBy || !/^(true|false)$/i.test(active) || locations.has(id)) throw new Error("Product Master contains invalid or duplicate records; operator review is required.");
      validateProductInput({ productCode, productName, variant, referenceImageUrl });
      if (!Number.isFinite(Date.parse(createdAt)) || !Number.isFinite(Date.parse(updatedAt))) throw new Error("Product Master timestamps are invalid.");
      products.push({ id, productCode, productName, variant, referenceImageUrl, active: active.toLowerCase() === "true", createdAt, updatedAt, createdBy });locations.set(id, index + 1);
    }
    return { products, locations };
  }
  async function find(id: string): Promise<Product> {
    const product = (await read()).products.find(product => product.id === id);
    if (!product) throw new Error("Product record is unavailable; retain the request ID and refresh before retrying.");
    return product;
  }
  return {
    list: async () => (await read()).products,
    async create({ id, values, actor, now }) {
      const { products } = await read();
      const existing = products.find(product => product.id === id);
      const fingerprint = stableFingerprint([id, values, actor]);
      const markers = (await client.findMetadata({ metadataKey: `pm:create:${id}` })).map(parseGuard);
      if (markers.some(marker => marker.identity === id && marker.fingerprint === stableFingerprint(["cancel-product-creation", id]) && marker.data?.state === "cancelled")) throw new ProductCreationCancelledError();
      if (existing) {
        if (markers.length !== 1) throw new Error("Product creation history is unavailable; no duplicate record was appended.");
      }
      const sheetId = await client.worksheetId("products");
      await guardedWrite(client, { key: `pm:create:${id}`, identity: id, fingerprint, data: { state: "created" } }, [
        { appendCells: { sheetId, rows: enteredRows([[id, values.productCode, values.productName, values.variant, values.referenceImageUrl, true, now, now, actor]]), fields: "userEnteredValue" } },
      ]);
      return find(id);
    },
    async cancelCreation(id, actor) {
      const existing = (await read()).products.find(product => product.id === id);
      if (existing) return { outcome: "created", product: existing };
      try {
        await guardedWrite(client, { key: `pm:create:${id}`, identity: id, fingerprint: stableFingerprint(["cancel-product-creation", id]), data: { state: "cancelled", actor } }, []);
        return { outcome: "cancelled" };
      } catch (error) {
        if (!(error instanceof GuardConflictError)) throw error;
        const product = (await read()).products.find(product => product.id === id);
        if (!product) throw new Error("Creation history is inconsistent; retain the request ID and contact the operator.");
        return { outcome: "created", product };
      }
    },
    async edit({ id, values, expectedUpdatedAt, requestId, now }) {
      const { products, locations } = await read(), product = products.find(product => product.id === id);
      if (!product) throw new ProductNotFoundError();
      const key = `pm:edit:${id}`, identity = expectedUpdatedAt;
      const fingerprint = stableFingerprint([id, values, requestId]);
      const previous = (await client.findMetadata({ metadataKey: key })).map(parseGuard);
      if (previous.some(record => record.data?.requestId === requestId && record.identity !== identity)) throw new GuardConflictError();
      // Recover a completed retry before requiring the old revision to match.
      const matching = previous.some(record => record.identity === identity && record.fingerprint === fingerprint);
      if (!matching && product.updatedAt !== expectedUpdatedAt) throw new GuardConflictError();
      const timestamp = new Date(Math.max(Date.parse(now), Date.parse(product.updatedAt) + 1)).toISOString();
      const sheetId = await client.worksheetId("products"), row = locations.get(id)! - 1;
      await guardedWrite(client, { key, identity, fingerprint, data: { requestId, updatedAt: timestamp } }, [
        { updateCells: { range: { sheetId, startRowIndex: row, endRowIndex: row + 1, startColumnIndex: 1, endColumnIndex: 6 }, rows: enteredRows([[values.productCode, values.productName, values.variant, values.referenceImageUrl, values.active]]), fields: "userEnteredValue" } },
        { updateCells: { range: { sheetId, startRowIndex: row, endRowIndex: row + 1, startColumnIndex: 7, endColumnIndex: 8 }, rows: enteredRows([[timestamp]]), fields: "userEnteredValue" } },
      ]);
      return find(id);
    },
  };
}
