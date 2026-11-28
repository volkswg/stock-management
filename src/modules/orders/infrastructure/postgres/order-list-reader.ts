import "server-only";
import type { NativeRecord } from "@/infrastructure/persistence/postgres/native-records";
import type { Storage } from "./storage";
import type { OrderListItem, OrderProductImage } from "../../contracts";
import type { OrderListReader } from "../../application/ports/order-list-reader";
import { mapOrderRow, mapOrderProductImageRow, toStringValue } from "./order-row-mapping";
import { OrderStatus, type OrderListQuery, type OrderListPageResult } from "../../contracts";
import { currentTransaction } from "@/infrastructure/persistence/postgres/database";
import { trimmedSql } from "@/infrastructure/persistence/postgres/text";

export class PostgresOrderListReader implements OrderListReader {
  constructor(private readonly storage: Pick<Storage, "orders" | "orderItems" | "shipmentOrders">) {}

  async readOrderList(): Promise<OrderListItem[]> {
    const [orderRows, orderItemRows, shipmentOrderRows] = await Promise.all([
      this.storage.orders.all("descending").then(records => records.reverse()),
      this.storage.orderItems.all(),
      this.storage.shipmentOrders.all(),
    ]);
    const productImagesByOrderId = groupProductImagesByOrderId(orderItemRows);
    const shipmentIdsByOrderId = groupShipmentIdsByOrderId(shipmentOrderRows);

    return orderRows
      .map(mapOrderRow)
      .filter((order): order is OrderListItem => Boolean(order))
      .map((order) => ({
        ...order,
        shipmentId: shipmentIdsByOrderId.get(order.id) ?? null,
        productImages: productImagesByOrderId.get(order.id) ?? [],
      }));
  }

  async readPage(input: OrderListQuery): Promise<OrderListPageResult> {
    // Count + clamped page IDs share one statement snapshot. Only this page's
    // order payloads and children cross the database connection afterward.
    const text = (column: string) => trimmedSql(`o."${column}"`);
    const linked = `EXISTS (SELECT 1 FROM stock_operational.shipment_orders s WHERE s."deletedAt" IS NULL AND ${trimmedSql('s."orderId"')}=${text("id")} AND ${trimmedSql('s."shipmentId"')}<>'')`;
    const query = input.query.trim().toLowerCase();
    let matchingIds: string[] | null = null;
    if (query) {
      // PostgreSQL locale lower() differs from JavaScript for e.g. dotted I and
      // final sigma. Fetch only three search fields for a SQL superset, then
      // apply the original JS match on the server before paging IDs in SQL.
      const fields = ["id","createdBy","seller"];
      const candidate = fields.map(column => {
        const value = `coalesce(o."${column}",'')`;
        return `(strpos(translate(${value},'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),$1)>0 OR octet_length(${value})<>length(${value}))`;
      }).join(" OR ");
      const searchRows = await currentTransaction().query<{ id: string; createdBy: string | null; seller: string | null }>(`SELECT o.id,o."createdBy",o.seller FROM stock_operational.orders o WHERE o."deletedAt" IS NULL AND (${candidate})`,[query]);
      matchingIds = searchRows.rows.filter(row => fields.some(field => toStringValue(row[field as keyof typeof row]).toLowerCase().includes(query))).map(row => row.id);
    }
    const result = await currentTransaction().query<{ total: string; page: string; ids: string[] }>(`
      WITH filtered AS MATERIALIZED (
        SELECT o.id,o."createdAt" FROM stock_operational.orders o
        WHERE o."deletedAt" IS NULL AND ${text("id")}<>'' AND ${text("status")}=ANY($6::text[])
          AND ($3::text[] IS NULL OR o.id=ANY($3::text[]))
          AND ($4::text='all' OR ($4='completed' AND ${text("status")}='complete') OR ($4='in-progress' AND ${text("status")}=ANY($7::text[])))
          AND ($5::text='all' OR ($5='linked' AND ${linked}) OR ($5='not-linked' AND NOT ${linked}))
      ), totals AS (SELECT count(*) AS total FROM filtered), paging AS (
        SELECT total,least($1::bigint,greatest(1,(total+$2::bigint-1)/$2::bigint)) AS page FROM totals
      ) SELECT total::text,page::text,coalesce((SELECT jsonb_agg(p.id ORDER BY p."createdAt" DESC NULLS LAST,p.id COLLATE "C" ASC) FROM (
        SELECT id,"createdAt" FROM filtered ORDER BY "createdAt" DESC NULLS LAST,id COLLATE "C" ASC LIMIT $2 OFFSET ((paging.page-1)*$2)
      ) p),'[]'::jsonb) AS ids FROM paging`,
      [input.page,input.pageSize,matchingIds,input.status,input.shipmentLink,Object.values(OrderStatus),[OrderStatus.Draft,OrderStatus.WaitingForBillImage,OrderStatus.WaitingForProductImage,OrderStatus.WaitingForTotalPrice]],
    );
    const { total, page, ids } = result.rows[0];
    const keys = ids.map(id => id.trim());
    const [orders, items, links] = ids.length ? await Promise.all([
      this.storage.orders.select('t.id=ANY($1::text[])',[ids],"descending"),
      this.storage.orderItems.select(`${trimmedSql('t."orderId"')}=ANY($1::text[])`,[keys]),
      this.storage.shipmentOrders.select(`${trimmedSql('t."orderId"')}=ANY($1::text[])`,[keys]),
    ]) : [[],[],[]];
    const images = groupProductImagesByOrderId(items), shipments = groupShipmentIdsByOrderId(links);
    return { orders: orders.map(mapOrderRow).filter((order): order is OrderListItem => !!order).map(order => ({...order,shipmentId:shipments.get(order.id) ?? null,productImages:images.get(order.id) ?? []})),total:Number(total),page:Number(page),pageSize:input.pageSize };
  }
}

function groupShipmentIdsByOrderId(
  rows: NativeRecord[],
): Map<string, string> {
  const shipmentIdsByOrderId = new Map<string, string>();

  for (const row of rows) {
    const { shipmentId, orderId, deletedAt } = row;
    const normalizedShipmentId = toStringValue(shipmentId);
    const normalizedOrderId = toStringValue(orderId);
    if (
      !normalizedShipmentId ||
      !normalizedOrderId ||
      toStringValue(deletedAt)
    ) {
      continue;
    }
    shipmentIdsByOrderId.set(normalizedOrderId, normalizedShipmentId);
  }

  return shipmentIdsByOrderId;
}

function groupProductImagesByOrderId(
  rows: NativeRecord[],
): Map<string, OrderProductImage[]> {
  const productImagesByOrderId = new Map<string, OrderProductImage[]>();

  for (const row of rows) {
    const productImage = mapOrderProductImageRow(row);
    if (!productImage) {
      continue;
    }

    const productImages = productImagesByOrderId.get(productImage.orderId) ?? [];
    productImages.push(productImage);
    productImagesByOrderId.set(productImage.orderId, productImages);
  }

  return productImagesByOrderId;
}
