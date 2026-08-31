"use client";

import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CarryOutOutlined,
  CheckCircleOutlined,
  LeftOutlined,
  LoginOutlined,
  LogoutOutlined,
  ReloadOutlined,
  RightOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  ConfigProvider,
  DatePicker,
  Form,
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
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./employeeTimesheets.module.css";

const { Text, Title } = Typography;

type Employee = {
  id: string;
  name: string;
  phone: string;
  status: "active" | "inactive";
};

type Shop = {
  id: string;
  name: string;
};

type EmployeeTimesheet = {
  id: string;
  employeeId: string;
  shopId: string;
  status: "work" | "leave";
  isOpen: boolean;
  createdAt: string;
  updatedAt: string;
};

type TimesheetResponse = {
  ok: boolean;
  employees?: Employee[];
  shops?: Shop[];
  timesheets?: EmployeeTimesheet[];
  error?: string;
};

type TimesheetFormValues = {
  date: Dayjs;
  employeeId: string;
  shopId: string;
};

export function EmployeeTimesheetsPage() {
  const [form] = Form.useForm<TimesheetFormValues>();
  const [date, setDate] = useState(getBangkokDate);
  const [shopId, setShopId] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [timesheets, setTimesheets] = useState<EmployeeTimesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [clockingOutId, setClockingOutId] = useState<string>();
  const [modalStatus, setModalStatus] = useState<"work" | "leave">("work");
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const loadTimesheets = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(undefined);
      const query = new URLSearchParams({ date });
      if (shopId) query.set("shopId", shopId);
      try {
        const response = await requestTimesheets(
          `/api/employees/timesheets?${query.toString()}`,
          { signal },
        );
        setEmployees(response.employees || []);
        setShops(response.shops || []);
        setTimesheets(response.timesheets || []);
      } catch (requestError) {
        if (!signal?.aborted) setError(getErrorMessage(requestError));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [date, shopId],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadTimesheets(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadTimesheets]);

  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );
  const shopById = useMemo(
    () => new Map(shops.map((shop) => [shop.id, shop])),
    [shops],
  );
  const unavailableEmployeeIds = useMemo(
    () =>
      new Set(
        timesheets
          .filter((timesheet) =>
            modalStatus === "leave"
              ? true
              : timesheet.isOpen || timesheet.status === "leave",
          )
          .map((timesheet) => timesheet.employeeId),
      ),
    [modalStatus, timesheets],
  );
  const availableEmployees = employees.filter(
    (employee) =>
      employee.status === "active" &&
      !unavailableEmployeeIds.has(employee.id),
  );
  const activeShifts = timesheets.filter(
    (timesheet) => timesheet.status === "work" && timesheet.isOpen,
  ).length;
  const workShifts = timesheets.filter(
    (timesheet) => timesheet.status === "work",
  ).length;
  const leaveCount = timesheets.length - workShifts;
  const completedMinutes = timesheets.reduce(
    (total, timesheet) =>
      timesheet.status === "work" && !timesheet.isOpen
        ? total + getDurationMinutes(timesheet.createdAt, timesheet.updatedAt)
        : total,
    0,
  );

  const openTimesheetModal = (status: "work" | "leave") => {
    setModalStatus(status);
    form.setFieldsValue({
      date: dayjs(date),
      employeeId: undefined,
      shopId: shopId || shops[0]?.id,
    });
    setModalOpen(true);
  };

  const addTimesheet = async (values: TimesheetFormValues) => {
    setSubmitting(true);
    setError(undefined);
    setNotice(undefined);
    const clockInDate = values.date.format("YYYY-MM-DD");
    try {
      await requestTimesheets("/api/employees/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: clockInDate,
          employeeId: values.employeeId,
          shopId: values.shopId,
          status: modalStatus,
        }),
      });
      const employee = employeeById.get(values.employeeId);
      setNotice(
        modalStatus === "work"
          ? `${employee?.name || "Employee"} clocked in.`
          : `Leave recorded for ${employee?.name || "employee"}.`,
      );
      setModalOpen(false);
      form.resetFields();
      if (clockInDate === date) {
        await loadTimesheets();
      } else {
        setDate(clockInDate);
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const clockOut = async (timesheet: EmployeeTimesheet) => {
    setClockingOutId(timesheet.id);
    setError(undefined);
    setNotice(undefined);
    try {
      await requestTimesheets(
        `/api/employees/timesheets/${encodeURIComponent(timesheet.id)}`,
        { method: "PATCH" },
      );
      const employee = employeeById.get(timesheet.employeeId);
      setNotice(`${employee?.name || "Employee"} clocked out.`);
      await loadTimesheets();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setClockingOutId(undefined);
    }
  };

  const columns: ColumnsType<EmployeeTimesheet> = [
    {
      title: "Employee",
      dataIndex: "employeeId",
      fixed: "left",
      width: 210,
      render: (employeeId: string) => (
        <div className={styles.employeeCell}>
          <Text strong>{employeeById.get(employeeId)?.name || employeeId}</Text>
          <Text type="secondary">{employeeId}</Text>
        </div>
      ),
    },
    {
      title: "Shop",
      dataIndex: "shopId",
      width: 170,
      render: (value: string) => shopById.get(value)?.name || value,
    },
    {
      title: "Clock in",
      key: "clockIn",
      width: 145,
      render: (_, timesheet) =>
        timesheet.status === "work"
          ? formatDateTime(timesheet.createdAt)
          : "-",
    },
    {
      title: "Clock out",
      key: "clockOut",
      width: 145,
      render: (_, timesheet) =>
        timesheet.status === "work" && !timesheet.isOpen
          ? formatDateTime(timesheet.updatedAt)
          : "-",
    },
    {
      title: "Duration",
      key: "duration",
      width: 115,
      render: (_, timesheet) =>
        timesheet.status === "leave"
          ? "-"
          : formatDuration(
              getDurationMinutes(
                timesheet.createdAt,
                timesheet.isOpen
                  ? new Date().toISOString()
                  : timesheet.updatedAt,
              ),
            ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 120,
      render: (status: EmployeeTimesheet["status"]) => (
        <Tag color={status === "work" ? "processing" : "gold"}>
          {status === "work" ? "Work" : "Leave"}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 82,
      render: (_, timesheet) =>
        timesheet.status === "work" && timesheet.isOpen ? (
          <Popconfirm
            title="Clock out employee?"
            description="The current time will be saved as the clock-out time."
            okText="Clock out"
            onConfirm={() => clockOut(timesheet)}
          >
            <Tooltip title="Clock out">
              <Button
                aria-label={`Clock out ${
                  employeeById.get(timesheet.employeeId)?.name ||
                  timesheet.employeeId
                }`}
                icon={<LogoutOutlined />}
                loading={clockingOutId === timesheet.id}
              />
            </Tooltip>
          </Popconfirm>
        ) : timesheet.status === "work" ? (
          <CheckCircleOutlined className={styles.completedIcon} />
        ) : (
          <CarryOutOutlined className={styles.leaveIcon} />
        ),
    },
  ];

  const isToday = date === getBangkokDate();

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
              <Text className={styles.eyebrow}>Employees</Text>
              <Title level={1}>Timesheet tracker</Title>
              <Text type="secondary">
                Track employee attendance by shop and business date.
              </Text>
            </div>
            <Space className={styles.pageActions} wrap>
              <Button href="/employees" icon={<ArrowLeftOutlined />}>
                Employees
              </Button>
              <Button
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={() => void loadTimesheets()}
              >
                Refresh
              </Button>
              <Button
                href="/employees/timesheets/summary"
                icon={<CalendarOutlined />}
              >
                Monthly summary
              </Button>
              <Tooltip title={shops.length ? "" : "No shops are configured."}>
                <Button
                  disabled={shops.length === 0}
                  icon={<LoginOutlined />}
                  type="primary"
                  onClick={() => openTimesheetModal("work")}
                >
                  Clock in
                </Button>
              </Tooltip>
              <Tooltip title={shops.length ? "" : "No shops are configured."}>
                <Button
                  disabled={shops.length === 0}
                  icon={<CarryOutOutlined />}
                  onClick={() => openTimesheetModal("leave")}
                >
                  Leave
                </Button>
              </Tooltip>
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

          <Card className={styles.filterCard}>
            <div className={styles.filters}>
              <div>
                <Text className={styles.fieldLabel}>Business date</Text>
                <Space.Compact className={styles.dateControl} block>
                  <Tooltip title="Previous date">
                    <Button
                      aria-label="Previous date"
                      icon={<LeftOutlined />}
                      onClick={() =>
                        setDate(dayjs(date).subtract(1, "day").format("YYYY-MM-DD"))
                      }
                    />
                  </Tooltip>
                  <DatePicker
                    allowClear={false}
                    aria-label="Timesheet business date"
                    className={styles.datePicker}
                    disabledDate={(value) =>
                      value.startOf("day").isAfter(dayjs().startOf("day"))
                    }
                    format="YYYY-MM-DD"
                    suffixIcon={<CalendarOutlined />}
                    value={dayjs(date)}
                    onChange={(_, value) => setDate(getPickerValue(value))}
                  />
                  <Tooltip title="Next date">
                    <Button
                      aria-label="Next date"
                      disabled={isToday}
                      icon={<RightOutlined />}
                      onClick={() =>
                        setDate(dayjs(date).add(1, "day").format("YYYY-MM-DD"))
                      }
                    />
                  </Tooltip>
                </Space.Compact>
              </div>
              <div>
                <Text className={styles.fieldLabel}>Shop</Text>
                <Select
                  aria-label="Timesheet shop"
                  className={styles.fullWidth}
                  options={[
                    { label: "All shops", value: "" },
                    ...shops.map((shop) => ({
                      label: shop.name,
                      value: shop.id,
                    })),
                  ]}
                  value={shopId}
                  onChange={setShopId}
                />
              </div>
            </div>
          </Card>

          <Row className={styles.summaryGrid} gutter={[12, 12]}>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="Work records" value={workShifts} />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="Clocked in" value={activeShifts} />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="Leave" value={leaveCount} />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic
                  title="Completed hours"
                  precision={1}
                  suffix="h"
                  value={completedMinutes / 60}
                />
              </Card>
            </Col>
          </Row>

          <Card className={styles.tableCard}>
            <Table
              columns={columns}
              dataSource={timesheets}
              loading={loading}
              locale={{ emptyText: "No timesheets for this date." }}
              pagination={{ pageSize: 20, showSizeChanger: false }}
              rowKey="id"
              scroll={{ x: 1050 }}
            />
          </Card>
        </main>
      </div>

      <Modal
        destroyOnHidden
        open={modalOpen}
        title={modalStatus === "work" ? "Clock in employee" : "Record leave"}
        okText={modalStatus === "work" ? "Clock in" : "Record leave"}
        confirmLoading={submitting}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark="optional"
          onFinish={(values) => void addTimesheet(values)}
        >
          <Form.Item
            label={modalStatus === "work" ? "Clock-in date" : "Leave date"}
            name="date"
            rules={[{ required: true, message: "Select a date." }]}
          >
            <DatePicker
              className={styles.fullWidth}
              disabledDate={(value) =>
                value.startOf("day").isAfter(dayjs().startOf("day"))
              }
              format="YYYY-MM-DD"
            />
          </Form.Item>
          <Form.Item
            label="Employee"
            name="employeeId"
            rules={[{ required: true, message: "Select an employee." }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={availableEmployees.map((employee) => ({
                label: employee.name,
                value: employee.id,
              }))}
              placeholder="Select employee"
              notFoundContent="No active employees available."
            />
          </Form.Item>
          <Form.Item
            label="Shop"
            name="shopId"
            rules={[{ required: true, message: "Select a shop." }]}
          >
            <Select
              options={shops.map((shop) => ({
                label: shop.name,
                value: shop.id,
              }))}
              placeholder="Select shop"
            />
          </Form.Item>
          <Alert
            message={
              modalStatus === "work"
                ? "The current Bangkok time will be used with the selected date."
                : "Leave will be recorded for the selected business date."
            }
            showIcon
            type="info"
          />
        </Form>
      </Modal>
    </ConfigProvider>
  );
}

async function requestTimesheets(
  url: string,
  init?: RequestInit,
): Promise<TimesheetResponse> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => undefined)) as
    | TimesheetResponse
    | undefined;
  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || `Request failed (${response.status}).`);
  }
  return body;
}

function getBangkokDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).format(new Date());
}

function getPickerValue(value: string | string[] | null): string {
  if (value === null) return getBangkokDate();
  return Array.isArray(value) ? value[0] || getBangkokDate() : value;
}

function formatDateTime(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "short",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function getDurationMinutes(start: string, end: string): number {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 0;
  return Math.max(0, Math.round((endTime - startTime) / 60_000));
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error.";
}
