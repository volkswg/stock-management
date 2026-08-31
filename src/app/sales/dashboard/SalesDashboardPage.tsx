"use client";

import {
  ArrowLeftOutlined,
  BarChartOutlined,
  CalendarOutlined,
  DatabaseOutlined,
  ReloadOutlined,
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
  Switch,
  Table,
  Tag,
  Typography,
  type TableProps,
} from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./salesDashboard.module.css";

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

type SalesAccount = { id: string; shopName: string };
type DailySalesRow = {
  salesDate: string;
  syncedShopCount: number;
  receiptCount: number;
  itemsSold: number;
  grossSales: number;
  netSales: number;
};
type ItemRow = {
  itemId: string;
  variantId: string;
  itemName: string;
  variantName: string;
  sku: string;
  itemsSold: number;
  itemsRefunded: number;
  grossSales: number;
  netSales: number;
};
type PaymentRow = {
  paymentTypeId: string;
  name: string;
  type: string;
  paymentsReceived: number;
  refunds: number;
  netPayments: number;
};
type DashboardResponse = {
  ok: boolean;
  source: "google_sheets";
  fromDate: string;
  toDate: string;
  accountIds: string[];
  accounts: SalesAccount[];
  syncedDays: number;
  dailySales: DailySalesRow[];
  shopSeries: Array<{
    accountId: string;
    shopName: string;
    dailySales: DailySalesRow[];
  }>;
  report: {
    receiptCount: number;
    rows: ItemRow[];
    paymentsByType: PaymentRow[];
    totals: {
      itemsSold: number;
      grossSales: number;
      netSales: number;
    };
  };
};

type ChartSeries = {
  id: string;
  name: string;
  color: string;
  rows: DailySalesRow[];
};

const LINE_COLORS = [
  "#157347",
  "#2563eb",
  "#c2410c",
  "#7c3aed",
  "#b91c1c",
  "#0f766e",
];

const MONEY_FORMATTER = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const NUMBER_FORMATTER = new Intl.NumberFormat("th-TH", {
  maximumFractionDigits: 2,
});

export function SalesDashboardPage() {
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [aggregateShops, setAggregateShops] = useState(true);
  const [range, setRange] = useState(getDefaultRange);
  const [dashboard, setDashboard] = useState<DashboardResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState(0);

  const loadDashboard = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setError(undefined);
      const query = new URLSearchParams({ from: range[0], to: range[1] });
      if (accountIds.length) query.set("accounts", accountIds.join(","));

      fetchJson<DashboardResponse>(
        `/api/sales/dashboard?${query.toString()}`,
        signal,
      )
        .then(setDashboard)
        .catch((requestError: unknown) => {
          if (!signal?.aborted) setError(getErrorMessage(requestError));
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        });
    },
    [accountIds, range],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => loadDashboard(controller.signal),
      0,
    );
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadDashboard, requestId]);

  const dailyColumns = useMemo<TableProps<DailySalesRow>["columns"]>(
    () => [
      { title: "Date", dataIndex: "salesDate", key: "salesDate", width: 130 },
      {
        title: "Shops",
        dataIndex: "syncedShopCount",
        key: "syncedShopCount",
        align: "right",
        width: 90,
        render: formatNumber,
      },
      {
        title: "Receipts",
        dataIndex: "receiptCount",
        key: "receiptCount",
        align: "right",
        width: 110,
        render: formatNumber,
      },
      {
        title: "Items",
        dataIndex: "itemsSold",
        key: "itemsSold",
        align: "right",
        width: 100,
        render: formatNumber,
      },
      {
        title: "Gross sales",
        dataIndex: "grossSales",
        key: "grossSales",
        align: "right",
        width: 150,
        render: formatMoney,
      },
      {
        title: "Net sales",
        dataIndex: "netSales",
        key: "netSales",
        align: "right",
        width: 150,
        render: formatMoney,
      },
    ],
    [],
  );
  const itemColumns = useMemo<TableProps<ItemRow>["columns"]>(
    () => [
      {
        title: "Item",
        key: "item",
        render: (_, row) => (
          <Space orientation="vertical" size={0}>
            <Text strong>{row.itemName || "Unknown item"}</Text>
            <Text className={styles.secondaryText} type="secondary">
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
        width: 140,
        render: formatMoney,
      },
      {
        title: "Net",
        dataIndex: "netSales",
        key: "netSales",
        align: "right",
        width: 140,
        render: formatMoney,
      },
    ],
    [],
  );
  const paymentColumns = useMemo<TableProps<PaymentRow>["columns"]>(
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
  const chartSeries = useMemo<ChartSeries[]>(() => {
    if (!dashboard) return [];
    if (aggregateShops) {
      return [
        {
          id: "aggregate",
          name: "Aggregate",
          color: LINE_COLORS[0],
          rows: dashboard.dailySales,
        },
      ];
    }
    return dashboard.shopSeries.map((series, index) => ({
      id: series.accountId,
      name: series.shopName,
      color: LINE_COLORS[index % LINE_COLORS.length],
      rows: series.dailySales,
    }));
  }, [aggregateShops, dashboard]);
  const lineChart = createLineChart(chartSeries);

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
              <Title level={1}>Dashboard</Title>
              <Text type="secondary">
                Range analysis using completed Google Sheets syncs only.
              </Text>
            </div>
            <Space className={styles.pageActions} wrap>
              <Button href="/" icon={<ArrowLeftOutlined />}>
                Home
              </Button>
              <Button href="/sales" icon={<DatabaseOutlined />}>
                Sync status
              </Button>
              <Button href="/sales/daily-sales" icon={<CalendarOutlined />}>
                Daily sales
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
              <Col xs={24} md={9} lg={7}>
                <Text className={styles.fieldLabel}>Shops</Text>
                <Select
                  allowClear
                  aria-label="Dashboard shops"
                  className={styles.fullWidth}
                  maxTagCount="responsive"
                  mode="multiple"
                  options={(dashboard?.accounts || []).map((account) => ({
                    label: account.shopName,
                    value: account.id,
                  }))}
                  placeholder="All shops"
                  value={accountIds}
                  onChange={setAccountIds}
                />
              </Col>
              <Col xs={24} md={9} lg={7}>
                <Text className={styles.fieldLabel}>Date range</Text>
                <RangePicker
                  allowClear={false}
                  aria-label="Dashboard date range"
                  className={styles.fullWidth}
                  format="YYYY-MM-DD"
                  value={[
                    dayjs(range[0], "YYYY-MM-DD"),
                    dayjs(range[1], "YYYY-MM-DD"),
                  ]}
                  onChange={(_, values) => setRange(getRangeValues(values))}
                />
              </Col>
              <Col xs={24} sm={12} md={6} lg={4}>
                <Text className={styles.fieldLabel}>Aggregate shops</Text>
                <div className={styles.switchControl}>
                  <Switch
                    aria-label="Aggregate shop lines"
                    checked={aggregateShops}
                    checkedChildren="On"
                    unCheckedChildren="Off"
                    onChange={setAggregateShops}
                  />
                </div>
              </Col>
              <Col xs={24} sm={12} md={6} lg={4}>
                <Button
                  block
                  icon={<BarChartOutlined />}
                  loading={loading}
                  type="primary"
                  onClick={() => setRequestId((value) => value + 1)}
                >
                  Load dashboard
                </Button>
              </Col>
            </Row>
          </Card>

          {error ? (
            <Alert
              className={styles.alert}
              type="error"
              showIcon
              title="Sales dashboard could not be loaded"
              description={error}
            />
          ) : null}

          <Spin spinning={loading} description="Loading synced sales...">
            {dashboard ? (
              <>
                <section className={styles.summaryGrid}>
                  <Card>
                    <Statistic
                      title="Net sales"
                      value={formatMoney(dashboard.report.totals.netSales)}
                    />
                  </Card>
                  <Card>
                    <Statistic
                      title="Gross sales"
                      value={formatMoney(dashboard.report.totals.grossSales)}
                    />
                  </Card>
                  <Card>
                    <Statistic
                      title="Receipts"
                      value={formatNumber(dashboard.report.receiptCount)}
                    />
                  </Card>
                  <Card>
                    <Statistic
                      title="Synced days"
                      value={formatNumber(dashboard.syncedDays)}
                    />
                  </Card>
                </section>

                <Card className={styles.panel} title="Daily net sales">
                  {dashboard.dailySales.length ? (
                    <div>
                      <div className={styles.chartLegend}>
                        {chartSeries.map((series) => (
                          <span className={styles.legendItem} key={series.id}>
                            <span
                              className={styles.legendSwatch}
                              style={{ backgroundColor: series.color }}
                            />
                            {series.name}
                          </span>
                        ))}
                      </div>
                      <div className={styles.chartViewport}>
                      <svg
                        aria-label="Daily net sales line chart"
                        className={styles.lineChart}
                        height={lineChart.height}
                        role="img"
                        viewBox={`0 0 ${lineChart.width} ${lineChart.height}`}
                        width={lineChart.width}
                      >
                        {lineChart.ticks.map((tick) => (
                          <g key={tick.value}>
                            <line
                              className={styles.gridLine}
                              x1={lineChart.left}
                              x2={lineChart.width - lineChart.right}
                              y1={tick.y}
                              y2={tick.y}
                            />
                            <text
                              className={styles.axisLabel}
                              textAnchor="end"
                              x={lineChart.left - 10}
                              y={tick.y + 4}
                            >
                              {formatCompactMoney(tick.value)}
                            </text>
                          </g>
                        ))}
                        {lineChart.series.map((series) => (
                          <g key={series.id}>
                            <polyline
                              className={styles.salesLine}
                              points={series.points
                                .map((point) => `${point.x},${point.y}`)
                                .join(" ")}
                              style={{ stroke: series.color }}
                            />
                            {series.points.map((point) => (
                              <circle
                                className={styles.salesPoint}
                                cx={point.x}
                                cy={point.y}
                                key={point.row.salesDate}
                                r="5"
                                style={{ stroke: series.color }}
                              >
                                <title>
                                  {series.name} / {point.row.salesDate}:{" "}
                                  {formatMoney(point.row.netSales)}
                                </title>
                              </circle>
                            ))}
                          </g>
                        ))}
                        {lineChart.dates.map((salesDate, index) => (
                          <text
                            className={styles.dateLabel}
                            key={salesDate}
                            textAnchor="middle"
                            x={lineChart.xPositions[index]}
                            y={lineChart.height - 12}
                          >
                            {salesDate.slice(5)}
                          </text>
                        ))}
                      </svg>
                      </div>
                    </div>
                  ) : (
                    <Empty description="No completed syncs in this range" />
                  )}
                </Card>

                <Card className={styles.panel} title="Daily performance">
                  <Table<DailySalesRow>
                    columns={dailyColumns}
                    dataSource={dashboard.dailySales}
                    rowKey="salesDate"
                    pagination={false}
                    scroll={{ x: 730 }}
                    locale={{ emptyText: "No completed syncs in this range" }}
                  />
                </Card>

                <div className={styles.twoColumnPanels}>
                  <Card className={styles.panel} title="Top items">
                    <Table<ItemRow>
                      columns={itemColumns}
                      dataSource={dashboard.report.rows.slice(0, 10)}
                      rowKey={(row) =>
                        row.variantId || row.itemId || row.sku || row.itemName
                      }
                      pagination={false}
                      scroll={{ x: 760 }}
                      locale={{ emptyText: "No synced item sales" }}
                    />
                  </Card>
                  <Card className={styles.panel} title="Payment totals">
                    <Table<PaymentRow>
                      columns={paymentColumns}
                      dataSource={dashboard.report.paymentsByType}
                      rowKey={(row) =>
                        row.paymentTypeId || `${row.type}:${row.name}`
                      }
                      pagination={false}
                      scroll={{ x: 590 }}
                      locale={{ emptyText: "No synced payments" }}
                    />
                  </Card>
                </div>
              </>
            ) : (
              <Card className={styles.emptyCard}>
                <Empty description="No dashboard data loaded" />
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

function getDefaultRange(): [string, string] {
  const today = getBangkokDate();
  return [`${today.slice(0, 7)}-01`, today];
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

function getRangeValues(values: string[]): [string, string] {
  return [values[0] || "", values[1] || ""];
}

function createLineChart(series: ChartSeries[]) {
  const height = 280;
  const left = 72;
  const right = 24;
  const top = 28;
  const bottom = 42;
  const dates = [
    ...new Set(series.flatMap((item) => item.rows.map((row) => row.salesDate))),
  ].sort();
  const values = series.flatMap((item) =>
    item.rows.map((row) => row.netSales),
  );
  const width = Math.max(720, (dates.length - 1) * 72 + left + right);
  const minimum = Math.min(0, ...values);
  let maximum = Math.max(0, ...values);
  if (maximum === minimum) maximum += 1;
  const valueRange = maximum - minimum;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const xPositions = dates.map((_, index) =>
    dates.length === 1
      ? left + plotWidth / 2
      : left + (index / (dates.length - 1)) * plotWidth,
  );
  const chartSeries = series.map((item) => ({
    ...item,
    points: item.rows.map((row) => ({
      row,
      x: xPositions[dates.indexOf(row.salesDate)],
      y: top + ((maximum - row.netSales) / valueRange) * plotHeight,
    })),
  }));
  const ticks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    return {
      value: maximum - ratio * valueRange,
      y: top + ratio * plotHeight,
    };
  });

  return {
    dates,
    height,
    left,
    right,
    series: chartSeries,
    ticks,
    width,
    xPositions,
  };
}

function formatMoney(value: number): string {
  return MONEY_FORMATTER.format(value);
}

function formatCompactMoney(value: number): string {
  return new Intl.NumberFormat("th-TH", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
