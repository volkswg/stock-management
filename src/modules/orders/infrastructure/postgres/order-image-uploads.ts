import "server-only";
import type { UploadedOrderCreationImage } from "../../contracts";
import { completedCommandResponse } from "@/infrastructure/persistence/postgres/commands";
import { currentTransaction } from "@/infrastructure/persistence/postgres/database";

const kind = "POST:/api/orders/with-images";
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export async function uploadedDriveImage(fileId: string): Promise<{ id: string; url: string }> {
  const { rows } = await currentTransaction().query<{ id: string; url: string }>(
    'SELECT id::text,"sourceUrl" AS url FROM stock_operational.media WHERE provider=\'google_drive\' AND "providerFileId"=$1 AND "deletedAt" IS NULL', [fileId],
  );
  if (rows.length !== 1) throw new Error("The uploaded image could not be registered.");
  return rows[0];
}

export async function verifiedOrderImages(images: UploadedOrderCreationImage[]): Promise<UploadedOrderCreationImage[] | undefined> {
  const verified: UploadedOrderCreationImage[] = [];
  for (const image of images) {
    const stored = await completedCommandResponse(kind, image.uploadKey);
    if (!record(stored) || stored.status !== 201 || typeof stored.body !== "string") return;
    let receipt: unknown;
    try { receipt = JSON.parse(Buffer.from(stored.body, "base64").toString("utf8")); } catch { return; }
    if (!record(receipt) || !record(receipt.image)) return;
    const saved = receipt.image;
    if (saved.id !== image.id || saved.url !== image.url || saved.imageType !== image.imageType || saved.uploadKey !== image.uploadKey) return;
    // Lock the canonical location through order creation. Never trust the URL
    // alone, fetch an arbitrary URL, or accept a soft-deleted catalog record.
    const { rows } = await currentTransaction().query<{ id: string; url: string }>(
      'SELECT id::text,"sourceUrl" AS url FROM stock_operational.media WHERE id=$1::uuid AND provider=\'google_drive\' AND "deletedAt" IS NULL AND "sourceUrl"=$2 FOR SHARE',
      [image.id, image.url],
    );
    if (rows.length !== 1) return;
    verified.push({ ...image, id: rows[0].id, url: rows[0].url });
  }
  return verified;
}
