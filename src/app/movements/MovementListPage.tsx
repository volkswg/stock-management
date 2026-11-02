"use client";

import {
  ArrowLeftOutlined,
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
  ConfigProvider,
  DatePicker,
  Empty,
  Grid,
  Modal,
  Segmented,
  Skeleton,
  Table,
  Tag,
  Typography,
  type TableProps,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import Link from "next/link";
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
type ViewMode = "list" | "calendar" | "table";
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
  const [resource, setResource] = useState<{ key: string; records: ProductMovementMasterRecord[]; error?: string }>({ key: "", records: [] });
  const [viewMode, setViewMode] = useState<ViewMode>();
  const screens = Grid.useBreakpoint();
  const activeView = viewMode === "table" && !screens.md ? "list" : viewMode || (screens.md ? "calendar" : "list");
  const [pickedDay, setPickedDay] = useState<{ key: string; summary: DailySummary }>();
  const filters = useMemo(
    () => readFilters(searchParams),
    [searchParams],
  );
  const requestKey = JSON.stringify(filters);
  const loading = resource.key !== requestKey;
  const records = useMemo(() => loading ? [] : resource.records, [loading, resource.records]);
  const error = loading ? undefined : resource.error;
  const selectedDay = pickedDay?.key === requestKey ? pickedDay.summary : undefined;
  function setSelectedDay(summary?: DailySummary) {
    setPickedDay(summary ? { key: requestKey, summary } : undefined);
  }
  const selectedDate = filters.fromDate || filters.date || filters.toDate;
  const period = dayjs(selectedDate || undefined);

  useEffect(() => {
    if (!selectedDate) {
      const current = getCurrentBangkokDate();
      router.replace(`/movements?${monthQuery(current)}`);
      return;
    }
    const controller = new AbortController();
    getMovements(filters, controller.signal)
      .then((records) => {
        if (!controller.signal.aborted) setResource({ key: requestKey, records });
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setResource({ key: requestKey, records: [], error: errorMessage(requestError) });
        }
      });
    return () => controller.abort();
  }, [filters, router, selectedDate, requestKey]);

  const dailySummaries = useMemo(() => summarizeDays(records).sort((a, b) => b.date.localeCompare(a.date)), [records]);
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
    setSelectedDay(undefined);
    router.push(`/movements?${monthQuery(value)}`);
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
              <Text type="secondary">Packing history and delivery status</Text>
            </div>
          </header>

          <Card className={styles.toolbarCard}>
            <div className={styles.toolbar}>
              <div className={styles.periodControl}>
                <div className={styles.periodLabel}>
                  <Text strong>Packing month</Text>
                  <Button className={styles.currentMonth} type="text" onClick={() => setPeriod(getCurrentBangkokDate())}>
                    This month
                  </Button>
                </div>
                <div className={styles.monthStepper}>
                  <Button aria-label="Previous month" icon={<LeftOutlined />} onClick={() => setPeriod(period.subtract(1, "month"))} />
                  <DatePicker
                    aria-label="Packing month"
                    allowClear={false}
                    format="MMMM YYYY"
                    inputReadOnly
                    suffixIcon={null}
                    picker="month"
                    value={period}
                    onChange={(value) => { if (value) setPeriod(value); }}
                  />
                  <Button aria-label="Next month" icon={<RightOutlined />} onClick={() => setPeriod(period.add(1, "month"))} />
                </div>
              </div>
              <Segmented<ViewMode>
                block
                className={styles.viewSwitch}
                aria-label="Movement view"
                options={[
                  { label: "List", value: "list" },
                  { label: "Calendar", value: "calendar" },
                  ...(screens.md ? [{ label: "Table", value: "table" as const }] : []),
                ]}
                value={activeView}
                onChange={setViewMode}
              />
            </div>
          </Card>

          <section className={styles.overview} aria-label="Month totals" aria-busy={loading}>
            <div className={styles.metrics}>
              <SummaryMetric title="Movements" value={records.length} pending={loading || Boolean(error)} />
              <SummaryMetric title="Items" value={totalItems} pending={loading || Boolean(error)} />
              <SummaryMetric title="Quantity" value={totalQuantity} pending={loading || Boolean(error)} />
            </div>
            <div className={styles.shopTotals}>
              <span className={styles.shopTotalsLabel}>Shop quantities</span>
              <ShopTotals totals={shopTotals} pending={loading || Boolean(error)} />
            </div>
          </section>

          {error ? <Alert className={styles.alert} title={error} description="Movement totals are unavailable. Try another month or reload this page." showIcon type="error" /> : null}
          {loading ? (
            <Card><Skeleton active paragraph={{ rows: 8 }} /></Card>
          ) : error ? null : records.length === 0 ? (
            <Card><Empty description="No movement records in this period" image={<SwapOutlined className={styles.emptyIcon} />} /></Card>
          ) : activeView === "list" ? (
            <section className={styles.activityList} aria-label="Movement list">
              <div className={styles.activityHeading}>
                <Title level={2}>Movement history</Title>
                <Text type="secondary">Newest first</Text>
              </div>
              {dailySummaries.map((day) => (
                <section className={styles.dayGroup} key={day.date} aria-label={`Movements on ${day.date}`}>
                  <div className={styles.dayHeading}>
                    <h3>{dayjs(day.date).format("ddd, D MMM")}</h3>
                    <span>{day.movementMasters.length} {day.movementMasters.length === 1 ? "movement" : "movements"} · {day.quantity.toLocaleString()} units</span>
                  </div>
                  <div className={styles.movementCards}>
                    {[...day.movementMasters].reverse().map((movement) => <MovementCard key={movement.id} movement={movement} />)}
                  </div>
                </section>
              ))}
            </section>
          ) : activeView === "table" ? (
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
      />
    </ConfigProvider>
  );
}

function SummaryMetric({ title, value, pending }: { title: string; value: number; pending: boolean }) {
  return <div className={styles.metric}><span>{title}</span><strong>{pending ? "—" : value.toLocaleString()}</strong></div>;
}

function ShopTotals({ totals, pending = false }: { totals: Record<string, number>; pending?: boolean }) {
  if (pending) return <span className={styles.shopPlaceholder}>—</span>;
  const entries = Object.entries(totals).sort(([a], [b]) => a.localeCompare(b));
  return entries.length ? entries.map(([shop, quantity]) => (
    <span className={styles.shopChip} key={shop}><span>{shop}</span><strong>{quantity.toLocaleString()}</strong></span>
  )) : <span className={styles.shopPlaceholder}>No shop quantities</span>;
}

function MovementCard({ movement }: { movement: ProductMovementMasterRecord }) {
  return (
    <Link className={styles.movementCard} href={`/movements/${encodeURIComponent(movement.id)}`} aria-label={`View movement ${movement.id}`}>
      <div className={styles.movementCardTop}>
        {statusTag(movement.status)}
        <time dateTime={movement.packingDate}>{formatBangkokDateTime(movement.packingDate) || "Packing date unavailable"}</time>
      </div>
      <div className={styles.movementIdentity}><strong>{movement.id}</strong><RightOutlined aria-hidden="true" /></div>
      <div className={styles.movementNumbers}>
        <span><strong>{movement.itemCount.toLocaleString()}</strong> items</span>
        <span><strong>{toNumber(movement.totalQuantity).toLocaleString()}</strong> units</span>
      </div>
      <div className={styles.movementShops}><span>Home →</span><ShopTotals totals={movement.shopQuantities} /></div>
      {movement.deliverDateTime ? <div className={styles.deliveredAt}>Delivered {formatBangkokDateTime(movement.deliverDateTime)}</div> : null}
      <span className={styles.openDetail}>View movement <RightOutlined aria-hidden="true" /></span>
    </Link>
  );
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
      aria-label={`${date.format("D MMMM YYYY")}${summary ? `, ${summary.movementMasters.length} movements, ${summary.quantity} units` : ", no movements"}`}
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
          <span className={styles.cellTotal} title={`${summary.quantity.toLocaleString()} units`}>
            <strong>{new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(summary.quantity)}</strong><span>units</span>
          </span>
          <span className={styles.cellShops}>{Object.entries(summary.shopQuantities)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([shop, quantity]) => (
              <span className={styles.shopQuantity} key={shop}>
                <span>{shop}</span>
                <strong>{quantity}</strong>
              </span>
            ))}</span>
        </span>
      ) : null}
    </button>
  );
}

function MovementPicker({ summary, onClose }: {
  summary?: DailySummary;
  onClose: () => void;
}) {
  return (
    <Modal
      className={styles.dayPicker}
      footer={null}
      open={Boolean(summary)}
      title={summary ? dayjs(summary.date).format("dddd, D MMMM YYYY") : "Movements"}
      width={680}
      onCancel={onClose}
    >
      <div className={styles.pickerSummary}>
        <Text>{summary?.movementMasters.length || 0} movements</Text>
        <Text strong>{summary?.quantity.toLocaleString() || 0} units</Text>
      </div>
      <div className={styles.pickerList}>
        {summary?.movementMasters.map((movement) => <MovementCard key={movement.id} movement={movement} />)}
      </div>
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
