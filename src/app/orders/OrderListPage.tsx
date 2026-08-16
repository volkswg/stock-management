"use client";

import {
  InboxOutlined,
  SearchOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import {
  Avatar,
  Card,
  Col,
  ConfigProvider,
  Empty,
  Input,
  Layout,
  Menu,
  Pagination,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Typography,
  type TableProps,
} from "antd";
import Link from "next/link";
import styles from "./orders.module.css";

type OrderListItem = {
  id: string;
  status: string;
  createdBy: string;
  createdAt: string;
  totalPrice: number;
};

const { Content, Sider } = Layout;
const { Text, Title } = Typography;

const COLUMNS: TableProps<OrderListItem>["columns"] = [
  { title: "Order ID", dataIndex: "id", key: "id", width: 150 },
  { title: "Status", dataIndex: "status", key: "status", width: 150 },
  {
    title: "Created by",
    dataIndex: "createdBy",
    key: "createdBy",
    width: 200,
  },
  {
    title: "Created",
    dataIndex: "createdAt",
    key: "createdAt",
    width: 170,
  },
  {
    title: "Total",
    dataIndex: "totalPrice",
    key: "totalPrice",
    align: "right",
    width: 140,
    render: (value: number) => `฿${value.toFixed(2)}`,
  },
];

const STATUS_OPTIONS = [
  { label: "All orders", value: "all" },
  { label: "In progress", value: "in-progress" },
  { label: "Completed", value: "completed" },
];

export function OrderListPage() {
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
          Layout: {
            siderBg: "#1b2420",
            triggerBg: "#2c3a33",
          },
          Menu: {
            darkItemBg: "#1b2420",
            darkItemSelectedBg: "#2c3a33",
            darkItemSelectedColor: "#78d6a3",
          },
          Table: {
            headerBg: "#f7f8f7",
            headerColor: "#66716b",
          },
        },
      }}
    >
      <Layout className={styles.appShell} hasSider>
        <Sider
          className={styles.sidebar}
          width={248}
          breakpoint="md"
          collapsedWidth={0}
        >
          <Link className={styles.brand} href="/orders">
            <span className={styles.brandMark}>SM</span>
            <span className={styles.brandText}>
              <strong>Stock Management</strong>
              <small>Operations</small>
            </span>
          </Link>

          <Text className={styles.navLabel}>Workspace</Text>
          <Menu
            mode="inline"
            theme="dark"
            selectedKeys={["orders"]}
            items={[
              {
                key: "orders",
                icon: <UnorderedListOutlined />,
                label: <Link href="/orders">Orders</Link>,
              },
            ]}
          />

          <div className={styles.account}>
            <Avatar>A</Avatar>
            <span>
              <strong>Administrator</strong>
              <small>Store operations</small>
            </span>
          </div>
        </Sider>

        <Content className={styles.content}>
          <header className={styles.pageHeader}>
            <Text className={styles.eyebrow}>Order management</Text>
            <Title level={1}>Orders</Title>
            <Text type="secondary">
              Track incoming orders from creation through completion.
            </Text>
          </header>

          <Row className={styles.summary} gutter={[12, 12]}>
            <Col xs={12} lg={6}>
              <Card><Statistic title="All orders" value={0} /></Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card><Statistic title="In progress" value={0} /></Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card><Statistic title="Completed" value={0} /></Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="Total value" value={0} prefix="฿" precision={2} />
              </Card>
            </Col>
          </Row>

          <Card className={styles.orderList} styles={{ body: { padding: 0 } }}>
            <div className={styles.listToolbar}>
              <div>
                <Title level={2}>Order list</Title>
                <Text type="secondary">0 orders</Text>
              </div>

              <Space className={styles.filters} wrap>
                <Input
                  aria-label="Search orders"
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder="Search by order ID or user"
                />
                <Select
                  aria-label="Filter by status"
                  defaultValue="all"
                  options={STATUS_OPTIONS}
                />
              </Space>
            </div>

            <Table<OrderListItem>
              columns={COLUMNS}
              dataSource={[]}
              rowKey="id"
              pagination={false}
              scroll={{ x: 810 }}
              locale={{
                emptyText: (
                  <Empty
                    image={<InboxOutlined className={styles.emptyIcon} />}
                    description={
                      <Space direction="vertical" size={2}>
                        <Text strong>No orders yet</Text>
                        <Text type="secondary">
                          Orders created from LINE will appear here.
                        </Text>
                      </Space>
                    }
                  />
                ),
              }}
            />

            <div className={styles.pagination}>
              <Text type="secondary">Showing 0 of 0 orders</Text>
              <Pagination current={1} total={0} disabled showSizeChanger={false} />
            </div>
          </Card>
        </Content>
      </Layout>
    </ConfigProvider>
  );
}
