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
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  type TableProps,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import type { Key } from "react";
import { OrderStatus, type OrderListItem } from "@/modules/orders/contracts";
import { getOrders } from "./api";
import { OrderImageGallery } from "./OrderImageGallery";
import { OrderMobileCard } from "./OrderMobileCard";
import {
  formatOrderDate,
  formatOrderStatus,
  formatOrderTotal,
} from "./orderListFormat";
import styles from "./orders.module.css";

const { Text, Title } = Typography;
const PAGE_SIZE = 10;

function readPageFromUrl(): number {
  const value = new URL(window.location.href).searchParams.get("page");
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

function writePageToUrl(page: number): void {
  const url = new URL(window.location.href);
  if (page === 1) url.searchParams.delete("page");
  else url.searchParams.set("page", String(page));
  if (url.href !== window.location.href) {
    window.history.replaceState(window.history.state, "", url);
  }
}

type ShipmentLinkFilter = "all" | "linked" | "not-linked";

const COLUMNS: TableProps<OrderListItem>["columns"] = [
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    width: 190,
    render: (status: OrderStatus) => formatOrderStatus(status),
  },
  {
    title: "Created",
    dataIndex: "createdAt",
    key: "createdAt",
    width: 170,
    render: (value: string) => formatOrderDate(value),
  },
  {
    title: "Shipment",
    dataIndex: "shipmentId",
    key: "shipmentId",
    width: 130,
    render: (shipmentId: string | null) => (
      <Tag color={shipmentId ? "success" : "default"}>
        {shipmentId ? "Linked" : "Not linked"}
      </Tag>
    ),
  },
  {
    title: "Total",
    dataIndex: "totalPrice",
    key: "totalPrice",
    align: "right",
    width: 140,
    render: (value: number | null) => formatOrderTotal(value),
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
  const [shipmentLink, setShipmentLink] =
    useState<ShipmentLinkFilter>("all");
  const [page, setPage] = useState(1);
  const [requestId, setRequestId] = useState(0);
  const [expandedRowKeys, setExpandedRowKeys] = useState<Key[]>([]);

  useEffect(() => {
    const restorePage = () => setPage(readPageFromUrl());
    restorePage();
    window.addEventListener("popstate", restorePage);
    return () => window.removeEventListener("popstate", restorePage);
  }, []);

  const changePage = (value: number): void => {
    setPage(value);
    writePageToUrl(value);
  };

  useEffect(() => {
    const controller = new AbortController();

    getOrders({ signal: controller.signal })
      .then((response) => {
        setOrders(response.orders);
        setPage((current) => Math.min(
          current,
          Math.max(1, Math.ceil(response.orders.length / PAGE_SIZE)),
        ));
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
      const matchesShipmentLink =
        shipmentLink === "all" ||
        (shipmentLink === "linked" && Boolean(order.shipmentId)) ||
        (shipmentLink === "not-linked" && !order.shipmentId);
      return matchesQuery && matchesStatus && matchesShipmentLink;
    });
  }, [orders, query, shipmentLink, status]);

  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  useEffect(() => {
    if (!loading && !error) writePageToUrl(currentPage);
  }, [currentPage, error, loading, page]);

  const visibleOrders = filteredOrders.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
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
              <Input
                aria-label="Search orders"
                allowClear
                className={styles.searchInput}
                prefix={<SearchOutlined />}
                placeholder="Search by order ID or user"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  changePage(1);
                }}
              />
              <Select<ShipmentLinkFilter>
                aria-label="Filter orders by shipment link"
                className={styles.shipmentFilter}
                options={[
                  { label: "All shipments", value: "all" },
                  { label: "Linked", value: "linked" },
                  { label: "Not linked", value: "not-linked" },
                ]}
                value={shipmentLink}
                onChange={(value) => {
                  setShipmentLink(value);
                  changePage(1);
                }}
              />
            </div>

            <Tabs
              activeKey={status}
              className={styles.filterTabs}
              items={STATUS_FILTERS}
              onChange={(value) => {
                setStatus(value);
                changePage(1);
              }}
            />

            <div className={styles.desktopOrderTable}>
              <Table<OrderListItem>
                columns={COLUMNS}
                dataSource={visibleOrders}
                rowKey="id"
                loading={loading}
                pagination={false}
                scroll={{ x: 750 }}
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
                  emptyText: <OrderEmptyState />,
                }}
              />
            </div>

            <div className={styles.mobileOrderList}>
              {loading ? (
                Array.from({ length: 3 }, (_, index) => (
                  <Card loading key={index} />
                ))
              ) : visibleOrders.length > 0 ? (
                visibleOrders.map((order) => (
                  <OrderMobileCard key={order.id} order={order} />
                ))
              ) : (
                <OrderEmptyState />
              )}
            </div>

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
                current={currentPage}
                pageSize={PAGE_SIZE}
                total={filteredOrders.length}
                disabled={loading || filteredOrders.length === 0}
                showSizeChanger={false}
                onChange={changePage}
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

function OrderEmptyState() {
  return (
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
  );
}
