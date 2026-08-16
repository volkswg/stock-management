"use client";

import {
  DownloadOutlined,
  InboxOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  ConfigProvider,
  Empty,
  Image,
  Input,
  message,
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
import {
  OrderStatus,
  type OrderListItem,
  type OrderProductImage,
} from "@/services/orders";
import { getOrders } from "./api";
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
            <Text className={styles.eyebrow}>Order management</Text>
            <Title level={1}>Orders</Title>
            <Text type="secondary">
              Track incoming orders from creation through completion.
            </Text>
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

function ProductImageList({ images }: { images: OrderProductImage[] }) {
  const [messageApi, messageContextHolder] = message.useMessage();

  if (images.length === 0) {
    return null;
  }

  return (
    <>
      {messageContextHolder}
      <section className={styles.productImages} aria-label="Product images">
        {images.map((image, index) => (
          <ProductImagePreview
            image={image}
            index={index}
            key={image.id}
            showError={(content) => messageApi.error(content)}
          />
        ))}
      </section>
    </>
  );
}

function ProductImagePreview({
  image,
  index,
  showError,
}: {
  image: OrderProductImage;
  index: number;
  showError: (content: string) => void;
}) {
  const [downloadFile, setDownloadFile] = useState<File>();
  const [preparing, setPreparing] = useState(false);
  const previewImageUrl = getGoogleDrivePreviewUrl(image.imageUrl);

  const prepareDownload = async (): Promise<void> => {
    setPreparing(true);
    try {
      setDownloadFile(await loadProductImageFile(image));
    } catch {
      showError("Could not prepare the product image.");
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div className={styles.productImage}>
      <Image
        alt={`Product ${index + 1}`}
        height={96}
        preview={{
          actionsRender: (originalNode) => (
            <>
              {originalNode}
              <Tooltip title={preparing ? "Preparing image" : "Save image"}>
                <Button
                  aria-label={`Save product image ${index + 1}`}
                  className={styles.previewSaveButton}
                  disabled={!downloadFile}
                  icon={<DownloadOutlined />}
                  loading={preparing}
                  type="text"
                  onClick={() => {
                    if (downloadFile) {
                      savePreparedProductImage(downloadFile, showError);
                    }
                  }}
                />
              </Tooltip>
            </>
          ),
          afterOpenChange: (open) => {
            if (open && !downloadFile && !preparing) {
              void prepareDownload();
            }
          },
          src: previewImageUrl,
        }}
        src={getGoogleDriveThumbnailUrl(image.imageUrl)}
        width={96}
      />
      <Text>Product image {index + 1}</Text>
      {image.quoteQuantity ? (
        <Text type="secondary">Qty: {image.quoteQuantity}</Text>
      ) : null}
    </div>
  );
}

async function loadProductImageFile(image: OrderProductImage): Promise<File> {
  const response = await fetch(
    `/api/order-images/${encodeURIComponent(image.id)}`,
  );
  if (!response.ok) {
    throw new Error("Image download failed.");
  }

  const blob = await response.blob();
  const fileName = getDownloadFileName(response, image.id, blob.type);
  return new File([blob], fileName, { type: blob.type });
}

function savePreparedProductImage(
  file: File,
  showError: (content: string) => void,
): void {
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    void navigator
      .share({ files: [file], title: "Product image" })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          showError("Could not save the product image.");
        }
      });
    return;
  }

  try {
    downloadBlob(file, file.name);
  } catch {
    showError("Could not save the product image.");
  }
}

function getDownloadFileName(
  response: Response,
  imageId: string,
  contentType: string,
): string {
  const contentDisposition = response.headers.get("content-disposition");
  const fileNameMatch = contentDisposition?.match(/filename="([^"]+)"/);
  return (
    fileNameMatch?.[1] ||
    `product-image-${imageId}${getImageExtension(contentType)}`
  );
}

function getImageExtension(contentType: string): string {
  switch (contentType.split(";")[0].trim().toLowerCase()) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/jpeg":
    default:
      return ".jpg";
  }
}

function downloadBlob(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
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

function getGoogleDrivePreviewUrl(imageUrl: string): string {
  const fileIdMatch = imageUrl.match(/\/file\/d\/([^/]+)/);
  if (fileIdMatch?.[1]) {
    return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(
      fileIdMatch[1],
    )}`;
  }

  return imageUrl;
}

function getGoogleDriveThumbnailUrl(imageUrl: string, size = "w400"): string {
  const fileIdMatch = imageUrl.match(/\/file\/d\/([^/]+)/);
  if (fileIdMatch?.[1]) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(
      fileIdMatch[1],
    )}&sz=${size}`;
  }

  return imageUrl;
}
