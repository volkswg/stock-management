"use client";

import {
  AuditOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  ConfigProvider,
  Empty,
  Input,
  InputNumber,
  message,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { StockAdjustmentsPanel, type AdjustmentFilter } from "./StockAdjustmentsPanel";
import styles from "./stockCounts.module.css";

const { Text, Title } = Typography;

type ShopStockCount = {
  accountId: string;
  shopName: string;
  month: string;
  openingStock: number;
  hasOpeningCount: boolean;
  stockIn: number;
  stockOut: number;
  salesSyncedDays: number;
  adjustmentsOut: number;
  adjustmentsIn: number;
  adjustmentCount: number;
  expectedSalesDays: number;
  missingSalesDays: number;
  warnings: string[];
  calculatedStock: number;
  physicalCount: number | null;
  variance: number | null;
  matches: boolean | null;
  note: string;
  countedAt: string;
  updatedAt: string;
};

type StockCountsResponse = {
  ok: boolean;
  month?: string;
  stockCounts?: ShopStockCount[];
  error?: string;
};

type CountDraft = {
  physicalCount: number | null;
  note: string;
};

export function StockCountsPage() {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [month, setMonth] = useState(getBangkokMonth());
  const [records, setRecords] = useState<ShopStockCount[]>([]);
  const [drafts, setDrafts] = useState<Record<string, CountDraft>>({});
  const [loading, setLoading] = useState(true);
  const [adjustmentFilter, setAdjustmentFilter] = useState<AdjustmentFilter>({ accountId: "all", direction: "all" });
  const [reportError, setReportError] = useState("");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const loadStockCounts = useCallback(
    async (signal?: AbortSignal, preserveDrafts = false) => {
      if (signal?.aborted) return;
      setLoading(true); setReportError("");
      if (!preserveDrafts) setRecords([]);
      try {
        const body = await requestStockCounts(
          `/api/stock-counts?month=${encodeURIComponent(month)}`,
          { signal },
        );
        if (signal?.aborted) return;
        const nextRecords = body.stockCounts || [];
        setRecords(nextRecords);
        setDrafts(current => Object.fromEntries(nextRecords.map(record => [record.accountId,
          preserveDrafts && current[record.accountId] ? current[record.accountId] : { physicalCount: record.physicalCount, note: record.note },
        ])));
      } catch (error) {
        if (!signal?.aborted) setReportError(getErrorMessage(error));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [month],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void loadStockCounts(controller.signal));
    return () => controller.abort();
  }, [loadStockCounts]);

  const showAdjustments = (record: ShopStockCount, direction: string) => {
    setAdjustmentFilter({ accountId: record.accountId, direction });
    document.getElementById("adjustments")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const updateDraft = (accountId: string, change: Partial<CountDraft>) => {
    setDrafts((current) => ({
      ...current,
      [accountId]: {
        physicalCount: current[accountId]?.physicalCount ?? null,
        note: current[accountId]?.note || "",
        ...change,
      },
    }));
  };

  const saveCount = async (record: ShopStockCount) => {
    const draft = drafts[record.accountId];
    if (draft?.physicalCount === null || draft?.physicalCount === undefined) {
      messageApi.warning("Enter the physical stock count first.");
      return;
    }
    setSavingIds((current) => new Set(current).add(record.accountId));
    try {
      const body = await requestStockCounts("/api/stock-counts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: record.accountId,
          month,
          note: draft.note,
          physicalCount: draft.physicalCount,
        }),
      });
      const nextRecords = body.stockCounts || [];
      setRecords(nextRecords);
      setDrafts(current => Object.fromEntries(nextRecords.map(next => [next.accountId,
        next.accountId === record.accountId ? { physicalCount: next.physicalCount, note: next.note } : current[next.accountId] || { physicalCount: next.physicalCount, note: next.note },
      ])));
      messageApi.success(`${record.shopName} physical count saved.`);
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    } finally {
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(record.accountId);
        return next;
      });
    }
  };

  const totals = useMemo(() => {
    let physicalCount = 0;
    let variance = 0;
    let countedShops = 0;
    let matchedShops = 0;
    for (const record of records) {
      const physical = drafts[record.accountId]?.physicalCount;
      if (physical !== null && physical !== undefined) {
        countedShops += 1;
        physicalCount += physical;
        variance += physical - record.calculatedStock;
        if (physical === record.calculatedStock) matchedShops += 1;
      }
    }
    return {
      openingStock: sum(records, "openingStock"),
      stockIn: sum(records, "stockIn"),
      stockOut: sum(records, "stockOut"),
      adjustmentsOut: records.reduce((sum, r) => sum + (r.adjustmentsOut || 0), 0),
      adjustmentsIn: records.reduce((sum, r) => sum + (r.adjustmentsIn || 0), 0),
      calculatedStock: sum(records, "calculatedStock"),
      physicalCount,
      variance,
      countedShops,
      matchedShops,
    };
  }, [drafts, records]);

  const columns: ColumnsType<ShopStockCount> = [
    {
      title: "Shop",
      key: "shop",
      fixed: "left",
      width: 220,
      render: (_, record) => (
        <div className={styles.shopCell}>
          <Text strong>{record.shopName}</Text>
          <Text type="secondary">{record.accountId}</Text>
        </div>
      ),
    },
    {
      title: "Opening stock",
      dataIndex: "openingStock",
      width: 145,
      align: "right",
      render: (value: number, record) => (
        <div className={styles.numberCell}>
          <Text>{formatUnits(value)}</Text>
          {!record.hasOpeningCount ? (
            <Text type="warning">No previous count</Text>
          ) : null}
        </div>
      ),
    },
    {
      title: "Stock in",
      dataIndex: "stockIn",
      width: 115,
      align: "right",
      render: (value: number) => <Text type="success">+{formatUnits(value)}</Text>,
    },
    {
      title: "Sales out",
      dataIndex: "stockOut",
      width: 120,
      align: "right",
      render: (value: number) => (
        <Text type={value >= 0 ? "danger" : "success"}>
          {formatStockOut(value)}
        </Text>
      ),
    },
    {
      title: "Other stock out", dataIndex: "adjustmentsOut", width: 145, align: "right",
      render: (value: number, record) => <Button type="link" aria-label={`View stock out adjustments for ${record.shopName}`} onClick={() => showAdjustments(record, "out")}>−{formatUnits(value || 0)}</Button>,
    },
    {
      title: "Adjustments in", dataIndex: "adjustmentsIn", width: 145, align: "right",
      render: (value: number, record) => <Button type="link" aria-label={`View stock in adjustments for ${record.shopName}`} onClick={() => showAdjustments(record, "in")}>+{formatUnits(value || 0)}</Button>,
    },
    {
      title: "Sales sync",
      dataIndex: "salesSyncedDays",
      width: 115,
      align: "right",
      render: (value: number, record) => `${value}/${record.expectedSalesDays ?? "?"} days`,
    },
    {
      title: "Calculated stock",
      dataIndex: "calculatedStock",
      width: 155,
      align: "right",
      render: (value: number) => <Text strong>{formatUnits(value)}</Text>,
    },
    {
      title: "Physical count",
      key: "physicalCount",
      width: 165,
      render: (_, record) => (
        <InputNumber
          aria-label={`Physical count for ${record.shopName}`}
          className={styles.fullWidth}
          min={0}
          precision={0}
          value={drafts[record.accountId]?.physicalCount}
          onChange={(value) =>
            updateDraft(record.accountId, { physicalCount: value })
          }
        />
      ),
    },
    {
      title: "Variance",
      key: "variance",
      width: 120,
      align: "right",
      render: (_, record) => {
        const physical = drafts[record.accountId]?.physicalCount;
        if (physical === null || physical === undefined) return "-";
        const variance = physical - record.calculatedStock;
        return (
          <Text type={variance === 0 ? "success" : "danger"} strong>
            {formatSignedUnits(variance)}
          </Text>
        );
      },
    },
    {
      title: "Status",
      key: "status",
      width: 115,
      render: (_, record) => {
        const physical = drafts[record.accountId]?.physicalCount;
        if (physical === null || physical === undefined) {
          return <Tag>Not counted</Tag>;
        }
        return physical === record.calculatedStock ? (
          <Tag color="success">Matched</Tag>
        ) : (
          <Tag color="error">Mismatch</Tag>
        );
      },
    },
    {
      title: "Note",
      key: "note",
      width: 220,
      render: (_, record) => (
        <Input
          aria-label={`Stock-count note for ${record.shopName}`}
          maxLength={500}
          placeholder="Optional note"
          value={drafts[record.accountId]?.note || ""}
          onChange={(event) =>
            updateDraft(record.accountId, { note: event.target.value })
          }
        />
      ),
    },
    {
      title: "Action",
      key: "action",
      fixed: "right",
      width: 110,
      render: (_, record) => (
        <Button
          disabled={loading || drafts[record.accountId]?.physicalCount == null}
          icon={<SaveOutlined />}
          loading={savingIds.has(record.accountId)}
          type="primary"
          onClick={() => void saveCount(record)}
        >
          Save
        </Button>
      ),
    },
  ];

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
      {messageContextHolder}
      <div className={styles.appShell}>
        <main className={styles.content}>
          <header className={styles.pageHeader}>
            <div>
              <Text className={styles.eyebrow}>Stock control</Text>
              <Title level={1}>Monthly stock count</Title>
              <Text type="secondary">
                Compare calculated shop stock with the physical count.
              </Text>
            </div>
            <Space className={styles.pageActions} wrap>
              <Button href="#adjustments">Stock adjustments</Button>
              <Button
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={() => void loadStockCounts(undefined, true)}
              >
                Refresh
              </Button>
            </Space>
          </header>

          {reportError && <Alert className={styles.ruleAlert} title={reportError} type="error" showIcon />}
          <Card className={styles.filterCard}>
            <label className={styles.monthField}>
              <span>Count month</span>
              <Select
                aria-label="Stock count month"
                options={getMonthOptions()}
                optionFilterProp="label"
                showSearch
                value={month}
                onChange={setMonth}
              />
            </label>
          </Card>

          <Alert
            className={styles.ruleAlert}
            title="Calculation"
            description="Calculated stock = previous month's physical count + delivered movements − net sales − other stock out + adjustments in. Refunds are added back. Adjustments apply only in their transaction month; physical counts are never changed automatically."
            showIcon
            type="info"
          />

          {records.some(r => r.warnings?.length) && <Alert className={styles.ruleAlert} type="warning" showIcon title="Some calculated stock figures need review" description={<details><summary>View shop warnings</summary><ul className={styles.warningList}>{records.flatMap(r => (r.warnings || []).map(w => <li key={`${r.accountId}:${w}`}><strong>{r.shopName}:</strong> {w}</li>))}</ul></details>} />}
          <Row className={styles.summaryGrid} gutter={[12, 12]}>
            <Col xs={12} md={6}>
              <Card><Statistic title="Opening" value={totals.openingStock} /></Card>
            </Col>
            <Col xs={12} md={6}>
              <Card><Statistic prefix="+" title="Stock in" value={totals.stockIn} /></Card>
            </Col>
            <Col xs={12} md={6}>
              <Card>
                <Statistic
                  prefix={totals.stockOut >= 0 ? "−" : "+"}
                  title="Sales out"
                  value={Math.abs(totals.stockOut)}
                />
              </Card>
            </Col>
            <Col xs={12} md={6}><Card><Statistic title="Other stock out" prefix="−" value={totals.adjustmentsOut} /></Card></Col>
            <Col xs={12} md={6}><Card><Statistic title="Adjustments in" prefix="+" value={totals.adjustmentsIn} /></Card></Col>
            <Col xs={12} md={6}>
              <Card><Statistic title="Calculated" value={totals.calculatedStock} /></Card>
            </Col>
            <Col xs={12} md={6}>
              <Card><Statistic title="Physical" value={totals.physicalCount} /></Card>
            </Col>
            <Col xs={12} md={6}>
              <Card>
                <Statistic
                  prefix={<AuditOutlined />}
                  title={`${totals.matchedShops}/${totals.countedShops} matched`}
                  value={totals.variance}
                />
              </Card>
            </Col>
          </Row>

          <Card className={`${styles.tableCard} ${styles.desktopTable}`}>
            <Table
              columns={columns}
              dataSource={records}
              loading={loading}
              locale={{ emptyText: "No configured shops found." }}
              pagination={false}
              rowKey="accountId"
              scroll={{ x: 1915 }}
            />
          </Card>

          <Spin spinning={loading}>
            <div className={styles.mobileList}>
              {!loading && records.length === 0 ? (
                <Card>
                  <Empty description="No configured shops found." />
                </Card>
              ) : null}
              {records.map((record) => {
                const draft = drafts[record.accountId];
                const physical = draft?.physicalCount;
                const variance =
                  physical === null || physical === undefined
                    ? null
                    : physical - record.calculatedStock;
                return (
                  <Card
                    className={styles.mobileShopCard}
                    key={record.accountId}
                    title={record.shopName}
                    extra={
                      variance === null ? (
                        <Tag>Not counted</Tag>
                      ) : variance === 0 ? (
                        <Tag color="success">Matched</Tag>
                      ) : (
                        <Tag color="error">Mismatch</Tag>
                      )
                    }
                  >
                    <Text className={styles.mobileAccountId} type="secondary">
                      {record.accountId}
                    </Text>
                    <div className={styles.mobileMetrics}>
                      <MobileMetric
                        label="Opening stock"
                        value={formatUnits(record.openingStock)}
                        note={
                          record.hasOpeningCount
                            ? undefined
                            : "No previous count"
                        }
                      />
                      <MobileMetric
                        label="Stock in"
                        tone="success"
                        value={`+${formatUnits(record.stockIn)}`}
                      />
                      <MobileMetric
                        label="Sales out"
                        tone={record.stockOut >= 0 ? "danger" : "success"}
                        value={formatStockOut(record.stockOut)}
                      />
                      <MobileMetric label="Other stock out" value={<Button type="link" aria-label={`View stock out adjustments for ${record.shopName}`} onClick={() => showAdjustments(record, "out")}>−{formatUnits(record.adjustmentsOut || 0)}</Button>} />
                      <MobileMetric label="Adjustments in" value={<Button type="link" aria-label={`View stock in adjustments for ${record.shopName}`} onClick={() => showAdjustments(record, "in")}>+{formatUnits(record.adjustmentsIn || 0)}</Button>} />
                      <MobileMetric
                        label="Sales sync"
                        value={`${record.salesSyncedDays}/${record.expectedSalesDays ?? "?"} days`}
                      />
                      <MobileMetric
                        emphasized
                        label="Calculated stock"
                        value={formatUnits(record.calculatedStock)}
                      />
                      <MobileMetric
                        emphasized
                        label="Variance"
                        tone={
                          variance === null
                            ? undefined
                            : variance === 0
                              ? "success"
                              : "danger"
                        }
                        value={
                          variance === null
                            ? "Not counted"
                            : formatSignedUnits(variance)
                        }
                      />
                    </div>
                    {record.warnings?.map(w => <Alert key={w} type="warning" title={w} />)}
                    <label className={styles.mobileField}>
                      <span>Physical count</span>
                      <InputNumber
                        aria-label={`Physical count for ${record.shopName}`}
                        className={styles.fullWidth}
                        min={0}
                        precision={0}
                        value={physical}
                        onChange={(value) =>
                          updateDraft(record.accountId, {
                            physicalCount: value,
                          })
                        }
                      />
                    </label>
                    <label className={styles.mobileField}>
                      <span>Note</span>
                      <Input
                        aria-label={`Stock-count note for ${record.shopName}`}
                        maxLength={500}
                        placeholder="Optional note"
                        value={draft?.note || ""}
                        onChange={(event) =>
                          updateDraft(record.accountId, {
                            note: event.target.value,
                          })
                        }
                      />
                    </label>
                    <Button
                      block
                      disabled={loading || physical == null}
                      icon={<SaveOutlined />}
                      loading={savingIds.has(record.accountId)}
                      size="large"
                      type="primary"
                      onClick={() => void saveCount(record)}
                    >
                      Save physical count
                    </Button>
                  </Card>
                );
              })}
            </div>
          </Spin>
          <StockAdjustmentsPanel month={month} shops={records} filter={adjustmentFilter} onFilterChange={setAdjustmentFilter} onChanged={() => loadStockCounts(undefined, true)} />
        </main>
      </div>
    </ConfigProvider>
  );
}

function MobileMetric({
  emphasized = false,
  label,
  note,
  tone,
  value,
}: {
  emphasized?: boolean;
  label: string;
  note?: string;
  tone?: "success" | "danger";
  value: ReactNode;
}) {
  return (
    <div className={styles.mobileMetric}>
      <Text type="secondary">{label}</Text>
      <Text strong={emphasized} type={tone}>
        {value}
      </Text>
      {note ? <Text type="warning">{note}</Text> : null}
    </div>
  );
}

async function requestStockCounts(
  url: string,
  init?: RequestInit,
): Promise<StockCountsResponse> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => undefined)) as
    | StockCountsResponse
    | undefined;
  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || `Request failed (${response.status}).`);
  }
  return body;
}

function sum(
  records: ShopStockCount[],
  field: "openingStock" | "stockIn" | "stockOut" | "calculatedStock",
): number {
  return records.reduce((total, record) => total + record[field], 0);
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

function getMonthOptions(): Array<{ label: string; value: string }> {
  const [year, month] = getBangkokMonth().split("-").map(Number);
  return Array.from({ length: 120 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - index, 1));
    return {
      label: new Intl.DateTimeFormat("en-GB", {
        month: "long",
        timeZone: "UTC",
        year: "numeric",
      }).format(date),
      value: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
    };
  });
}

function formatUnits(value: number): string {
  return new Intl.NumberFormat("en-TH", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSignedUnits(value: number): string {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : ""}${formatUnits(value)}`;
}

function formatStockOut(value: number): string {
  if (value === 0) return "0";
  return `${value > 0 ? "−" : "+"}${formatUnits(Math.abs(value))}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error.";
}
