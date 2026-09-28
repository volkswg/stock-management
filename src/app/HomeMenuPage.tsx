"use client";

import {
  ArrowRightOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  FundOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  SwapOutlined,
  TeamOutlined,
  TruckOutlined,
} from "@ant-design/icons";
import {
  Card,
  Col,
  ConfigProvider,
  Row,
  Space,
  Typography,
} from "antd";
import type { ReactNode } from "react";
import styles from "./page.module.css";

const { Text, Title } = Typography;

type MenuItem = {
  href: string;
  icon: ReactNode;
  title: string;
};

const MENU_GROUPS: Array<{
  id: string;
  items: MenuItem[];
  title: string;
}> = [
  {
    id: "stock-menu",
    items: [
      {
        href: "/orders",
        icon: <ShoppingCartOutlined />,
        title: "Orders",
      },
      {
        href: "/shipments",
        icon: <TruckOutlined />,
        title: "Shipments",
      },
      {
        href: "/movements",
        icon: <SwapOutlined />,
        title: "Movements",
      },
    ],
    title: "Stock",
  },
  {
    id: "sales-menu",
    items: [
      {
        href: "/sales/sync-status",
        icon: <DatabaseOutlined />,
        title: "Sync status",
      },
      {
        href: "/sales/daily-sales",
        icon: <CalendarOutlined />,
        title: "Daily sales",
      },
      {
        href: "/sales/dashboard",
        icon: <DashboardOutlined />,
        title: "Dashboard",
      },
      {
        href: "/sales/profit-summary",
        icon: <FundOutlined />,
        title: "Profit summary",
      },
    ],
    title: "Sales",
  },
  {
    id: "human-resources-menu",
    items: [
      {
        href: "/employees",
        icon: <TeamOutlined />,
        title: "Employees",
      },
      {
        href: "/timesheets",
        icon: <ClockCircleOutlined />,
        title: "Timesheets",
      },
    ],
    title: "Human resources",
  },
  {
    id: "loyverse-menu",
    items: [
      {
        href: "/loyverse/daily-sales",
        icon: <ShopOutlined />,
        title: "Daily sales",
      },
    ],
    title: "Loyverse",
  },
];

export function HomeMenuPage() {
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
              <Text className={styles.eyebrow}>Workspace</Text>
              <Title level={1}>Stock Management</Title>
            </div>
          </header>

          {MENU_GROUPS.map((group) => (
            <section
              aria-labelledby={group.id}
              className={styles.menuSection}
              key={group.id}
            >
              <Title id={group.id} level={2}>
                {group.title}
              </Title>
              <Row gutter={[16, 16]}>
                {group.items.map((item) => (
                  <Col key={item.href} xs={24} sm={12} lg={6}>
                    <a
                      aria-label={`Open ${item.title.toLowerCase()}`}
                      className={styles.menuLink}
                      href={item.href}
                    >
                      <Card className={styles.menuCard} hoverable>
                        <Space className={styles.menuCardContent} size={14}>
                          <span className={styles.menuIcon}>{item.icon}</span>
                          <Title level={3}>{item.title}</Title>
                          <ArrowRightOutlined className={styles.menuArrow} />
                        </Space>
                      </Card>
                    </a>
                  </Col>
                ))}
              </Row>
            </section>
          ))}
        </main>
      </div>
    </ConfigProvider>
  );
}
