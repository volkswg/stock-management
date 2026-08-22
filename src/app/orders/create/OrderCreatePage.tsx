"use client";

import {
  ArrowLeftOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  ConfigProvider,
  Form,
  Input,
  InputNumber,
  message,
  Space,
  Typography,
} from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createOrder } from "../api";
import styles from "./orderCreate.module.css";

const { Text, Title } = Typography;
const { TextArea } = Input;

type OrderFormValues = {
  seller: string;
  totalPrice?: number | null;
  remark?: string;
};

export function OrderCreatePage() {
  const router = useRouter();
  const [form] = Form.useForm<OrderFormValues>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const submitOrder = async (values: OrderFormValues): Promise<void> => {
    setSubmitting(true);
    setError(undefined);
    try {
      const response = await createOrder(values);
      messageApi.success("Order created.");
      router.push(`/orders/${encodeURIComponent(response.order.id)}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create order.",
      );
    } finally {
      setSubmitting(false);
    }
  };

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
      {messageContextHolder}
      <div className={styles.appShell}>
        <main className={styles.content}>
          <Button
            className={styles.backButton}
            href="/orders"
            icon={<ArrowLeftOutlined />}
            type="text"
          >
            Orders
          </Button>

          <header className={styles.pageHeader}>
            <Text className={styles.eyebrow}>Order management</Text>
            <Title level={1}>Create order</Title>
          </header>

          <Card className={styles.formCard} title="Order information">
            {error ? (
              <Alert
                className={styles.errorAlert}
                title="Order could not be created"
                description={error}
                showIcon
                type="error"
              />
            ) : null}

            <Form<OrderFormValues>
              form={form}
              layout="vertical"
              name="create-order"
              requiredMark="optional"
              onFinish={submitOrder}
            >
              <Form.Item
                label="Seller"
                name="seller"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: "Enter a seller.",
                  },
                  { max: 100, message: "Seller must be 100 characters or less." },
                ]}
              >
                <Input autoFocus maxLength={100} placeholder="Seller" />
              </Form.Item>

              <Form.Item
                label="Total price"
                name="totalPrice"
                rules={[
                  {
                    type: "number",
                    min: 0,
                    message: "Total price cannot be negative.",
                  },
                ]}
              >
                <InputNumber<number>
                  addonBefore="฿"
                  className={styles.priceInput}
                  controls={false}
                  min={0}
                  placeholder="0.00"
                  precision={2}
                  step={100}
                />
              </Form.Item>

              <Form.Item
                label="Remark"
                name="remark"
                rules={[
                  { max: 1000, message: "Remark must be 1,000 characters or less." },
                ]}
              >
                <TextArea
                  autoSize={{ minRows: 4, maxRows: 8 }}
                  maxLength={1000}
                  placeholder="Remark"
                  showCount
                />
              </Form.Item>

              <div className={styles.formActions}>
                <Space wrap>
                  <Button disabled={submitting} href="/orders">
                    Cancel
                  </Button>
                  <Button
                    htmlType="submit"
                    icon={<PlusOutlined />}
                    loading={submitting}
                    type="primary"
                  >
                    Create order
                  </Button>
                </Space>
              </div>
            </Form>
          </Card>
        </main>
      </div>
    </ConfigProvider>
  );
}
