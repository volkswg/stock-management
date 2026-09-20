import { ArrowRightOutlined } from "@ant-design/icons";
import { Button, Card, Descriptions, Tag, Typography } from "antd";
import { OrderStatus, type OrderListItem } from "@/services/orders";
import { OrderImageGallery } from "./OrderImageGallery";
import {
  formatOrderDate,
  formatOrderStatus,
  formatOrderTotal,
} from "./orderListFormat";
import styles from "./orders.module.css";

const { Text } = Typography;

export function OrderMobileCard({ order }: { order: OrderListItem }) {
  return (
    <Card
      className={styles.mobileOrderCard}
      title={<Text strong>{order.id}</Text>}
      extra={
        <Tag color={getOrderStatusColor(order.status)}>
          {formatOrderStatus(order.status)}
        </Tag>
      }
    >
      <Descriptions
        className={styles.mobileOrderDetails}
        colon={false}
        column={1}
        size="small"
      >
        <Descriptions.Item label="Created">
          {formatOrderDate(order.createdAt)}
        </Descriptions.Item>
        <Descriptions.Item label="Seller">
          {order.seller || "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Shipment">
          <Tag color={order.shipmentId ? "success" : "default"}>
            {order.shipmentId ? "Linked" : "Not linked"}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Total">
          <Text strong>{formatOrderTotal(order.totalPrice)}</Text>
        </Descriptions.Item>
      </Descriptions>

      {order.productImages.length > 0 ? (
        <div className={styles.mobileOrderProducts}>
          <Text className={styles.mobileOrderSectionLabel} type="secondary">
            Products ({order.productImages.length})
          </Text>
          <OrderImageGallery
            ariaLabel={`Product images for order ${order.id}`}
            images={order.productImages.map((image, index) => ({
              id: image.id,
              imageUrl: image.imageUrl,
              title: `Product ${index + 1}`,
              description: image.quoteQuantity
                ? `Qty: ${image.quoteQuantity}`
                : undefined,
            }))}
            thumbnailSize={76}
          />
        </div>
      ) : (
        <Text className={styles.mobileOrderNoProducts} type="secondary">
          No product images
        </Text>
      )}

      <Button
        block
        href={`/orders/${encodeURIComponent(order.id)}`}
        icon={<ArrowRightOutlined />}
        iconPlacement="end"
      >
        View order details
      </Button>
    </Card>
  );
}

function getOrderStatusColor(status: OrderStatus): string {
  if (status === OrderStatus.Complete || status === OrderStatus.Delivered) {
    return "success";
  }
  if (status === OrderStatus.Canceled) return "error";
  if (status === OrderStatus.Draft) return "default";
  return "processing";
}
