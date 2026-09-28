"use client";

import {
  ArrowRightOutlined,
  CalendarOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  FundOutlined,
} from "@ant-design/icons";
import { Card, Col, ConfigProvider, Row, Space, Typography } from "antd";
import type { ReactNode } from "react";
import styles from "../page.module.css";

const { Text, Title } = Typography;

const SALES_MENU_ITEMS: Array<{
  href: string;
  icon: ReactNode;
  title: string;
}> = [
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
];

export function SalesMenuPage() {
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
              <Title level={1}>Sales</Title>
            </div>
          </header>

          <section
            aria-labelledby="sales-menu-title"
            className={styles.menuSection}
          >
            <Title id="sales-menu-title" level={2}>
              Sales menu
            </Title>
            <Row gutter={[16, 16]}>
              {SALES_MENU_ITEMS.map((item) => (
                <Col key={item.href} xs={24} sm={12} lg={8}>
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
        </main>
      </div>
    </ConfigProvider>
  );
}
