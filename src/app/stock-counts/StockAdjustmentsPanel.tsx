"use client";
import { Alert, Button, Input, Modal, Select, Spin, Tag } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { ADJUSTMENT_REASONS, type AdjustmentEmployee, type AdjustmentReason, type StockAdjustment } from "@/modules/inventory/contracts";
import styles from "./adjustments.module.css";

type Shop = { accountId: string; shopName: string; calculatedStock: number; physicalCount: number | null; warnings?: string[] };
export type AdjustmentFilter = { accountId: string; direction: string };
type Props = { month: string; shops: Shop[]; filter: AdjustmentFilter; onFilterChange: (filter: AdjustmentFilter) => void; onChanged: () => Promise<void> };
type Entry = { accountId: string; date: string; direction: "in" | "out"; reason: AdjustmentReason; employeeId: string; quantity: string; itemDescription: string; photoUrl: string; note: string; replacesId: string; notInLoyverse: boolean };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const label = (a: StockAdjustment) => a.reason === "reversal" ? "Reversal" : ADJUSTMENT_REASONS[a.reason];
const units = (n: number) => new Intl.NumberFormat("en-TH").format(n);
async function request(url: string, method = "GET", body?: unknown, signal?: AbortSignal) {
  const response = await fetch(url, { method, signal, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) throw new Error(data?.error || "Stock adjustment operation failed. Please retry.");
  return data;
}
export function StockAdjustmentsPanel({ month, shops, filter, onFilterChange, onChanged }: Props) {
  const [records, setRecords] = useState<StockAdjustment[]>([]), [employees, setEmployees] = useState<AdjustmentEmployee[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; shopName: string }[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [reasonFilter, setReasonFilter] = useState("all");
  const [entry, setEntry] = useState<Entry>(), [reverseTarget, setReverseTarget] = useState<StockAdjustment>();
  const [reverseNote, setReverseNote] = useState(""), [replaceAfter, setReplaceAfter] = useState(false);
  const [busy, setBusy] = useState(false), [formError, setFormError] = useState("");
  const requestId = useRef(""), lock = useRef(false);
  const pendingReplacement = useRef<StockAdjustment | undefined>(undefined);
  const load = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted) return;
    setLoading(true); setError("");
    try {
      const data = await request(`/api/stock-adjustments?month=${encodeURIComponent(month)}`, "GET", undefined, signal);
      if (!signal?.aborted) { setRecords(data.records); setEmployees(data.employees); setAccounts(data.accounts); }
    } catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : "Could not load adjustments."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [month]);
  useEffect(() => { const c = new AbortController(); queueMicrotask(() => void load(c.signal)); return () => c.abort(); }, [load]);
  const reversed = new Set(records.filter(a => a.reversesId).map(a => a.reversesId));
  const replaced = new Set(records.filter(a => a.replacesId).map(a => a.replacesId));
  const filtered = records.filter(a => (filter.accountId === "all" || a.accountId === filter.accountId) && (filter.direction === "all" || a.direction === filter.direction) && (reasonFilter === "all" || a.reason === reasonFilter) && `${a.shopName} ${a.employeeName} ${label(a)} ${a.note} ${a.itemDescription} ${a.id}`.toLowerCase().includes(query.trim().toLowerCase()));
  const accountOptions = [...new Map([...accounts, ...records.map(a => ({ id: a.accountId, shopName: a.shopName }))].map(a => [a.id, a])).values()];
  const selectedShop = shops.find(s => s.accountId === entry?.accountId);
  const projected = entry && selectedShop ? selectedShop.calculatedStock + (entry.direction === "out" ? -1 : 1) * Number(entry.quantity || 0) : undefined;
  const maxDate = today().slice(0, 7) === month ? today() : `${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()}`;
  function openEntry(original?: StockAdjustment) {
    setFormError(""); requestId.current = crypto.randomUUID();
    setEntry({ accountId: original?.accountId || (filter.accountId === "all" ? "" : filter.accountId), date: original?.date || maxDate, direction: original?.direction || "out", reason: original && original.reason !== "reversal" ? original.reason : "employee_gift", employeeId: original?.employeeId || "", quantity: original ? String(original.quantity) : "1", itemDescription: original?.itemDescription || "", photoUrl: original?.photoUrl || "", note: original?.note || "", replacesId: original?.id || "", notInLoyverse: false });
  }
  async function saveEntry(event: React.FormEvent) {
    event.preventDefault(); if (!entry || lock.current) return;
    lock.current = true; setBusy(true); setFormError("");
    try {
      await request("/api/stock-adjustments", "POST", { ...entry, quantity: Number(entry.quantity), requestId: requestId.current });
      setEntry(undefined); await Promise.all([load(), onChanged()]);
    } catch (e) { setFormError(e instanceof Error ? e.message : "Could not save adjustment."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function reverse(event: React.FormEvent) {
    event.preventDefault(); if (!reverseTarget || lock.current) return;
    lock.current = true; setBusy(true); setFormError("");
    try {
      await request("/api/stock-adjustments", "PATCH", { action: "reverse", id: reverseTarget.id, note: reverseNote });
      if (replaceAfter) pendingReplacement.current = reverseTarget;
      setReverseTarget(undefined);
      await Promise.all([load(), onChanged()]);
    } catch (e) { setFormError(e instanceof Error ? e.message : "Could not reverse adjustment."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section id="adjustments" className={styles.panel} aria-label="Stock adjustment history">
    <header className={styles.header}><div><h2>Stock adjustments</h2><p>Non-sale unit changes · {month}. History includes original entries and reversals.</p></div><div className={styles.actions}><Button loading={loading} onClick={() => void load()}>Refresh history</Button><Button type="primary" disabled={loading || Boolean(error) || !accounts.length} onClick={() => openEntry()}>Record adjustment</Button></div></header>
    {error && <Alert type="error" title={error} showIcon />}
    <p className={styles.hint}>Gifts, damage, samples and personal use reduce stock. Returns and positive corrections add stock. No sales, expenses or payroll deductions are created. Never log the same change here and in Loyverse.</p>
    <div className={styles.filters}>
      <Input aria-label="Search adjustments" placeholder="Employee, item, reason or note…" value={query} onChange={e => setQuery(e.target.value)} allowClear />
      <Select aria-label="Adjustment shop" value={filter.accountId} onChange={accountId => onFilterChange({ ...filter, accountId })} options={[{ value: "all", label: "All shops" }, ...accountOptions.map(a => ({ value: a.id, label: a.shopName }))]} />
      <Select aria-label="Adjustment direction" value={filter.direction} onChange={direction => onFilterChange({ ...filter, direction })} options={[{ value: "all", label: "In and out" }, { value: "out", label: "Stock out" }, { value: "in", label: "Stock in" }]} />
      <Select aria-label="Adjustment reason filter" value={reasonFilter} onChange={setReasonFilter} options={[{ value: "all", label: "All reasons" }, ...Object.entries(ADJUSTMENT_REASONS).map(([value, label]) => ({ value, label })), { value: "reversal", label: "Reversals" }]} />
    </div>
    {loading ? <div className={styles.empty}><Spin /></div> : !filtered.length ? <div className={styles.empty}><h3>No adjustments found</h3><p>Record an adjustment or change the filters.</p></div> : <ul className={styles.list}>{filtered.map(a => <li key={a.id}>
      <div><strong>{a.shopName} · {label(a)}</strong><span>{a.date}{a.employeeName ? ` · ${a.employeeName}` : ""}</span><div className={styles.tags}>{reversed.has(a.id) ? <Tag>Reversed</Tag> : a.reversesId ? <Tag>Counter-entry</Tag> : <Tag color={a.direction === "out" ? "gold" : "green"}>Applied</Tag>}{a.replacesId && <Tag>Replacement</Tag>}</div></div>
      <strong className={a.direction === "out" ? styles.out : styles.in}>{a.direction === "out" ? "−" : "+"}{units(a.quantity)} units</strong>
      <div className={styles.actions}>{!a.reversesId && !reversed.has(a.id) && <Button danger onClick={() => { setFormError(""); setReverseNote(""); setReplaceAfter(false); setReverseTarget(a); }} aria-label={`Reverse adjustment ${a.id}`}>Reverse</Button>}{reversed.has(a.id) && !replaced.has(a.id) && <Button onClick={() => openEntry(a)} aria-label={`Record replacement for ${a.id}`}>Record replacement</Button>}</div>
      <div className={styles.details}>{a.itemDescription && <p>{a.itemDescription}</p>}{a.note && <p>{a.note}</p>}{a.photoUrl && <a href={a.photoUrl} target="_blank" rel="noopener noreferrer">Open photo</a>}<details><summary>Details</summary><p>ID: {a.id}</p><p>Recorded by: {a.createdBy === "web-owner" ? "Shop owner (web)" : a.createdBy} · {new Date(a.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" })}</p>{a.reversesId && <p>Reverses: {a.reversesId}</p>}{a.replacesId && <p>Replaces: {a.replacesId}</p>}</details></div>
    </li>)}</ul>}
    <Modal className={styles.modal} open={Boolean(entry)} title={entry?.replacesId ? "Record corrected adjustment" : "Record stock adjustment"} footer={null} mask={{ closable: false }} closable={!busy} keyboard={!busy} onCancel={() => { if (!busy) setEntry(undefined); }} destroyOnHidden>
      {entry && <form className={styles.form} onSubmit={event => void saveEntry(event)}>
        {formError && <Alert type="error" title={formError} showIcon />}
        {entry.replacesId && <Alert type="info" title="The original entry is reversed. Review and save this replacement separately." />}
        <label>Shop<select aria-label="Adjustment shop entry" required value={entry.accountId} onChange={e => setEntry({ ...entry, accountId: e.target.value })}><option value="" disabled>Select shop</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.shopName}</option>)}</select></label>
        <label>Adjustment date<input aria-label="Adjustment date" type="date" required min={`${month}-01`} max={maxDate} value={entry.date} onChange={e => setEntry({ ...entry, date: e.target.value })} /></label>
        <label>Reason<select aria-label="Adjustment reason" value={entry.reason} onChange={e => { const reason = e.target.value as AdjustmentReason; setEntry({ ...entry, reason, direction: reason === "correction" ? entry.direction : reason === "employee_return" ? "in" : "out" }); }}>{Object.entries(ADJUSTMENT_REASONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Direction<select aria-label="Adjustment direction entry" disabled={entry.reason !== "correction"} value={entry.direction} onChange={e => setEntry({ ...entry, direction: e.target.value as Entry["direction"] })}><option value="out">Stock out</option><option value="in">Stock in</option></select></label>
        <label>Employee{["employee_gift", "employee_return"].includes(entry.reason) ? " (required)" : " (optional)"}<select aria-label="Adjustment employee" required={["employee_gift", "employee_return"].includes(entry.reason)} value={entry.employeeId} onChange={e => setEntry({ ...entry, employeeId: e.target.value })}><option value="">Select employee</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}{e.status !== "active" ? " (inactive)" : ""}</option>)}</select></label>
        <label>Quantity (whole units)<input aria-label="Adjustment quantity" type="number" required min="1" max="1000000000" step="1" inputMode="numeric" value={entry.quantity} onChange={e => setEntry({ ...entry, quantity: e.target.value })} /></label>
        <label>Item description (optional)<input aria-label="Adjustment item description" maxLength={250} value={entry.itemDescription} onChange={e => setEntry({ ...entry, itemDescription: e.target.value })} /></label>
        <label>Photo link (optional)<input aria-label="Adjustment photo link" type="url" maxLength={2000} placeholder="HTTPS photo or Google Drive link" value={entry.photoUrl} onChange={e => setEntry({ ...entry, photoUrl: e.target.value })} /></label>
        <label>Note (optional)<textarea aria-label="Adjustment note" rows={3} maxLength={500} value={entry.note} onChange={e => setEntry({ ...entry, note: e.target.value })} /></label>
        {selectedShop && <p>Calculated stock after saving: <strong>{units(projected ?? selectedShop.calculatedStock)} units</strong>. This is a monthly estimate, not a physical count.</p>}
        {selectedShop?.warnings?.map(w => <Alert key={w} type="warning" title={w} />)}
        {selectedShop?.physicalCount != null && <Alert type="warning" title="This month already has a physical count. Saving changes calculated stock and variance, not the saved physical count." />}
        {projected !== undefined && projected < 0 && <Alert type="warning" title="This would make calculated stock negative. Review the figures before saving." />}
        <label className={styles.check}><input type="checkbox" required checked={entry.notInLoyverse} onChange={e => setEntry({ ...entry, notInLoyverse: e.target.checked })} />I confirm this change is not already recorded in Loyverse.</label>
        <div className={styles.actions}><Button disabled={busy} onClick={() => setEntry(undefined)}>Cancel</Button><Button type="primary" loading={busy} htmlType="submit">Save adjustment</Button></div>
      </form>}
    </Modal>
    <Modal className={styles.modal} open={Boolean(reverseTarget)} title="Reverse stock adjustment" afterClose={() => { const original = pendingReplacement.current; pendingReplacement.current = undefined; if (original) openEntry(original); }} footer={null} mask={{ closable: false }} closable={!busy} keyboard={!busy} onCancel={() => { if (!busy) setReverseTarget(undefined); }} destroyOnHidden>
      {reverseTarget && <form className={styles.form} onSubmit={event => void reverse(event)}>
        {formError && <Alert type="error" title={formError} showIcon />}
        <p>Reverse <strong>{units(reverseTarget.quantity)} units {reverseTarget.direction}</strong> for <strong>{reverseTarget.shopName}</strong> on {reverseTarget.date}{reverseTarget.employeeName ? ` · ${reverseTarget.employeeName}` : ""}?</p>
        <p>A linked counter-entry will cancel its effect in {reverseTarget.date.slice(0, 7)}. The original history and physical counts are retained.</p>
        <label>Reason for reversal<textarea aria-label="Reversal reason" required maxLength={500} value={reverseNote} onChange={e => setReverseNote(e.target.value)} rows={3} /></label>
        <label className={styles.check}><input type="checkbox" checked={replaceAfter} onChange={e => setReplaceAfter(e.target.checked)} />Review a corrected replacement after reversing</label>
        {replaceAfter && <p>The reversal is saved first. The replacement only takes effect if you save it on the next form.</p>}
        <div className={styles.actions}><Button disabled={busy} onClick={() => setReverseTarget(undefined)}>Keep adjustment</Button><Button danger type="primary" loading={busy} htmlType="submit">Reverse adjustment</Button></div>
      </form>}
    </Modal>
  </section>;
}
