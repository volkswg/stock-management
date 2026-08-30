"use client";

import {
  ArrowLeftOutlined,
  EyeOutlined,
  MinusSquareOutlined,
  PlusSquareOutlined,
  ReloadOutlined,
  SearchOutlined,
  TruckOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  ConfigProvider,
  Empty,
  Input,
  Pagination,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  type TableProps,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import type { Key } from "react";
import { OrderStatus } from "@/services/orders";
import {
  ShipmentStatus,
  type ShipmentListItem,
  type ShipmentRelatedOrder,
} from "@/services/shipments";
import { OrderImageGallery } from "../../features/frontend/orders/components/OrderImageGallery";
import { getShipments } from "./api";
import styles from "./shipments.module.css";

const { Text, Title } = Typography;
const PAGE_SIZE = 10;
const THB_FORMATTER = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COLUMNS: TableProps<ShipmentListItem>["columns"] = [
  {
    title: "PO number",
    dataIndex: "poNumber",
    key: "poNumber",
    width: 230,
    render: (value: string) => <Text strong>{value}</Text>,
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    width: 170,
    render: (status: ShipmentStatus) => (
      <Tag color={getStatusColor(status)}>{formatStatus(status)}</Tag>
    ),
  },
  {
    title: "Carrier",
    dataIndex: "carrier",
    key: "carrier",
    width: 190,
    render: (value: string) => value || "—",
  },
  {
    title: "Orders",
    key: "orders",
    align: "right",
    width: 90,
    render: (_, shipment) => shipment.orders.length,
  },
  {
    title: "Shipping fee",
    dataIndex: "shippingFee",
    key: "shippingFee",
    align: "right",
    width: 150,
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
    render: (_, shipment) => (
      <Button
        aria-label={`View shipment ${shipment.poNumber}`}
        href={`/shipments/${encodeURIComponent(shipment.id)}`}
        icon={<EyeOutlined />}
        type="text"
      />
    ),
  },
];

const RELATED_ORDER_COLUMNS: TableProps<ShipmentRelatedOrder>["columns"] = [
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    width: 190,
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
    key: "productImages",
    width: 240,
    render: (_, order) =>
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
    width: 150,
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

const STATUS_FILTERS = [
  { label: "All", key: "all" },
  { label: "Preparing", key: "preparing" },
  { label: "Shipping", key: ShipmentStatus.Shipping },
  { label: "Delivered", key: ShipmentStatus.Delivered },
  { label: "Canceled", key: ShipmentStatus.Canceled },
];

export function ShipmentListPage() {
  const [shipments, setShipments] = useState<ShipmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [requestId, setRequestId] = useState(0);
  const [expandedRowKeys, setExpandedRowKeys] = useState<Key[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    getShipments({ signal: controller.signal })
      .then((response) => {
        setShipments(response.shipments);
        setExpandedRowKeys(
          response.shipments
            .filter((shipment) => shipment.orders.length > 0)
            .map((shipment) => shipment.id),
        );
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Failed to load shipments.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [requestId]);

  const filteredShipments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return shipments.filter((shipment) => {
      const matchesQuery =
        !normalizedQuery ||
        shipment.poNumber.toLowerCase().includes(normalizedQuery) ||
        shipment.carrier.toLowerCase().includes(normalizedQuery) ||
        shipment.orders.some(
          (order) =>
            order.id.toLowerCase().includes(normalizedQuery) ||
            order.seller.toLowerCase().includes(normalizedQuery),
        );
      return matchesQuery && matchesStatusFilter(shipment.status, status);
    });
  }, [query, shipments, status]);

  const visibleShipments = filteredShipments.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  const expandableShipmentIds = filteredShipments
    .filter((shipment) => shipment.orders.length > 0)
    .map((shipment) => shipment.id);
  const allExpandableRowsExpanded =
    expandableShipmentIds.length > 0 &&
    expandableShipmentIds.every((id) => expandedRowKeys.includes(id));
  const hasExpandedRows = expandableShipmentIds.some((id) =>
    expandedRowKeys.includes(id),
  );

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
            href="/orders"
            icon={<ArrowLeftOutlined />}
            type="text"
          >
            Orders
          </Button>

          <header className={styles.pageHeader}>
            <Text className={styles.eyebrow}>Shipping management</Text>
            <Title level={1}>Shipments</Title>
            <Text type="secondary">
              Review shipment preparation and delivery progress.
            </Text>
          </header>

          <Card className={styles.shipmentList} styles={{ body: { padding: 0 } }}>
            <div className={styles.listToolbar}>
              <Input
                allowClear
                aria-label="Search shipments"
                className={styles.searchInput}
                placeholder="Search PO, carrier, or order"
                prefix={<SearchOutlined />}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
              <Space className={styles.expandActions} wrap>
                <Button
                  disabled={loading || allExpandableRowsExpanded}
                  icon={<PlusSquareOutlined />}
                  onClick={() =>
                    setExpandedRowKeys((current) => [
                      ...new Set([...current, ...expandableShipmentIds]),
                    ])
                  }
                >
                  Expand all
                </Button>
                <Button
                  disabled={loading || !hasExpandedRows}
                  icon={<MinusSquareOutlined />}
                  onClick={() => {
                    const filteredIdSet = new Set(expandableShipmentIds);
                    setExpandedRowKeys((current) =>
                      current.filter((key) => !filteredIdSet.has(String(key))),
                    );
                  }}
                >
                  Collapse all
                </Button>
              </Space>
            </div>

            <Tabs
              activeKey={status}
              className={styles.filterTabs}
              items={STATUS_FILTERS}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            />

            <Table<ShipmentListItem>
              columns={COLUMNS}
              dataSource={visibleShipments}
              loading={loading}
              pagination={false}
              rowKey="id"
              scroll={{ x: 1066 }}
              expandable={{
                expandedRowKeys,
                expandedRowRender: (shipment) => (
                  <RelatedOrdersTable
                    orders={shipment.orders}
                    poNumber={shipment.poNumber}
                  />
                ),
                onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]),
                rowExpandable: (shipment) => shipment.orders.length > 0,
              }}
              locale={{
                emptyText: (
                  <Empty
                    description={
                      <Space orientation="vertical" size={2}>
                        <Text strong>
                          {shipments.length === 0
                            ? "No shipments yet"
                            : "No matching shipments"}
                        </Text>
                        <Text type="secondary">
                          {shipments.length === 0
                            ? "Created shipment masters will appear here."
                            : "Adjust the search or status filter."}
                        </Text>
                      </Space>
                    }
                    image={<TruckOutlined className={styles.emptyIcon} />}
                  />
                ),
              }}
            />

            {error ? (
              <Alert
                action={
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => {
                      setLoading(true);
                      setError(undefined);
                      setRequestId((value) => value + 1);
                    }}
                  >
                    Retry
                  </Button>
                }
                className={styles.errorAlert}
                description={error}
                message="Shipments could not be loaded"
                showIcon
                type="error"
              />
            ) : null}

            <div className={styles.pagination}>
              <Text type="secondary">
                Showing {visibleShipments.length} of {filteredShipments.length}{" "}
                shipments
              </Text>
              <Pagination
                current={page}
                disabled={loading || filteredShipments.length === 0}
                pageSize={PAGE_SIZE}
                showSizeChanger={false}
                total={filteredShipments.length}
                onChange={setPage}
              />
            </div>
          </Card>
        </main>
      </div>
    </ConfigProvider>
  );
}

function RelatedOrdersTable({
  orders,
  poNumber,
}: {
  orders: ShipmentRelatedOrder[];
  poNumber: string;
}) {
  return (
    <section
      aria-label={`Orders linked to shipment ${poNumber}`}
      className={styles.relatedOrders}
    >
      <Table<ShipmentRelatedOrder>
        columns={RELATED_ORDER_COLUMNS}
        dataSource={orders}
        pagination={false}
        rowKey="id"
        scroll={{ x: 996 }}
        size="small"
      />
    </section>
  );
}

function matchesStatusFilter(
  shipmentStatus: ShipmentStatus,
  filter: string,
): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "preparing") {
    return (
      shipmentStatus === ShipmentStatus.Draft ||
      shipmentStatus === ShipmentStatus.ReadyToShip
    );
  }
  return shipmentStatus === filter;
}

function getStatusColor(status: ShipmentStatus): string {
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
