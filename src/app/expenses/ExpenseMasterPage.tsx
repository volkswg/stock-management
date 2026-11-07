"use client";
import { Alert, Button, Card, ConfigProvider, Empty, Form, Input, Modal, Select, Spin, Switch, Tag, Typography } from "antd";
import { useCallback, useEffect, useState } from "react";
import type { ExpenseCategory, ExpenseShop } from "@/modules/expenses/contracts";
import styles from "./expenses.module.css";
type Row = ExpenseCategory | ExpenseShop;
type Values = { name: string; active: boolean; loyverseAccountId?: string };
export function ExpenseMasterPage({ kind }: { kind: "categories" | "shops" }) {
  const [rows, setRows] = useState<Row[]>([]), [accounts, setAccounts] = useState<{ id: string; shopName: string }[]>([]);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>(), [modalError, setModalError] = useState<string>();
  const [editing, setEditing] = useState<Row | null>(); const [form] = Form.useForm<Values>();
  const shop = kind === "shops", title = shop ? "Shop master" : "Expense categories", singular = shop ? "shop" : "category";
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(undefined);
    try { const result = await request(kind, { signal }); if (!signal?.aborted) { setRows(result.records || []); setAccounts(result.accounts || []); } }
    catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Load failed."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [kind]);
  useEffect(() => { const controller = new AbortController(), timer = window.setTimeout(() => { void load(controller.signal); }, 0); return () => { window.clearTimeout(timer); controller.abort(); }; }, [load]);
  const open = (row: Row | null) => { setEditing(row); setModalError(undefined); form.resetFields(); form.setFieldsValue({ name: row?.name || "", active: row?.active ?? true, loyverseAccountId: row && "loyverseAccountId" in row ? row.loyverseAccountId || undefined : undefined }); };
  const save = async (values: Values) => {
    if (saving) return; setSaving(true); setModalError(undefined);
    try { await request(kind, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, id: editing?.id, loyverseAccountId: values.loyverseAccountId || "" }) }); setEditing(undefined); await load(); }
    catch (cause) { setModalError(cause instanceof Error ? cause.message : "Save failed."); }
    finally { setSaving(false); }
  };
  return <ConfigProvider theme={{ token: { colorPrimary: "#157347", borderRadius: 6, fontFamily: "Arial, Helvetica, sans-serif" } }}><div className={styles.appShell}><main className={styles.content}>
    <header className={styles.header}><div><Typography.Text type="secondary">Expenses · Master data</Typography.Text><Typography.Title level={1}>{title}</Typography.Title><Typography.Text type="secondary">{shop ? "Manage shops independently. Loyverse mapping is optional and connects expenses to sales reports." : "Manage reusable categories. Deactivate unused categories without changing historical entries."}</Typography.Text></div><div className={styles.headerActions}><Button href="/expenses">Expense entries</Button><Button href={shop ? "/expenses/categories" : "/expenses/shops"}>{shop ? "Categories" : "Shop master"}</Button><Button disabled={saving} loading={loading} onClick={() => void load()}>Refresh</Button></div></header>
    {error && <Alert title={error} type="error" showIcon className={styles.alert} />}
    <div className={styles.sectionHeader}><h2>{rows.length} {shop ? "shops" : "categories"}</h2><Button type="primary" disabled={loading || saving || Boolean(error)} onClick={() => open(null)}>Add {singular}</Button></div>
    <Spin spinning={loading}><div className={styles.grid}>{rows.map(row => <Card className={styles.expenseCard} key={row.id}><div className={styles.cardHeader}><h3>{row.name}</h3><Button type="text" size="small" className={styles.editButton} disabled={loading || saving || Boolean(error)} aria-label={`Edit ${row.name}`} onClick={() => open(row)}>Edit</Button></div><Tag color={row.active ? "green" : undefined}>{row.active ? "Active" : "Inactive"}</Tag>{"loyverseAccountId" in row && <p>{row.loyverseAccountId ? `Loyverse: ${accounts.find(account => account.id === row.loyverseAccountId)?.shopName || row.loyverseAccountId}` : "No Loyverse mapping"}</p>}</Card>)}</div>{!loading && !rows.length && <Empty description={`No ${kind} yet.`} />}</Spin>
    <Modal open={editing !== undefined} title={`${editing ? "Edit" : "Add"} ${singular}`} okText={`Save ${singular}`} confirmLoading={saving} closable={!saving} keyboard={!saving} cancelButtonProps={{ disabled: saving }} mask={{ closable: false }} onCancel={() => { if (!saving) setEditing(undefined); }} onOk={() => form.submit()}>
      {modalError && <Alert title={modalError} type="error" className={styles.alert} showIcon />}
      <Form form={form} layout="vertical" onFinish={save} disabled={saving}><Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true }, { max: 100 }]}><Input maxLength={100} /></Form.Item>
      {shop && <Form.Item name="loyverseAccountId" label="Loyverse account (optional)"><Select allowClear placeholder="No mapping" options={[...accounts.map(account => ({ value: account.id, label: account.shopName })), ...(editing && "loyverseAccountId" in editing && editing.loyverseAccountId && !accounts.some(account => account.id === editing.loyverseAccountId) ? [{ value: editing.loyverseAccountId, label: editing.loyverseAccountId }] : [])]} /></Form.Item>}
      <Form.Item name="active" label="Active" valuePropName="checked"><Switch /></Form.Item><Typography.Text type="secondary">Inactive records remain visible on historical expenses but cannot be selected for new entries.</Typography.Text></Form>
    </Modal>
  </main></div></ConfigProvider>;
}
async function request(kind: string, init?: RequestInit): Promise<{ ok: boolean; error?: string; records?: Row[]; accounts?: { id: string; shopName: string }[] }> {
  const response = await fetch(`/api/expenses/masters/${kind}`, init), result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || "Master data request failed."); return result;
}
