"use client";

import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  EditOutlined,
  ReloadOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  ConfigProvider,
  Empty,
  Image,
  Input,
  Popconfirm,
  Segmented,
  Skeleton,
  Space,
  Tag,
  Typography,
  Upload,
} from "antd";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ProductMovementRecord } from "@/services/movements";
import { isValidMovementQuantity, parseQuantity } from "@/features/backend/line/services/movements/utils";
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
const MOVEMENT_IMAGE_PLACEHOLDER = "/assets/movement-image-placeholder.svg";

export function MovementDetailPage({ movementMasterId }: { movementMasterId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [records, setRecords] = useState<ProductMovementRecord[]>([]);
  const [packedIds, setPackedIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [itemFilter, setItemFilter] = useState<"all" | "missing">("all");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    getMovement(movementMasterId, controller.signal)
      .then((nextRecords) => {
        setRecords(nextRecords);
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
  const selectedShop = searchParams.get("shop")?.trim() || "";
  const currentShop =
    shops.find(
      (shop) => shop.toLocaleLowerCase() === selectedShop.toLocaleLowerCase(),
    ) ||
    shops[0] ||
    "";
  const currentRecords = recordsByShop[currentShop] || [];
  const shopMissingCount = currentRecords.filter((record) => !isValidMovementQuantity(record.quantity)).length;
  const visibleRecords = itemFilter === "missing"
    ? currentRecords.filter((record) => !isValidMovementQuantity(record.quantity))
    : currentRecords;
  const totalQuantity = sumQuantity(records);
  const missingQuantityCount = records.filter((record) => !isValidMovementQuantity(record.quantity)).length;
  const isDelivered =
    records.length > 0 && records.every((record) => record.status === "delivered");

  useEffect(() => {
    if (!currentShop || selectedShop === currentShop) return;

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set("shop", currentShop);
    router.replace(`${pathname}?${nextSearchParams.toString()}`, {
      scroll: false,
    });
  }, [currentShop, pathname, router, searchParams, selectedShop]);

  function selectShop(shop: string) {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set("shop", shop);
    router.replace(`${pathname}?${nextSearchParams.toString()}`, {
      scroll: false,
    });
  }

  function reviewMissingQuantities() {
    const nextShop = shopMissingCount > 0 ? currentShop : shops.find((shop) =>
      recordsByShop[shop].some((record) => !isValidMovementQuantity(record.quantity)),
    );
    if (nextShop) selectShop(nextShop);
    setItemFilter("missing");
    document.getElementById("movement-items")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function refreshMovement() {
    setRefreshing(true);
    setError(undefined);
    try {
      setRecords(await getMovement(movementMasterId));
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setRefreshing(false);
    }
  }

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
    isNewArrival?: boolean;
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
          <div className={styles.topBar}>
            <Button className={styles.backButton} href="/movements" icon={<ArrowLeftOutlined />} type="text">Movements</Button>
            <Button
              className={styles.refreshButton}
              disabled={loading || delivering || savingIds.size > 0 || uploadingIds.size > 0}
              icon={<ReloadOutlined />}
              loading={refreshing}
              onClick={() => void refreshMovement()}
            >Refresh</Button>
          </div>
          <header className={styles.pageHeader}>
            <div>
              <Text className={styles.eyebrow}>Home → {shops.length > 0 ? shops.join(" + ") : "Shop"}</Text>
              <Title level={1}>Movement details</Title>
              <Text className={styles.movementReference}>{movementMasterId}</Text>
            </div>
            <Tag className={styles.movementStatus} color={isDelivered ? "green" : "default"}>
              {isDelivered ? "Delivered" : "Created"}
            </Tag>
          </header>
          {missingQuantityCount > 0 ? <Alert className={styles.alert} title={`${missingQuantityCount} ${missingQuantityCount === 1 ? "item needs" : "items need"} a quantity`} description="Add a note or quantity below before marking this movement delivered." showIcon type="warning" /> : null}
          {error ? <Alert className={styles.alert} title={error} showIcon type="error" /> : null}
          {notice ? <Alert className={styles.alert} title={notice} showIcon type="success" closable={{ onClose: () => setNotice(undefined) }} /> : null}
          {loading ? <Card><Skeleton active paragraph={{ rows: 9 }} /></Card> : records.length === 0 ? <Card><Empty description="No movement items" /></Card> : (
            <>
              <div className={styles.shopSummary} aria-label="Selected shop summary">
                <div><span>Items</span><strong>{currentRecords.length}</strong></div>
                <div><span>Total pieces</span><strong>{sumQuantity(currentRecords)}</strong></div>
                <div><span>Need quantity</span><strong className={shopMissingCount ? styles.pendingCount : undefined}>{shopMissingCount}</strong></div>
              </div>
              <div className={styles.reviewToolbar}>
                <Segmented
                  aria-label="Movement shops"
                  className={styles.shopTabs}
                  options={shops.map((shop) => ({ label: `${shop} · ${recordsByShop[shop].length} ${recordsByShop[shop].length === 1 ? "item" : "items"}`, value: shop }))}
                  value={currentShop}
                  onChange={selectShop}
                  block
                />
                <div className={styles.itemFilters} aria-label="Filter movement items">
                  <Button type={itemFilter === "all" ? "primary" : "default"} aria-pressed={itemFilter === "all"} onClick={() => setItemFilter("all")}>All items <span>{currentRecords.length}</span></Button>
                  <Button type={itemFilter === "missing" ? "primary" : "default"} aria-pressed={itemFilter === "missing"} onClick={() => setItemFilter("missing")}>Needs quantity <span>{shopMissingCount}</span></Button>
                </div>
              </div>
              <section id="movement-items" className={styles.itemGrid} aria-label={`${currentShop} movement items`}>
                {visibleRecords.length === 0 ? <Card className={styles.emptyCard}><Empty description="All quantities for this shop are ready"><Button onClick={() => setItemFilter("all")}>Show all items</Button></Empty></Card> : null}
                {visibleRecords.map((record) => (
                  <MovementItem
                    checked={packedIds.has(record.movementId)}
                    key={record.movementId}
                    record={record}
                    itemNumber={currentRecords.indexOf(record) + 1}
                    saving={savingIds.has(record.movementId)}
                    uploading={uploadingIds.has(record.movementId)}
                    message={messages[record.movementId]}
                    onChecked={(checked) => setPackedIds((current) => checked ? new Set(current).add(record.movementId) : without(current, record.movementId))}
                    onSave={updateItem}
                    onStockCounted={(stockCounted) => updateItem({ movementId: record.movementId, stockCounted })}
                    onNewArrival={(isNewArrival) => updateItem({ movementId: record.movementId, isNewArrival })}
                    onUpdateImage={(file) => updateImage(record.movementId, file)}
                  />
                ))}
              </section>
            </>
          )}
        </main>
        {!loading && records.length > 0 ? (
          <footer className={styles.deliveryBar} aria-label="Movement completion">
            <div className={styles.deliveryInner}>
              <div className={styles.deliveryInfo}>
                <Text strong>{isDelivered ? "Movement delivered" : missingQuantityCount > 0 ? `${missingQuantityCount} ${missingQuantityCount === 1 ? "quantity" : "quantities"} to add` : "Ready to deliver"}</Text>
                <Text type="secondary">{records.length} items · {totalQuantity} pieces · all shops</Text>
              </div>
              {missingQuantityCount > 0 ? (
                <Button type="primary" onClick={reviewMissingQuantities}>Add quantities</Button>
              ) : (
                <Popconfirm
                  disabled={isDelivered || delivering || savingIds.size > 0 || uploadingIds.size > 0 || refreshing}
                  title="Mark this movement as delivered?"
                  description={`All ${records.length} items across all shops will be marked delivered.`}
                  okText="Mark delivered"
                  onConfirm={markDelivered}
                >
                  <Button disabled={isDelivered || savingIds.size > 0 || uploadingIds.size > 0 || refreshing} icon={<CheckCircleOutlined />} loading={delivering} type="primary">
                    {isDelivered ? "Delivered" : "Mark delivered"}
                  </Button>
                </Popconfirm>
              )}
            </div>
          </footer>
        ) : null}
      </div>
    </ConfigProvider>
  );
}

function MovementItem({ checked, record, itemNumber, saving, uploading, message, onChecked, onSave, onStockCounted, onNewArrival, onUpdateImage }: {
  checked: boolean;
  record: ProductMovementRecord;
  itemNumber: number;
  saving: boolean;
  uploading: boolean;
  message?: string;
  onChecked: (checked: boolean) => void;
  onSave: (input: { movementId: string; quantity: string; remark: string }) => Promise<void>;
  onStockCounted: (value: boolean) => Promise<void>;
  onNewArrival: (value: boolean) => Promise<void>;
  onUpdateImage: (file: File) => Promise<void>;
}) {
  const [editing, setEditing] = useState(() => !isValidMovementQuantity(record.quantity));
  const [quantity, setQuantity] = useState(record.quantity);
  const [remark, setRemark] = useState(record.remark);
  const nextRemark = remark.trim();
  const calculatedQuantity = nextRemark !== record.remark ? parseQuantity(nextRemark)?.quantity : undefined;
  const nextQuantity = calculatedQuantity || quantity.trim();
  const quantityMissing = !isValidMovementQuantity(record.quantity);
  const busy = saving || uploading;
  const noteInputId = `movement-note-${record.movementId}`;
  const quantityInputId = `movement-quantity-${record.movementId}`;
  const changed = nextQuantity !== record.quantity || nextRemark !== record.remark;

  function updateRemark(value: string) {
    setRemark(value);
    const calculated = parseQuantity(value);
    if (calculated) setQuantity(calculated.quantity);
  }

  function cancel() {
    setQuantity(record.quantity);
    setRemark(record.remark);
    setEditing(false);
  }

  return (
    <Card className={`${styles.itemCard} ${checked ? styles.packed : ""}`} data-needs-quantity={quantityMissing}>
      <div className={styles.itemHeader}>
        <div className={styles.itemHeading}>
          <Text strong>Item {String(itemNumber).padStart(2, "0")}</Text>
          <Text type="secondary">{record.fromLocation} → {record.toLocation}</Text>
        </div>
        <div className={styles.itemHeaderActions}>
          <Checkbox checked={checked} onChange={(event) => onChecked(event.target.checked)}>Packed</Checkbox>
          {!editing ? <Button icon={<EditOutlined />} onClick={() => { setQuantity(record.quantity); setRemark(record.remark); setEditing(true); }} aria-label={`Edit item ${itemNumber}`}>Edit</Button> : null}
        </div>
      </div>
      <div className={styles.itemLayout}>
        <div className={styles.imageColumn}>
          <Image
            alt={`Product for item ${itemNumber}, ${record.toLocation}`}
            className={styles.productImage}
            fallback={MOVEMENT_IMAGE_PLACEHOLDER}
            src={movementImageUrl(record.productImageUrl, 900) || MOVEMENT_IMAGE_PLACEHOLDER}
            preview={{ src: movementImageUrl(record.productImageUrl, 1600) || MOVEMENT_IMAGE_PLACEHOLDER }}
          />
          <Text className={styles.photoHint} type="secondary">Tap photo to zoom</Text>
          {editing ? <Upload accept="image/*" beforeUpload={(file) => { void onUpdateImage(file as File); return false; }} disabled={busy} showUploadList={false}><Button block icon={<UploadOutlined />} loading={uploading} disabled={saving}>Change photo</Button></Upload> : null}
        </div>
        <div className={styles.itemBody}>
          <Space className={styles.itemBadges} size={6} wrap>
            <Tag color={quantityMissing ? "orange" : "cyan"}>{quantityMissing ? "Needs quantity" : `${record.quantity} pieces`}</Tag>
            {record.status === "delivered" ? <Tag color="green">Delivered</Tag> : null}
          </Space>
          {editing ? (
            <div className={styles.editForm}>
              <div className={styles.noteField}>
                <label htmlFor={noteInputId}>Breakdown / note</label>
                <TextArea id={noteInputId} autoSize={{ minRows: 3, maxRows: 8 }} disabled={busy} value={remark} placeholder={"ดำ 5\nขาว 7"} onChange={(event) => updateRemark(event.target.value)} aria-describedby={`${noteInputId}-help`} />
                <Text id={`${noteInputId}-help`} type="secondary">One quantity per line, or just a number. We add them for you.</Text>
              </div>
              <div className={styles.quantityField}>
                <label htmlFor={quantityInputId}>Quantity <span>{calculatedQuantity ? "Calculated from note" : "Or enter directly"}</span></label>
                <Input id={quantityInputId} aria-label="Quantity" inputMode="decimal" size="large" disabled={busy} readOnly={Boolean(calculatedQuantity)} value={nextQuantity} placeholder="0" onChange={(event) => setQuantity(event.target.value)} suffix="pieces" aria-describedby={`${quantityInputId}-help`} />
                <Text id={`${quantityInputId}-help`} type="secondary">{isValidMovementQuantity(nextQuantity) ? "" : "Enter a quantity greater than 0 to save."}</Text>
              </div>
              <div className={styles.editActions}>
                <Button disabled={busy} onClick={cancel}>Cancel</Button>
                <Button disabled={busy || !isValidMovementQuantity(nextQuantity) || !changed} loading={saving} type="primary" onClick={() => void onSave({ movementId: record.movementId, quantity: nextQuantity, remark: nextRemark }).then(() => { setQuantity(nextQuantity); setRemark(nextRemark); setEditing(false); }).catch(() => undefined)}>
                  Save item
                </Button>
              </div>
            </div>
          ) : record.remark ? <Paragraph className={styles.remark}>{record.remark}</Paragraph> : null}
          <div className={styles.itemFlags} aria-label={`Flags for item ${itemNumber}`}>
            <Button aria-pressed={record.stockCounted} loading={saving} disabled={busy} type={record.stockCounted ? "primary" : "default"} onClick={() => void onStockCounted(!record.stockCounted).catch(() => undefined)}>
              {record.stockCounted ? "✓ Stock counted" : "Stock counted"}
            </Button>
            <Button aria-pressed={record.isNewArrival} loading={saving} disabled={busy} type={record.isNewArrival ? "primary" : "default"} onClick={() => void onNewArrival(!record.isNewArrival).catch(() => undefined)}>
              {record.isNewArrival ? "✓ New arrival" : "New arrival"}
            </Button>
          </div>
          {message ? <Text className={styles.saveMessage} role="status" type={message === "Saved." || message === "Image updated." ? "success" : busy ? "secondary" : "danger"}>{message}</Text> : null}
          <div className={styles.itemMeta}>
            <Text type="secondary">Created {formatBangkokDateTime(record.createdAt)}</Text>
            <Text type="secondary">{record.movementId}</Text>
          </div>
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
    borderRadius: 12,
    controlHeight: 44,
    controlHeightLG: 48,
    fontFamily: "Arial, Helvetica, sans-serif",
  },
};
