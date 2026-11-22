export type ProductInput = { productCode: string; productName: string; variant: string };
export type Product = ProductInput & {
  id: string; referenceImageMediaId: string | null; imageUrl: string;
  createdAt: string; updatedAt: string; deletedAt: string | null; revision: string;
};
export type ProductCreateInput = ProductInput & { referenceImageMediaId: string | null; confirmSimilar: boolean };
