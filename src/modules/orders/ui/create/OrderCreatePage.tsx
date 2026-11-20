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
import { useEffect, useRef, useState } from "react";
import { createOrderFromUploadedImages, uploadOrderCreationImage, getPendingOrderCreationNotice, MAX_ORDER_IMAGE_BYTES } from "../api";
import type { OrderImageType, UploadedOrderCreationImage } from "../../contracts";
import styles from "./orderCreate.module.css";

const { Text, Title } = Typography;
const { TextArea } = Input;

type OrderFormValues = {
  seller?: string;
  totalPrice?: number | null;
  remark?: string;
};

type ImageState = { status: "uploading" | "done" | "error"; image?: UploadedOrderCreationImage; error?: string };
const imageKey = (type: OrderImageType, file: UploadFile) => `${type}:${file.uid}`;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function OrderCreatePage() {
  const router = useRouter();
  const [form] = Form.useForm<OrderFormValues>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [submitting, setSubmitting] = useState(false);
  const submissionLocked = useRef(false);
  const [pendingNotice, setPendingNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [billImageFiles, setBillImageFiles] = useState<UploadFile[]>([]);
  const [productImageFiles, setProductImageFiles] = useState<UploadFile[]>([]);
  const [billImageError, setBillImageError] = useState<string>();
  const [productImageError, setProductImageError] = useState<string>();
  const imageJobs = useRef(new Map<string, ImageState>());
  const [imageStates, setImageStates] = useState<Record<string, ImageState>>({});
  const mounted = useRef(true);
  const setImageState = (key: string, state: ImageState) => {
    imageJobs.current.set(key, state);
    if (mounted.current) setImageStates(current => ({ ...current, [key]: state }));
  };
  const uploadImage = async (file: UploadFile, type: OrderImageType, retry = false) => {
    if (submissionLocked.current || !file.originFileObj) return;
    const key = imageKey(type, file), prior = imageJobs.current.get(key);
    if (prior?.status === "uploading" || (!retry && prior)) return;
    setImageState(key, { status: "uploading" });
    try {
      const image = await uploadOrderCreationImage(file.originFileObj, type);
      setImageState(key, { status: "done", image });
    } catch (error) {
      setImageState(key, { status: "error", error: error instanceof Error ? error.message : "Image upload failed." });
    }
  };
  const changeImages = (files: UploadFile[], type: OrderImageType) => {
    if (submissionLocked.current) return;
    if (type === "bill") { setBillImageFiles(files); if (files.length) setBillImageError(undefined); }
    else { setProductImageFiles(files); if (files.length) setProductImageError(undefined); }
    for (const file of files) void uploadImage(file, type);
  };
  const selected = [...billImageFiles.map(file => imageKey("bill", file)), ...productImageFiles.map(file => imageKey("product", file))];
  const imagesPending = selected.some(key => imageStates[key]?.status !== "done");
  const imagesUploading = selected.some(key => imageStates[key]?.status === "uploading");

  useEffect(() => {
    // Read browser storage after hydration; do not update an unmounted form.
    let active = true; mounted.current = true;
    Promise.resolve().then(() => {
      if (active) setPendingNotice(getPendingOrderCreationNotice());
    });
    return () => { active = false; mounted.current = false; };
  }, []);

  const submitOrder = async (values: OrderFormValues): Promise<void> => {
    if (submissionLocked.current) return;
    const billImages = billImageFiles;
    const productImages = productImageFiles;
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

    const images: UploadedOrderCreationImage[] = [];
    for (const [type, files] of [["bill", billImageFiles], ["product", productImageFiles]] as const) {
      for (const file of files) {
        const result = imageJobs.current.get(imageKey(type, file));
        if (result?.status !== "done" || !result.image) {
          setError("Wait for every selected image to finish uploading. Retry or remove any failed image before creating the order.");
          return;
        }
        images.push(result.image);
      }
    }
    submissionLocked.current = true;
    setSubmitting(true);
    setError(undefined);
    setBillImageError(undefined);
    setProductImageError(undefined);
    let completed = false;
    try {
      const response = await createOrderFromUploadedImages({ ...values, images });

      completed = true;
      messageApi.success("Order created.");
      router.push(`/orders/${encodeURIComponent(response.order.id)}`);
    } catch (submitError) {
      setPendingNotice(getPendingOrderCreationNotice());
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create order.",
      );
    } finally {
      if (!completed) {
        submissionLocked.current = false;
        setSubmitting(false);
      }
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
            {pendingNotice && !error ? (
              <Alert
                className={styles.errorAlert}
                title="Previous order needs confirmation"
                description={pendingNotice}
                showIcon
                type="warning"
              />
            ) : null}
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
              disabled={submitting}
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
                disabled={submitting}
                error={billImageError}
                files={billImageFiles}
                label="Bill images"
                imageStates={Object.fromEntries(billImageFiles.map(file => [file.uid, imageStates[imageKey("bill", file)]]))}
                onRetry={file => { void uploadImage(file, "bill", true); }}
                onChange={files => changeImages(files, "bill")}
                onRejected={(validationError) =>
                  messageApi.error(validationError)
                }
              />

              <ImageUploadField
                disabled={submitting}
                error={productImageError}
                files={productImageFiles}
                label="Product images"
                imageStates={Object.fromEntries(productImageFiles.map(file => [file.uid, imageStates[imageKey("product", file)]]))}
                onRetry={file => { void uploadImage(file, "product", true); }}
                onChange={files => changeImages(files, "product")}
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
                    disabled={submitting || imagesPending}
                    htmlType="submit"
                    icon={<PlusOutlined />}
                    loading={submitting || imagesUploading}
                    type="primary"
                  >
                    {imagesUploading ? "Uploading images" : pendingNotice ? "Check saved outcome" : "Create order"}
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
  imageStates,
  onRetry,
}: {
  disabled: boolean;
  error?: string;
  files: UploadFile[];
  label: string;
  onChange: (files: UploadFile[]) => void;
  onRejected: (error: string) => void;
  imageStates: Record<string, ImageState | undefined>;
  onRetry(file: UploadFile): void;
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
          if (file.size > MAX_ORDER_IMAGE_BYTES) {
            onRejected(`${file.name} is larger than 4 MB.`);
            return Upload.LIST_IGNORE;
          }
          return false;
        }}
        disabled={disabled}
        fileList={files.map(file => ({ ...file, status: imageStates[file.uid]?.status, error: imageStates[file.uid]?.error }))}
        listType="picture"
        maxCount={10}
        multiple
        onChange={({ fileList }) => onChange(fileList)}
        itemRender={(node, file) => <div>{node}{imageStates[file.uid]?.status === "error" ? <div>
          <Text type="danger">{imageStates[file.uid]?.error}</Text>{" "}
          <Button size="small" disabled={disabled} onClick={() => onRetry(file)}>Retry same image</Button>
        </div> : null}</div>}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Upload {label.toLowerCase()}</p>
        <p className="ant-upload-hint">
          JPEG, PNG, or WebP. Maximum 4 MB per image. Each image uploads when selected; order creation sends only its saved reference.
        </p>
      </Upload.Dragger>
    </Form.Item>
  );
}
