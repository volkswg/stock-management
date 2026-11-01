"use client";

import { MoreOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, ConfigProvider, DatePicker, Dropdown, Empty, Form, Input, InputNumber, Modal, Select, Spin, Tag, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useEffect, useState } from "react";
import type { Expense, ExpenseCategory, ExpenseShop } from "@/services/expenses";
import styles from "./expenses.module.css";

const { Title, Text } = Typography;
type Result = { ok: boolean; shops?: ExpenseShop[]; categories?: ExpenseCategory[]; expenses?: Expense[]; error?: string };
type Values = { amount: number; note?: string; name: string; categoryId: string; shopId?: string; scope: "SHOP" | "SHARED"; expenseDate?: Dayjs; month: Dayjs };
const money = (value: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(value);

export function ExpensesPage({ initialMonth }: { initialMonth: string }) {
  const [month, setMonth] = useState(initialMonth);
  const [shops, setShops] = useState<ExpenseShop[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [shopFilter, setShopFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [requestId, setRequestId] = useState("");
  const [editing, setEditing] = useState<Expense | null>();
  const [deleting, setDeleting] = useState<Expense>();
  const [modalError, setModalError] = useState<string>();
  const [form] = Form.useForm<Values>();
  const scope = Form.useWatch("scope", form);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(undefined);
    try {
      const result = await request(`/api/expenses?month=${encodeURIComponent(month)}`, { signal });
      if (!signal?.aborted) { setShops(result.shops || []); setCategories(result.categories || []); setExpenses(result.expenses || []); }
    } catch (cause) { if (!signal?.aborted) setError(errorMessage(cause)); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [month]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void load(controller.signal); }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);

  const visible = expenses.filter(row => (shopFilter === "ALL" || (shopFilter === "SHARED" ? row.scope === "SHARED" : row.scope === "SHOP" && row.shopId === shopFilter)) && (categoryFilter === "ALL" || row.categoryId === categoryFilter));
  const shopTotal = visible.filter(row => row.scope === "SHOP").reduce((sum, row) => sum + row.amount, 0);
  const sharedTotal = visible.filter(row => row.scope === "SHARED").reduce((sum, row) => sum + row.amount, 0);
  const busy = loading || saving || Boolean(error);
  const shopName = (row: Expense) => row.scope === "SHARED" ? "Shared" : shops.find(shop => shop.id === row.shopId)?.name || row.shopId;

  const changeMonth = (next: string) => {
    if (next === month) return;
    setLoading(true); setExpenses([]); setMonth(next); setNotice(undefined);
    const url = new URL(window.location.href); url.searchParams.set("month", next); window.history.replaceState(null, "", url);
  };
  const open = (row: Expense | null) => {
    setRequestId(createRequestId());
    setModalError(undefined); setEditing(row); form.resetFields();
    const firstShop = shops.find(shop => shop.active);
    form.setFieldsValue({ amount: row?.amount, note: row?.note || "", name: row?.name || "", categoryId: row?.categoryId || categories.find(category => category.active)?.id,
      scope: row?.scope || (firstShop ? "SHOP" : "SHARED"), shopId: row?.shopId || firstShop?.id, month: dayjs(`${row?.month || month}-01`), expenseDate: row?.expenseDate ? dayjs(row.expenseDate) : row ? undefined : dayjs() });
  };
  const save = async (values: Values) => {
    if (editing === undefined || saving) return;
    setSaving(true); setModalError(undefined);
    const savedMonth = values.month.format("YYYY-MM");
    try {
      await request("/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: editing ? undefined : requestId, id: editing?.id, month: savedMonth, expenseDate: values.expenseDate?.format("YYYY-MM-DD") || "", amount: values.amount, note: values.note || "", scope: values.scope, shopId: values.scope === "SHOP" ? values.shopId : "", categoryId: values.categoryId, name: values.name }) });
      setEditing(undefined); setNotice("Expense saved. Profit reports use the updated totals.");
      if (savedMonth !== month) changeMonth(savedMonth); else await load();
    } catch (cause) { setModalError(errorMessage(cause)); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!deleting || saving) return;
    setSaving(true); setModalError(undefined);
    try { await request("/api/expenses", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deleting.id }) }); setDeleting(undefined); setNotice("Expense deleted."); await load(); }
    catch (cause) { setModalError(errorMessage(cause)); }
    finally { setSaving(false); }
  };

  return <ConfigProvider theme={{ token: { colorPrimary: "#157347", borderRadius: 6, fontFamily: "Arial, Helvetica, sans-serif" } }}>
    <div className={styles.appShell}><main className={styles.content}>
      <header className={styles.header}>
        <div><Text type="secondary">Operating costs</Text><Title level={1}>Expense entries</Title><Text type="secondary">Record individual shop and shared expenses, independently of sales.</Text></div>
        <div className={styles.headerActions}><Button href="/expenses/categories">Categories</Button><Button href="/expenses/shops">Shop master</Button><Button href="/sales/profit-summary">Profit summary</Button><Button icon={<ReloadOutlined />} loading={loading} disabled={saving} onClick={() => void load()}>Refresh</Button></div>
      </header>
      {error && <Alert title={error} type="error" showIcon className={styles.alert} />}
      {notice && <Alert title={notice} type="success" showIcon className={styles.alert} />}
      <div className={styles.filters}>
        <div><label htmlFor="expense-month">Month</label><DatePicker id="expense-month" aria-label="Expense month" picker="month" format="MMMM YYYY" allowClear={false} value={dayjs(`${month}-01`)} disabled={loading || saving} onChange={value => { if (value) changeMonth(value.format("YYYY-MM")); }} /></div>
        <div><label htmlFor="expense-shop-filter">Shop / scope</label><Select id="expense-shop-filter" aria-label="Filter shop" value={shopFilter} disabled={busy} onChange={setShopFilter} options={[{ value: "ALL", label: "All shops and shared" }, { value: "SHARED", label: "Shared only" }, ...shops.map(shop => ({ value: shop.id, label: `${shop.name}${shop.active ? "" : " (inactive)"}` }))]} /></div>
        <div><label htmlFor="expense-category-filter">Category</label><Select id="expense-category-filter" aria-label="Filter category" value={categoryFilter} disabled={busy} onChange={setCategoryFilter} options={[{ value: "ALL", label: "All categories" }, ...categories.map(category => ({ value: category.id, label: category.name }))]} /></div>
      </div>
      <div className={styles.totals}><Card><Text type="secondary">Shop expenses (filtered)</Text><strong>{money(shopTotal)}</strong></Card><Card><Text type="secondary">Shared expenses (filtered)</Text><strong>{money(sharedTotal)}</strong></Card><Card><Text type="secondary">Total expenses (filtered)</Text><strong>{money(shopTotal + sharedTotal)}</strong></Card></div>
      <section className={styles.section} aria-labelledby="expense-entries">
        <div className={styles.sectionHeader}><div><h2 id="expense-entries">Entries</h2><Text type="secondary">{visible.length} expense{visible.length === 1 ? "" : "s"} for {dayjs(`${month}-01`).format("MMMM YYYY")}</Text></div><Button type="primary" disabled={busy || !categories.some(category => category.active)} onClick={() => open(null)}>Add expense</Button></div>
        <Spin spinning={loading}><div className={styles.grid}>{visible.map(row => <Card key={row.id} className={styles.expenseCard}>
          <div className={styles.cardHeader}><h3>{row.name}</h3><div className={styles.rowActions}><Button type="text" size="small" className={styles.editButton} disabled={busy} aria-label={`Edit ${row.name} for ${shopName(row)}`} onClick={() => open(row)}>Edit</Button><Dropdown trigger={["click"]} menu={{ items: [{ key: "delete", label: "Delete expense", danger: true }], onClick: () => { setModalError(undefined); setDeleting(row); } }}><Button type="text" icon={<MoreOutlined />} disabled={busy} aria-label={`More actions for ${row.name} for ${shopName(row)}`} /></Dropdown></div></div>
          <Text>{shopName(row)}</Text><div className={styles.tags}><Tag>{categories.find(category => category.id === row.categoryId)?.name || row.categoryId}</Tag></div>
          <strong className={styles.amount}>{money(row.amount)}</strong><Text type="secondary">{row.expenseDate ? dayjs(row.expenseDate).format("D MMM YYYY") : "Actual date not recorded"}</Text>{row.note && <p>{row.note}</p>}
        </Card>)}</div>{!loading && !visible.length && <Empty description="No expenses match this month and filters." />}</Spin>
      </section>
    </main></div>
    <Modal open={editing !== undefined} title={editing ? "Edit expense" : "Add expense"} okText="Save expense" confirmLoading={saving} cancelButtonProps={{ disabled: saving }} closable={!saving} keyboard={!saving} mask={{ closable: false }} onCancel={() => { if (!saving) setEditing(undefined); }} onOk={() => form.submit()}>
      {modalError && <Alert title={modalError} type="error" showIcon className={styles.alert} />}
      <Form form={form} layout="vertical" disabled={saving} onFinish={save}>
        <Form.Item name="name" label="Expense name" rules={[{ required: true, whitespace: true }, { max: 100 }]}><Input maxLength={100} /></Form.Item>
        <div className={styles.formGrid}><Form.Item name="month" label="Accounting month" rules={[{ required: true }]}><DatePicker picker="month" format="MMMM YYYY" className={styles.fullWidth} allowClear={false} /></Form.Item><Form.Item name="expenseDate" label="Expense date" extra="Optional when the actual date is unknown."><DatePicker format="YYYY-MM-DD" className={styles.fullWidth} /></Form.Item></div>
        <Form.Item name="scope" label="Scope" rules={[{ required: true }]}><Select options={[{ value: "SHOP", label: "Shop" }, { value: "SHARED", label: "Shared" }]} /></Form.Item>
        {scope === "SHOP" && <Form.Item name="shopId" label="Shop" rules={[{ required: true }]}><Select options={shops.map(shop => ({ value: shop.id, label: `${shop.name}${shop.active ? "" : " (inactive)"}`, disabled: !shop.active && editing?.shopId !== shop.id }))} /></Form.Item>}
        <Form.Item name="categoryId" label="Category" rules={[{ required: true }]}><Select options={categories.map(category => ({ value: category.id, label: `${category.name}${category.active ? "" : " (inactive)"}`, disabled: !category.active && editing?.categoryId !== category.id }))} /></Form.Item>
        <Form.Item name="amount" label="Amount (THB)" rules={[{ required: true }, { type: "number", min: 0, max: 1e12 }]}><InputNumber min={0} max={1e12} precision={2} className={styles.fullWidth} /></Form.Item>
        <Form.Item name="note" label="Note" rules={[{ max: 200 }]}><Input.TextArea maxLength={200} rows={3} /></Form.Item>
      </Form>
    </Modal>
    <Modal open={Boolean(deleting)} title={`Delete ${deleting?.name || "expense"}?`} centered mask={{ closable: false }} keyboard={!saving} closable={!saving} okText="Delete expense" cancelText="Keep expense" confirmLoading={saving} okButtonProps={{ danger: true }} cancelButtonProps={{ disabled: saving }} onOk={() => void remove()} onCancel={() => { if (!saving) setDeleting(undefined); }}>
      <p>This removes only {deleting?.name} for {deleting ? shopName(deleting) : ""} ({money(deleting?.amount || 0)}) from {dayjs(`${month}-01`).format("MMMM YYYY")}. The audit record is retained.</p>{modalError && <Alert title={modalError} type="error" showIcon />}
    </Modal>
  </ConfigProvider>;
}
async function request(url: string, init?: RequestInit): Promise<Result> {
  const response = await fetch(url, init), result = await response.json() as Result;
  if (!response.ok || !result.ok) throw new Error(result.error || "Expense request failed."); return result;
}
function errorMessage(cause: unknown): string { return cause instanceof Error ? cause.message : "Expense request failed."; }

// getRandomValues also works on local-network HTTP pages, unlike randomUUID.
function createRequestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
