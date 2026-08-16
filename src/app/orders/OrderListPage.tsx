"use client";

import {
  InboxOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  ConfigProvider,
  Empty,
  Image,
  Input,
  Pagination,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Typography,
  type TableProps,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import type { Key } from "react";
import {
  OrderStatus,
  type OrderListItem,
  type OrderProductImage,
} from "@/services/orders";
import { getOrders } from "./api";
import styles from "./orders.module.css";

const { Text, Title } = Typography;
const PAGE_SIZE = 10;

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
      value === null ? "—" : `฿${value.toFixed(2)}`,
  },
];

const STATUS_OPTIONS = [
  { label: "All orders", value: "all" },
  { label: "In progress", value: "in-progress" },
  { label: "Completed", value: "completed" },
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
  const inProgressCount = orders.filter((order) =>
    isInProgress(order.status),
  ).length;
  const completedCount = orders.filter(
    (order) => order.status === OrderStatus.Complete,
  ).length;
  const totalValue = orders.reduce(
    (total, order) => total + (order.totalPrice ?? 0),
    0,
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
            <Text className={styles.eyebrow}>Order management</Text>
            <Title level={1}>Orders</Title>
            <Text type="secondary">
              Track incoming orders from creation through completion.
            </Text>
          </header>

          <Row className={styles.summary} gutter={[12, 12]}>
            <Col xs={12} lg={6}>
              <Card><Statistic title="All orders" value={orders.length} /></Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card><Statistic title="In progress" value={inProgressCount} /></Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card><Statistic title="Completed" value={completedCount} /></Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="Total value" value={totalValue} prefix="฿" precision={2} />
              </Card>
            </Col>
          </Row>

          <Card className={styles.orderList} styles={{ body: { padding: 0 } }}>
            <div className={styles.listToolbar}>
              <div>
                <Title level={2}>Order list</Title>
                <Text type="secondary">{filteredOrders.length} orders</Text>
              </div>

              <Space className={styles.filters} wrap>
                <Input
                  aria-label="Search orders"
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder="Search by order ID or user"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                />
                <Select
                  aria-label="Filter by status"
                  value={status}
                  options={STATUS_OPTIONS}
                  onChange={(value) => {
                    setStatus(value);
                    setPage(1);
                  }}
                />
              </Space>
            </div>

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
                  <ProductImageList images={order.productImages} />
                ),
                onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]),
                rowExpandable: (order) => order.productImages.length > 0,
              }}
              locale={{
                emptyText: (
                  <Empty
                    image={<InboxOutlined className={styles.emptyIcon} />}
                    description={
                      <Space direction="vertical" size={2}>
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
                message="Orders could not be loaded"
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

function ProductImageList({
  images,
}: {
  images: OrderProductImage[];
}) {
  if (images.length === 0) {
    return null;
  }

  return (
    <section className={styles.productImages} aria-label="Product images">
      {images.map((image, index) => (
        <a
          className={styles.productImageLink}
          href={image.imageUrl}
          key={image.id}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            alt={`Product image ${index + 1}`}
            height={96}
            preview={false}
            src={getGoogleDriveThumbnailUrl(image.imageUrl)}
            width={96}
          />
          <Text>Product image {index + 1}</Text>
          {image.createdAt ? (
            <Text type="secondary">{formatDate(image.createdAt)}</Text>
          ) : null}
        </a>
      ))}
    </section>
  );
}

function isInProgress(status: OrderStatus): boolean {
  return (
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

function getGoogleDriveThumbnailUrl(imageUrl: string): string {
  const fileIdMatch = imageUrl.match(/\/file\/d\/([^/]+)/);
  if (fileIdMatch?.[1]) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(
      fileIdMatch[1],
    )}&sz=w400`;
  }

  return imageUrl;
}
