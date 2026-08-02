export const GOOGLE_SHEETS_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets";
export const GOOGLE_SHEETS_API_BASE =
  "https://sheets.googleapis.com/v4/spreadsheets";

export const PURCHASE_SHEET_HEADERS = [
  "id",
  "poNumber",
  "status",
  "seller",
  "item",
  "quantity",
  "totalPrice",
  "deliveryFee",
  "sentToCargoAt",
  "deliveredAt",
  "createdAt",
  "updatedAt",
  "createdBy",
  "remark",
];

export const ORDERS_SHEET_HEADERS = [
  "id",
  "status", // draft, paid, shipped, delivered, canceled
  "seller", // seller
  // "quantity",
  "totalPrice",
  "remark",
  // "deliveryFee",
  // "sentToCargoAt",
  // "deliveredAt",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "createdBy",
];

export const lastColumnLetter = (columnIndex: number): string => {
  let letter = "";
  let index = columnIndex;

  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }

  return letter;
};
