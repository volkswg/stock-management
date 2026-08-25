"use client";

import {
  EyeOutlined,
  InboxOutlined,
  PlusOutlined,
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
  Tooltip,
  Typography,
  type TableProps,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import type { Key } from "react";
import { OrderStatus, type OrderListItem } from "@/services/orders";
import { getOrders } from "./api";
import { OrderImageGallery } from "./OrderImageGallery";
import styles from "./orders.module.css";

const { Text, Title } = Typography;
const PAGE_SIZE = 10;
const THB_FORMATTER = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COLUMNS: TableProps<OrderListItem>["columns"] = [
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    width: 190,
    render: (status: OrderStatus) => formatStatus(status),
  },
  {
    title: "Created",
    dataIndex: "createdAt",
    key: "createdAt",
    width: 170,
    render: (value: string) => formatDate(value),
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
  { label: "In progress", key: "in-progress" },
  { label: "Complete", key: "completed" },
];

export function OrderListPage() {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [requestId, setRequestId] = useState(0);
  const [expandedRowKeys, setExpandedRowKeys] = useState<Key[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    getOrders({ signal: controller.signal })
      .then((response) => {
        setOrders(response.orders);
        setExpandedRowKeys(
          response.orders
            .filter((order) => order.productImages.length > 0)
            .map((order) => order.id),
        );
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Failed to load orders.",
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

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesQuery =
        !normalizedQuery ||
        order.id.toLowerCase().includes(normalizedQuery) ||
        order.createdBy.toLowerCase().includes(normalizedQuery) ||
        order.seller.toLowerCase().includes(normalizedQuery);
      const matchesStatus =
        status === "all" ||
        (status === "in-progress" && isInProgress(order.status)) ||
        (status === "completed" && order.status === OrderStatus.Complete);
      return matchesQuery && matchesStatus;
    });
  }, [orders, query, status]);

  const visibleOrders = filteredOrders.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
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
          <header className={styles.pageHeader}>
            <div>
              <Text className={styles.eyebrow}>Order management</Text>
              <Title level={1}>Orders</Title>
              <Text type="secondary">
                Track incoming orders from creation through completion.
              </Text>
            </div>
            <Space className={styles.pageActions} wrap>
              <Button
                href="/orders/create"
                icon={<PlusOutlined />}
                type="primary"
              >
                Create order
              </Button>
              <Button href="/shipments" icon={<TruckOutlined />}>
                Shipments
              </Button>
            </Space>
          </header>

          <Card className={styles.orderList} styles={{ body: { padding: 0 } }}>
            <div className={styles.listToolbar}>
              <div>
                <Input
                  aria-label="Search orders"
                  allowClear
                  className={styles.searchInput}
                  prefix={<SearchOutlined />}
                  placeholder="Search by order ID or user"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
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

            <Table<OrderListItem>
              columns={COLUMNS}
              dataSource={visibleOrders}
              rowKey="id"
              loading={loading}
              pagination={false}
              scroll={{ x: 620 }}
              expandable={{
                expandedRowKeys,
                expandedRowRender: (order) => (
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
                  />
                ),
                onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]),
                rowExpandable: (order) => order.productImages.length > 0,
              }}
              locale={{
                emptyText: (
                  <Empty
                    image={<InboxOutlined className={styles.emptyIcon} />}
                    description={
                      <Space orientation="vertical" size={2}>
                        <Text strong>No orders yet</Text>
                        <Text type="secondary">
                          Orders created from LINE will appear here.
                        </Text>
                      </Space>
                    }
                  />
                ),
              }}
            />

            {error ? (
              <Alert
                className={styles.errorAlert}
                type="error"
                showIcon
                title="Orders could not be loaded"
                description={error}
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
              />
            ) : null}

            <div className={styles.pagination}>
              <Text type="secondary">
                Showing {visibleOrders.length} of {filteredOrders.length} orders
              </Text>
              <Pagination
                current={page}
                pageSize={PAGE_SIZE}
                total={filteredOrders.length}
                disabled={loading || filteredOrders.length === 0}
                showSizeChanger={false}
                onChange={setPage}
              />
            </div>
          </Card>
        </main>
      </div>
    </ConfigProvider>
  );
}

function isInProgress(status: OrderStatus): boolean {
  return (
    status === OrderStatus.Draft ||
    status === OrderStatus.WaitingForBillImage ||
    status === OrderStatus.WaitingForProductImage ||
    status === OrderStatus.WaitingForTotalPrice
  );
}

function formatStatus(status: OrderStatus): string {
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
