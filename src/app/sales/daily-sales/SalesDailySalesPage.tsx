"use client";

import {
  ArrowLeftOutlined,
  BarChartOutlined,
  CalendarOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  LeftOutlined,
  ReloadOutlined,
  RightOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
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
  Table,
  Tag,
  Typography,
  type TableProps,
} from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./salesDailySales.module.css";

const { Text, Title } = Typography;

type SalesAccount = { id: string; shopName: string };

type SalesByItemRow = {
  itemId: string;
  variantId: string;
  itemName: string;
  variantName: string;
  sku: string;
  itemsSold: number;
  grossSales: number;
  itemsRefunded: number;
  refunds: number;
  discounts: number;
  netSales: number;
  grossProfit: number;
  marginPercent: number;
};

type SalesByPaymentTypeRow = {
  paymentTypeId: string;
  name: string;
  type: string;
  paymentsReceived: number;
  refunds: number;
  netPayments: number;
};

type DailySalesResponse = {
  ok: boolean;
  source: "google_sheets";
  date: string;
  account: SalesAccount;
  accounts: SalesAccount[];
  isSynced: boolean;
  hourlyGrossSales: Array<{ hour: string; grossSales: number }>;
  report: {
    receiptCount: number;
    rows: SalesByItemRow[];
    paymentsByType: SalesByPaymentTypeRow[];
    totals: {
      itemsSold: number;
      grossSales: number;
      netSales: number;
    };
  };
};

const THB_FORMATTER = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const NUMBER_FORMATTER = new Intl.NumberFormat("th-TH", {
  maximumFractionDigits: 2,
});

export function SalesDailySalesPage() {
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(getBangkokDate);
  const [sales, setSales] = useState<DailySalesResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState(0);

  const loadSales = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setError(undefined);

      const query = new URLSearchParams({ date });
      if (accountId) query.set("account", accountId);
      fetchJson<DailySalesResponse>(
        `/api/sales/daily-sales?${query.toString()}`,
        signal,
      )
        .then((response) => {
          setSales(response);
          setAccountId(response.account.id);
        })
        .catch((requestError: unknown) => {
          if (!signal?.aborted) setError(getErrorMessage(requestError));
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        });
    },
    [accountId, date],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => loadSales(controller.signal), 0);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadSales, requestId]);

  const itemColumns = useMemo<TableProps<SalesByItemRow>["columns"]>(
    () => [
      {
        title: "Item",
        key: "itemName",
        width: 280,
        render: (_, row) => (
          <Space orientation="vertical" size={0}>
            <Text strong>{row.itemName || "Unknown item"}</Text>
            <Text className={styles.variantText} type="secondary">
              {row.variantName || row.sku || "No variant"}
            </Text>
          </Space>
        ),
      },
      {
        title: "Sold",
        dataIndex: "itemsSold",
        key: "itemsSold",
        align: "right",
        width: 100,
        render: formatNumber,
      },
      {
        title: "Refunded",
        dataIndex: "itemsRefunded",
        key: "itemsRefunded",
        align: "right",
        width: 115,
        render: formatNumber,
      },
      {
        title: "Gross",
        dataIndex: "grossSales",
        key: "grossSales",
        align: "right",
        width: 135,
        render: formatMoney,
      },
      {
        title: "Discounts",
        dataIndex: "discounts",
        key: "discounts",
        align: "right",
        width: 135,
        render: formatMoney,
      },
      {
        title: "Net",
        dataIndex: "netSales",
        key: "netSales",
        align: "right",
        width: 135,
        render: formatMoney,
      },
      {
        title: "Profit",
        dataIndex: "grossProfit",
        key: "grossProfit",
        align: "right",
        width: 135,
        render: formatMoney,
      },
      {
        title: "Margin",
        dataIndex: "marginPercent",
        key: "marginPercent",
        align: "right",
        width: 100,
        render: (value: number) => `${formatNumber(value)}%`,
      },
    ],
    [],
  );

  const paymentColumns = useMemo<
    TableProps<SalesByPaymentTypeRow>["columns"]
  >(
    () => [
      {
        title: "Payment type",
        dataIndex: "name",
        key: "name",
        render: (value: string, row) => (
          <Space>
            <Text strong>{value}</Text>
            <Tag>{row.type}</Tag>
          </Space>
        ),
      },
      {
        title: "Received",
        dataIndex: "paymentsReceived",
        key: "paymentsReceived",
        align: "right",
        width: 150,
        render: formatMoney,
      },
      {
        title: "Refunds",
        dataIndex: "refunds",
        key: "refunds",
        align: "right",
        width: 140,
        render: formatMoney,
      },
      {
        title: "Net",
        dataIndex: "netPayments",
        key: "netPayments",
        align: "right",
        width: 140,
        render: formatMoney,
      },
    ],
    [],
  );

  const maxHourlyGrossSales = Math.max(
    1,
    ...(sales?.hourlyGrossSales.map((row) => row.grossSales) || []),
  );
  const showSyncSuggestion = Boolean(
    sales &&
      sales.date === date &&
      sales.account.id === accountId &&
      !sales.isSynced,
  );
  const loyverseSyncPath = `/loyverse/daily-sales?${new URLSearchParams({
    account: accountId,
    date,
  }).toString()}`;

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
          Table: { headerBg: "#f7f8f7", headerColor: "#66716b" },
        },
      }}
    >
      <div className={styles.appShell}>
        <main className={styles.content}>
          <header className={styles.pageHeader}>
            <div>
              <Text className={styles.eyebrow}>Sales</Text>
              <Title level={1}>Daily sales</Title>
              <Text type="secondary">
                Synced sales loaded exclusively from Google Sheets.
              </Text>
            </div>
            <Space className={styles.pageActions} wrap>
              <Button href="/" icon={<ArrowLeftOutlined />}>
                Home
              </Button>
              <Button href="/sales" icon={<DatabaseOutlined />}>
                Sync status
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
              <Col xs={24} md={10} lg={8}>
                <Text className={styles.fieldLabel}>Shop</Text>
                <Select
                  aria-label="Sales shop"
                  className={styles.fullWidth}
                  loading={loading && !sales}
                  options={(sales?.accounts || []).map((account) => ({
                    label: account.shopName,
                    value: account.id,
                  }))}
                  placeholder="Select shop"
                  value={accountId || undefined}
                  onChange={setAccountId}
                />
              </Col>
              <Col xs={24} sm={12} md={7} lg={5}>
                <Text className={styles.fieldLabel}>Date</Text>
                <Space.Compact block>
                  <Button
                    aria-label="Previous date"
                    icon={<LeftOutlined />}
                    title="Previous date"
                    onClick={() => setDate(shiftDate(date, -1))}
                  />
                  <DatePicker
                    allowClear={false}
                    aria-label="Sales date"
                    className={styles.datePicker}
                    format="YYYY-MM-DD"
                    suffixIcon={<CalendarOutlined />}
                    value={dayjs(date, "YYYY-MM-DD")}
                    onChange={(_, value) => setDate(getPickerValue(value))}
                  />
                  <Button
                    aria-label="Next date"
                    icon={<RightOutlined />}
                    title="Next date"
                    onClick={() => setDate(shiftDate(date, 1))}
                  />
                </Space.Compact>
              </Col>
              <Col xs={24} sm={12} md={7} lg={5}>
                <Button
                  block
                  icon={<BarChartOutlined />}
                  loading={loading}
                  type="primary"
                  onClick={() => setRequestId((value) => value + 1)}
                >
                  Load sales
                </Button>
              </Col>
            </Row>
          </Card>

          {error ? (
            <Alert
              className={styles.errorAlert}
              type="error"
              showIcon
              title="Stored sales could not be loaded"
              description={error}
            />
          ) : null}

          {showSyncSuggestion ? (
            <Alert
              action={
                <Button href={loyverseSyncPath} icon={<SyncOutlined />}>
                  Open Loyverse sync
                </Button>
              }
              className={styles.errorAlert}
              type="warning"
              showIcon
              title="This day has not been synced"
              description="Open the Loyverse daily-sales page to review and sync this shop and date."
            />
          ) : null}

          <Spin spinning={loading} description="Loading stored sales...">
            {sales ? (
              <>
                <section className={styles.summaryGrid}>
                  <Card>
                    <Statistic
                      title="Net sales"
                      value={formatMoney(sales.report.totals.netSales)}
                    />
                  </Card>
                  <Card>
                    <Statistic
                      title="Gross sales"
                      value={formatMoney(sales.report.totals.grossSales)}
                    />
                  </Card>
                  <Card>
                    <Statistic
                      title="Items sold"
                      value={formatNumber(sales.report.totals.itemsSold)}
                    />
                  </Card>
                  <Card>
                    <Statistic
                      title="Receipts"
                      value={formatNumber(sales.report.receiptCount)}
                    />
                  </Card>
                </section>

                <Card
                  className={styles.chartCard}
                  title={`${sales.account.shopName} hourly gross sales`}
                >
                  <div className={styles.hourlyChart}>
                    {sales.hourlyGrossSales.map((row) => (
                      <div className={styles.hourColumn} key={row.hour}>
                        <div className={styles.hourBarTrack}>
                          <div
                            aria-label={`${row.hour} ${formatMoney(row.grossSales)}`}
                            className={styles.hourBar}
                            style={{
                              height: `${Math.max(
                                2,
                                (row.grossSales / maxHourlyGrossSales) * 100,
                              )}%`,
                            }}
                            title={`${row.hour} ${formatMoney(row.grossSales)}`}
                          />
                        </div>
                        <span>{row.hour.slice(0, 2)}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className={styles.tableCard} title="Sales by item">
                  <Table<SalesByItemRow>
                    columns={itemColumns}
                    dataSource={sales.report.rows}
                    rowKey={(row) =>
                      row.variantId || row.itemId || row.sku || row.itemName
                    }
                    pagination={{ pageSize: 10, showSizeChanger: false }}
                    scroll={{ x: 1180 }}
                    locale={{
                      emptyText: (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="No synced item sales for this date"
                        />
                      ),
                    }}
                  />
                </Card>

                <Card className={styles.tableCard} title="Sales by payment type">
                  <Table<SalesByPaymentTypeRow>
                    columns={paymentColumns}
                    dataSource={sales.report.paymentsByType}
                    rowKey={(row) => row.paymentTypeId || `${row.type}:${row.name}`}
                    pagination={false}
                    scroll={{ x: 620 }}
                    locale={{
                      emptyText: (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="No synced payments for this date"
                        />
                      ),
                    }}
                  />
                </Card>
              </>
            ) : (
              <Card className={styles.emptyCard}>
                <Empty description="No stored sales loaded" />
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
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(body.error || `Request failed with status ${response.status}.`);
  }
  return body as T;
}

function getBangkokDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  return `${year}-${month}-${day}`;
}

function formatMoney(value: number): string {
  return THB_FORMATTER.format(value);
}

function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
}

function getPickerValue(value: string | string[] | null): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function shiftDate(value: string, days: number): string {
  return dayjs(value, "YYYY-MM-DD").add(days, "day").format("YYYY-MM-DD");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
