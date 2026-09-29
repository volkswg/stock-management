"use client";

import {
  ArrowLeftOutlined,
  CalculatorOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  ConfigProvider,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./payroll.module.css";

const { Text, Title } = Typography;

type DailyCommissionRecord = {
  date: string;
  shopId: string;
  shopName: string;
  attendanceUnits: number;
  netSales: number;
  commissionType: "none" | "sales_bucket";
  bucketCount: number;
  commission: number;
};

type PayrollRecord = {
  employeeId: string;
  employeeName: string;
  compensationType: "daily" | "monthly" | null;
  effectiveFrom: string;
  baseSalary: number;
  commission: number;
  commissionType: "none" | "sales_bucket";
  commissionBucketSales: number;
  commissionBucketAmount: number;
  commissionRoundupThreshold: number;
  commissionSales: number;
  workedDays: number;
  leaveDays: number;
  basePay: number;
  totalPay: number;
  dailyCommissions: DailyCommissionRecord[];
};

type PayrollResponse = {
  ok: boolean;
  month?: string;
  payroll?: PayrollRecord[];
  error?: string;
};

const dailyCommissionColumns: ColumnsType<DailyCommissionRecord> = [
  {
    title: "Date",
    dataIndex: "date",
    width: 130,
    render: formatDate,
  },
  {
    title: "Selected shop",
    key: "shop",
    width: 240,
    render: (_, record) => (
      <div className={styles.employeeCell}>
        <Text>{record.shopName || record.shopId}</Text>
        {record.shopName && record.shopName !== record.shopId ? (
          <Text type="secondary">{record.shopId}</Text>
        ) : null}
      </div>
    ),
  },
  {
    title: "Attendance",
    dataIndex: "attendanceUnits",
    width: 120,
    render: (units: number) => (
      <Tag color={units === 0.5 ? "gold" : "green"}>
        {units === 0.5 ? "Half day" : "Full day"}
      </Tag>
    ),
  },
  {
    title: "Shop net sales",
    dataIndex: "netSales",
    width: 160,
    align: "right",
    render: formatMoney,
  },
  {
    title: "Bucket result",
    key: "bucketResult",
    width: 150,
    align: "right",
    render: (_, record) => {
      if (record.commissionType !== "sales_bucket") return "Not eligible";
      if (record.bucketCount === 0) return "Below first bucket";
      return `${record.bucketCount} ${record.bucketCount === 1 ? "bucket" : "buckets"}`;
    },
  },
  {
    title: "Daily commission",
    dataIndex: "commission",
    width: 160,
    align: "right",
    render: (value: number) => <Text strong>{formatMoney(value)}</Text>,
  },
];

export function PayrollPage() {
  const [month, setMonth] = useState(getBangkokMonth());
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const loadPayroll = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch(
        `/api/employees/payroll?month=${encodeURIComponent(month)}`,
        { signal },
      );
      const body = (await response.json().catch(() => undefined)) as
        | PayrollResponse
        | undefined;
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || `Request failed (${response.status}).`);
      }
      setPayroll(body.payroll || []);
    } catch (requestError) {
      if (!signal?.aborted) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Failed to calculate payroll.",
        );
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    const controller = new AbortController();
    void loadPayroll(controller.signal);
    return () => controller.abort();
  }, [loadPayroll]);

  const totals = useMemo(
    () => ({
      basePay: payroll.reduce((sum, record) => sum + record.basePay, 0),
      commission: payroll.reduce((sum, record) => sum + record.commission, 0),
      totalPay: payroll.reduce((sum, record) => sum + record.totalPay, 0),
    }),
    [payroll],
  );

  const columns: ColumnsType<PayrollRecord> = [
    {
      title: "Employee",
      key: "employee",
      fixed: "left",
      width: 220,
      render: (_, record) => (
        <div className={styles.employeeCell}>
          <Text strong>{record.employeeName}</Text>
          <Text type="secondary">{record.employeeId}</Text>
        </div>
      ),
    },
    {
      title: "Pay type",
      dataIndex: "compensationType",
      width: 105,
      render: (type: PayrollRecord["compensationType"]) =>
        type ? (
          <Tag color={type === "daily" ? "blue" : "purple"}>
            {type === "daily" ? "Daily" : "Monthly"}
          </Tag>
        ) : (
          <Tag>No rate</Tag>
        ),
    },
    {
      title: "Attendance",
      key: "attendance",
      width: 185,
      render: (_, record) => (
        <Space size={[4, 4]} wrap>
          <Tag color="green">{record.workedDays} worked</Tag>
          <Tag color="gold">{record.leaveDays} leave</Tag>
        </Space>
      ),
    },
    {
      title: "Base rate",
      key: "baseSalary",
      width: 155,
      align: "right",
      render: (_, record) => (
        <div className={styles.moneyCell}>
          <Text>{formatMoney(record.baseSalary)}</Text>
          {record.effectiveFrom ? (
            <Text type="secondary">From {record.effectiveFrom}</Text>
          ) : null}
        </div>
      ),
    },
    {
      title: "Base pay",
      dataIndex: "basePay",
      width: 140,
      align: "right",
      render: formatMoney,
    },
    {
      title: "Eligible sales",
      dataIndex: "commissionSales",
      width: 145,
      align: "right",
      render: (value: number, record) =>
        record.commissionType === "sales_bucket"
          ? formatMoney(value)
          : "-",
    },
    {
      title: "Commission rule",
      key: "commissionRule",
      width: 190,
      align: "right",
      render: (_, record) =>
        record.commissionType === "sales_bucket" ? (
          <div className={styles.moneyCell}>
            <Text>
              {formatMoney(record.commissionBucketAmount)} /{" "}
              {formatMoney(record.commissionBucketSales)}
            </Text>
            <Text type="secondary">
              Round at {formatMoney(record.commissionRoundupThreshold)}
            </Text>
          </div>
        ) : (
          "None"
        ),
    },
    {
      title: "Commission",
      dataIndex: "commission",
      width: 140,
      align: "right",
      render: formatMoney,
    },
    {
      title: "Total pay",
      dataIndex: "totalPay",
      fixed: "right",
      width: 150,
      align: "right",
      render: (value: number) => <Text strong>{formatMoney(value)}</Text>,
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
      <div className={styles.appShell}>
        <main className={styles.content}>
          <header className={styles.pageHeader}>
            <div>
              <Text className={styles.eyebrow}>Human resources</Text>
              <Title level={1}>Payroll</Title>
              <Text type="secondary">
                Monthly pay ignores leave. Daily pay uses recorded workdays.
              </Text>
            </div>
            <Space className={styles.pageActions} wrap>
              <Button href="/employees" icon={<ArrowLeftOutlined />}>
                Employees
              </Button>
              <Button
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={() => void loadPayroll()}
              >
                Refresh
              </Button>
            </Space>
          </header>

          {error ? (
            <Alert className={styles.alert} title={error} showIcon type="error" />
          ) : null}

          <Card className={styles.filterCard}>
            <label className={styles.monthField}>
              <span>Payroll month</span>
              <Select
                aria-label="Payroll month"
                options={getPayrollMonthOptions()}
                optionFilterProp="label"
                showSearch
                value={month}
                onChange={setMonth}
              />
            </label>
          </Card>

          <Row className={styles.summaryGrid} gutter={[12, 12]}>
            <Col xs={24} sm={6}>
              <Card><Statistic prefix={<CalculatorOutlined />} title="Employees" value={payroll.length} /></Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card><Statistic precision={2} prefix="฿" title="Base pay" value={totals.basePay} /></Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card><Statistic precision={2} prefix="฿" title="Commission" value={totals.commission} /></Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card><Statistic precision={2} prefix="฿" title="Total payroll" value={totals.totalPay} /></Card>
            </Col>
          </Row>

          <Alert
            className={styles.ruleAlert}
            title="Calculation rules"
            description="Monthly: full base salary. Daily: base rate × workday units. Commission: synced net sales for the selected shop and work date earn one configured amount per full sales bucket; a remainder at the round-up threshold earns the next bucket. Sales below the first full bucket earn no commission. A half day counts as 0.5."
            showIcon
            type="info"
          />

          <Card className={styles.tableCard}>
            <Table
              columns={columns}
              dataSource={payroll}
              loading={loading}
              locale={{ emptyText: "No employees found for this payroll month." }}
              pagination={false}
              rowKey="employeeId"
              scroll={{ x: 1430 }}
              expandable={{
                expandRowByClick: true,
                expandedRowRender: (record) => (
                  <div className={styles.dailyBreakdown}>
                    <Text strong>Daily sales and commission</Text>
                    <Table
                      columns={dailyCommissionColumns}
                      dataSource={record.dailyCommissions}
                      locale={{ emptyText: "No worked days recorded." }}
                      pagination={false}
                      rowKey={(dailyRecord) =>
                        `${dailyRecord.date}:${dailyRecord.shopId}`
                      }
                      scroll={{ x: 960 }}
                      size="small"
                    />
                  </div>
                ),
                rowExpandable: (record) => record.dailyCommissions.length > 0,
              }}
              summary={(records) => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} />
                  <Table.Summary.Cell index={1} colSpan={4}>
                    <Text strong>Total</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell align="right" index={5}>
                    <Text strong>{formatMoney(records.reduce((sum, record) => sum + record.basePay, 0))}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell align="right" index={6}>
                    <Text strong>{formatMoney(records.reduce((sum, record) => sum + record.commissionSales, 0))}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell align="right" index={7}>
                    <Text type="secondary">-</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell align="right" index={8}>
                    <Text strong>{formatMoney(records.reduce((sum, record) => sum + record.commission, 0))}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell align="right" index={9}>
                    <Text strong>{formatMoney(records.reduce((sum, record) => sum + record.totalPay, 0))}</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
          </Card>
        </main>
      </div>
    </ConfigProvider>
  );
}

function getBangkokMonth(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  return `${year}-${month}`;
}

function getPayrollMonthOptions(): Array<{ label: string; value: string }> {
  const [currentYear, currentMonth] = getBangkokMonth().split("-").map(Number);
  return Array.from({ length: 120 }, (_, index) => {
    const date = new Date(Date.UTC(currentYear, currentMonth - 1 - index, 1));
    return {
      label: new Intl.DateTimeFormat("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(date),
      value: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
    };
  });
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
