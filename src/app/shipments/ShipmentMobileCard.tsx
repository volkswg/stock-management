"use client";

import {
  ArrowRightOutlined,
  DownOutlined,
  UpOutlined,
} from "@ant-design/icons";
import { Button, Card, Descriptions, Tag, Typography } from "antd";
import type {
  ShipmentListItem,
  ShipmentRelatedOrder,
} from "@/services/shipments";
import { OrderImageGallery } from "@/features/frontend/orders/components/OrderImageGallery";
import {
  formatShipmentCurrency,
  formatShipmentDate,
  formatShipmentStatus,
  getShipmentOrderStatusColor,
  getShipmentStatusColor,
} from "./shipmentListFormat";
import styles from "./shipments.module.css";

const { Text } = Typography;

export function ShipmentMobileCard({
  ordersExpanded,
  onOrdersExpandedChange,
  shipment,
}: {
  ordersExpanded: boolean;
  onOrdersExpandedChange: (expanded: boolean) => void;
  shipment: ShipmentListItem;
}) {
  return (
    <Card
      className={styles.mobileShipmentCard}
      title={<Text strong>{shipment.poNumber}</Text>}
      extra={
        <Tag color={getShipmentStatusColor(shipment.status)}>
          {formatShipmentStatus(shipment.status)}
        </Tag>
      }
    >
      <Descriptions
        className={styles.mobileShipmentDetails}
        colon={false}
        column={1}
        size="small"
      >
        <Descriptions.Item label="Carrier">
          {shipment.carrier || "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Orders">
          {shipment.orders.length}
        </Descriptions.Item>
        <Descriptions.Item label="Shipping fee">
          {formatShipmentCurrency(shipment.shippingFee)}
        </Descriptions.Item>
        <Descriptions.Item label="Quote avg./unit">
          {formatShipmentCurrency(
            shipment.costSummary?.quote?.averageLandedCostPerUnit,
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Delivered avg./unit">
          {formatShipmentCurrency(
            shipment.costSummary?.delivered?.averageLandedCostPerUnit,
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Created">
          {formatShipmentDate(shipment.createdAt)}
        </Descriptions.Item>
      </Descriptions>

      {shipment.orders.length > 0 ? (
        <section
          aria-label={`Orders linked to shipment ${shipment.poNumber}`}
          className={styles.mobileRelatedOrders}
        >
          <div className={styles.mobileRelatedOrdersHeader}>
            <Text className={styles.mobileShipmentSectionLabel} type="secondary">
              Related orders ({shipment.orders.length})
            </Text>
            <Button
              aria-expanded={ordersExpanded}
              icon={ordersExpanded ? <UpOutlined /> : <DownOutlined />}
              size="small"
              type="text"
              onClick={() => onOrdersExpandedChange(!ordersExpanded)}
            >
              {ordersExpanded ? "Collapse" : "Expand"}
            </Button>
          </div>
          {ordersExpanded
            ? shipment.orders.map((order) => (
                <ShipmentMobileOrder key={order.id} order={order} />
              ))
            : null}
        </section>
      ) : (
        <Text className={styles.mobileShipmentNoOrders} type="secondary">
          No linked orders
        </Text>
      )}

      <Button
        block
        href={`/shipments/${encodeURIComponent(shipment.id)}`}
        icon={<ArrowRightOutlined />}
        iconPlacement="end"
      >
        View shipment details
      </Button>
    </Card>
  );
}

function ShipmentMobileOrder({ order }: { order: ShipmentRelatedOrder }) {
  return (
    <article className={styles.mobileRelatedOrder}>
      <div className={styles.mobileRelatedOrderHeader}>
        <Text strong>{order.id}</Text>
        <Tag color={getShipmentOrderStatusColor(order.status)}>
          {formatShipmentStatus(order.status)}
        </Tag>
      </div>
      <Descriptions colon={false} column={1} size="small">
        <Descriptions.Item label="Seller">
          {order.seller || "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Total">
          {formatShipmentCurrency(order.totalPrice)}
        </Descriptions.Item>
        <Descriptions.Item label="Created">
          {formatShipmentDate(order.createdAt)}
        </Descriptions.Item>
      </Descriptions>
      {order.productImages.length > 0 ? (
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
          showLabels={false}
          thumbnailSize={64}
        />
      ) : null}
      <Button
        block
        href={`/orders/${encodeURIComponent(order.id)}`}
        size="small"
      >
        View order
      </Button>
    </article>
  );
}
