import "server-only";
import type { IGoogleSheetsService } from "@/externals/google/sheet/types";
import { lastColumnLetter } from "@/infrastructure/persistence/google-sheets/const";
import { ORDERS_SHEET_HEADERS } from "@/modules/orders/infrastructure/google-sheets/orders/const";
import type { CreatedOrder } from "../../contracts";
import type { CreatedOrderWriter } from "../../application/ports/created-order-writer";

export class GoogleSheetsOrderWriter implements CreatedOrderWriter {
  constructor(private readonly sheets: Pick<IGoogleSheetsService, "orders">) {}

  async appendCreatedOrder(order: CreatedOrder): Promise<void> {
    await this.sheets.orders.appendRows(
      `A:${lastColumnLetter(ORDERS_SHEET_HEADERS.length - 1)}`,
      [[
        order.id,
        order.status,
        order.seller,
        order.totalPrice,
        order.remark,
        order.createdAt,
        order.updatedAt,
        order.deletedAt,
        order.createdBy,
      ]],
    );
  }
}
