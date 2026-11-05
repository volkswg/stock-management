import "server-only";
import type { IGoogleDriveService } from "@/externals/google/drive/types";
import type { ShipmentBillStorage, ShipmentBillUploadResult } from "../../application/ports/shipment-bill-storage";

export class GoogleDriveShipmentBillStorage implements ShipmentBillStorage {
  private googleDriveService: IGoogleDriveService | undefined;

  constructor(
    private readonly shipmentId: string,
    private readonly shippingBill: File,
    private readonly createDriveService: () => IGoogleDriveService | undefined,
  ) {}

  async upload(): Promise<ShipmentBillUploadResult> {
    this.googleDriveService = this.createDriveService();
    const googleDriveService = this.googleDriveService;
    if (!googleDriveService) return { outcome: "unavailable" };
    const shipmentId = this.shipmentId;
    const shippingBill = this.shippingBill;
    const driveFile = await googleDriveService.uploadImage({
      fileName: createShippingBillFileName(shipmentId, shippingBill),
      contentType: shippingBill.type,
      bytes: Buffer.from(await shippingBill.arrayBuffer()),
    });
    return { outcome: "uploaded", file: driveFile };
  }

  async cleanup(fileId: string | undefined): Promise<void> {
    await cleanUpUploadedFile(this.googleDriveService, fileId);
  }
}

function createShippingBillFileName(shipmentId: string, file: File): string {
  const extension =
    file.type === "application/pdf"
      ? ".pdf"
      : file.type === "image/png"
        ? ".png"
        : file.type === "image/webp"
          ? ".webp"
          : ".jpg";
  const safeShipmentId = shipmentId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `shipment-bill-${safeShipmentId}-${Date.now()}${extension}`;
}

async function cleanUpUploadedFile(
  googleDriveService: IGoogleDriveService | undefined,
  fileId: string | undefined,
): Promise<void> {
  if (!googleDriveService || !fileId) return;
  try {
    await googleDriveService.deleteFile(fileId);
  } catch (error) {
    console.error("Failed to clean up shipment bill upload", {
      fileId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
