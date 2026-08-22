"use client";

import {
  ArrowLeftOutlined,
  FileImageOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Collapse,
  ConfigProvider,
  Descriptions,
  Divider,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Select,
  Skeleton,
  Tag,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { OrderStatus, type OrderDetail } from "@/services/orders";
import { getShipments } from "@/app/shipments/api";
import { getOrder } from "../api";
import { OrderImageGallery } from "../OrderImageGallery";
import styles from "./orderDetail.module.css";

const { Text, Title } = Typography;
const THB_FORMATTER = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function OrderDetailPage({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderDetail>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    getOrder(orderId, { signal: controller.signal })
      .then((response) => setOrder(response.order))
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Failed to load order.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [orderId, requestId]);

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
      }}
    >
      <div className={styles.appShell}>
        <main className={styles.content}>
          <Button
            className={styles.backButton}
            href="/orders"
            icon={<ArrowLeftOutlined />}
            type="text"
          >
            Orders
          </Button>

          {loading ? <OrderDetailLoading /> : null}
          {!loading && error ? (
            <OrderDetailError
              message={error}
              onRetry={() => {
                setError(undefined);
                setLoading(true);
                setRequestId((value) => value + 1);
              }}
            />
          ) : null}
          {!loading && !error && order ? <OrderContent order={order} /> : null}
        </main>
      </div>
    </ConfigProvider>
  );
}

function OrderContent({ order }: { order: OrderDetail }) {
  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <Text className={styles.eyebrow}>Order management</Text>
          <Title level={1}>Order details</Title>
          <Text className={styles.orderId} copyable={{ text: order.id }}>
            {order.id}
          </Text>
        </div>
        <Tag color={getStatusColor(order.status)}>
          {formatStatus(order.status)}
        </Tag>
      </header>

      <Card className={styles.informationCard} title="Order information">
        <Descriptions
          bordered
          column={{ xs: 1, md: 2 }}
          items={[
            {
              key: "seller",
              label: "Seller",
              children: order.seller || "—",
            },
            {
              key: "totalPrice",
              label: "Total",
              children:
                order.totalPrice === null
                  ? "—"
                  : THB_FORMATTER.format(order.totalPrice),
            },
            {
              key: "createdAt",
              label: "Created",
              children: formatDate(order.createdAt),
            },
            {
              key: "updatedAt",
              label: "Last updated",
              children: formatDate(order.updatedAt),
            },
            {
              key: "remark",
              label: "Remark",
              children: order.remark || "—",
              span: 2,
            },
          ]}
        />
      </Card>

      <ShipmentLinkCard orderId={order.id} />

      <Card className={styles.imageCard} styles={{ body: { padding: 0 } }}>
        <Collapse
          className={styles.imageCollapse}
          defaultActiveKey={["products"]}
          ghost
          items={[
            {
              key: "bills",
              label: (
                <ImageSectionLabel
                  count={order.billImages.length}
                  title="Bill images"
                />
              ),
              children:
                order.billImages.length > 0 ? (
                  <OrderImageGallery
                    ariaLabel="Bill images"
                    images={order.billImages.map((image, index) => ({
                      id: image.id,
                      imageUrl: image.imageUrl,
                      title: `Bill ${index + 1}`,
                    }))}
                    thumbnailSize={128}
                  />
                ) : (
                  <ImageEmptyState description="No bill images" />
                ),
            },
            {
              key: "products",
              label: (
                <ImageSectionLabel
                  count={order.productImages.length}
                  title="Product images"
                />
              ),
              children:
                order.productImages.length > 0 ? (
                  <OrderImageGallery
                    ariaLabel="Product images"
                    images={order.productImages.map((image, index) => ({
                      id: image.id,
                      imageUrl: image.imageUrl,
                      title: `Product ${index + 1}`,
                      description: image.quoteQuantity
                        ? `Qty: ${image.quoteQuantity}`
                        : undefined,
                    }))}
                    thumbnailSize={128}
                  />
                ) : (
                  <ImageEmptyState description="No product images" />
                ),
            },
          ]}
        />
      </Card>
    </>
  );
}

type ShipmentOption = {
  id: string;
  poNumber: string;
  carrier: string;
  isLocal?: boolean;
};

type NewShipmentFormValues = {
  poNumber: string;
  carrier?: string;
};

function ShipmentLinkCard({ orderId }: { orderId: string }) {
  const [form] = Form.useForm<NewShipmentFormValues>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [shipments, setShipments] = useState<ShipmentOption[]>([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(true);
  const [shipmentsError, setShipmentsError] = useState<string>();
  const [shipmentsRequestId, setShipmentsRequestId] = useState(0);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>();
  const [linkedShipmentId, setLinkedShipmentId] = useState<string>();
  const [selectOpen, setSelectOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const linkedShipment = shipments.find(
    (shipment) => shipment.id === linkedShipmentId,
  );

  useEffect(() => {
    const controller = new AbortController();

    getShipments({ signal: controller.signal })
      .then((response) => {
        const remoteShipments = response.shipments.map((shipment) => ({
          id: shipment.id,
          poNumber: shipment.poNumber,
          carrier: shipment.carrier,
        }));
        setShipments((current) => [
          ...current.filter((shipment) => shipment.isLocal),
          ...remoteShipments,
        ]);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setShipmentsError(
            requestError instanceof Error
              ? requestError.message
              : "Failed to load shipments.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setShipmentsLoading(false);
        }
      });

    return () => controller.abort();
  }, [shipmentsRequestId]);

  const createShipment = ({
    poNumber,
    carrier,
  }: NewShipmentFormValues): void => {
    const shipment: ShipmentOption = {
      id: createTemporaryShipmentId(),
      poNumber: poNumber.trim(),
      carrier: carrier?.trim() || "",
      isLocal: true,
    };
    setShipments((current) => [...current, shipment]);
    setSelectedShipmentId(shipment.id);
    setCreateModalOpen(false);
    form.resetFields();
    messageApi.success("Shipment master created.");
  };

  const linkOrder = (): void => {
    if (!selectedShipmentId) {
      return;
    }
    setLinkedShipmentId(selectedShipmentId);
    messageApi.success("Order linked to shipment.");
  };

  const openCreateShipmentModal = (): void => {
    form.setFieldsValue({
      poNumber: createTemporaryPoNumber(),
      carrier: "",
    });
    setSelectOpen(false);
    setCreateModalOpen(true);
  };

  return (
    <>
      {messageContextHolder}
      <Card className={styles.shipmentCard} title="Shipment">
        <div className={styles.shipmentStatus}>
          <Text type="secondary">Current shipment</Text>
          <Text strong>
            {linkedShipment
              ? formatShipmentLabel(linkedShipment)
              : "Not linked"}
          </Text>
        </div>

        <div className={styles.shipmentControls}>
          <Select
            aria-label="Select shipment"
            className={styles.shipmentSelect}
            loading={shipmentsLoading}
            open={selectOpen}
            optionFilterProp="label"
            options={shipments.map((shipment) => ({
              label: formatShipmentLabel(shipment),
              value: shipment.id,
            }))}
            placeholder="Select shipment"
            showSearch
            value={selectedShipmentId}
            notFoundContent={
              <Empty
                description="No shipments"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            }
            popupRender={(menu) => (
              <>
                {menu}
                <Divider className={styles.shipmentMenuDivider} />
                <Button
                  block
                  icon={<PlusOutlined />}
                  type="text"
                  onClick={openCreateShipmentModal}
                >
                  Create new shipment master
                </Button>
              </>
            )}
            onChange={setSelectedShipmentId}
            onOpenChange={setSelectOpen}
          />
          <Button
            disabled={
              !selectedShipmentId || selectedShipmentId === linkedShipmentId
            }
            icon={<LinkOutlined />}
            type="primary"
            onClick={linkOrder}
          >
            Link order
          </Button>
        </div>

        {shipmentsError ? (
          <Alert
            action={
              <Button
                icon={<ReloadOutlined />}
                size="small"
                onClick={() => {
                  setShipmentsError(undefined);
                  setShipmentsLoading(true);
                  setShipmentsRequestId((value) => value + 1);
                }}
              >
                Retry
              </Button>
            }
            className={styles.shipmentError}
            message={shipmentsError}
            showIcon
            type="error"
          />
        ) : null}
      </Card>

      <Modal
        destroyOnHidden
        okText="Create shipment"
        open={createModalOpen}
        title="Create shipment master"
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form<NewShipmentFormValues>
          form={form}
          layout="vertical"
          name={`create-shipment-${orderId}`}
          onFinish={createShipment}
        >
          <Form.Item
            label="PO number"
            name="poNumber"
            rules={[
              { required: true, whitespace: true, message: "Enter a PO number." },
            ]}
          >
            <Input autoFocus maxLength={100} placeholder="PO number" />
          </Form.Item>
          <Form.Item label="Carrier" name="carrier">
            <Input maxLength={100} placeholder="Carrier" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function createTemporaryShipmentId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `local-${crypto.randomUUID()}`;
  }
  return `local-${Date.now()}`;
}

function createTemporaryPoNumber(): string {
  const now = new Date();
  const date = [
    now.getFullYear(),
    padNumber(now.getMonth() + 1),
    padNumber(now.getDate()),
  ].join("");
  const time = [
    padNumber(now.getHours()),
    padNumber(now.getMinutes()),
    padNumber(now.getSeconds()),
  ].join("");
  const milliseconds = String(now.getMilliseconds()).padStart(3, "0");
  return `TEMP-${date}-${time}-${milliseconds}`;
}

function padNumber(value: number): string {
  return String(value).padStart(2, "0");
}

function formatShipmentLabel(shipment: ShipmentOption): string {
  return shipment.carrier
    ? `${shipment.poNumber} · ${shipment.carrier}`
    : shipment.poNumber;
}

function ImageSectionLabel({
  count,
  title,
}: {
  count: number;
  title: string;
}) {
  return (
    <div className={styles.sectionHeader}>
      <Title level={2}>{title}</Title>
      <Tag>{count}</Tag>
    </div>
  );
}

function ImageEmptyState({ description }: { description: string }) {
  return (
    <Empty
      className={styles.imageEmpty}
      description={description}
      image={<FileImageOutlined className={styles.emptyIcon} />}
    />
  );
}

function OrderDetailLoading() {
  return (
    <div className={styles.loading} aria-label="Loading order" aria-busy="true">
      <Skeleton active paragraph={{ rows: 1 }} title={{ width: 220 }} />
      <Card className={styles.informationCard}>
        <Skeleton active paragraph={{ rows: 4 }} title={false} />
      </Card>
    </div>
  );
}

function OrderDetailError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Alert
      action={
        <Button icon={<ReloadOutlined />} onClick={onRetry}>
          Retry
        </Button>
      }
      className={styles.errorAlert}
      description={message}
      message="Order could not be loaded"
      showIcon
      type="error"
    />
  );
}

function formatStatus(status: OrderStatus): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getStatusColor(status: OrderStatus): string {
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
