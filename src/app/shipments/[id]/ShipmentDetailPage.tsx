"use client";

import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  EyeOutlined,
  ReloadOutlined,
  TruckOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  ConfigProvider,
  Descriptions,
  Empty,
  Form,
  InputNumber,
  message,
  Modal,
  Skeleton,
  Space,
  Steps,
  Table,
  Tag,
  Typography,
  type TableProps,
} from "antd";
import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { OrderStatus } from "@/services/orders";
import {
  ShipmentStatus,
  type ShipmentListItem,
  type ShipmentRelatedOrder,
} from "@/services/shipments";
import { OrderImageGallery } from "@/features/frontend/orders/components/OrderImageGallery";
import { advanceShipmentStatus, getShipment } from "../api";
import styles from "./shipmentDetail.module.css";

const { Text, Title } = Typography;
const THB_FORMATTER = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type DeliveryFeeFormValues = {
  deliveryFee: number;
};

const ORDER_COLUMNS: TableProps<ShipmentRelatedOrder>["columns"] = [
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    width: 150,
    render: (status: OrderStatus) => (
      <Tag color={getOrderStatusColor(status)}>{formatStatus(status)}</Tag>
    ),
  },
  {
    title: "Seller",
    dataIndex: "seller",
    key: "seller",
    width: 180,
    render: (value: string) => value || "—",
  },
  {
    title: "Products",
    key: "products",
    width: 260,
    render: (_, order) =>
      order.productImages.length > 0 ? (
        <OrderImageGallery
          ariaLabel="Product images"
          images={order.productImages.map((image, index) => ({
            id: image.id,
            imageUrl: image.imageUrl,
            title: image.productCode || `Product ${index + 1}`,
            description: image.quoteQuantity
              ? `Qty: ${image.quoteQuantity}`
              : undefined,
          }))}
          showLabels={false}
          thumbnailSize={56}
        />
      ) : (
        "—"
      ),
  },
  {
    title: "Total",
    dataIndex: "totalPrice",
    key: "totalPrice",
    align: "right",
    width: 140,
    render: (value: number | null) =>
      value === null ? "—" : THB_FORMATTER.format(value),
  },
  {
    title: "Created",
    dataIndex: "createdAt",
    key: "createdAt",
    width: 180,
    render: (value: string) => formatDate(value),
  },
  {
    title: "",
    key: "action",
    align: "center",
    width: 56,
    render: (_, order) => (
      <Button
        aria-label="View order details"
        href={`/orders/${encodeURIComponent(order.id)}`}
        icon={<EyeOutlined />}
        type="text"
      />
    ),
  },
];

export function ShipmentDetailPage({ shipmentId }: { shipmentId: string }) {
  const [shipment, setShipment] = useState<ShipmentListItem>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    getShipment(shipmentId, { signal: controller.signal })
      .then((response) => setShipment(response.shipment))
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Failed to load shipment.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [requestId, shipmentId]);

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#157347",
          colorBgLayout: "#f3f5f4",
          colorBorderSecondary: "#e1e5e2",
          borderRadius: 6,
          fontFamily: "Arial, Helvetica, sans-serif",
        },
        components: {
          Table: {
            headerBg: "#f7f8f7",
            headerColor: "#66716b",
          },
        },
      }}
    >
      <div className={styles.appShell}>
        <main className={styles.content}>
          <Button
            className={styles.backButton}
            href="/shipments"
            icon={<ArrowLeftOutlined />}
            type="text"
          >
            Shipments
          </Button>

          {loading ? <DetailLoading /> : null}
          {!loading && error ? (
            <Alert
              action={
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    setError(undefined);
                    setLoading(true);
                    setRequestId((value) => value + 1);
                  }}
                >
                  Retry
                </Button>
              }
              description={error}
              message="Shipment could not be loaded"
              showIcon
              type="error"
            />
          ) : null}
          {!loading && !error && shipment ? (
            <ShipmentContent
              shipment={shipment}
              onShipmentChange={setShipment}
            />
          ) : null}
        </main>
      </div>
    </ConfigProvider>
  );
}

function ShipmentContent({
  shipment,
  onShipmentChange,
}: {
  shipment: ShipmentListItem;
  onShipmentChange: Dispatch<SetStateAction<ShipmentListItem | undefined>>;
}) {
  const [deliveryFeeForm] = Form.useForm<DeliveryFeeFormValues>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [deliveryFeeModalOpen, setDeliveryFeeModalOpen] = useState(false);
  const currentStep = getShipmentStep(shipment);
  const nextStatus = getNextShipmentStatus(shipment.status);
  const stepTitles = ["Draft", "Ready to ship", "Shipping", "Delivered"];

  const handleStatusUpdate = async (
    status: ShipmentStatus,
    deliveryFee?: number,
  ) => {
    setStatusUpdating(true);
    try {
      const response = await advanceShipmentStatus(
        shipment.id,
        status,
        deliveryFee,
      );
      onShipmentChange((current) =>
        current ? { ...current, ...response.shipment } : current,
      );
      setDeliveryFeeModalOpen(false);
      deliveryFeeForm.resetFields();
      messageApi.success(
        `Shipment status updated to ${formatStatus(status).toLowerCase()}.`,
      );
    } catch (updateError: unknown) {
      messageApi.error(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update shipment status.",
      );
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleAdvance = () => {
    if (!nextStatus) {
      return;
    }
    if (nextStatus === ShipmentStatus.Delivered) {
      deliveryFeeForm.setFieldValue(
        "deliveryFee",
        shipment.shippingFee ?? undefined,
      );
      setDeliveryFeeModalOpen(true);
      return;
    }
    void handleStatusUpdate(nextStatus);
  };

  return (
    <>
      {messageContextHolder}
      <header className={styles.pageHeader}>
        <div>
          <Text className={styles.eyebrow}>Shipment management</Text>
          <Title level={1}>{shipment.poNumber}</Title>
          <Text type="secondary">
            {shipment.carrier || "Carrier not assigned"}
          </Text>
        </div>
        <Space className={styles.statusActions} size={10} wrap>
          <Tag color={getShipmentStatusColor(shipment.status)}>
            {formatStatus(shipment.status)}
          </Tag>
          {nextStatus ? (
            <Button
              icon={
                nextStatus === ShipmentStatus.Delivered ? (
                  <CheckOutlined />
                ) : (
                  <ArrowRightOutlined />
                )
              }
              loading={statusUpdating}
              onClick={handleAdvance}
              type="primary"
            >
              {getShipmentActionLabel(nextStatus)}
            </Button>
          ) : null}
        </Space>
      </header>

      <nav aria-label="Shipment progress" className={styles.shipmentProgress}>
        <Steps
          current={currentStep}
          items={stepTitles.map((title, index) => ({
            title:
              shipment.status === ShipmentStatus.Canceled &&
              index === currentStep
                ? "Canceled"
                : title,
          }))}
          status={
            shipment.status === ShipmentStatus.Canceled ? "error" : "process"
          }
          size="small"
          type="panel"
        />
      </nav>

      <Card className={styles.informationCard} title="Shipment information">
        <Descriptions
          bordered
          column={{ xs: 1, md: 2 }}
          items={[
            {
              key: "carrier",
              label: "Carrier",
              children: shipment.carrier || "—",
            },
            {
              key: "shippingFee",
              label: "Delivery fee",
              children:
                shipment.shippingFee === null
                  ? "—"
                  : THB_FORMATTER.format(shipment.shippingFee),
            },
            {
              key: "shippedAt",
              label: "Shipped",
              children: formatDate(shipment.shippedAt),
            },
            {
              key: "deliveredAt",
              label: "Delivered",
              children: formatDate(shipment.deliveredAt),
            },
            {
              key: "createdAt",
              label: "Created",
              children: formatDate(shipment.createdAt),
            },
            {
              key: "updatedAt",
              label: "Last updated",
              children: formatDate(shipment.updatedAt),
            },
            {
              key: "createdBy",
              label: "Created by",
              children: shipment.createdBy || "—",
            },
            {
              key: "remark",
              label: "Remark",
              children: shipment.remark || "—",
              span: 2,
            },
          ]}
        />
      </Card>

      <Card
        className={styles.ordersCard}
        styles={{ body: { padding: 0 } }}
        title={
          <Space size={8}>
            <span>Linked orders</span>
            <Tag>{shipment.orders.length}</Tag>
          </Space>
        }
      >
        <Table<ShipmentRelatedOrder>
          columns={ORDER_COLUMNS}
          dataSource={shipment.orders}
          locale={{
            emptyText: (
              <Empty
                description="No orders are linked to this shipment"
                image={<TruckOutlined className={styles.emptyIcon} />}
              />
            ),
          }}
          pagination={false}
          rowKey="id"
          scroll={{ x: 966 }}
        />
      </Card>

      <Modal
        cancelButtonProps={{ disabled: statusUpdating }}
        closable={!statusUpdating}
        keyboard={!statusUpdating}
        maskClosable={!statusUpdating}
        okButtonProps={{ loading: statusUpdating }}
        okText="Mark delivered"
        open={deliveryFeeModalOpen}
        title="Complete delivery"
        onCancel={() => {
          setDeliveryFeeModalOpen(false);
          deliveryFeeForm.resetFields();
        }}
        onOk={() => deliveryFeeForm.submit()}
      >
        <Form<DeliveryFeeFormValues>
          form={deliveryFeeForm}
          layout="vertical"
          onFinish={({ deliveryFee }) =>
            void handleStatusUpdate(ShipmentStatus.Delivered, deliveryFee)
          }
        >
          <Form.Item
            label="Delivery fee"
            name="deliveryFee"
            rules={[{ required: true, message: "Enter the delivery fee." }]}
          >
            <InputNumber<number>
              className={styles.deliveryFeeInput}
              max={1_000_000_000}
              min={0}
              placeholder="0.00"
              precision={2}
              prefix="฿"
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function DetailLoading() {
  return (
    <div aria-busy="true" aria-label="Loading shipment details">
      <Skeleton active paragraph={{ rows: 1 }} title={{ width: 260 }} />
      <Card className={styles.informationCard}>
        <Skeleton active paragraph={{ rows: 5 }} title={false} />
      </Card>
    </div>
  );
}

function getShipmentStatusColor(status: ShipmentStatus): string {
  switch (status) {
    case ShipmentStatus.ReadyToShip:
      return "warning";
    case ShipmentStatus.Shipping:
      return "processing";
    case ShipmentStatus.Delivered:
      return "success";
    case ShipmentStatus.Canceled:
      return "error";
    default:
      return "default";
  }
}

function getShipmentStep(shipment: ShipmentListItem): number {
  switch (shipment.status) {
    case ShipmentStatus.ReadyToShip:
      return 1;
    case ShipmentStatus.Shipping:
      return 2;
    case ShipmentStatus.Delivered:
      return 3;
    case ShipmentStatus.Canceled:
      return shipment.shippedAt ? 2 : 1;
    default:
      return 0;
  }
}

function getNextShipmentStatus(
  status: ShipmentStatus,
): ShipmentStatus | undefined {
  switch (status) {
    case ShipmentStatus.Draft:
      return ShipmentStatus.ReadyToShip;
    case ShipmentStatus.ReadyToShip:
      return ShipmentStatus.Shipping;
    case ShipmentStatus.Shipping:
      return ShipmentStatus.Delivered;
    default:
      return undefined;
  }
}

function getShipmentActionLabel(status: ShipmentStatus): string {
  switch (status) {
    case ShipmentStatus.ReadyToShip:
      return "Mark ready to ship";
    case ShipmentStatus.Shipping:
      return "Start shipping";
    case ShipmentStatus.Delivered:
      return "Mark delivered";
    default:
      return "Update status";
  }
}

function getOrderStatusColor(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.Complete:
    case OrderStatus.Delivered:
      return "success";
    case OrderStatus.Canceled:
      return "error";
    case OrderStatus.Paid:
    case OrderStatus.Shipped:
      return "processing";
    default:
      return "warning";
  }
}

function formatStatus(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(value: string): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
