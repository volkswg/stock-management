"use client";
import { Alert, Button, Card, Space, Typography } from "antd";
import { useOrderProductLinks } from "./OrderProductLinkProvider";
import { OrderItemProductLink } from "./OrderItemProductLink";
import type { OrderProductPickerPort } from "./[id]/product-picker-port";
export function OrderAdditionalProductLinks({ orderId, visibleItemIds, picker }: { orderId: string;visibleItemIds: string[];picker: OrderProductPickerPort }) {
  const links = useOrderProductLinks(), visible = new Set(visibleItemIds), additional = links.items.filter(item => !visible.has(item.itemId));
  if (!links.error && !additional.length) return null;
  return <Card title={<Typography.Title level={4} style={{ margin: 0 }}>Other Order Item identities</Typography.Title>}>
    {links.error ? <Alert type="warning" title={links.error} action={<Button onClick={links.reload}>Retry identification</Button>} /> : null}
    <Space orientation="vertical" style={{ width: "100%" }}>{additional.map(item => <Card key={item.itemId} size="small">
      <Typography.Text style={{ overflowWrap: "anywhere" }}>{item.productCode || "No product code"} — Order Item {item.itemId}</Typography.Text>
      <OrderItemProductLink orderId={orderId} itemId={item.itemId} productCode={item.productCode} imageUrl={item.imageUrl} picker={picker} />
    </Card>)}</Space>
  </Card>;
}
