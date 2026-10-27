"use client";

import {
  ArrowLeftOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  EditOutlined,
  FileImageOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Badge,
  Button,
  Card,
  Collapse,
  Col,
  ConfigProvider,
  Descriptions,
  Divider,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Row,
  Segmented,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  OrderItemQuantityType,
  OrderStatus,
  type OrderDetail,
} from "@/services/orders";
import { ShipmentStatus, type Shipment } from "@/services/shipments";
import {
  createShipmentMaster,
  getShipments,
  linkOrderToShipment,
} from "@/app/shipments/api";
import {
  getOrder,
  updateOrderProducts,
  replaceOrderProductImage,
  updateOrderDetails,
  type UpdateOrderDetailsResponse,
} from "../api";
import { OrderImageGallery } from "@/features/frontend/orders/components/OrderImageGallery";
import { OrderProductImageUpload } from "@/features/frontend/orders/components/OrderProductImageUpload";
import { OrderProductImageActions } from "@/features/frontend/orders/components/OrderProductImageActions";
import { OrderQuantityStatus } from "@/features/frontend/orders/components/OrderQuantityStatus";
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

type ProductImageDraft = {
  productCode?: string;
  quoteQuantity?: number | null;
  deliveredQuantity?: number | null;
};

function OrderContent({
  order,
  onOrderChange,
}: {
  order: OrderDetail;
  onOrderChange: Dispatch<SetStateAction<OrderDetail | undefined>>;
}) {
  const [quantityType, setQuantityType] = useState<OrderItemQuantityType>(
    OrderItemQuantityType.Quote,
  );
  const [productDrafts, setProductDrafts] = useState<
    Record<string, ProductImageDraft>
  >({});
  const [savingProducts, setSavingProducts] = useState(false);
  const [productSaveError, setProductSaveError] = useState<string>();
  const [productMessageApi, productMessageContext] = message.useMessage({
    top: 24,
    maxCount: 1,
    duration: 3,
    pauseOnHover: false,
  });
  const productChanges = order.productImages.flatMap((image) => {
    const draft = productDrafts[image.id];
    if (!draft) return [];
    const changes: ProductImageDraft = {};
    if (
      draft.productCode !== undefined &&
      draft.productCode.trim() !== image.productCode
    ) {
      changes.productCode = draft.productCode.trim();
    }
    for (const field of ["quoteQuantity", "deliveredQuantity"] as const) {
      if (
        draft[field] !== undefined &&
        draft[field] !== parseQuantity(image[field])
      ) {
        changes[field] = draft[field];
      }
    }
    return Object.keys(changes).length > 0 ? [{ image, changes }] : [];
  });
  const invalidProductChanges = productChanges.some(({ changes }) =>
    [changes.quoteQuantity, changes.deliveredQuantity].some(
      (quantity) =>
        quantity !== undefined &&
        (quantity === null || !Number.isInteger(quantity) || quantity <= 0),
    ),
  );
  const dirtyProductFields = new Map(
    productChanges.map(({ image, changes }) => [image.id, changes]),
  );

  const updateProductDraft = (itemId: string, update: ProductImageDraft): void => {
    setProductDrafts((current) => ({
      ...current,
      [itemId]: { ...current[itemId], ...update },
    }));
    setProductSaveError(undefined);
  };

  const getProductQuantity = (
    image: OrderDetail["productImages"][number],
    type: OrderItemQuantityType,
  ): number | null => {
    const field = type === OrderItemQuantityType.Quote
      ? "quoteQuantity" : "deliveredQuantity";
    const draft = productDrafts[image.id]?.[field];
    return draft !== undefined ? draft : parseQuantity(image[field]);
  };

  const quoteQuantities = order.productImages.map((image) =>
    getProductQuantity(image, OrderItemQuantityType.Quote),
  );
  const totalQuoteQuantity = quoteQuantities.length > 0 &&
    quoteQuantities.every((quantity) =>
      quantity !== null && Number.isInteger(quantity) && quantity > 0,
    )
      ? quoteQuantities.reduce<number>((total, quantity) => total + (quantity ?? 0), 0)
      : null;
  const averageQuotePrice = order.totalPrice !== null &&
    Number.isFinite(order.totalPrice) &&
    totalQuoteQuantity !== null &&
    Number.isFinite(totalQuoteQuantity) && totalQuoteQuantity > 0
      ? order.totalPrice / totalQuoteQuantity
      : null;
  const quotePriceIsDraft = productChanges.some(
    ({ changes }) => changes.quoteQuantity !== undefined,
  );

  const saveProducts = async (): Promise<void> => {
    if (savingProducts || productChanges.length === 0 || invalidProductChanges) return;
    setSavingProducts(true);
    setProductSaveError(undefined);
    try {
      const items = productChanges.map(({ image, changes }) => ({
        id: image.id,
        ...(changes.productCode !== undefined ? { productCode: changes.productCode } : {}),
        ...(changes.quoteQuantity !== undefined && changes.quoteQuantity !== null
          ? { quoteQuantity: changes.quoteQuantity } : {}),
        ...(changes.deliveredQuantity !== undefined && changes.deliveredQuantity !== null
          ? { deliveredQuantity: changes.deliveredQuantity } : {}),
      }));
      const response = await updateOrderProducts(order.id, items);
      const updates = new Map(response.items.map((item) => [item.id, item]));
      onOrderChange((current) => current
        ? {
            ...current,
            productImages: current.productImages.map((item) => {
              const update = updates.get(item.id);
              return update ? { ...item, ...update } : item;
            }),
          }
        : current,
      );
      setProductDrafts({});
      const key = "product-save-success";
      const dismiss = () => productMessageApi.destroy(key);
      productMessageApi.success({
        key,
        duration: 3,
        pauseOnHover: false,
        content: (
          <Button type="text" size="small" onClick={dismiss}>
            Product changes saved.
          </Button>
        ),
        onClick: dismiss,
        style: { cursor: "pointer" },
      });
    } catch (saveError) {
      setProductSaveError(
        saveError instanceof Error ? saveError.message : "Failed to save product changes. Your edits are kept; try saving again.",
      );
    } finally {
      setSavingProducts(false);
    }
  };
  const handleDetailsUpdated = (
    update: UpdateOrderDetailsResponse["order"],
  ) =>
    onOrderChange((current) =>
      current
        ? {
            ...current,
            status: update.status,
            totalPrice: update.totalPrice,
            remark: update.remark,
            updatedAt: update.updatedAt,
          }
        : current,
    );

  return (
    <>
      {productMessageContext}
      <header className={styles.pageHeader}>
        <div>
          <Text className={styles.eyebrow}>Order management</Text>
          <Title level={1}>Order details</Title>
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
                  onUpdated={handleDetailsUpdated}
                />
              ),
            },
            {
              key: "averageQuotePrice",
              label: "Avg quote price",
              span: 2,
              children: averageQuotePrice === null ? (
                <Text type="secondary">—</Text>
              ) : (
                <Space wrap>
                  <Text>{THB_FORMATTER.format(averageQuotePrice)} / piece</Text>
                  {quotePriceIsDraft ? <Tag color="warning">Unsaved</Tag> : null}
                </Space>
              ),
            },
          ]}
        />
        <Row className={styles.orderTimestamps} gutter={[32, 16]}>
          <Col xs={24} sm={12}>
            <div className={styles.orderTimestamp}>
              <span className={styles.timestampIcon} aria-hidden="true"><CalendarOutlined /></span>
              <div className={styles.timestampContent}>
                <Text type="secondary">Created</Text>
                <Text>{formatDate(order.createdAt)}</Text>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12} className={styles.updatedTimestamp}>
            <div className={styles.orderTimestamp}>
              <span className={styles.timestampIcon} aria-hidden="true"><ClockCircleOutlined /></span>
              <div className={styles.timestampContent}>
                <Text type="secondary">Last updated</Text>
                <Text>{formatDate(order.updatedAt)}</Text>
              </div>
            </div>
          </Col>
        </Row>
        <div className={styles.orderRemarkSection}>
          <OrderRemark order={order} onUpdated={handleDetailsUpdated} />
        </div>
      </Card>

      <ShipmentLinkCard
        key={`${order.id}:${order.shipmentId ?? ""}`}
        currentShipmentId={order.shipmentId ?? undefined}
        currentShipment={order.shipment ?? undefined}
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
              className: styles.productImageSection,
              label: (
                <ImageSectionLabel
                  count={order.productImages.length}
                  title="Product images"
                />
              ),
              extra: (
                <div
                  className={styles.imageHeaderActions}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <Space wrap>
                    <Text
                      type="secondary"
                      aria-hidden={productChanges.length === 0}
                      style={{ visibility: productChanges.length > 0 ? "visible" : "hidden" }}
                    >
                      Unsaved
                    </Text>
                    <OrderProductImageUpload
                      orderId={order.id}
                      onUploaded={(image) =>
                        onOrderChange((current) =>
                          current
                            ? {
                                ...current,
                                productImages: [...current.productImages, image],
                              }
                            : current,
                        )
                      }
                    />
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      loading={savingProducts}
                      disabled={productChanges.length === 0 || invalidProductChanges}
                      onClick={() => void saveProducts()}
                    >
                      Save
                    </Button>
                  </Space>
                </div>
              ),
              children: (
                <>
                  {invalidProductChanges ? (
                    <Alert type="error" showIcon title="Enter positive whole numbers for all changed quantities, including the other quantity tab." style={{ marginBottom: 16 }} />
                  ) : null}
                  {productSaveError ? (
                    <Alert type="error" showIcon title={productSaveError} style={{ marginBottom: 16 }} />
                  ) : null}
                  {order.productImages.length > 0 ? (
                    <>
                      <div className={styles.quantityToolbar}>
                        <Segmented<OrderItemQuantityType>
                          className={styles.quantityMode}
                          options={[
                            {
                              label: (
                                <span>
                                  Quote
                                  <ProductDirtyIndicator dirty={productChanges.some(
                                    ({ changes }) => changes.quoteQuantity !== undefined,
                                  )} />
                                </span>
                              ),
                              value: OrderItemQuantityType.Quote,
                            },
                            {
                              label: (
                                <span>
                                  Delivered
                                  <ProductDirtyIndicator dirty={productChanges.some(
                                    ({ changes }) => changes.deliveredQuantity !== undefined,
                                  )} />
                                </span>
                              ),
                              value: OrderItemQuantityType.Delivered,
                            },
                          ]}
                          value={quantityType}
                          disabled={savingProducts}
                          onChange={setQuantityType}
                        />
                      </div>
                      <OrderImageGallery
                        ariaLabel="Product images"
                        variant="card"
                        images={order.productImages.map((image, index) => ({
                          id: image.id,
                          imageUrl: image.imageUrl,
                          title: image.productCode || `Product ${index + 1}`,
                          sequenceNumber: index + 1,
                          actions: (
                            <OrderProductImageActions
                              productNumber={index + 1}
                              disabled={savingProducts}
                              onReplace={async (file) => {
                                const response = await replaceOrderProductImage(
                                  order.id, image.id, file,
                                );
                                onOrderChange((current) => current
                                  ? {
                                      ...current,
                                      productImages: current.productImages.map((item) =>
                                        item.id === image.id
                                          ? { ...item, imageUrl: response.item.imageUrl }
                                          : item,
                                      ),
                                    }
                                  : current,
                                );
                              }}
                            />
                          ),
                          details: (
                            <div className={styles.itemEditors}>
                              <OrderItemProductCode
                                productCode={productDrafts[image.id]?.productCode ?? image.productCode}
                                dirty={dirtyProductFields.get(image.id)?.productCode !== undefined}
                                disabled={savingProducts}
                                onChange={(productCode) => updateProductDraft(image.id, { productCode })}
                              />
                              <OrderItemQuantity
                                quantity={getProductQuantity(image, quantityType)}
                                quantityType={quantityType}
                                dirty={dirtyProductFields.get(image.id)?.[
                                  quantityType === OrderItemQuantityType.Quote
                                    ? "quoteQuantity" : "deliveredQuantity"
                                ] !== undefined}
                                disabled={savingProducts}
                                onChange={(quantity) => updateProductDraft(image.id,
                                  quantityType === OrderItemQuantityType.Quote
                                    ? { quoteQuantity: quantity }
                                    : { deliveredQuantity: quantity },
                                )}
                              />
                              <OrderQuantityStatus
                                deliveredQuantity={getProductQuantity(image, OrderItemQuantityType.Delivered)}
                                quoteQuantity={getProductQuantity(image, OrderItemQuantityType.Quote)}
                              />
                            </div>
                          ),
                        }))}
                        thumbnailSize={128}
                      />
                    </>
                  ) : (
                    <ImageEmptyState description="No product images" />
                  )}
                </>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}

function ProductDirtyIndicator({ dirty }: { dirty: boolean }) {
  return (
    <span
      className={styles.productDirtyIndicator}
      aria-hidden={!dirty}
      style={{ visibility: dirty ? "visible" : "hidden" }}
    >
      <Badge status="warning" role="img" aria-label="Unsaved changes" title="Unsaved changes" />
    </span>
  );
}

function OrderItemProductCode({
  productCode,
  dirty,
  disabled,
  onChange,
}: {
  productCode: string;
  dirty: boolean;
  disabled: boolean;
  onChange: (productCode: string) => void;
}) {
  return (
    <div className={styles.productCodeEditor}>
      <Text className={styles.quantityLabel} type="secondary">
        Product code
        <ProductDirtyIndicator dirty={dirty} />
      </Text>
      <Input
        aria-label="Product code"
        maxLength={100}
        placeholder="Product code"
        value={productCode}
        status={dirty ? "warning" : undefined}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function OrderItemQuantity({
  quantity,
  quantityType,
  dirty,
  disabled,
  onChange,
}: {
  quantity: number | null;
  quantityType: OrderItemQuantityType;
  dirty: boolean;
  disabled: boolean;
  onChange: (quantity: number | null) => void;
}) {
  const quantityLabel = quantityType === OrderItemQuantityType.Quote
    ? "Quote" : "Deliver";

  return (
    <div className={styles.quantityEditor}>
      <Text className={styles.quantityLabel} type="secondary">
        {quantityLabel}
        <ProductDirtyIndicator dirty={dirty} />
      </Text>
      <InputNumber<number>
        aria-label={quantityLabel}
        className={styles.quantityControls}
        controls={false}
        min={1}
        placeholder="Quantity"
        precision={0}
        value={quantity}
        status={dirty ? "warning" : undefined}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}

function parseQuantity(value: string): number | null {
  if (!value.trim()) return null;

  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : null;
}

function OrderTotalPrice({
  order,
  onUpdated,
}: {
  order: OrderDetail;
  onUpdated: (update: UpdateOrderDetailsResponse["order"]) => void;
}) {
  const [price, setPrice] = useState<number | null>(order.totalPrice);
  const [editing, setEditing] = useState(order.totalPrice === null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const savePrice = async (): Promise<void> => {
    if (price === null) return;

    setSaving(true);
    setError(undefined);
    try {
      const response = await updateOrderDetails(order.id, {
        totalPrice: price,
      });
      setPrice(response.order.totalPrice);
      setEditing(false);
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

  if (!editing && order.totalPrice !== null) {
    return (
      <div className={styles.fieldDisplay}>
        <Text>{THB_FORMATTER.format(order.totalPrice)}</Text>
        <Button
          aria-label="Edit total price"
          icon={<EditOutlined />}
          type="text"
          onClick={() => setEditing(true)}
        />
      </div>
    );
  }

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
          aria-label="Save total price"
          disabled={price === null || price === order.totalPrice}
          icon={<SaveOutlined />}
          loading={saving}
          type="primary"
          onClick={() => void savePrice()}
        />
        {order.totalPrice !== null ? (
          <Button
            aria-label="Cancel total price edit"
            disabled={saving}
            icon={<CloseOutlined />}
            onClick={() => {
              setPrice(order.totalPrice);
              setError(undefined);
              setEditing(false);
            }}
          />
        ) : null}
      </Space.Compact>
      {error ? <Text type="danger">{error}</Text> : null}
    </div>
  );
}

function OrderRemark({
  order,
  onUpdated,
}: {
  order: OrderDetail;
  onUpdated: (update: UpdateOrderDetailsResponse["order"]) => void;
}) {
  const [remark, setRemark] = useState(order.remark);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const saveRemark = async (): Promise<void> => {
    setSaving(true);
    setError(undefined);
    try {
      const response = await updateOrderDetails(order.id, { remark });
      setRemark(response.order.remark);
      onUpdated(response.order);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to update the remark.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.remarkEditor}>
      <label htmlFor="order-remark"><Text type="secondary">Remark</Text></label>
      <Input.TextArea
        id="order-remark"
        aria-label="Order remark"
        aria-describedby="order-remark-count"
        disabled={saving}
        autoSize={{ minRows: 2, maxRows: 6 }}
        maxLength={1000}
        placeholder="Order remark"
        value={remark}
        onChange={(event) => setRemark(event.target.value)}
      />
      <div className={styles.remarkActions}>
        <Text type="secondary" id="order-remark-count">{remark.length} / 1000</Text>
        <Button
          aria-label="Save remark"
          disabled={remark.trim() === order.remark}
          icon={<SaveOutlined />}
          loading={saving}
          onClick={() => void saveRemark()}
        />
      </div>
      {error ? <Text type="danger">{error}</Text> : null}
    </div>
  );
}

type ShipmentOption = {
  id: string;
  poNumber: string;
  carrier: string;
  status: ShipmentStatus;
};

type NewShipmentFormValues = {
  poNumber: string;
  carrier?: string;
};

function ShipmentLinkCard({
  currentShipment,
  currentShipmentId,
  orderId,
}: {
  currentShipment?: Shipment;
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

    getShipments({
      excludeStatuses: [
        ShipmentStatus.Shipping,
        ShipmentStatus.Delivered,
        ShipmentStatus.Canceled,
      ],
      includeOrders: false,
      signal: controller.signal,
    })
      .then((response) => {
        const remoteShipments = response.shipments.map((shipment) => ({
          id: shipment.id,
          poNumber: shipment.poNumber,
          carrier: shipment.carrier,
          status: shipment.status,
        }));
        setShipments(
          currentShipment
            ? [
                mapShipmentToOption(currentShipment),
                ...remoteShipments.filter(
                  (shipment) => shipment.id !== currentShipment.id,
                ),
              ]
            : remoteShipments,
        );
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
  }, [currentShipment, shipmentsRequestId]);

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
        status: response.shipment.status,
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
            title={shipmentsError}
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

function mapShipmentToOption(shipment: Shipment): ShipmentOption {
  return {
    id: shipment.id,
    poNumber: shipment.poNumber,
    carrier: shipment.carrier,
    status: shipment.status,
  };
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
      title="Order could not be loaded"
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
