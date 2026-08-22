"use client";

import {
  ArrowLeftOutlined,
  CheckOutlined,
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
  InputNumber,
  message,
  Modal,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { OrderStatus, type OrderDetail } from "@/services/orders";
import {
  createShipmentMaster,
  getShipments,
  linkOrderToShipment,
} from "@/app/shipments/api";
import { getOrder, updateOrderPrice } from "../api";
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
          {!loading && !error && order ? (
            <OrderContent order={order} onOrderChange={setOrder} />
          ) : null}
        </main>
      </div>
    </ConfigProvider>
  );
}

function OrderContent({
  order,
  onOrderChange,
}: {
  order: OrderDetail;
  onOrderChange: (order: OrderDetail) => void;
}) {
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
              children: (
                <OrderTotalPrice
                  order={order}
                  onUpdated={({ status, totalPrice, updatedAt }) =>
                    onOrderChange({
                      ...order,
                      status,
                      totalPrice,
                      updatedAt,
                    })
                  }
                />
              ),
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

      <ShipmentLinkCard
        currentShipmentId={order.shipmentId ?? undefined}
        orderId={order.id}
      />

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

function OrderTotalPrice({
  order,
  onUpdated,
}: {
  order: OrderDetail;
  onUpdated: (update: {
    status: OrderStatus.Complete;
    totalPrice: number;
    updatedAt: string;
  }) => void;
}) {
  const [price, setPrice] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  if (order.status !== OrderStatus.WaitingForTotalPrice) {
    return order.totalPrice === null
      ? "—"
      : THB_FORMATTER.format(order.totalPrice);
  }

  const savePrice = async (): Promise<void> => {
    if (price === null) return;

    setSaving(true);
    setError(undefined);
    try {
      const response = await updateOrderPrice(order.id, price);
      onUpdated(response.order);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to update the price.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.priceEditor}>
      <Space.Compact className={styles.priceControls}>
        <InputNumber<number>
          aria-label="Total price"
          controls={false}
          min={0}
          placeholder="Total price"
          precision={2}
          prefix="฿"
          value={price}
          onChange={(value) => setPrice(value)}
          onPressEnter={() => void savePrice()}
        />
        <Button
          disabled={price === null}
          icon={<CheckOutlined />}
          loading={saving}
          type="primary"
          onClick={() => void savePrice()}
        >
          Save price
        </Button>
      </Space.Compact>
      {error ? <Text type="danger">{error}</Text> : null}
    </div>
  );
}

type ShipmentOption = {
  id: string;
  poNumber: string;
  carrier: string;
};

type NewShipmentFormValues = {
  poNumber: string;
  carrier?: string;
};

function ShipmentLinkCard({
  currentShipmentId,
  orderId,
}: {
  currentShipmentId?: string;
  orderId: string;
}) {
  const [form] = Form.useForm<NewShipmentFormValues>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [shipments, setShipments] = useState<ShipmentOption[]>([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(true);
  const [shipmentsError, setShipmentsError] = useState<string>();
  const [shipmentsRequestId, setShipmentsRequestId] = useState(0);
  const [shipmentCreating, setShipmentCreating] = useState(false);
  const [shipmentLinking, setShipmentLinking] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState<
    string | undefined
  >(currentShipmentId);
  const [linkedShipmentId, setLinkedShipmentId] = useState<string | undefined>(
    currentShipmentId,
  );
  const [selectOpen, setSelectOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const linkedShipment = shipments.find(
    (shipment) => shipment.id === linkedShipmentId,
  );

  useEffect(() => {
    const controller = new AbortController();

    getShipments({ includeOrders: false, signal: controller.signal })
      .then((response) => {
        const remoteShipments = response.shipments.map((shipment) => ({
          id: shipment.id,
          poNumber: shipment.poNumber,
          carrier: shipment.carrier,
        }));
        setShipments(remoteShipments);
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

  const handleCreateShipment = async ({
    poNumber,
    carrier,
  }: NewShipmentFormValues): Promise<void> => {
    setShipmentCreating(true);
    try {
      const response = await createShipmentMaster({ poNumber, carrier });
      const shipment: ShipmentOption = {
        id: response.shipment.id,
        poNumber: response.shipment.poNumber,
        carrier: response.shipment.carrier,
      };
      setShipments((current) => [
        shipment,
        ...current.filter((item) => item.id !== shipment.id),
      ]);
      setSelectedShipmentId(shipment.id);
      setCreateModalOpen(false);
      form.resetFields();
      messageApi.success("Shipment master created.");
    } catch (createError) {
      messageApi.error(
        createError instanceof Error
          ? createError.message
          : "Failed to create shipment.",
      );
    } finally {
      setShipmentCreating(false);
    }
  };

  const handleLinkOrder = async (): Promise<void> => {
    if (!selectedShipmentId) {
      return;
    }
    setShipmentLinking(true);
    try {
      await linkOrderToShipment(selectedShipmentId, orderId);
      setLinkedShipmentId(selectedShipmentId);
      messageApi.success("Order linked to shipment.");
    } catch (linkError) {
      messageApi.error(
        linkError instanceof Error
          ? linkError.message
          : "Failed to link order to shipment.",
      );
    } finally {
      setShipmentLinking(false);
    }
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
              : linkedShipmentId || "Not linked"}
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
            loading={shipmentLinking}
            type="primary"
            onClick={handleLinkOrder}
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
        cancelButtonProps={{ disabled: shipmentCreating }}
        closable={!shipmentCreating}
        confirmLoading={shipmentCreating}
        destroyOnHidden
        mask={{ closable: !shipmentCreating }}
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
          onFinish={handleCreateShipment}
        >
          <Form.Item
            label="PO number"
            name="poNumber"
            rules={[
              {
                required: true,
                whitespace: true,
                message: "Enter a PO number.",
              },
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

function ImageSectionLabel({ count, title }: { count: number; title: string }) {
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
