"use client";
import { Alert, Button, ConfigProvider, Input, Modal, Select, Spin, Tag } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SalaryAdvance } from "@/services/employees/manageSalaryAdvances";
import styles from "./advances.module.css";

type Advance = SalaryAdvance & { recoveredAmount: number; outstandingAmount: number };
type Data = { advances: Advance[]; employees: { id: string; name: string; status: string }[]; shops: { id: string; name: string; active: boolean }[]; settledMonths: { employeeId: string; month: string }[] };
// Only needed for unpaid entries saved by an older version of the app.
type Action = { kind: "pay" | "cancel"; advance: Advance };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const money = (n: number) => new Intl.NumberFormat("en-TH", { style: "currency", currency: "THB", currencyDisplay: "narrowSymbol" }).format(n);
const isUnpaid = (a: Advance) => a.status === "requested" || a.status === "approved";
async function request(method = "GET", body?: unknown, signal?: AbortSignal) {
  const response = await fetch("/api/employees/advances", { method, signal, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || "Could not load salary advances.");
  return data;
}
export function SalaryAdvancesPage() {
  const [data, setData] = useState<Data>({ advances: [], employees: [], shops: [], settledMonths: [] });
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [status, setStatus] = useState("all"), [month, setMonth] = useState("");
  const [create, setCreate] = useState(false), [action, setAction] = useState<Action>();
  const [busy, setBusy] = useState(false), [formError, setFormError] = useState("");
  const requestId = useRef(""); const submitting = useRef(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("");
    try { const result = await request("GET", undefined, signal); if (!signal?.aborted) setData(result); }
    catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : "Could not load advances."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const c = new AbortController(); queueMicrotask(() => { if (!c.signal.aborted) void load(c.signal); }); return () => c.abort(); }, [load]);
  const name = (id: string) => data.employees.find(e => e.id === id)?.name || id;
  const shop = (id: string) => data.shops.find(s => s.id === id)?.name || id;
  const filtered = data.advances.filter(a => (!month || a.payrollMonth === month) &&
    (status === "all" || (status === "outstanding" ? a.outstandingAmount > 0 : status === "recovered" ? a.status === "paid" && a.outstandingAmount === 0 : status === "unpaid" ? isUnpaid(a) : a.status === status)) &&
    `${name(a.employeeId)} ${a.employeeId} ${shop(a.shopId)} ${a.note} ${a.reference}`.toLowerCase().includes(query.trim().toLowerCase()));
  const statusOptions = ["all", "paid", "outstanding", "recovered", ...(data.advances.some(isUnpaid) ? ["unpaid"] : []), ...(data.advances.some(a => a.status === "cancelled") ? ["cancelled"] : [])];
  const openAction = (kind: Action["kind"], advance: Advance) => { setFormError(""); setAction({ kind, advance }); };
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitting.current) return;
    const values = new FormData(event.currentTarget); submitting.current = true; setBusy(true); setFormError("");
    try {
      const payment = { paidAmount: Number(values.get("paidAmount")), paidDate: values.get("paidDate"), reference: values.get("reference") || "" };
      if (create) await request("POST", { requestId: requestId.current, employeeId: values.get("employeeId"), shopId: values.get("shopId"), payrollMonth: values.get("payrollMonth"), note: values.get("note") || "", ...payment });
      else if (action) await request("PATCH", { id: action.advance.id, updatedAt: action.advance.updatedAt, action: action.kind, ...(action.kind === "pay" ? payment : {}) });
      setCreate(false); setAction(undefined); await load();
    } catch (e) { setFormError(e instanceof Error ? e.message : "Could not save advance."); }
    finally { submitting.current = false; setBusy(false); }
  }
  const title = create ? "Record salary advance" : action ? `${action.kind === "pay" ? "Record payment for" : "Remove unpaid entry for"} ${name(action.advance.employeeId)}` : "";
  return <ConfigProvider theme={{ token: { colorPrimary: "#157347", colorBorder: "#dfe5e8", colorText: "#15243a", colorBgContainer: "#ffffff", borderRadius: 6, fontFamily: "Arial, Helvetica, sans-serif" } }}>
    <div className={styles.appShell}><main className={styles.page}>
      <header className={styles.header}>
        <div><span>Human resources</span><h1>Salary advances</h1><p>Record advances paid to employees and deduct them from payroll.</p></div>
        <div className={styles.actions}>
          <Button href="/employees/payroll">Payroll</Button>
          <Button onClick={() => void load()} loading={loading}>Refresh</Button>
          <Button type="primary" disabled={loading || Boolean(error)} onClick={() => { requestId.current = crypto.randomUUID(); setFormError(""); setCreate(true); }}>Record advance</Button>
        </div>
      </header>
      {error && <Alert title={error} type="error" showIcon />}
      <div className={styles.summary}>
        {[["Payments", filtered.filter(a => a.status === "paid").length], ["Paid", filtered.reduce((s, a) => s + a.paidAmount, 0)], ["Recovered", filtered.reduce((s, a) => s + a.recoveredAmount, 0)], ["Outstanding", filtered.reduce((s, a) => s + a.outstandingAmount, 0)]].map(([label, value]) =>
          <div key={label}><span>{label}</span><strong>{loading ? "—" : label === "Payments" ? value : money(Number(value))}</strong></div>)}
      </div>
      <p className={styles.hint}>Record money already paid to an employee. It is included in the selected payroll month immediately; remaining balances carry forward. This does not transfer money or create an expense entry.</p>
      <section aria-label="Salary advance list" className={styles.panel}>
        <div className={styles.filters}>
          <Input aria-label="Find advances" placeholder="Find employee, shop or note…" value={query} onChange={e => setQuery(e.target.value)} allowClear />
          <Select aria-label="Advance status" value={status} onChange={setStatus} options={statusOptions.map(value => ({ value, label: value === "all" ? "All statuses" : value === "unpaid" ? "Not paid" : value[0].toUpperCase() + value.slice(1) }))} />
          <label>Deduction month<input aria-label="Deduction month filter" type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>
          {month && <Button onClick={() => setMonth("")}>All months</Button>}
        </div>
        {loading ? <div className={styles.empty}><Spin /></div> : !filtered.length ? <div className={styles.empty}><h2>No salary advances</h2><p>Record an advance payment or adjust your filters.</p></div> :
          <ul className={styles.list}>{filtered.map(a => {
            const unpaid = isUnpaid(a);
            const locked = data.settledMonths.some(s => s.employeeId === a.employeeId && s.month >= a.payrollMonth);
            return <li className={unpaid ? styles.unpaidRow : undefined} key={a.id}>
              <div className={styles.identity}>
                <strong>{name(a.employeeId)}</strong><span>{shop(a.shopId)}{a.paidDate ? ` · Paid ${a.paidDate}` : ""}</span><span>Deduct from {a.payrollMonth}</span>
                <Tag color={a.status === "paid" ? a.outstandingAmount ? "gold" : "green" : "default"}>{a.status === "paid" ? a.outstandingAmount === 0 ? "Recovered" : "Paid" : unpaid ? "Not paid" : "Cancelled"}</Tag>
              </div>
              <div className={styles.amount}><span>{unpaid ? "Unpaid amount" : "Paid amount"}</span><strong>{money(unpaid ? a.requestedAmount : a.paidAmount)}</strong></div>
              <div className={styles.amount}><span>Outstanding</span><strong>{money(a.outstandingAmount)}</strong><span>Recovered: {money(a.recoveredAmount)}</span></div>
              {unpaid && <div className={styles.rowActions}>
                {unpaid && !locked && <Button type="primary" onClick={() => openAction("pay", a)}>Record payment</Button>}
                {unpaid && <Button danger onClick={() => openAction("cancel", a)}>Remove unpaid entry</Button>}
                {locked && unpaid && <span>Payroll month locked</span>}
              </div>}
              {(a.note || a.reference) && <p className={styles.note}>{a.reference}{a.note && <span>{a.note}</span>}</p>}
            </li>;
          })}</ul>}
      </section>
      <Modal className={styles.modal} open={create || Boolean(action)} title={title} onCancel={() => { if (!busy) { setCreate(false); setAction(undefined); } }} footer={null} mask={{ closable: false }} closable={!busy} keyboard={!busy} destroyOnHidden>
        <form className={styles.form} onSubmit={event => void save(event)}>
          {formError && <Alert title={formError} type="error" showIcon />}
          {create && <>
            <label>Employee<select aria-label="Employee" name="employeeId" required defaultValue=""><option value="" disabled>Select employee</option>{data.employees.filter(e => e.status === "active").map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
            <label>Shop<select aria-label="Shop" name="shopId" required defaultValue=""><option value="" disabled>Select shop</option>{data.shops.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          </>}
          {create || action?.kind === "pay" ? <>
            <p>Enter an advance you have already paid. It will be deducted from the selected payroll month.</p>
            <label>Paid amount (THB)<input aria-label="Paid amount (THB)" name="paidAmount" type="number" min="0.01" max={create ? 1000000000 : action?.advance.requestedAmount} step="0.01" required inputMode="decimal" defaultValue={action?.advance.requestedAmount} /></label>
            <label>Payment date<input aria-label="Payment date" name="paidDate" type="date" required min={action?.advance.requestedDate} max={today()} defaultValue={today()} /></label>
            {create && <label>Deduct from payroll month<input aria-label="Deduct from payroll month" name="payrollMonth" type="month" required min="2000-01" max="2199-12" defaultValue={today().slice(0, 7)} /></label>}
            <label>Payment reference<input aria-label="Payment reference" name="reference" maxLength={200} /></label>
            {create && <label>Note<textarea aria-label="Note" name="note" maxLength={500} rows={3} /></label>}
            <p>Paid advances cannot be edited or cancelled.</p>
          </> : action && <p>Remove this unpaid entry of {money(action.advance.requestedAmount)}? Its history will be retained and payroll will not change.</p>}
          <div className={styles.formActions}>
            <Button disabled={busy} onClick={() => { setCreate(false); setAction(undefined); }}>{action?.kind === "cancel" ? "Keep entry" : "Back"}</Button>
            <Button type="primary" danger={action?.kind === "cancel"} loading={busy} htmlType="submit">{create ? "Save advance" : action?.kind === "pay" ? "Confirm payment" : "Remove entry"}</Button>
          </div>
        </form>
      </Modal>
    </main></div>
  </ConfigProvider>;
}
