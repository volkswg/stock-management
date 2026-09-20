"use client";

import {
  ArrowLeftOutlined,
  CalendarOutlined,
  LeftOutlined,
  RightOutlined,
  SwapOutlined,
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
  Descriptions,
  Empty,
  Modal,
  Row,
  Segmented,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  type TableProps,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ProductMovementMasterRecord } from "@/services/movements";
import { getMovements } from "./api";
import {
  formatBangkokDate,
  formatBangkokDateTime,
  formatShopTotals,
  getCurrentBangkokDate,
  toNumber,
} from "./format";
import styles from "./movements.module.css";

const { Text, Title } = Typography;
type DisplayType = "month" | "week";
type ViewMode = "calendar" | "table";
type DailySummary = {
  date: string;
  itemCount: number;
  movementMasters: ProductMovementMasterRecord[];
  quantity: number;
  shopQuantities: Record<string, number>;
};

export function MovementListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [records, setRecords] = useState<ProductMovementMasterRecord[]>([]);
  const [displayType, setDisplayType] = useState<DisplayType>("month");
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [selectedDay, setSelectedDay] = useState<DailySummary>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const filters = useMemo(
    () => readFilters(searchParams),
    [searchParams],
  );
  const selectedDate = filters.fromDate || filters.date || filters.toDate;
  const period = dayjs(selectedDate || undefined);

  useEffect(() => {
    if (!selectedDate) {
      const current = getCurrentBangkokDate();
      router.replace(`/movements?${monthQuery(current)}`);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    getMovements(filters, controller.signal)
      .then(setRecords)
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(requestError));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters, router, selectedDate]);

  const dailySummaries = useMemo(() => summarizeDays(records), [records]);
  const summaryByDate = useMemo(
    () => new Map(dailySummaries.map((summary) => [summary.date, summary])),
    [dailySummaries],
  );
  const totalQuantity = records.reduce(
    (sum, record) => sum + toNumber(record.totalQuantity),
    0,
  );
  const totalItems = records.reduce((sum, record) => sum + record.itemCount, 0);
  const shopTotals = summarizeShops(records);

  function setPeriod(value: Dayjs) {
    router.push(
      `/movements?${displayType === "week" ? weekQuery(value) : monthQuery(value)}`,
    );
  }

  function setDisplay(next: DisplayType) {
    setDisplayType(next);
    router.push(
      `/movements?${next === "week" ? weekQuery(period) : monthQuery(period)}`,
    );
  }

  const columns: TableProps<ProductMovementMasterRecord>["columns"] = [
    {
      title: "Movement",
      dataIndex: "id",
      key: "id",
      render: (id: string) => <Text strong>{id}</Text>,
    },
    {
      title: "Packing date",
      dataIndex: "packingDate",
      key: "packingDate",
      render: (value: string) => formatBangkokDateTime(value) || "—",
    },
    { title: "Items", dataIndex: "itemCount", key: "itemCount", align: "right" },
    {
      title: "Total qty",
      dataIndex: "totalQuantity",
      key: "totalQuantity",
      align: "right",
    },
    {
      title: "Shop qty",
      dataIndex: "shopQuantities",
      key: "shopQuantities",
      render: (value: Record<string, number>) => formatShopTotals(value),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: statusTag,
    },
  ];

  return (
    <ConfigProvider theme={movementTheme}>
      <div className={styles.appShell}>
        <main className={styles.content}>
          <Button
            className={styles.backButton}
            href="/"
            icon={<ArrowLeftOutlined />}
            type="text"
          >
            Home
          </Button>
          <header className={styles.pageHeader}>
            <div>
              <Text className={styles.eyebrow}>Inventory operations</Text>
              <Title level={1}>Movements</Title>
              <Text type="secondary">Summary by packing date and shop</Text>
            </div>
          </header>

          <Card className={styles.toolbarCard}>
            <div className={styles.toolbar}>
              <div className={styles.periodControl}>
                <Text strong>{displayType === "week" ? "Week" : "Month"}</Text>
                <Space.Compact>
                  <Button
                    aria-label={`Previous ${displayType}`}
                    icon={<LeftOutlined />}
                    onClick={() => setPeriod(period.subtract(1, displayType))}
                  />
                  <DatePicker
                    allowClear={false}
                    format={displayType === "week" ? weekLabel : "YYYY-MM"}
                    picker={displayType}
                    value={period}
                    onChange={(value) => setPeriod(value || dayjs())}
                  />
                  <Tooltip title={`Current ${displayType}`}>
                    <Button
                      aria-label={`Current ${displayType}`}
                      icon={<CalendarOutlined />}
                      onClick={() => setPeriod(getCurrentBangkokDate())}
                    />
                  </Tooltip>
                  <Button
                    aria-label={`Next ${displayType}`}
                    icon={<RightOutlined />}
                    onClick={() => setPeriod(period.add(1, displayType))}
                  />
                </Space.Compact>
              </div>
              <Space wrap>
                <Segmented<DisplayType>
                  aria-label="Calendar period"
                  options={[
                    { label: "Month", value: "month" },
                    { label: "Week", value: "week" },
                  ]}
                  value={displayType}
                  onChange={setDisplay}
                />
                <Segmented<ViewMode>
                  aria-label="Movement view"
                  options={[
                    { label: "Calendar", value: "calendar" },
                    { label: "Table", value: "table" },
                  ]}
                  value={viewMode}
                  onChange={setViewMode}
                />
              </Space>
            </div>
          </Card>

          <Row className={styles.summaryGrid} gutter={[16, 16]}>
            <SummaryCard title="Quantity" value={totalQuantity} />
            <SummaryCard title="Items" value={totalItems} />
            <SummaryCard title="Shop totals" value={formatShopTotals(shopTotals)} />
          </Row>

          {error ? <Alert className={styles.alert} message={error} showIcon type="error" /> : null}
          {loading ? (
            <Card><Skeleton active paragraph={{ rows: 8 }} /></Card>
          ) : records.length === 0 ? (
            <Card><Empty description="No movement records in this period" image={<SwapOutlined className={styles.emptyIcon} />} /></Card>
          ) : viewMode === "table" ? (
            <Card className={styles.tableCard}>
              <Table
                columns={columns}
                dataSource={[...records].sort((a, b) => b.packingDate.localeCompare(a.packingDate))}
                pagination={false}
                rowKey="id"
                scroll={{ x: 780 }}
                onRow={(record) => ({
                  className: styles.clickableRow,
                  tabIndex: 0,
                  onClick: () => router.push(`/movements/${encodeURIComponent(record.id)}`),
                  onKeyDown: (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/movements/${encodeURIComponent(record.id)}`);
                    }
                  },
                })}
                summary={() => (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0}><Text strong>Period total</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} />
                    <Table.Summary.Cell index={2} align="right"><Text strong>{totalItems}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right"><Text strong>{totalQuantity}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={4}><Text strong>{formatShopTotals(shopTotals)}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={5} />
                  </Table.Summary.Row>
                )}
              />
            </Card>
          ) : displayType === "week" ? (
            <WeekView period={period} summaries={summaryByDate} onSelect={setSelectedDay} />
          ) : (
            <Card className={styles.calendarCard}>
              <Calendar
                fullscreen
                headerRender={() => null}
                value={period}
                fullCellRender={(date, info) =>
                  info.type === "date" ? (
                    <CalendarCell
                      date={date}
                      period={period}
                      summary={summaryByDate.get(date.format("YYYY-MM-DD"))}
                      onSelect={setSelectedDay}
                    />
                  ) : info.originNode
                }
              />
            </Card>
          )}
        </main>
      </div>
      <MovementPicker
        summary={selectedDay}
        onClose={() => setSelectedDay(undefined)}
        onOpen={(id) => router.push(`/movements/${encodeURIComponent(id)}`)}
      />
    </ConfigProvider>
  );
}

function SummaryCard({ title, value }: { title: string; value: number | string }) {
  return <Col xs={24} sm={8}><Card><Statistic title={title} value={value} /></Card></Col>;
}

function CalendarCell({ date, period, summary, onSelect }: {
  date: Dayjs;
  period: Dayjs;
  summary?: DailySummary;
  onSelect: (summary: DailySummary) => void;
}) {
  return (
    <button
      className={`${styles.calendarCell} ${date.month() !== period.month() ? styles.mutedCell : ""} ${summary ? styles.activeCell : ""}`}
      disabled={!summary}
      type="button"
      onClick={() => summary && onSelect(summary)}
    >
      <span className={styles.cellHeader}>
        <strong>{date.date()}</strong>
        {summary ? (
          <Badge
            color="#157347"
            count={summary.movementMasters.length}
            overflowCount={99}
            title={`${summary.movementMasters.length} movements`}
          />
        ) : null}
      </span>
      {summary ? (
        <span
          aria-label={`${summary.quantity} total. ${formatShopTotals(summary.shopQuantities)}`}
          className={styles.cellSummary}
        >
          {Object.entries(summary.shopQuantities)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([shop, quantity]) => (
              <span className={styles.shopQuantity} key={shop}>
                <span>{shop}</span>
                <strong>{quantity}</strong>
              </span>
            ))}
        </span>
      ) : null}
    </button>
  );
}

function WeekView({ period, summaries, onSelect }: {
  period: Dayjs;
  summaries: Map<string, DailySummary>;
  onSelect: (summary: DailySummary) => void;
}) {
  const start = period.startOf("week");
  return (
    <Card className={styles.weekCard}>
      <div className={styles.weekGrid}>
        {Array.from({ length: 7 }, (_, index) => start.add(index, "day")).map((date) => {
          const summary = summaries.get(date.format("YYYY-MM-DD"));
          return (
            <article className={styles.weekDay} key={date.format("YYYY-MM-DD")}>
              <div className={styles.weekHeader}><Text type="secondary">{date.format("ddd")}</Text><Title level={4}>{date.format("MMM D")}</Title></div>
              {summary ? (
                <button className={styles.weekSummary} type="button" onClick={() => onSelect(summary)}>
                  <Badge color="#157347" count={summary.movementMasters.length} />
                  <strong>Qty {summary.quantity}</strong>
                  <span>{formatShopTotals(summary.shopQuantities)}</span>
                  {summary.movementMasters.map((movement) => <span className={styles.weekMovement} key={movement.id}>{movement.id}{statusTag(movement.status)}</span>)}
                </button>
              ) : <Text type="secondary">No movements</Text>}
            </article>
          );
        })}
      </div>
    </Card>
  );
}

function MovementPicker({ summary, onClose, onOpen }: {
  summary?: DailySummary;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <Modal footer={null} open={Boolean(summary)} title={summary ? `Movements on ${summary.date}` : "Movements"} width={680} onCancel={onClose}>
      <Space className={styles.pickerList} direction="vertical" size={12}>
        {summary?.movementMasters.map((movement) => (
          <Card key={movement.id} size="small" title={<Space><Text strong>{movement.id}</Text>{statusTag(movement.status)}</Space>} extra={<Button onClick={() => onOpen(movement.id)} type="primary">Open</Button>}>
            <Row gutter={[12, 12]}><Col span={12}><Statistic title="Items" value={movement.itemCount} /></Col><Col span={12}><Statistic title="Quantity" value={toNumber(movement.totalQuantity)} /></Col></Row>
            <Descriptions className={styles.pickerDescriptions} column={1} size="small">
              <Descriptions.Item label="Packed">{formatBangkokDateTime(movement.packingDate)}</Descriptions.Item>
              <Descriptions.Item label="Delivered">{formatBangkokDateTime(movement.deliverDateTime) || "—"}</Descriptions.Item>
              <Descriptions.Item label="Shops">{formatShopTotals(movement.shopQuantities)}</Descriptions.Item>
            </Descriptions>
          </Card>
        ))}
      </Space>
    </Modal>
  );
}

function summarizeDays(records: ProductMovementMasterRecord[]): DailySummary[] {
  const groups = new Map<string, ProductMovementMasterRecord[]>();
  for (const record of records) {
    const date = formatBangkokDate(record.packingDate);
    if (date) groups.set(date, [...(groups.get(date) || []), record]);
  }
  return Array.from(groups, ([date, movementMasters]) => ({
    date,
    itemCount: movementMasters.reduce((sum, item) => sum + item.itemCount, 0),
    movementMasters: [...movementMasters].sort((a, b) => a.packingDate.localeCompare(b.packingDate)),
    quantity: movementMasters.reduce((sum, item) => sum + toNumber(item.totalQuantity), 0),
    shopQuantities: summarizeShops(movementMasters),
  }));
}

function summarizeShops(records: ProductMovementMasterRecord[]): Record<string, number> {
  return records.reduce<Record<string, number>>((totals, record) => {
    for (const [shop, quantity] of Object.entries(record.shopQuantities)) totals[shop] = (totals[shop] || 0) + quantity;
    return totals;
  }, {});
}

function readFilters(searchParams: ReturnType<typeof useSearchParams>) {
  const date = validDate(searchParams.get("date"));
  const fromDate = validDate(searchParams.get("fromDate"));
  const toDate = validDate(searchParams.get("toDate"));
  return { date, fromDate, toDate };
}

function validDate(value: string | null): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function monthQuery(date: Dayjs): string {
  return new URLSearchParams({ fromDate: date.startOf("month").format("YYYY-MM-DD"), toDate: date.endOf("month").format("YYYY-MM-DD") }).toString();
}

function weekQuery(date: Dayjs): string {
  const start = date.startOf("week");
  return new URLSearchParams({ fromDate: start.format("YYYY-MM-DD"), toDate: start.add(6, "day").format("YYYY-MM-DD") }).toString();
}

function weekLabel(value: Dayjs): string {
  const start = value.startOf("week");
  return `${start.format("YYYY-MM-DD")} – ${start.add(6, "day").format("YYYY-MM-DD")}`;
}

function statusTag(status: ProductMovementMasterRecord["status"]) {
  return <Tag color={status === "delivered" ? "green" : status === "in_progress" ? "blue" : "default"}>{status === "delivered" ? "Delivered" : status === "in_progress" ? "In progress" : "Created"}</Tag>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to load movements.";
}

const movementTheme = {
  token: {
    colorPrimary: "#157347",
    colorBgLayout: "#f3f5f4",
    colorBorderSecondary: "#e1e5e2",
    borderRadius: 6,
    fontFamily: "Arial, Helvetica, sans-serif",
  },
};
