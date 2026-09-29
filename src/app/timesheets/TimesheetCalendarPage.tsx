"use client";

import {
  ArrowLeftOutlined,
  CalendarOutlined,
  LeftOutlined,
  ReloadOutlined,
  RightOutlined,
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
  Form,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./timesheetCalendar.module.css";

const { Text, Title } = Typography;

type Employee = {
  id: string;
  name: string;
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
  workdayType: "full" | "half" | null;
};

type SummaryResponse = {
  ok: boolean;
  employees?: Employee[];
  shops?: Shop[];
  timesheets?: EmployeeTimesheet[];
  error?: string;
};

type CalendarEntry = {
  employeeId: string;
  shopId: string;
  status: EmployeeTimesheet["status"];
  timesheetId: string;
  workdayType: EmployeeTimesheet["workdayType"];
};

type AddTimesheetFormValues = {
  employeeId: string;
  shopId: string;
  workdayType: "full" | "half";
};

export function TimesheetCalendarPage() {
  const [form] = Form.useForm<AddTimesheetFormValues>();
  const today = getBangkokDate();
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [shopId, setShopId] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [timesheets, setTimesheets] = useState<EmployeeTimesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addStatus, setAddStatus] = useState<"work" | "leave">("work");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const loadSummary = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(undefined);
      const query = new URLSearchParams({ month });
      if (shopId) query.set("shopId", shopId);
      try {
        const response = await requestSummary(
          `/api/employees/timesheets/summary?${query.toString()}`,
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
    [month, shopId],
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

  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );
  const shopById = useMemo(
    () => new Map(shops.map((shop) => [shop.id, shop])),
    [shops],
  );
  const entriesByDate = useMemo(() => {
    const result = new Map<string, Map<string, CalendarEntry>>();
    for (const timesheet of timesheets) {
      const date = getBangkokDate(timesheet.createdAt);
      const dateEntries = result.get(date) || new Map<string, CalendarEntry>();
      const existing = dateEntries.get(timesheet.employeeId);
      if (!existing || timesheet.status === "leave") {
        dateEntries.set(timesheet.employeeId, {
          employeeId: timesheet.employeeId,
          shopId: timesheet.shopId,
          status: timesheet.status,
          timesheetId: timesheet.id,
          workdayType: timesheet.workdayType,
        });
      }
      result.set(date, dateEntries);
    }
    return new Map(
      Array.from(result, ([date, dateEntries]) => [
        date,
        Array.from(dateEntries.values()).sort((left, right) =>
          getEmployeeName(left.employeeId, employeeById).localeCompare(
            getEmployeeName(right.employeeId, employeeById),
          ),
        ),
      ]),
    );
  }, [employeeById, timesheets]);
  const employeeDays = Array.from(entriesByDate.values()).flat();
  const workDays = employeeDays
    .filter((entry) => entry.status === "work")
    .reduce((total, entry) => total + (entry.workdayType === "half" ? 0.5 : 1), 0);
  const leaveDays = employeeDays.length - workDays;
  const recordedEmployees = new Set(
    employeeDays.map((entry) => entry.employeeId),
  ).size;
  const selectedRows = timesheets.filter(
    (timesheet) => getBangkokDate(timesheet.createdAt) === selectedDate,
  );
  const unavailableEmployeeIds = new Set(
    (addStatus === "leave"
      ? selectedRows
      : selectedRows.filter((timesheet) => timesheet.status === "leave")
    ).map((timesheet) => timesheet.employeeId),
  );
  const availableEmployees = employees.filter(
    (employee) =>
      employee.status === "active" &&
      !unavailableEmployeeIds.has(employee.id),
  );

  const openAddTimesheet = (date: string) => {
    if (date > today) return;
    setSelectedDate(date);
    setAddStatus("work");
    form.resetFields();
    form.setFieldsValue({
      shopId: shopId || shops[0]?.id,
      workdayType: "full",
    });
    setAddModalOpen(true);
  };

  const addTimesheet = async (values: AddTimesheetFormValues) => {
    setSubmitting(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await requestSummary("/api/employees/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          employeeId: values.employeeId,
          shopId: values.shopId,
          status: addStatus,
          workdayType: addStatus === "work" ? values.workdayType : undefined,
        }),
      });
      const employee = employeeById.get(values.employeeId);
      setNotice(
        addStatus === "work"
          ? `${employee?.name || "Employee"} work recorded.`
          : `Leave recorded for ${employee?.name || "employee"}.`,
      );
      setAddModalOpen(false);
      form.resetFields();
      await loadSummary();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const updateMonth = (value: string) => {
    if (!value) return;
    setMonth(value);
    setSelectedDate(value === today.slice(0, 7) ? today : `${value}-01`);
  };

  const columns: ColumnsType<EmployeeTimesheet> = [
    {
      title: "Employee",
      dataIndex: "employeeId",
      width: 220,
      render: (employeeId: string) => (
        <div className={styles.employeeCell}>
          <Text strong>{getEmployeeName(employeeId, employeeById)}</Text>
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
      title: "Status",
      dataIndex: "status",
      width: 110,
      render: (status: EmployeeTimesheet["status"]) => (
        <Tag color={status === "work" ? "success" : "gold"}>
          {status === "work" ? "Work" : "Leave"}
        </Tag>
      ),
    },
    {
      title: "Attendance",
      key: "attendance",
      width: 130,
      render: (_, timesheet) =>
        timesheet.status === "leave"
          ? "Leave"
          : timesheet.workdayType === "half"
            ? "Half day"
            : "Full day",
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
              <Text className={styles.eyebrow}>Timesheets</Text>
              <Title level={1}>Monthly timesheet summary</Title>
              <Text type="secondary">
                Review employee work and leave by business date.
              </Text>
            </div>
            <Space className={styles.pageActions} wrap>
              <Button
                href="/timesheets/tracker"
                icon={<ArrowLeftOutlined />}
              >
                Timesheet tracker
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
              title={error}
              showIcon
              type="error"
              onClose={() => setError(undefined)}
            />
          ) : null}
          {notice ? (
            <Alert
              closable
              className={styles.alert}
              title={notice}
              showIcon
              type="success"
              onClose={() => setNotice(undefined)}
            />
          ) : null}

          <Card className={styles.filterCard}>
            <div className={styles.filters}>
              <div>
                <Text className={styles.fieldLabel}>Month</Text>
                <Space.Compact className={styles.monthControl} block>
                  <Tooltip title="Previous month">
                    <Button
                      aria-label="Previous month"
                      icon={<LeftOutlined />}
                      onClick={() =>
                        updateMonth(
                          dayjs(`${month}-01`)
                            .subtract(1, "month")
                            .format("YYYY-MM"),
                        )
                      }
                    />
                  </Tooltip>
                  <DatePicker
                    allowClear={false}
                    aria-label="Timesheet summary month"
                    className={styles.monthPicker}
                    format="MMMM YYYY"
                    picker="month"
                    suffixIcon={<CalendarOutlined />}
                    value={dayjs(`${month}-01`)}
                    onChange={(_, value) => updateMonth(getPickerValue(value))}
                  />
                  <Tooltip title="Next month">
                    <Button
                      aria-label="Next month"
                      icon={<RightOutlined />}
                      onClick={() =>
                        updateMonth(
                          dayjs(`${month}-01`).add(1, "month").format("YYYY-MM"),
                        )
                      }
                    />
                  </Tooltip>
                </Space.Compact>
              </div>
              <div>
                <Text className={styles.fieldLabel}>Shop</Text>
                <Select
                  aria-label="Timesheet summary shop"
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
                <Statistic title="Employees recorded" value={recordedEmployees} />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="Employee work days" value={workDays} />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="Employee leave days" value={leaveDays} />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="Timesheet records" value={timesheets.length} />
              </Card>
            </Col>
          </Row>

          <Spin spinning={loading} tip="Loading monthly summary...">
            <Card
              className={styles.calendarCard}
              title="Attendance calendar"
              extra={
                <Space>
                  <Badge status="success" text="Work" />
                  <Badge status="warning" text="Leave" />
                </Space>
              }
            >
              <Text className={styles.calendarInstruction} type="secondary">
                Select a date up to today to add a work or leave entry.
              </Text>
              <div className={styles.calendarViewport}>
                <Calendar
                  className={styles.calendar}
                  disabledDate={(value) =>
                    value.format("YYYY-MM-DD") > today
                  }
                  headerRender={() => null}
                  value={dayjs(selectedDate)}
                  cellRender={(current, info) => {
                    if (
                      info.type !== "date" ||
                      current.format("YYYY-MM") !== month
                    ) {
                      return null;
                    }
                    const entries =
                      entriesByDate.get(current.format("YYYY-MM-DD")) || [];
                    if (!entries.length) return null;
                    const visibleEntries = entries.slice(0, 3);
                    return (
                      <ul className={styles.calendarEntries}>
                        {visibleEntries.map((entry) => (
                          <li
                            className={
                              entry.status === "work"
                                ? styles.workEntry
                                : styles.leaveEntry
                            }
                            key={entry.employeeId}
                          >
                            <a
                              className={styles.calendarEntryLink}
                              href={`/timesheets/tracker?date=${current.format(
                                "YYYY-MM-DD",
                              )}&timesheetId=${encodeURIComponent(entry.timesheetId)}`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              {getEmployeeName(entry.employeeId, employeeById)}
                              {" · "}
                              {shopById.get(entry.shopId)?.name || entry.shopId}
                              {entry.status === "work" && entry.workdayType === "half"
                                ? " · Half day"
                                : ""}
                            </a>
                          </li>
                        ))}
                        {entries.length > visibleEntries.length ? (
                          <li className={styles.moreEntry}>
                            +{entries.length - visibleEntries.length} more
                          </li>
                        ) : null}
                      </ul>
                    );
                  }}
                  onSelect={(value, info) => {
                    if (info.source !== "date") return;
                    const valueMonth = value.format("YYYY-MM");
                    if (valueMonth !== month) {
                      updateMonth(valueMonth);
                      return;
                    }
                    openAddTimesheet(value.format("YYYY-MM-DD"));
                  }}
                />
              </div>
            </Card>
          </Spin>

          <Card
            className={styles.dayCard}
            title={dayjs(selectedDate).format("dddd, DD MMMM YYYY")}
            extra={`${selectedRows.length} record${
              selectedRows.length === 1 ? "" : "s"
            }`}
          >
            <Table
              columns={columns}
              dataSource={selectedRows}
              locale={{ emptyText: "No work or leave recorded for this date." }}
              pagination={false}
              rowKey="id"
              rowClassName={styles.clickableRecord}
              scroll={{ x: 850 }}
              size="middle"
              onRow={(timesheet) => ({
                onClick: () => openTimesheetRecord(timesheet),
                onKeyDown: (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openTimesheetRecord(timesheet);
                  }
                },
                role: "link",
                tabIndex: 0,
              })}
            />
          </Card>
        </main>
      </div>

      <Modal
        destroyOnHidden
        open={addModalOpen}
        title={`Add timesheet — ${dayjs(selectedDate).format("DD MMMM YYYY")}`}
        okText={addStatus === "work" ? "Add work" : "Record leave"}
        confirmLoading={submitting}
        onCancel={() => {
          setAddModalOpen(false);
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
          <Form.Item label="Entry type">
            <Select
              aria-label="Timesheet entry type"
              options={[
                { label: "Work", value: "work" },
                { label: "Leave", value: "leave" },
              ]}
              value={addStatus}
              onChange={(value: "work" | "leave") => {
                setAddStatus(value);
                form.setFieldValue("employeeId", undefined);
              }}
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
          {addStatus === "work" ? (
            <Form.Item
              label="Workday"
              name="workdayType"
              rules={[{ required: true, message: "Select full or half day." }]}
            >
              <Select
                options={[
                  { label: "Full day", value: "full" },
                  { label: "Half day", value: "half" },
                ]}
              />
            </Form.Item>
          ) : null}
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
            title={
              addStatus === "work"
                ? "The selected employee will be recorded as working on this date."
                : "Leave will be recorded for the selected date."
            }
            showIcon
            type="info"
          />
        </Form>
      </Modal>
    </ConfigProvider>
  );
}

async function requestSummary(
  url: string,
  init?: RequestInit,
): Promise<SummaryResponse> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => undefined)) as
    | SummaryResponse
    | undefined;
  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || `Request failed (${response.status}).`);
  }
  return body;
}

function getEmployeeName(
  employeeId: string,
  employees: Map<string, Employee>,
): string {
  return employees.get(employeeId)?.name || employeeId;
}

function openTimesheetRecord(timesheet: EmployeeTimesheet): void {
  const date = getBangkokDate(timesheet.createdAt);
  window.location.href = `/timesheets/tracker?date=${date}&timesheetId=${encodeURIComponent(
    timesheet.id,
  )}`;
}

function getBangkokDate(value: string | Date = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).format(date);
}

function getPickerValue(value: string | string[] | null): string {
  if (value === null) return "";
  return Array.isArray(value) ? value[0] || "" : value;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error.";
}
