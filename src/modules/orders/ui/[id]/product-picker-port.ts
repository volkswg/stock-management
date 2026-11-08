import type { ReactNode } from "react";
export type ProductPickerInput = {
  contextKey: string;
  linkedId: string | null;
  initialCode: string;
  initialImage: string;
  onSave(productId: string | null): Promise<void>;
};
export interface OrderProductPickerPort { render(input: ProductPickerInput): ReactNode }
