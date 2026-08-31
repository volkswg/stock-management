"use client";

import {
  ArrowRightOutlined,
  BarChartOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
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

const MENU_ITEMS: Array<{
  href: string;
  icon: ReactNode;
  title: string;
}> = [
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
    href: "/sales",
    icon: <BarChartOutlined />,
    title: "Sales",
  },
];

const LOYVERSE_ITEMS: Array<{
  href: string;
  icon: ReactNode;
  title: string;
}> = [
  {
    href: "/loyverse/daily-sales",
    icon: <ShopOutlined />,
    title: "Daily sales",
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

          <section aria-labelledby="menu-title" className={styles.menuSection}>
            <Title id="menu-title" level={2}>
              Menu
            </Title>
            <Row gutter={[16, 16]}>
              {MENU_ITEMS.map((item) => (
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

          <section aria-labelledby="loyverse-title" className={styles.menuSection}>
            <Title id="loyverse-title" level={2}>
              Loyverse
            </Title>
            <Row gutter={[16, 16]}>
              {LOYVERSE_ITEMS.map((item) => (
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
