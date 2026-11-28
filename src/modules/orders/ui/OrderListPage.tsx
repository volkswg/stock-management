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
import { useEffect, useState } from "react";
import type { Key } from "react";
import type { OrderStatus, OrderListQuery, OrderListItem, OrderListPageResult } from "@/modules/orders/contracts";
import { getOrderPage } from "./api";
import { OrderImageGallery } from "./OrderImageGallery";
import { OrderMobileCard } from "./OrderMobileCard";
import {
  formatOrderDate,
  formatOrderStatus,
  formatOrderTotal,
} from "./orderListFormat";
import styles from "./orders.module.css";

const { Text, Title } = Typography;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function readPageFromUrl(): number {
  const value = new URL(window.location.href).searchParams.get("page");
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

function readPageSizeFromUrl(): number {
  const value = new URL(window.location.href).searchParams.get("pageSize");
  return PAGE_SIZE_OPTIONS.find((size) => String(size) === value) ?? 10;
}

function writePaginationToUrl(page: number, pageSize: number): void {
  const url = new URL(window.location.href);
  if (page === 1) url.searchParams.delete("page");
  else url.searchParams.set("page", String(page));
  if (pageSize === 10) url.searchParams.delete("pageSize");
  else url.searchParams.set("pageSize", String(pageSize));
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
  const [result, setResult] = useState<OrderListPageResult & {requestKey: string; error?: string}>();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OrderListQuery["status"]>("all");
  const [shipmentLink, setShipmentLink] =
    useState<ShipmentLinkFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [requestId, setRequestId] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [search, setSearch] = useState("");
  const requestKey = JSON.stringify([page,pageSize,search,status,shipmentLink,requestId]);
  const current = query === search && result?.requestKey === requestKey ? result : undefined;
  const loading = current === undefined;
  const error = current?.error;
  const total = current?.total ?? 0;
  const currentPage = current?.page ?? page;
  const visibleOrders = current?.orders ?? [];
  const [expandedRowKeys, setExpandedRowKeys] = useState<Key[]>([]);

  useEffect(() => {
    const restorePage = () => {
      setPage(readPageFromUrl());
      setPageSize(readPageSizeFromUrl());
      setInitialized(true);
    };
    restorePage();
    window.addEventListener("popstate", restorePage);
    return () => window.removeEventListener("popstate", restorePage);
  }, []);

  const changePage = (value: number, nextPageSize = pageSize): void => {
    setPage(value);
    writePaginationToUrl(value, nextPageSize);
  };

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!initialized || query !== search) return;
    const controller = new AbortController();
    let active = true;
    getOrderPage({page,pageSize,query:search,status,shipmentLink},controller.signal)
      .then((response) => {
        if (!active) return;
        setResult({...response,requestKey});
        writePaginationToUrl(response.page,pageSize);
        setExpandedRowKeys(response.orders.filter(order => order.productImages.length > 0).map(order => order.id));
      })
      .catch((requestError: unknown) => {
        if (active) setResult({requestKey,orders:[],total:0,page,pageSize,error:requestError instanceof Error ? requestError.message : "Failed to load orders."});
      });
    return () => { active = false; controller.abort(); };
  }, [initialized,page,pageSize,query,search,status,shipmentLink,requestId,requestKey]);

  const renderPagination = (label: string) => (
    <nav aria-label={label} className={styles.pagination}>
      <Text type="secondary">
        Showing {visibleOrders.length} of {total} orders
      </Text>
      <Pagination
        current={currentPage}
        pageSize={pageSize}
        total={total}
        disabled={loading || total === 0}
        responsive
        showSizeChanger={{ "aria-label": "Orders per page" }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onChange={(nextPage, nextPageSize = pageSize) => {
          setPageSize(nextPageSize);
          changePage(nextPageSize === pageSize ? nextPage : 1, nextPageSize);
        }}
      />
    </nav>
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
                setStatus(value as OrderListQuery["status"]);
                changePage(1);
              }}
            />

            {renderPagination("Orders pagination above list")}

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
                      setRequestId((value) => value + 1);
                    }}
                  >
                    Retry
                  </Button>
                }
              />
            ) : null}

            {renderPagination("Orders pagination below list")}
          </Card>
        </main>
      </div>
    </ConfigProvider>
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
