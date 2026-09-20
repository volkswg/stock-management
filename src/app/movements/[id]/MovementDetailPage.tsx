"use client";

import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  MoreOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  ConfigProvider,
  Dropdown,
  Empty,
  Image,
  Input,
  Popconfirm,
  Row,
  Segmented,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Typography,
  Upload,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import type { ProductMovementRecord } from "@/services/movements";
import {
  deliverMovement,
  getMovement,
  saveMovementImage,
  saveMovementItem,
} from "../api";
import {
  formatBangkokDateTime,
  movementImageUrl,
  toNumber,
} from "../format";
import styles from "./movementDetail.module.css";

const { Paragraph, Text, Title } = Typography;
const { TextArea } = Input;

export function MovementDetailPage({ movementMasterId }: { movementMasterId: string }) {
  const [records, setRecords] = useState<ProductMovementRecord[]>([]);
  const [activeShop, setActiveShop] = useState("");
  const [packedIds, setPackedIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [delivering, setDelivering] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    getMovement(movementMasterId, controller.signal)
      .then((nextRecords) => {
        setRecords(nextRecords);
        setActiveShop(nextRecords[0]?.shopName || "");
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [movementMasterId]);

  const recordsByShop = useMemo(() => groupByShop(records), [records]);
  const shops = Object.keys(recordsByShop);
  const currentShop = activeShop || shops[0] || "";
  const currentRecords = recordsByShop[currentShop] || [];
  const totalQuantity = sumQuantity(records);
  const isDelivered =
    records.length > 0 && records.every((record) => record.status === "delivered");

  async function markDelivered() {
    setDelivering(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await deliverMovement(movementMasterId);
      setRecords(result.records);
      setNotice(
        result.movementMaster.deliverDateTime
          ? `Movement marked as delivered at ${formatBangkokDateTime(result.movementMaster.deliverDateTime)}.`
          : "Movement marked as delivered.",
      );
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setDelivering(false);
    }
  }

  async function updateItem(input: {
    movementId: string;
    quantity?: string;
    remark?: string;
    stockCounted?: boolean;
  }) {
    setSavingIds((current) => new Set(current).add(input.movementId));
    setMessages((current) => ({ ...current, [input.movementId]: "Saving changes…" }));
    try {
      const result = await saveMovementItem({ movementMasterId, ...input });
      setRecords(result.records);
      setMessages((current) => ({ ...current, [input.movementId]: "Saved." }));
    } catch (requestError) {
      setMessages((current) => ({ ...current, [input.movementId]: errorMessage(requestError) }));
      throw requestError;
    } finally {
      setSavingIds((current) => without(current, input.movementId));
    }
  }

  async function updateImage(movementId: string, file: File) {
    setUploadingIds((current) => new Set(current).add(movementId));
    setMessages((current) => ({ ...current, [movementId]: "Updating image…" }));
    try {
      const result = await saveMovementImage({ movementMasterId, movementId, file });
      setRecords(result.records);
      setMessages((current) => ({ ...current, [movementId]: "Image updated." }));
    } catch (requestError) {
      setMessages((current) => ({ ...current, [movementId]: errorMessage(requestError) }));
    } finally {
      setUploadingIds((current) => without(current, movementId));
    }
  }

  return (
    <ConfigProvider theme={movementTheme}>
      <div className={styles.appShell}>
        <main className={styles.content}>
          <Button className={styles.backButton} href="/movements" icon={<ArrowLeftOutlined />} type="text">Movements</Button>
          <header className={styles.pageHeader}>
            <div>
              <Text className={styles.eyebrow}>Inventory movement</Text>
              <Title level={1}>{movementMasterId}</Title>
              <Space size={8} wrap>
                <Text type="secondary">{records.length} items</Text>
                <Text type="secondary">{totalQuantity} total quantity</Text>
                <Tag color={isDelivered ? "green" : "default"}>{isDelivered ? "Delivered" : "Created"}</Tag>
              </Space>
            </div>
            <Popconfirm
              disabled={isDelivered}
              title="Mark this movement as delivered?"
              description="All movement items will be marked delivered."
              okText="Mark delivered"
              onConfirm={markDelivered}
            >
              <Button disabled={isDelivered} icon={<CheckCircleOutlined />} loading={delivering} type="primary">
                {isDelivered ? "Delivered" : "Mark delivered"}
              </Button>
            </Popconfirm>
          </header>

          {error ? <Alert className={styles.alert} message={error} showIcon type="error" /> : null}
          {notice ? <Alert className={styles.alert} message={notice} showIcon type="success" closable onClose={() => setNotice(undefined)} /> : null}
          {loading ? <Card><Skeleton active paragraph={{ rows: 9 }} /></Card> : records.length === 0 ? <Card><Empty description="No movement items" /></Card> : (
            <>
              <Segmented
                aria-label="Movement shops"
                className={styles.shopTabs}
                options={shops.map((shop) => ({ label: `${shop} (${sumQuantity(recordsByShop[shop])})`, value: shop }))}
                value={currentShop}
                onChange={setActiveShop}
              />
              <Row className={styles.summaryGrid} gutter={[16, 16]}>
                <Col xs={8}><Card><Statistic title="Shop" value={currentShop || "—"} /></Card></Col>
                <Col xs={8}><Card><Statistic title="Items" value={currentRecords.length} /></Card></Col>
                <Col xs={8}><Card><Statistic title="Shop quantity" value={sumQuantity(currentRecords)} /></Card></Col>
              </Row>
              <section className={styles.itemGrid}>
                {currentRecords.map((record) => (
                  <MovementItem
                    checked={packedIds.has(record.movementId)}
                    key={record.movementId}
                    record={record}
                    saving={savingIds.has(record.movementId)}
                    uploading={uploadingIds.has(record.movementId)}
                    message={messages[record.movementId]}
                    onChecked={(checked) => setPackedIds((current) => checked ? new Set(current).add(record.movementId) : without(current, record.movementId))}
                    onSave={updateItem}
                    onStockCounted={(stockCounted) => updateItem({ movementId: record.movementId, stockCounted })}
                    onUpdateImage={(file) => updateImage(record.movementId, file)}
                  />
                ))}
              </section>
            </>
          )}
        </main>
      </div>
    </ConfigProvider>
  );
}

function MovementItem({ checked, record, saving, uploading, message, onChecked, onSave, onStockCounted, onUpdateImage }: {
  checked: boolean;
  record: ProductMovementRecord;
  saving: boolean;
  uploading: boolean;
  message?: string;
  onChecked: (checked: boolean) => void;
  onSave: (input: { movementId: string; quantity: string; remark: string }) => Promise<void>;
  onStockCounted: (value: boolean) => Promise<void>;
  onUpdateImage: (file: File) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState(record.quantity);
  const [remark, setRemark] = useState(record.remark);
  useEffect(() => {
    setQuantity(record.quantity);
    setRemark(record.remark);
  }, [record.quantity, record.remark]);
  const nextQuantity = quantity.trim();
  const nextRemark = remark.trim();
  const changed = nextQuantity !== record.quantity || nextRemark !== record.remark;

  function cancel() {
    setQuantity(record.quantity);
    setRemark(record.remark);
    setEditing(false);
  }

  return (
    <Card className={`${styles.itemCard} ${checked ? styles.packed : ""}`}>
      <div className={styles.itemChecks}>
        <Checkbox checked={checked} onChange={(event) => onChecked(event.target.checked)}>Packed</Checkbox>
        <Button aria-pressed={record.stockCounted} loading={saving} size="small" type={record.stockCounted ? "primary" : "default"} onClick={() => void onStockCounted(!record.stockCounted).catch(() => undefined)}>
          {record.stockCounted ? "Stock counted" : "Stock not counted"}
        </Button>
      </div>
      <div className={styles.itemLayout}>
        <div className={styles.imageColumn}>
          <Image alt={`Movement product ${record.movementId}`} className={styles.productImage} src={movementImageUrl(record.productImageUrl, 900)} preview={{ src: movementImageUrl(record.productImageUrl, 1600) }} />
          {editing ? <Upload accept="image/*" beforeUpload={(file) => { void onUpdateImage(file as File); return false; }} showUploadList={false}><Button block icon={<UploadOutlined />} loading={uploading} size="small">Update image</Button></Upload> : null}
        </div>
        <div className={styles.itemBody}>
          <div className={styles.itemHeading}>
            <Text strong>{record.movementId}</Text>
            <Dropdown menu={{ items: [{ key: "edit", label: editing ? "Close edit" : "Edit item" }], onClick: () => editing ? cancel() : setEditing(true) }} trigger={["click"]}>
              <Button aria-label={`Actions for ${record.movementId}`} icon={<MoreOutlined />} type="text" />
            </Dropdown>
          </div>
          <Space size={6} wrap><Tag color="cyan">Qty {record.quantity}</Tag><Tag>{record.fromLocation} → {record.toLocation}</Tag><Tag color={record.status === "delivered" ? "green" : "default"}>{record.status === "delivered" ? "Delivered" : "Created"}</Tag></Space>
          <Text type="secondary">Created {formatBangkokDateTime(record.createdAt)}</Text>
          {editing ? (
            <div className={styles.editForm}>
              <label><span>Amount</span><Input disabled={saving} value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
              <label><span>Note</span><TextArea autoSize={{ minRows: 2, maxRows: 4 }} disabled={saving} value={remark} onChange={(event) => setRemark(event.target.value)} /></label>
              <Space><Button disabled={saving} onClick={cancel}>Cancel</Button><Button disabled={!nextQuantity || !changed} loading={saving} type="primary" onClick={() => void onSave({ movementId: record.movementId, quantity: nextQuantity, remark: nextRemark }).then(() => setEditing(false)).catch(() => undefined)}>Save</Button></Space>
            </div>
          ) : record.remark ? <Paragraph className={styles.remark}>{record.remark}</Paragraph> : null}
          {message ? <Text type="secondary">{message}</Text> : null}
        </div>
      </div>
    </Card>
  );
}

function groupByShop(records: ProductMovementRecord[]): Record<string, ProductMovementRecord[]> {
  return records.reduce<Record<string, ProductMovementRecord[]>>((groups, record) => {
    const shop = record.shopName || "Unknown";
    groups[shop] = [...(groups[shop] || []), record];
    return groups;
  }, {});
}

function sumQuantity(records: ProductMovementRecord[]): number {
  return records.reduce((sum, record) => sum + toNumber(record.quantity), 0);
}

function without(values: Set<string>, value: string): Set<string> {
  const next = new Set(values);
  next.delete(value);
  return next;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Movement request failed.";
}

const movementTheme = {
  token: {
    colorPrimary: "#157347",
    colorBgLayout: "#f3f5f4",
    colorBorderSecondary: "#e1e5e2",
    borderRadius: 6,
    fontFamily: "Arial, Helvetica, sans-serif",
  },
};
