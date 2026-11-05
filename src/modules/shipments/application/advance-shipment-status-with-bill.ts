import type { UpdateShipmentStatusResult } from "./update-shipment-status";
import type { ShipmentBillStorage } from "./ports/shipment-bill-storage";

export type ShipmentStatusUpdater = (
  shippingBillUrl: string | undefined,
) => Promise<UpdateShipmentStatusResult>;

export type AdvanceShipmentStatusWithBillResult = (
  | { outcome: "drive_unavailable" }
  | { outcome: "completed"; result: UpdateShipmentStatusResult }
) & { cleanupAfterFailure(): Promise<void> };

export async function advanceShipmentStatusWithBill({
  storage,
  updateStatus,
}: {
  storage?: ShipmentBillStorage;
  updateStatus: ShipmentStatusUpdater;
}): Promise<AdvanceShipmentStatusWithBillResult> {
  let uploadedFileId: string | undefined;
  // Also retained by the caller for failures after successful orchestration.
  const cleanupAfterFailure = async (): Promise<void> => {
    if (storage) await storage.cleanup(uploadedFileId);
  };

  try {
    let shippingBillUrl: string | undefined;
    if (storage) {
      const upload = await storage.upload();
      if (upload.outcome === "unavailable") {
        return { outcome: "drive_unavailable", cleanupAfterFailure };
      }
      const driveFile = upload.file;
      uploadedFileId = driveFile.id;
      shippingBillUrl = driveFile.webViewLink;
    }

    const result = await updateStatus(shippingBillUrl);
    if (result.outcome !== "updated") {
      await cleanupAfterFailure();
      uploadedFileId = undefined;
    }
    return { outcome: "completed", result, cleanupAfterFailure };
  } catch (error) {
    await cleanupAfterFailure();
    throw error;
  }
}
