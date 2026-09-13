"use client";

import {
  ArrowLeftOutlined,
  CalendarOutlined,
  DashboardOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  ConfigProvider,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import styles from "./salesProfitSummary.module.css";

const { Text, Title } = Typography;
const { TextArea } = Input;

type ProfitMetrics = {
  netItems: number;
  netSales: number;
  averageSellingPrice: number;
  averageItemCost: number;
  unitGrossProfit: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
};

type ShopProfitRow = ProfitMetrics & {
  accountId: string;
  shopName: string;
  expenseNote: string;
  syncedAverageItemCost: number;
  hasItemCostOverride: boolean;
  itemCostOverrideNote: string;
};

type MonthProfitRow = ProfitMetrics & {
  month: string;
  shops: ShopProfitRow[];
  shopExpenses: number;
  sharedExpenseTotal: number;
  sharedExpenses: SharedExpenseRow[];
};

type SharedExpenseRow = {
  id: string;
  amount: number;
  category: string;
  name: string;
  note: string;
};

type ProfitSummaryResponse = {
  ok: boolean;
  source?: "google_sheets";
  year?: string;
  months?: MonthProfitRow[];
  totals?: ProfitMetrics;
  error?: string;
};

type ExpenseFormValues = {
  amount: number;
  note?: string;
};

type CostOverrideFormValues = {
  averageItemCost: number;
  note?: string;
};

type SharedExpenseFormValues = {
  amount: number;
  category: string;
  name: string;
  note?: string;
};

type SelectedExpense = {
  month: string;
  shop: ShopProfitRow;
};

type SelectedSharedExpense = {
  month: string;
  expense?: SharedExpenseRow;
};

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

export function SalesProfitSummaryPage() {
  const [expenseForm] = Form.useForm<ExpenseFormValues>();
  const [costForm] = Form.useForm<CostOverrideFormValues>();
  const [sharedExpenseForm] = Form.useForm<SharedExpenseFormValues>();
  const [year, setYear] = useState(getBangkokYear);
  const [summary, setSummary] = useState<ProfitSummaryResponse>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<SelectedExpense>();
  const [selectedCost, setSelectedCost] = useState<SelectedExpense>();
  const [selectedSharedExpense, setSelectedSharedExpense] =
    useState<SelectedSharedExpense>();
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [costModalOpen, setCostModalOpen] = useState(false);
  const [sharedExpenseModalOpen, setSharedExpenseModalOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const loadSummary = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(undefined);
      try {
        const response = await requestProfitSummary(
          `/api/sales/profit-summary?year=${encodeURIComponent(year)}`,
          { signal },
        );
        setSummary(response);
      } catch (requestError) {
        if (!signal?.aborted) setError(getErrorMessage(requestError));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [year],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadSummary(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadSummary]);

  const openExpenseModal = (month: string, shop: ShopProfitRow) => {
    setSelectedExpense({ month, shop });
    expenseForm.setFieldsValue({
      amount: shop.expenses,
      note: shop.expenseNote,
    });
    setExpenseModalOpen(true);
  };

  const openCostModal = (month: string, shop: ShopProfitRow) => {
    setSelectedCost({ month, shop });
    costForm.setFieldsValue({
      averageItemCost: shop.averageItemCost,
      note: shop.itemCostOverrideNote,
    });
    setCostModalOpen(true);
  };

  const openSharedExpenseModal = (
    month: string,
    expense?: SharedExpenseRow,
  ) => {
    setSelectedSharedExpense({ month, expense });
    sharedExpenseForm.setFieldsValue({
      amount: expense?.amount,
      category: expense?.category || "RENT",
      name: expense?.name || "",
      note: expense?.note || "",
    });
    setSharedExpenseModalOpen(true);
  };

  const saveExpense = async (values: ExpenseFormValues) => {
    if (!selectedExpense) return;
    setSubmitting(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await requestProfitSummary("/api/sales/profit-summary/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedExpense.shop.accountId,
          amount: values.amount,
          month: selectedExpense.month,
          note: values.note || "",
        }),
      });
      setNotice(
        `Expense saved for ${selectedExpense.shop.shopName}, ${formatMonth(
          selectedExpense.month,
        )}.`,
      );
      setExpenseModalOpen(false);
      expenseForm.resetFields();
      await loadSummary();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const saveCostOverride = async (values: CostOverrideFormValues) => {
    if (!selectedCost) return;
    setSubmitting(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await requestProfitSummary(
        "/api/sales/profit-summary/cost-overrides",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: selectedCost.shop.accountId,
            averageItemCost: values.averageItemCost,
            month: selectedCost.month,
            note: values.note || "",
          }),
        },
      );
      setNotice(
        `Average item cost saved for ${
          selectedCost.shop.shopName
        }, ${formatMonth(selectedCost.month)}.`,
      );
      setCostModalOpen(false);
      costForm.resetFields();
      await loadSummary();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const resetCostOverride = async () => {
    if (!selectedCost) return;
    setSubmitting(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await requestProfitSummary(
        "/api/sales/profit-summary/cost-overrides",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: selectedCost.shop.accountId,
            month: selectedCost.month,
          }),
        },
      );
      setNotice(
        `Using synced item cost for ${
          selectedCost.shop.shopName
        }, ${formatMonth(selectedCost.month)}.`,
      );
      setCostModalOpen(false);
      costForm.resetFields();
      await loadSummary();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const saveSharedExpense = async (values: SharedExpenseFormValues) => {
    if (!selectedSharedExpense) return;
    setSubmitting(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await requestProfitSummary("/api/sales/profit-summary/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          id: selectedSharedExpense.expense?.id,
          month: selectedSharedExpense.month,
          note: values.note || "",
          scope: "SHARED",
        }),
      });
      setNotice(
        `Shared expense saved for ${formatMonth(
          selectedSharedExpense.month,
        )}.`,
      );
      setSharedExpenseModalOpen(false);
      sharedExpenseForm.resetFields();
      await loadSummary();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const removeSharedExpense = async (expense: SharedExpenseRow) => {
    setSubmitting(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await requestProfitSummary("/api/sales/profit-summary/expenses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: expense.id }),
      });
      setNotice(`${expense.name} removed.`);
      await loadSummary();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const monthColumns: ColumnsType<MonthProfitRow> = [
    {
      title: "Month",
      dataIndex: "month",
      fixed: "left",
      width: 150,
      render: (value: string) => <Text strong>{formatMonth(value)}</Text>,
    },
    ...createMetricColumns<MonthProfitRow>(),
  ];

  const createShopColumns = (month: string): ColumnsType<ShopProfitRow> => [
    {
      title: "Shop",
      dataIndex: "shopName",
      fixed: "left",
      width: 170,
      render: (value: string) => <Text strong>{value}</Text>,
    },
    ...createMetricColumns<ShopProfitRow>({
      averageItemCostWidth: 205,
      renderAverageItemCost: (value, shop) => (
        <Space size={4}>
          <Text>{formatMoney(value)}</Text>
          {shop.hasItemCostOverride ? <Tag color="blue">Manual</Tag> : null}
          <Tooltip title="Edit average item cost">
            <Button
              aria-label={`Edit average item cost for ${shop.shopName}`}
              icon={<EditOutlined />}
              size="small"
              type="text"
              onClick={() => openCostModal(month, shop)}
            />
          </Tooltip>
        </Space>
      ),
    }),
    {
      title: "Expense",
      key: "edit",
      fixed: "right",
      width: 70,
      render: (_, shop) => (
        <Tooltip title="Edit expense">
          <Button
            aria-label={`Edit expense for ${shop.shopName}`}
            icon={<EditOutlined />}
            onClick={() => openExpenseModal(month, shop)}
          />
        </Tooltip>
      ),
    },
  ];

  const createSharedExpenseColumns = (
    month: string,
  ): ColumnsType<SharedExpenseRow> => [
    {
      title: "Expense",
      dataIndex: "name",
      width: 220,
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: "Category",
      dataIndex: "category",
      width: 130,
      render: (value: string) => <Tag>{formatCategory(value)}</Tag>,
    },
    {
      title: "Amount",
      dataIndex: "amount",
      align: "right",
      width: 150,
      render: formatMoney,
    },
    {
      title: "Note",
      dataIndex: "note",
      ellipsis: true,
    },
    {
      title: "Actions",
      key: "actions",
      align: "right",
      width: 96,
      render: (_, expense) => (
        <Space size={2}>
          <Tooltip title="Edit shared expense">
            <Button
              aria-label={`Edit ${expense.name}`}
              icon={<EditOutlined />}
              size="small"
              type="text"
              onClick={() => openSharedExpenseModal(month, expense)}
            />
          </Tooltip>
          <Popconfirm
            cancelText="Cancel"
            okButtonProps={{ danger: true, loading: submitting }}
            okText="Delete"
            title={`Delete ${expense.name}?`}
            onConfirm={() => removeSharedExpense(expense)}
          >
            <Tooltip title="Delete shared expense">
              <Button
                aria-label={`Delete ${expense.name}`}
                danger
                icon={<DeleteOutlined />}
                size="small"
                type="text"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const totals = summary?.totals;

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
              <Title level={1}>Profit summary</Title>
              <Text type="secondary">
                Profit analysis from completed Google Sheets sales syncs.
              </Text>
            </div>
            <Space className={styles.pageActions} wrap>
              <Button href="/sales" icon={<ArrowLeftOutlined />}>
                Sales
              </Button>
              <Button href="/sales/dashboard" icon={<DashboardOutlined />}>
                Dashboard
              </Button>
              <Button
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={() => void loadSummary()}
              >
                Refresh
              </Button>
            </Space>
          </header>

          {error ? (
            <Alert
              closable
              className={styles.alert}
              message={error}
              showIcon
              type="error"
              onClose={() => setError(undefined)}
            />
          ) : null}
          {notice ? (
            <Alert
              closable
              className={styles.alert}
              message={notice}
              showIcon
              type="success"
              onClose={() => setNotice(undefined)}
            />
          ) : null}
          {(summary?.totals?.netItems || 0) !== 0 &&
          (summary?.totals?.averageItemCost || 0) === 0 ? (
            <Alert
              className={styles.alert}
              message="Synced item cost is zero"
              description="Gross profit currently equals net sales until item cost is available in synced receipt items."
              showIcon
              type="warning"
            />
          ) : null}

          <Card className={styles.filterCard}>
            <div className={styles.yearField}>
              <Text className={styles.fieldLabel}>Year</Text>
              <DatePicker
                allowClear={false}
                aria-label="Profit summary year"
                className={styles.fullWidth}
                format="YYYY"
                picker="year"
                suffixIcon={<CalendarOutlined />}
                value={dayjs(`${year}-01-01`)}
                onChange={(_, value) => setYear(getPickerValue(value))}
              />
            </div>
          </Card>

          <Row className={styles.summaryGrid} gutter={[12, 12]}>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="Net sales" value={formatMoney(totals?.netSales || 0)} />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic
                  title="Gross profit"
                  value={formatMoney(totals?.grossProfit || 0)}
                />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="Expenses" value={formatMoney(totals?.expenses || 0)} />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic
                  title="Net profit"
                  value={formatMoney(totals?.netProfit || 0)}
                  valueStyle={{
                    color: (totals?.netProfit || 0) < 0 ? "#b42318" : "#157347",
                  }}
                />
              </Card>
            </Col>
          </Row>

          <Card className={styles.tableCard}>
            <Table
              columns={monthColumns}
              dataSource={summary?.months || []}
              expandable={{
                expandedRowRender: (monthRow) => (
                  <div className={styles.expandedContent}>
                    <Table
                      className={styles.shopTable}
                      columns={createShopColumns(monthRow.month)}
                      dataSource={monthRow.shops}
                      pagination={false}
                      rowKey="accountId"
                      scroll={{ x: 1370 }}
                      size="small"
                    />
                    <div className={styles.sharedExpensesSection}>
                      <div className={styles.sharedExpensesHeader}>
                        <Space>
                          <Text strong>Shared expenses</Text>
                          <Text type="secondary">
                            {formatMoney(monthRow.sharedExpenseTotal)}
                          </Text>
                        </Space>
                        <Button
                          icon={<PlusOutlined />}
                          onClick={() => openSharedExpenseModal(monthRow.month)}
                        >
                          Add shared expense
                        </Button>
                      </div>
                      <Table
                        columns={createSharedExpenseColumns(monthRow.month)}
                        dataSource={monthRow.sharedExpenses}
                        locale={{ emptyText: "No shared expenses for this month." }}
                        pagination={false}
                        rowKey="id"
                        scroll={{ x: 760 }}
                        size="small"
                      />
                    </div>
                  </div>
                ),
                rowExpandable: () => true,
              }}
              loading={loading}
              locale={{ emptyText: "No completed sales syncs for this year." }}
              pagination={false}
              rowKey="month"
              scroll={{ x: 1300 }}
              size="middle"
            />
          </Card>
        </main>
      </div>

      <Modal
        destroyOnHidden
        open={sharedExpenseModalOpen}
        title={`${
          selectedSharedExpense?.expense ? "Edit" : "Add"
        } shared expense - ${formatMonth(selectedSharedExpense?.month || "")}`}
        okText="Save expense"
        confirmLoading={submitting}
        onCancel={() => {
          setSharedExpenseModalOpen(false);
          sharedExpenseForm.resetFields();
        }}
        onOk={() => sharedExpenseForm.submit()}
      >
        <Form
          form={sharedExpenseForm}
          layout="vertical"
          requiredMark="optional"
          onFinish={(values) => void saveSharedExpense(values)}
        >
          <Form.Item
            label="Expense name"
            name="name"
            rules={[
              { required: true, message: "Enter an expense name." },
              { max: 100 },
            ]}
          >
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item
            label="Category"
            name="category"
            rules={[{ required: true, message: "Select a category." }]}
          >
            <Select
              options={[
                { label: "Rent", value: "RENT" },
                { label: "Utilities", value: "UTILITIES" },
                { label: "Salary", value: "SALARY" },
                { label: "Other", value: "OTHER" },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="Amount"
            name="amount"
            rules={[
              { required: true, message: "Enter the expense amount." },
              { type: "number", min: 0, message: "Amount cannot be negative." },
            ]}
          >
            <InputNumber
              addonAfter="THB"
              className={styles.fullWidth}
              min={0}
              precision={2}
              step={100}
            />
          </Form.Item>
          <Form.Item label="Note" name="note" rules={[{ max: 200 }]}>
            <TextArea maxLength={200} rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        destroyOnHidden
        open={expenseModalOpen}
        title={`Expense for ${selectedExpense?.shop.shopName || "shop"}`}
        okText="Save expense"
        confirmLoading={submitting}
        onCancel={() => {
          setExpenseModalOpen(false);
          expenseForm.resetFields();
        }}
        onOk={() => expenseForm.submit()}
      >
        <Form
          form={expenseForm}
          layout="vertical"
          requiredMark="optional"
          onFinish={(values) => void saveExpense(values)}
        >
          <Form.Item
            label="Expense amount"
            name="amount"
            rules={[
              { required: true, message: "Enter the expense amount." },
              { type: "number", min: 0, message: "Expense cannot be negative." },
            ]}
          >
            <InputNumber
              addonAfter="THB"
              className={styles.fullWidth}
              min={0}
              precision={2}
              step={100}
            />
          </Form.Item>
          <Form.Item label="Note" name="note" rules={[{ max: 200 }]}>
            <TextArea maxLength={200} rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        destroyOnHidden
        open={costModalOpen}
        title={`Average item cost for ${
          selectedCost?.shop.shopName || "shop"
        }`}
        okText="Save item cost"
        confirmLoading={submitting}
        onCancel={() => {
          setCostModalOpen(false);
          costForm.resetFields();
        }}
        onOk={() => costForm.submit()}
      >
        <Form
          form={costForm}
          layout="vertical"
          requiredMark="optional"
          onFinish={(values) => void saveCostOverride(values)}
        >
          <Form.Item
            label="Average item cost"
            name="averageItemCost"
            rules={[
              { required: true, message: "Enter the average item cost." },
              {
                type: "number",
                min: 0,
                message: "Average item cost cannot be negative.",
              },
            ]}
          >
            <InputNumber
              addonAfter="THB"
              className={styles.fullWidth}
              min={0}
              precision={2}
              step={1}
            />
          </Form.Item>
          <Form.Item label="Note" name="note" rules={[{ max: 200 }]}>
            <TextArea maxLength={200} rows={3} />
          </Form.Item>
          <Alert
            message={`Synced average: ${formatMoney(
              selectedCost?.shop.syncedAverageItemCost || 0,
            )}`}
            showIcon
            type="info"
          />
          {selectedCost?.shop.hasItemCostOverride ? (
            <Button
              block
              danger
              disabled={submitting}
              onClick={() => void resetCostOverride()}
            >
              Use synced cost
            </Button>
          ) : null}
        </Form>
      </Modal>
    </ConfigProvider>
  );
}

function createMetricColumns<T extends ProfitMetrics>(
  options?: {
    averageItemCostWidth?: number;
    renderAverageItemCost?: (value: number, row: T) => ReactNode;
  },
): ColumnsType<T> {
  return [
    {
      title: "Net items",
      dataIndex: "netItems",
      key: "netItems",
      align: "right",
      width: 100,
      render: formatNumber,
    },
    {
      title: "Net sales",
      dataIndex: "netSales",
      key: "netSales",
      align: "right",
      width: 145,
      render: formatMoney,
    },
    {
      title: "Avg. selling price",
      dataIndex: "averageSellingPrice",
      key: "averageSellingPrice",
      align: "right",
      width: 155,
      render: formatMoney,
    },
    {
      title: "Avg. item cost",
      dataIndex: "averageItemCost",
      key: "averageItemCost",
      align: "right",
      width: options?.averageItemCostWidth || 145,
      render: options?.renderAverageItemCost || formatMoney,
    },
    {
      title: "Unit gross profit",
      dataIndex: "unitGrossProfit",
      key: "unitGrossProfit",
      align: "right",
      width: 155,
      render: formatMoney,
    },
    {
      title: "Gross profit",
      dataIndex: "grossProfit",
      key: "grossProfit",
      align: "right",
      width: 145,
      render: formatMoney,
    },
    {
      title: "Expenses",
      dataIndex: "expenses",
      key: "expenses",
      align: "right",
      width: 135,
      render: formatMoney,
    },
    {
      title: "Net profit",
      dataIndex: "netProfit",
      key: "netProfit",
      align: "right",
      width: 145,
      render: (value: number) => (
        <Text strong type={value < 0 ? "danger" : undefined}>
          {formatMoney(value)}
        </Text>
      ),
    },
  ];
}

async function requestProfitSummary(
  url: string,
  init?: RequestInit,
): Promise<ProfitSummaryResponse> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => undefined)) as
    | ProfitSummaryResponse
    | undefined;
  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || `Request failed (${response.status}).`);
  }
  return body;
}

function getBangkokYear(): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).format(new Date());
}

function getPickerValue(value: string | string[] | null): string {
  if (value === null) return getBangkokYear();
  return Array.isArray(value) ? value[0] || getBangkokYear() : value;
}

function formatMonth(value: string): string {
  return dayjs(`${value}-01`).format("MMMM YYYY");
}

function formatCategory(value: string): string {
  const labels: Record<string, string> = {
    RENT: "Rent",
    UTILITIES: "Utilities",
    SALARY: "Salary",
    OTHER: "Other",
  };
  return labels[value] || value;
}

function formatMoney(value: number): string {
  return MONEY_FORMATTER.format(value);
}

function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error.";
}
