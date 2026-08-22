"use client";

import {
  ArrowLeftOutlined,
  InboxOutlined,
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
  Upload,
  type UploadFile,
} from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createOrder, uploadOrderImage } from "../api";
import styles from "./orderCreate.module.css";

const { Text, Title } = Typography;
const { TextArea } = Input;

type OrderFormValues = {
  seller?: string;
  totalPrice?: number | null;
  remark?: string;
};

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function OrderCreatePage() {
  const router = useRouter();
  const [form] = Form.useForm<OrderFormValues>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [createdOrderId, setCreatedOrderId] = useState<string>();
  const [billImageFiles, setBillImageFiles] = useState<UploadFile[]>([]);
  const [productImageFiles, setProductImageFiles] = useState<UploadFile[]>([]);
  const [billImageError, setBillImageError] = useState<string>();
  const [productImageError, setProductImageError] = useState<string>();

  const submitOrder = async (values: OrderFormValues): Promise<void> => {
    const billImages = getFiles(billImageFiles);
    const productImages = getFiles(productImageFiles);
    setBillImageError(
      billImages.length === 0 ? "Add at least one bill image." : undefined,
    );
    setProductImageError(
      productImages.length === 0
        ? "Add at least one product image."
        : undefined,
    );
    if (billImages.length === 0 || productImages.length === 0) {
      return;
    }

    setSubmitting(true);
    setError(undefined);
    setBillImageError(undefined);
    setProductImageError(undefined);
    let newOrderId: string | undefined;
    try {
      const response = await createOrder(values);
      newOrderId = response.order.id;
      setCreatedOrderId(newOrderId);

      for (const image of billImages) {
        await uploadOrderImage(newOrderId, image, "bill");
      }
      for (const image of productImages) {
        await uploadOrderImage(newOrderId, image, "product");
      }

      messageApi.success("Order created.");
      router.push(`/orders/${encodeURIComponent(newOrderId)}`);
    } catch (submitError) {
      setError(
        newOrderId
          ? "The order was created, but one or more images could not be uploaded."
          : submitError instanceof Error
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
                title={
                  createdOrderId
                    ? "Image upload failed"
                    : "Order could not be created"
                }
                description={error}
                action={
                  createdOrderId ? (
                    <Button
                      href={`/orders/${encodeURIComponent(createdOrderId)}`}
                      size="small"
                    >
                      Open order
                    </Button>
                  ) : undefined
                }
                showIcon
                type="error"
              />
            ) : null}

            <Form<OrderFormValues>
              form={form}
              disabled={Boolean(createdOrderId)}
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
                    max: 100,
                    message: "Seller must be 100 characters or less.",
                  },
                ]}
              >
                <Input autoFocus maxLength={100} placeholder="Seller" />
              </Form.Item>

              <ImageUploadField
                disabled={submitting || Boolean(createdOrderId)}
                error={billImageError}
                files={billImageFiles}
                label="Bill images"
                onChange={(files) => {
                  setBillImageFiles(files);
                  if (files.length > 0) setBillImageError(undefined);
                }}
                onRejected={(validationError) =>
                  messageApi.error(validationError)
                }
              />

              <ImageUploadField
                disabled={submitting || Boolean(createdOrderId)}
                error={productImageError}
                files={productImageFiles}
                label="Product images"
                onChange={(files) => {
                  setProductImageFiles(files);
                  if (files.length > 0) setProductImageError(undefined);
                }}
                onRejected={(validationError) =>
                  messageApi.error(validationError)
                }
              />

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
                  prefix="฿"
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
                  {
                    max: 1000,
                    message: "Remark must be 1,000 characters or less.",
                  },
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
                    disabled={Boolean(createdOrderId)}
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

function ImageUploadField({
  disabled,
  error,
  files,
  label,
  onChange,
  onRejected,
}: {
  disabled: boolean;
  error?: string;
  files: UploadFile[];
  label: string;
  onChange: (files: UploadFile[]) => void;
  onRejected: (error: string) => void;
}) {
  return (
    <Form.Item
      label={label}
      required
      validateStatus={error ? "error" : undefined}
      help={error}
    >
      <Upload.Dragger
        accept="image/jpeg,image/png,image/webp"
        beforeUpload={(file) => {
          if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
            onRejected(`${file.name} is not a supported image.`);
            return Upload.LIST_IGNORE;
          }
          if (file.size > MAX_IMAGE_SIZE_BYTES) {
            onRejected(`${file.name} is larger than 10 MB.`);
            return Upload.LIST_IGNORE;
          }
          return false;
        }}
        disabled={disabled}
        fileList={files}
        listType="picture"
        maxCount={10}
        multiple
        onChange={({ fileList }) => onChange(fileList)}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Upload {label.toLowerCase()}</p>
        <p className="ant-upload-hint">
          JPEG, PNG, or WebP. Maximum 10 MB per image.
        </p>
      </Upload.Dragger>
    </Form.Item>
  );
}

function getFiles(files: UploadFile[]): File[] {
  return files.flatMap((file) =>
    file.originFileObj ? [file.originFileObj] : [],
  );
}
