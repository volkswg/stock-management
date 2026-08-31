"use client";

import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EditOutlined,
  PhoneOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  UserAddOutlined,
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
import styles from "./employees.module.css";

const { Text, Title } = Typography;

type EmployeeStatus = "active" | "inactive";

type Employee = {
  id: string;
  name: string;
  phone: string;
  status: EmployeeStatus;
  hiredDate: string;
  terminatedDate: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

type EmployeeFormValues = {
  name: string;
  phone?: string;
  status: EmployeeStatus;
  hiredDate: Dayjs;
  terminatedDate?: Dayjs;
};

type EmployeesResponse = {
  ok: boolean;
  employees?: Employee[];
  employee?: Employee;
  error?: string;
};

export function EmployeesPage() {
  const [form] = Form.useForm<EmployeeFormValues>();
  const formStatus = Form.useWatch("status", form);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string>();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | EmployeeStatus>(
    "all",
  );
  const [editingEmployee, setEditingEmployee] = useState<Employee>();
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const loadEmployees = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await requestEmployees("/api/employees", { signal });
      setEmployees(response.employees || []);
    } catch (requestError) {
      if (!signal?.aborted) setError(getErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadEmployees(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadEmployees]);

  const filteredEmployees = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return employees.filter((employee) => {
      const matchesStatus =
        statusFilter === "all" || employee.status === statusFilter;
      const matchesQuery =
        !normalizedQuery ||
        employee.name.toLocaleLowerCase().includes(normalizedQuery) ||
        employee.phone.toLocaleLowerCase().includes(normalizedQuery) ||
        employee.id.toLocaleLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [employees, query, statusFilter]);

  const openCreateModal = () => {
    setEditingEmployee(undefined);
    form.setFieldsValue({
      name: "",
      phone: "",
      status: "active",
      hiredDate: dayjs(getBangkokDate()),
      terminatedDate: undefined,
    });
    setModalOpen(true);
  };

  const openEditModal = (employee: Employee) => {
    setEditingEmployee(employee);
    form.setFieldsValue({
      name: employee.name,
      phone: employee.phone,
      status: employee.status,
      hiredDate: dayjs(employee.hiredDate),
      terminatedDate: employee.terminatedDate
        ? dayjs(employee.terminatedDate)
        : undefined,
    });
    setModalOpen(true);
  };

  const saveEmployee = async (values: EmployeeFormValues) => {
    setSubmitting(true);
    setError(undefined);
    setNotice(undefined);
    const payload = {
      name: values.name,
      phone: values.phone || "",
      status: values.status,
      hiredDate: values.hiredDate.format("YYYY-MM-DD"),
      terminatedDate:
        values.status === "inactive" && values.terminatedDate
          ? values.terminatedDate.format("YYYY-MM-DD")
          : "",
    };

    try {
      await requestEmployees(
        editingEmployee
          ? `/api/employees/${encodeURIComponent(editingEmployee.id)}`
          : "/api/employees",
        {
          method: editingEmployee ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      setNotice(editingEmployee ? "Employee updated." : "Employee added.");
      setModalOpen(false);
      form.resetFields();
      await loadEmployees();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const changeStatus = async (employee: Employee) => {
    const nextStatus: EmployeeStatus =
      employee.status === "active" ? "inactive" : "active";
    setUpdatingId(employee.id);
    setError(undefined);
    setNotice(undefined);
    try {
      await requestEmployees(
        `/api/employees/${encodeURIComponent(employee.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: nextStatus,
            terminatedDate:
              nextStatus === "inactive" ? getBangkokDate() : "",
          }),
        },
      );
      setNotice(
        nextStatus === "active"
          ? `${employee.name} activated.`
          : `${employee.name} deactivated.`,
      );
      await loadEmployees();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setUpdatingId(undefined);
    }
  };

  const columns: ColumnsType<Employee> = [
    {
      title: "Employee",
      key: "employee",
      fixed: "left",
      width: 230,
      render: (_, employee) => (
        <div className={styles.employeeCell}>
          <Text strong>{employee.name}</Text>
          <Text copyable={{ text: employee.id }} type="secondary">
            {employee.id}
          </Text>
        </div>
      ),
    },
    {
      title: "Phone",
      dataIndex: "phone",
      width: 150,
      render: (phone: string) =>
        phone ? (
          <a href={`tel:${phone}`}>
            <PhoneOutlined /> {phone}
          </a>
        ) : (
          <Text type="secondary">Not set</Text>
        ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 110,
      render: (status: EmployeeStatus) => (
        <Tag color={status === "active" ? "success" : "default"}>
          {status === "active" ? "Active" : "Inactive"}
        </Tag>
      ),
    },
    {
      title: "Hired",
      dataIndex: "hiredDate",
      width: 130,
      render: formatDate,
    },
    {
      title: "Terminated",
      dataIndex: "terminatedDate",
      width: 130,
      render: formatDate,
    },
    {
      title: "Updated",
      dataIndex: "updatedAt",
      width: 170,
      render: formatDateTime,
    },
    {
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 112,
      render: (_, employee) => (
        <Space size={4}>
          <Tooltip title="Edit employee">
            <Button
              aria-label={`Edit ${employee.name}`}
              icon={<EditOutlined />}
              onClick={() => openEditModal(employee)}
            />
          </Tooltip>
          <Popconfirm
            title={
              employee.status === "active"
                ? "Deactivate employee?"
                : "Activate employee?"
            }
            description={
              employee.status === "active"
                ? "The employee remains available for timesheet history."
                : "The employee can be used for new timesheets again."
            }
            okText={employee.status === "active" ? "Deactivate" : "Activate"}
            onConfirm={() => changeStatus(employee)}
          >
            <Tooltip
              title={employee.status === "active" ? "Deactivate" : "Activate"}
            >
              <Button
                aria-label={`${
                  employee.status === "active" ? "Deactivate" : "Activate"
                } ${employee.name}`}
                danger={employee.status === "active"}
                icon={
                  employee.status === "active" ? (
                    <StopOutlined />
                  ) : (
                    <CheckCircleOutlined />
                  )
                }
                loading={updatingId === employee.id}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const activeCount = employees.filter(
    (employee) => employee.status === "active",
  ).length;

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
              <Text className={styles.eyebrow}>People</Text>
              <Title level={1}>Employees</Title>
              <Text type="secondary">
                Manage employees stored in Google Sheets.
              </Text>
            </div>
            <Space className={styles.pageActions} wrap>
              <Button href="/" icon={<ArrowLeftOutlined />}>
                Home
              </Button>
              <Button
                href="/employees/timesheets"
                icon={<ClockCircleOutlined />}
              >
                Timesheets
              </Button>
              <Button
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={() => void loadEmployees()}
              >
                Refresh
              </Button>
              <Button
                icon={<UserAddOutlined />}
                type="primary"
                onClick={openCreateModal}
              >
                Add employee
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

          <Row className={styles.summaryGrid} gutter={[12, 12]}>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic title="Employees" value={employees.length} />
              </Card>
            </Col>
            <Col xs={12} sm={8}>
              <Card>
                <Statistic title="Active" value={activeCount} />
              </Card>
            </Col>
            <Col xs={12} sm={8}>
              <Card>
                <Statistic
                  title="Inactive"
                  value={employees.length - activeCount}
                />
              </Card>
            </Col>
          </Row>

          <Card className={styles.employeeTableCard}>
            <div className={styles.filters}>
              <Input
                allowClear
                aria-label="Search employees"
                prefix={<SearchOutlined />}
                placeholder="Search name, phone, or ID"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Select
                aria-label="Filter employee status"
                options={[
                  { label: "All statuses", value: "all" },
                  { label: "Active", value: "active" },
                  { label: "Inactive", value: "inactive" },
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            </div>
            <Table
              columns={columns}
              dataSource={filteredEmployees}
              loading={loading}
              locale={{ emptyText: "No employees found." }}
              pagination={{ pageSize: 20, showSizeChanger: false }}
              rowKey="id"
              scroll={{ x: 1050 }}
              size="middle"
            />
          </Card>
        </main>
      </div>

      <Modal
        destroyOnHidden
        open={modalOpen}
        title={editingEmployee ? "Edit employee" : "Add employee"}
        okText={editingEmployee ? "Save changes" : "Add employee"}
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
          onFinish={(values) => void saveEmployee(values)}
        >
          <Form.Item
            label="Name"
            name="name"
            rules={[
              { required: true, whitespace: true, message: "Enter a name." },
              { max: 100 },
            ]}
          >
            <Input autoComplete="name" />
          </Form.Item>
          <Form.Item label="Phone" name="phone" rules={[{ max: 30 }]}>
            <Input autoComplete="tel" inputMode="tel" />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Hired date"
                name="hiredDate"
                rules={[{ required: true, message: "Select a hired date." }]}
              >
                <DatePicker className={styles.fullWidth} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Status" name="status" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: "Active", value: "active" },
                    { label: "Inactive", value: "inactive" },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          {formStatus === "inactive" ? (
            <Form.Item label="Terminated date" name="terminatedDate">
              <DatePicker className={styles.fullWidth} format="YYYY-MM-DD" />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </ConfigProvider>
  );
}

async function requestEmployees(
  url: string,
  init?: RequestInit,
): Promise<EmployeesResponse> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => undefined)) as
    | EmployeesResponse
    | undefined;
  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || `Request failed (${response.status}).`);
  }
  return body;
}

function getBangkokDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDate(value: string): string {
  return value ? dayjs(value).format("DD MMM YYYY") : "-";
}

function formatDateTime(value: string): string {
  return value ? dayjs(value).format("DD MMM YYYY, HH:mm") : "-";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error.";
}
