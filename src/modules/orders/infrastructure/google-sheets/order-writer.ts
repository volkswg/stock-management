import "server-only";
import type { IGoogleSheetsService } from "@/externals/google/sheet/types";
import { lastColumnLetter } from "@/externals/google/sheet/const";
import { ORDERS_SHEET_HEADERS } from "@/externals/google/sheet/sheets/orders/const";
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
