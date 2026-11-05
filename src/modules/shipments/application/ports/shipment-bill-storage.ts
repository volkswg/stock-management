export type UploadedShipmentBill = {
  id: string;
  webViewLink: string;
};

export type ShipmentBillUploadResult =
  | { outcome: "unavailable" }
  | { outcome: "uploaded"; file: UploadedShipmentBill };

export interface ShipmentBillStorage {
  upload(): Promise<ShipmentBillUploadResult>;
  cleanup(fileId: string | undefined): Promise<void>;
}
