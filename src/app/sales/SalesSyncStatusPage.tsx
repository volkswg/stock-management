"use client";

import {
  ArrowLeftOutlined,
  BarChartOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Badge,
  Button,
  Calendar,
  Card,
  Col,
  ConfigProvider,
  DatePicker,
  Empty,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./salesSyncStatus.module.css";

const { Text, Title } = Typography;

type LoyverseAccount = {
  id: string;
  shopName: string;
};

type SalesSyncStatusRow = {
  id: string;
  salesDate: string;
  accountId: string;
  shopName: string;
  status: string;
  receiptCount: number;
  itemCount: number;
  paymentCount: number;
  syncedAt: string;
};

type SalesSyncStatusResponse = {
  ok: boolean;
  source: "google_sheets";
  month: string;
  accountId: string | null;
  accounts: LoyverseAccount[];
  rows: SalesSyncStatusRow[];
  summary: {
    syncedDays: number;
    totalReceipts: number;
    totalItems: number;
    totalPayments: number;
    latestSyncedAt: string | null;
  };
};

const NUMBER_FORMATTER = new Intl.NumberFormat("th-TH");

export function SalesSyncStatusPage() {
  const [month, setMonth] = useState(getBangkokMonth);
  const [accountId, setAccountId] = useState("");
  const [status, setStatus] = useState<SalesSyncStatusResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState(0);

  const loadStatus = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setError(undefined);

      const query = new URLSearchParams({ month });
      if (accountId) query.set("account", accountId);

      fetchJson<SalesSyncStatusResponse>(
        `/api/sales/sync-status?${query.toString()}`,
        signal,
      )
        .then(setStatus)
        .catch((requestError: unknown) => {
          if (!signal?.aborted) {
            setError(getErrorMessage(requestError));
          }
        })
        .finally(() => {
          if (!signal?.aborted) {
            setLoading(false);
          }
        });
    },
    [accountId, month],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      loadStatus(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadStatus, requestId]);

  const rowsByDate = useMemo(
    () =>
      (status?.rows || []).reduce<Map<string, SalesSyncStatusRow[]>>(
        (result, row) => {
          const rows = result.get(row.salesDate) || [];
          rows.push(row);
          result.set(row.salesDate, rows);
          return result;
        },
        new Map(),
      ),
    [status?.rows],
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
      }}
    >
      <div className={styles.appShell}>
        <main className={styles.content}>
          <header className={styles.pageHeader}>
            <div>
              <Text className={styles.eyebrow}>Sales</Text>
              <Title level={1}>Sync status</Title>
              <Text type="secondary">
                Synced Loyverse sales data from Google Sheets.
              </Text>
            </div>
            <Space className={styles.pageActions} wrap>
              <Button href="/" icon={<ArrowLeftOutlined />}>
                Home
              </Button>
              <Button href="/sales/daily-sales" icon={<BarChartOutlined />}>
                Daily sales
              </Button>
              <Button href="/sales/dashboard" icon={<DashboardOutlined />}>
                Dashboard
              </Button>
              <Button
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={() => setRequestId((value) => value + 1)}
              >
                Refresh
              </Button>
            </Space>
          </header>

          <Card className={styles.filterCard}>
            <Row gutter={[12, 12]} align="bottom">
              <Col xs={24} sm={12} md={7} lg={5}>
                <Text className={styles.fieldLabel}>Month</Text>
                <DatePicker
                  allowClear={false}
                  aria-label="Sales sync month"
                  className={styles.fullWidth}
                  format="YYYY-MM"
                  picker="month"
                  suffixIcon={<CalendarOutlined />}
                  value={dayjs(month, "YYYY-MM")}
                  onChange={(_, value) => setMonth(getPickerValue(value))}
                />
              </Col>
              <Col xs={24} md={10} lg={8}>
                <Text className={styles.fieldLabel}>Shop</Text>
                <Select
                  aria-label="Loyverse shop"
                  className={styles.fullWidth}
                  options={[
                    { label: "All shops", value: "" },
                    ...(status?.accounts || []).map((account) => ({
                      label: account.shopName,
                      value: account.id,
                    })),
                  ]}
                  value={accountId}
                  onChange={setAccountId}
                />
              </Col>
              <Col xs={24} sm={12} md={7} lg={5}>
                <Button
                  block
                  icon={<CheckCircleOutlined />}
                  loading={loading}
                  type="primary"
                  onClick={() => setRequestId((value) => value + 1)}
                >
                  Load status
                </Button>
              </Col>
            </Row>
          </Card>

          {error ? (
            <Alert
              className={styles.errorAlert}
              type="error"
              showIcon
              title="Sales sync status could not be loaded"
              description={error}
            />
          ) : null}

          <Spin spinning={loading} tip="Loading sync status...">
            {status ? (
              <>
                <section className={styles.summaryGrid}>
                  <Card>
                    <Statistic
                      title="Synced days"
                      value={formatNumber(status.summary.syncedDays)}
                    />
                  </Card>
                  <Card>
                    <Statistic
                      title="Receipts"
                      value={formatNumber(status.summary.totalReceipts)}
                    />
                  </Card>
                  <Card>
                    <Statistic
                      title="Items"
                      value={formatNumber(status.summary.totalItems)}
                    />
                  </Card>
                  <Card>
                    <Statistic
                      title="Latest sync"
                      value={formatDateTime(status.summary.latestSyncedAt)}
                    />
                  </Card>
                </section>

                <Card
                  className={styles.calendarCard}
                  title="Sync calendar"
                  extra={<Badge status="success" text="Synced" />}
                >
                  <div className={styles.calendarViewport}>
                    <Calendar
                      className={styles.calendar}
                      value={dayjs(`${month}-01`, "YYYY-MM-DD")}
                      cellRender={(current, info) => {
                        if (info.type !== "date") return info.originNode;

                        const rows = rowsByDate.get(
                          current.format("YYYY-MM-DD"),
                        );
                        if (!rows?.length) return null;

                        return (
                          <ul className={styles.calendarEntries}>
                            {rows.map((row) => (
                              <li className={styles.calendarEntry} key={row.id}>
                                <div className={styles.calendarEntryHeader}>
                                  <Badge
                                    status={
                                      row.status === "complete"
                                        ? "success"
                                        : "processing"
                                    }
                                  />
                                  <span className={styles.calendarShop}>
                                    {row.shopName || row.accountId}
                                  </span>
                                </div>
                                <span className={styles.calendarCounts}>
                                  {formatNumber(row.receiptCount)} receipts /{" "}
                                  {formatNumber(row.itemCount)} items
                                </span>
                              </li>
                            ))}
                          </ul>
                        );
                      }}
                      onPanelChange={(value, mode) => {
                        if (mode === "month") setMonth(value.format("YYYY-MM"));
                      }}
                    />
                  </div>
                </Card>
              </>
            ) : (
              <Card className={styles.emptyCard}>
                <Empty description="No sync status loaded" />
              </Card>
            )}
          </Spin>
        </main>
      </div>
    </ConfigProvider>
  );
}

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal });
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(body.error || `Request failed with status ${response.status}.`);
  }
  return body as T;
}

function getBangkokMonth(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  return `${year}-${month}`;
}

function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
}

function getPickerValue(value: string | string[] | null): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
