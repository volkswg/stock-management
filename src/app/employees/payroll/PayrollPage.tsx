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

type PayrollRecord = {
  employeeId: string;
  employeeName: string;
  compensationType: "daily" | "monthly" | null;
  effectiveFrom: string;
  baseSalary: number;
  commission: number;
  workedDays: number;
  leaveDays: number;
  basePay: number;
  totalPay: number;
};

type PayrollResponse = {
  ok: boolean;
  month?: string;
  payroll?: PayrollRecord[];
  error?: string;
};

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
            description="Monthly: full base salary. Daily: base rate × recorded workday units. A half day counts as 0.5. Commission is added once for the month."
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
              scroll={{ x: 1095 }}
              summary={(records) => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={4}>
                    <Text strong>Total</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell align="right" index={4}>
                    <Text strong>{formatMoney(records.reduce((sum, record) => sum + record.basePay, 0))}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell align="right" index={5}>
                    <Text strong>{formatMoney(records.reduce((sum, record) => sum + record.commission, 0))}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell align="right" index={6}>
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
