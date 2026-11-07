"use client";

import { DownOutlined, MoreOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, ConfigProvider, DatePicker, Dropdown, Empty, Form, Input, InputNumber, Modal, Select, Spin, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useEffect, useState } from "react";
import type { Expense, ExpenseCategory, ExpenseShop } from "@/modules/expenses/contracts";
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

  const groups = Array.from(new Set(visible.map(row => row.scope === "SHARED" ? "SHARED" : row.shopId)))
    .sort((a, b) => a === "SHARED" ? 1 : b === "SHARED" ? -1 : (shops.find(shop => shop.id === a)?.name || a).localeCompare(shops.find(shop => shop.id === b)?.name || b))
    .map(id => ({ id, name: id === "SHARED" ? "Shared expenses" : shops.find(shop => shop.id === id)?.name || id,
      rows: visible.filter(row => (row.scope === "SHARED" ? "SHARED" : row.shopId) === id) }));
  const addDisabled = busy || !categories.some(category => category.active);
  const managementLinks = [{ key: "categories", label: <a href="/expenses/categories">Categories</a> }, { key: "shops", label: <a href="/expenses/shops">Shop master</a> }, { key: "profit", label: <a href="/sales/profit-summary">Profit summary</a> }];

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
    <div className={`${styles.appShell} ${styles.listShell}`}><main className={`${styles.content} ${styles.listContent}`}>
      <header className={styles.listHeader}>
        <div><div className={styles.eyebrow}>Operating costs</div><Title level={1}>Expenses</Title><Text type="secondary">Your shop and shared expenses, in one clear list.</Text></div>
        <div className={styles.listHeaderActions}>
          <nav className={styles.desktopLinks} aria-label="Expense management"><a href="/expenses/categories">Categories</a><a href="/expenses/shops">Shop master</a><a href="/sales/profit-summary">Profit summary</a></nav>
          <Button type="primary" aria-label="Add expense" icon={<PlusOutlined />} className={styles.desktopAdd} disabled={addDisabled} onClick={() => open(null)}>Add expense</Button>
          <Dropdown trigger={["click"]} menu={{ items: managementLinks }}><Button className={styles.manageButton}>Manage <DownOutlined /></Button></Dropdown>
        </div>
      </header>
      {error && <Alert title={error} type="error" showIcon className={styles.alert} />}
      {notice && <Alert title={notice} type="success" showIcon className={styles.alert} />}
      <section className={styles.summary} aria-label="Filtered expense totals">
        <div className={`${styles.metric} ${styles.totalMetric}`}><span>Total expenses</span><strong>{money(shopTotal + sharedTotal)}</strong></div>
        <div className={styles.metric}><span>Shop expenses</span><strong>{money(shopTotal)}</strong></div>
        <div className={styles.metric}><span>Shared expenses</span><strong>{money(sharedTotal)}</strong></div>
      </section>
      <div className={styles.listFilters}>
        <div><label htmlFor="expense-month">Month</label><DatePicker id="expense-month" aria-label="Expense month" picker="month" format="MMMM YYYY" allowClear={false} value={dayjs(`${month}-01`)} disabled={loading || saving} onChange={value => { if (value) changeMonth(value.format("YYYY-MM")); }} /></div>
        <div><label htmlFor="expense-shop-filter">Shop / scope</label><Select id="expense-shop-filter" aria-label="Filter shop" value={shopFilter} disabled={busy} onChange={setShopFilter} options={[{ value: "ALL", label: "All shops and shared" }, { value: "SHARED", label: "Shared only" }, ...shops.map(shop => ({ value: shop.id, label: `${shop.name}${shop.active ? "" : " (inactive)"}` }))]} /></div>
        <div><label htmlFor="expense-category-filter">Category</label><Select id="expense-category-filter" aria-label="Filter category" value={categoryFilter} disabled={busy} onChange={setCategoryFilter} options={[{ value: "ALL", label: "All categories" }, ...categories.map(category => ({ value: category.id, label: category.name }))]} /></div>
        <Button type="text" className={styles.refreshButton} icon={<ReloadOutlined />} loading={loading} disabled={saving} onClick={() => void load()}>Refresh</Button>
      </div>
      <section className={styles.section} aria-labelledby="expense-entries" aria-busy={loading}>
        <div className={styles.listTop}><h2 id="expense-entries">Expense list <span className={styles.count}>{visible.length}</span></h2><Text type="secondary">{dayjs(`${month}-01`).format("MMMM YYYY")}</Text></div>
        <Spin spinning={loading}>
          <div className={styles.expenseList}>
            <div className={styles.columnLabels} aria-hidden="true"><span>Expense</span><span>Category</span><span>Expense date</span><span className={styles.amountLabel}>Amount</span><span /></div>
            {groups.map(group => <section key={group.id} aria-label={`${group.name} expenses`}>
              <div className={styles.groupHeader}><div><h3>{group.name}</h3><span>{group.rows.length} expense{group.rows.length === 1 ? "" : "s"}</span></div><strong>{money(group.rows.reduce((sum, row) => sum + row.amount, 0))}</strong></div>
              <ul className={styles.expenseRows}>{group.rows.map(row => {
                const category = categories.find(category => category.id === row.categoryId)?.name || row.categoryId;
                const date = row.expenseDate ? dayjs(row.expenseDate).format("D MMM YYYY") : "Not recorded";
                return <li key={row.id} className={styles.expenseRow}>
                  <div className={styles.expenseName}><h4>{row.name}</h4><div className={styles.mobileMeta}><span>{category}</span><span aria-hidden="true">·</span><span>{row.expenseDate ? date : "Date not recorded"}</span></div>{row.note && <p className={styles.expenseNote}>{row.note}</p>}</div>
                  <div className={styles.rowCategory}><span className={styles.categoryPill}>{category}</span></div>
                  <div className={`${styles.rowDate} ${!row.expenseDate ? styles.unknownDate : ""}`}>{date}</div>
                  <strong className={styles.rowAmount}>{money(row.amount)}</strong>
                  <div className={styles.listRowActions}><Button type="text" size="small" className={styles.editButton} disabled={busy} aria-label={`Edit ${row.name} for ${shopName(row)}`} onClick={() => open(row)}>Edit</Button><Dropdown trigger={["click"]} menu={{ items: [{ key: "delete", label: "Delete expense", danger: true }], onClick: () => { setModalError(undefined); setDeleting(row); } }}><Button type="text" icon={<MoreOutlined />} disabled={busy} aria-label={`More actions for ${row.name} for ${shopName(row)}`} /></Dropdown></div>
                </li>;
              })}</ul>
            </section>)}
            {!loading && !visible.length && <Empty className={styles.listEmpty} description="No expenses match this month and filters." />}
          </div>
        </Spin>
        <div className={styles.listFootnote}><span>Showing {visible.length} expense{visible.length === 1 ? "" : "s"} · {shopFilter === "ALL" ? "All shops and shared" : shopFilter === "SHARED" ? "Shared only" : shops.find(shop => shop.id === shopFilter)?.name || shopFilter}{categoryFilter !== "ALL" && ` · ${categories.find(category => category.id === categoryFilter)?.name || categoryFilter}`}</span><span>Amounts in Thai baht (THB)</span></div>
      </section>
      <div className={styles.mobileAddBar}><Button type="primary" aria-label="Add expense" icon={<PlusOutlined />} disabled={addDisabled} onClick={() => open(null)}>Add expense</Button></div>
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
