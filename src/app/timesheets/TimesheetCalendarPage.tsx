"use client";

import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfigProvider,
  DatePicker,
  Form,
  message,
  Modal,
  Select,
  Space,
  Spin,
  Tooltip,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
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
  date: Dayjs;
  employeeId: string;
  shopId: string;
  workdayType: "full" | "half";
};

export function TimesheetCalendarPage() {
  const [form] = Form.useForm<AddTimesheetFormValues>();
  const [messageApi, messageContextHolder] = message.useMessage();
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
  const [editingTimesheet, setEditingTimesheet] = useState<EmployeeTimesheet | null>(null);
  const [saveError, setSaveError] = useState<string>();
  const [addStatus, setAddStatus] = useState<"work" | "leave">("work");

  const loadSummary = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
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
        if (!signal?.aborted) {
          messageApi.error(getErrorMessage(requestError));
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [messageApi, month, shopId],
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
  const leaveDays = employeeDays.filter((entry) => entry.status === "leave").length;
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
      (employee.status === "active" || employee.id === editingTimesheet?.employeeId) &&
      (Boolean(editingTimesheet) || !unavailableEmployeeIds.has(employee.id)),
  );

  const openAddTimesheet = (date: string) => {
    if (date > today) return;
    setSelectedDate(date);
    setEditingTimesheet(null);
    setSaveError(undefined);
    setAddStatus("work");
    form.resetFields();
    form.setFieldsValue({
      shopId: shopId || shops[0]?.id,
      workdayType: "full",
    });
    setAddModalOpen(true);
  };

  const openEditTimesheet = (timesheet: EmployeeTimesheet) => {
    setEditingTimesheet(timesheet);
    setSaveError(undefined);
    setAddStatus(timesheet.status);
    form.resetFields();
    form.setFieldsValue({
      date: dayjs(getBangkokDate(timesheet.createdAt)),
      employeeId: timesheet.employeeId,
      shopId: timesheet.shopId,
      workdayType: timesheet.workdayType || "full",
    });
    setAddModalOpen(true);
  };

  const addTimesheet = async (values: AddTimesheetFormValues) => {
    if (submitting) return;
    setSubmitting(true);
    setSaveError(undefined);
    const entryDate = editingTimesheet ? values.date.format("YYYY-MM-DD") : selectedDate;
    try {
      await requestSummary(editingTimesheet
        ? `/api/employees/timesheets/${encodeURIComponent(editingTimesheet.id)}`
        : "/api/employees/timesheets", {
        method: editingTimesheet ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: entryDate,
          employeeId: values.employeeId,
          shopId: values.shopId,
          status: addStatus,
          workdayType: addStatus === "work" ? values.workdayType : undefined,
        }),
      });
      const employee = employeeById.get(values.employeeId);
      messageApi.success(
        editingTimesheet ? "Timesheet updated." : addStatus === "work"
          ? `${employee?.name || "Employee"} work recorded.`
          : `Leave recorded for ${employee?.name || "employee"}.`,
      );
      setAddModalOpen(false);
      form.resetFields();
      if (entryDate.slice(0, 7) === month) {
        setSelectedDate(entryDate);
        await loadSummary();
      } else {
        setMonth(entryDate.slice(0, 7));
        setSelectedDate(entryDate);
      }
    } catch (requestError) {
      setSaveError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const updateMonth = (value: string) => {
    if (!value) return;
    setMonth(value);
    setSelectedDate(value === today.slice(0, 7) ? today : `${value}-01`);
  };

  const monthStart = dayjs(`${month}-01`);
  const calendarStart = monthStart.startOf("week");
  const calendarDays = Array.from(
    { length: Math.ceil((monthStart.day() + monthStart.daysInMonth()) / 7) * 7 },
    (_, index) => calendarStart.add(index, "day"),
  );
  const selectedEntries = entriesByDate.get(selectedDate) || [];
  const fullDays = selectedEntries.filter((entry) => entry.status === "work" && entry.workdayType !== "half").length;
  const halfDays = selectedEntries.filter((entry) => entry.status === "work" && entry.workdayType === "half").length;
  const selectedLeaveDays = selectedEntries.filter((entry) => entry.status === "leave").length;

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#157347",
          colorLink: "#157347",
          colorLinkHover: "#0d5132",
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
              <Title level={1}>Timesheets</Title>
              <Text type="secondary">Work and leave, by date</Text>
            </div>
            <div className={styles.pageActions}>
              <Button type="link" href="/timesheets/tracker">Tracker</Button>
              <Button type="text" loading={loading} onClick={() => void loadSummary()}>Refresh</Button>
              <Button className={styles.desktopAdd} type="primary" disabled={loading || selectedDate > today} onClick={() => openAddTimesheet(selectedDate)}>Add entry</Button>
            </div>
          </header>

          <div className={styles.filters}>
            <Space.Compact className={styles.monthControl} block>
              <Tooltip title="Previous month">
                <Button aria-label="Previous month" icon={<LeftOutlined />} onClick={() => updateMonth(monthStart.subtract(1, "month").format("YYYY-MM"))} />
              </Tooltip>
              <DatePicker
                allowClear={false}
                aria-label="Timesheet summary month"
                className={styles.monthPicker}
                format="MMMM YYYY"
                picker="month"
                suffixIcon={null}
                value={monthStart}
                onChange={(value) => {
                  if (value) updateMonth(value.format("YYYY-MM"));
                }}
              />
              <Tooltip title="Next month">
                <Button aria-label="Next month" icon={<RightOutlined />} onClick={() => updateMonth(monthStart.add(1, "month").format("YYYY-MM"))} />
              </Tooltip>
            </Space.Compact>
            <Select
              aria-label="Timesheet summary shop"
              className={styles.shopFilter}
              options={[
                { label: "All shops", value: "" },
                ...shops.map((shop) => ({ label: shop.name, value: shop.id })),
              ]}
              value={shopId}
              onChange={setShopId}
            />
          </div>

          <section className={styles.summaryGrid} aria-label="Month summary" aria-busy={loading}>
            {[
              ["Employees", recordedEmployees],
              ["Work days", workDays],
              ["Leave days", leaveDays],
              ["Records", timesheets.length],
            ].map(([label, value]) => (
              <div className={styles.summaryCell} key={label}>
                <strong>{loading ? "—" : value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </section>

          <Spin spinning={loading} description="Loading monthly summary...">
            <div className={styles.workspace} aria-busy={loading}>
              <Card className={styles.calendarCard} title="Attendance" extra={
                <Button type="link" onClick={() => { setMonth(today.slice(0, 7)); setSelectedDate(today); }}>Today</Button>
              }>
                <div className={styles.weekdays} aria-hidden="true">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}
                </div>
                <div className={styles.calendar} role="group" aria-label={monthStart.format("MMMM YYYY attendance")}>
                  {calendarDays.map((day) => {
                    const date = day.format("YYYY-MM-DD");
                    const inMonth = day.format("YYYY-MM") === month;
                    const entries = entriesByDate.get(date) || [];
                    const hasWork = entries.some((entry) => entry.status === "work");
                    const hasLeave = entries.some((entry) => entry.status === "leave");
                    return (
                      <button
                        type="button"
                        key={date}
                        className={styles.calendarDay}
                        disabled={!inMonth || date > today || loading}
                        aria-label={`${day.format("dddd, D MMMM YYYY")}${hasWork ? ", Work" : ""}${hasLeave ? ", Leave" : ""}`}
                        aria-pressed={date === selectedDate}
                        aria-current={date === today ? "date" : undefined}
                        onClick={() => setSelectedDate(date)}
                      >
                        <span className={styles.dayNumber}>{day.date()}</span>
                        <span className={styles.dayIndicators} aria-hidden="true">
                          {inMonth && hasWork ? <span className={styles.workDot} /> : null}
                          {inMonth && hasLeave ? <span className={styles.leaveDot} /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className={styles.calendarFooter}>
                  <Space size={16}><Badge color="#157347" text="Work" /><Badge color="#d48806" text="Leave" /></Space>
                  <Text type="secondary">Choose a date to see records</Text>
                </div>
              </Card>

              <Card className={styles.dayCard} title={<h2>{dayjs(selectedDate).format("ddd, D MMMM")}</h2>} extra={`${selectedRows.length} record${selectedRows.length === 1 ? "" : "s"}`}>
                <Text className={styles.daySummary} type="secondary">
                  {fullDays} full day{fullDays === 1 ? "" : "s"} · {halfDays} half day{halfDays === 1 ? "" : "s"} · {selectedLeaveDays} leave
                </Text>
                {selectedRows.length ? (
                  <ul className={styles.records}>
                    {selectedRows.map((timesheet) => (
                      <li key={timesheet.id} className={styles.record}>
                        <div className={styles.recordHeading}>
                          <h3>{getEmployeeName(timesheet.employeeId, employeeById)}</h3>
                          <span className={timesheet.status === "work" ? styles.workStatus : styles.leaveStatus}>{timesheet.status === "work" ? "Work" : "Leave"}</span>
                        </div>
                        <p>{shopById.get(timesheet.shopId)?.name || timesheet.shopId}{timesheet.status === "work" ? ` · ${timesheet.workdayType === "half" ? "Half day" : "Full day"}` : ""}</p>
                        <div className={styles.recordActions}>
                          <Button type="text" size="small" className={styles.editButton} disabled={loading} onClick={() => openEditTimesheet(timesheet)} aria-label={`Edit entry for ${getEmployeeName(timesheet.employeeId, employeeById)}`}>Edit</Button>
                        <a className={styles.recordLink} href={getTimesheetRecordUrl(timesheet)} aria-label={`View details for ${getEmployeeName(timesheet.employeeId, employeeById)}`}>View details <span aria-hidden="true">›</span></a>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className={styles.emptyState}>
                    <Text type="secondary">No work or leave recorded for this date.</Text>
                  </div>
                )}
              </Card>
            </div>
          </Spin>
          <div className={styles.mobileAdd}>
            <Button type="primary" block disabled={loading || selectedDate > today} onClick={() => openAddTimesheet(selectedDate)}>Add entry</Button>
          </div>
        </main>
      </div>

      <Modal
        destroyOnHidden
        open={addModalOpen}
        title={`${editingTimesheet ? "Edit" : "Add"} timesheet — ${dayjs(selectedDate).format("DD MMMM YYYY")}`}
        okText={editingTimesheet ? "Save changes" : addStatus === "work" ? "Add work" : "Record leave"}
        confirmLoading={submitting}
        mask={{ closable: !submitting }}
        keyboard={!submitting}
        closable={!submitting}
        cancelButtonProps={{ disabled: submitting }}
        onCancel={() => {
          if (submitting) return;
          setAddModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          disabled={submitting}
          layout="vertical"
          requiredMark="optional"
          onFinish={(values) => void addTimesheet(values)}
        >
          {saveError ? <Alert type="error" title={saveError} showIcon style={{ marginBottom: 16 }} /> : null}
          {editingTimesheet ? (
            <Form.Item label="Date" name="date" rules={[{ required: true, message: "Select a date." }]}>
              <DatePicker format="YYYY-MM-DD" style={{ width: "100%" }} disabledDate={(value) => value.format("YYYY-MM-DD") > today} />
            </Form.Item>
          ) : null}
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
                if (!editingTimesheet) form.setFieldValue("employeeId", undefined);
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
              editingTimesheet ? "Changes will update this record only. Leave cannot overlap another entry for the employee on the same date." : addStatus === "work"
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

function getTimesheetRecordUrl(timesheet: EmployeeTimesheet): string {
  const date = getBangkokDate(timesheet.createdAt);
  return `/timesheets/tracker?date=${date}&timesheetId=${encodeURIComponent(
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error.";
}
