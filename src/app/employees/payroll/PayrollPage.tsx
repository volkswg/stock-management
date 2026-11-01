"use client";

import { Alert, Button, ConfigProvider, Input, Select, Spin } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./payroll.module.css";
import type { PayrollRecord } from "./payrollPdf";
type DailyCommissionRecord = PayrollRecord["dailyCommissions"][number];



type PayrollResponse = {
  ok: boolean;
  month?: string;
  payroll?: PayrollRecord[];
  error?: string;
};

export function PayrollPage() {
  const [month, setMonth] = useState(getBangkokMonth());
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [exportingId, setExportingId] = useState<string>();
  const [query, setQuery] = useState("");
  const [payType, setPayType] = useState("all");
  const [expanded, setExpanded] = useState<string[]>([]);
  const activePayroll = useMemo(
    () => payroll.filter(record => record.workedDays > 0 || record.leaveDays > 0),
    [payroll],
  );
  const filtered = activePayroll.filter(record =>
    `${record.employeeName} ${record.employeeId}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
    (payType === "all" || (record.compensationType || "none") === payType),
  );
  const period = getPayrollMonthOptions().find(option => option.value === month)?.label;
  function toggleDetails(id: string) {
    setExpanded(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]);
  }

  async function exportPdf(record: PayrollRecord) {
    setExportingId(record.employeeId);
    setError(undefined);
    try {
      const { downloadPayrollPdf } = await import("./payrollPdf");
      await downloadPayrollPdf(record, month);
    } catch {
      setError("Could not export the salary PDF. Please try again.");
    } finally {
      setExportingId(undefined);
    }
  }

  const loadPayroll = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted) return;
    setLoading(true);
    setPayroll([]);
    setError(undefined);
    try {
      const response = await fetch(
        `/api/employees/payroll?month=${encodeURIComponent(month)}`,
        { signal },
      );
      const body = (await response.json().catch(() => undefined)) as
        | PayrollResponse
        | undefined;
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || `Request failed (${response.status}).`);
      }
      setPayroll(body.payroll || []);
    } catch (requestError) {
      if (!signal?.aborted) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Failed to calculate payroll.",
        );
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void loadPayroll(controller.signal));
    return () => controller.abort();
  }, [loadPayroll]);

  const totals = useMemo(
    () => ({
      basePay: activePayroll.reduce((sum, record) => sum + record.basePay, 0),
      commission: activePayroll.reduce((sum, record) => sum + record.commission, 0),
      totalPay: activePayroll.reduce((sum, record) => sum + record.totalPay, 0),
    }),
    [activePayroll],
  );

  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#157347", colorBorder: "#dfe5e8", borderRadius: 6, fontFamily: "Arial, Helvetica, sans-serif" } }}>
      <div className={styles.appShell}>
        <main className={styles.content}>
          <header className={styles.pageHeader}>
            <div>
              <span className={styles.eyebrow}>Human resources</span>
              <h1>Payroll</h1>
              <p>Review attendance, salary and commission.</p>
            </div>
            <div className={styles.pageActions}>
              <Button href="/employees">Employees</Button>
              <Button aria-label="Refresh" loading={loading} onClick={() => void loadPayroll()}>Refresh</Button>
            </div>
          </header>
          {error && <Alert className={styles.alert} title={error} type="error" />}
          <div className={styles.monthBar}>
            <label className={styles.monthField}>
              <span>Payroll month</span>
              <Select aria-label="Payroll month" options={getPayrollMonthOptions()} optionFilterProp="label" showSearch value={month} onChange={setMonth} />
            </label>
          </div>
          <section className={styles.summaryGrid} aria-label="Monthly payroll totals" aria-busy={loading}>
            {[
              ["Employees", activePayroll.length], ["Base pay", formatMoney(totals.basePay)],
              ["Commission", formatMoney(totals.commission)], ["Total payroll", formatMoney(totals.totalPay)],
            ].map(([label, value]) => <div key={label} className={styles.summaryCard}><span>{label}</span><strong>{loading ? "—" : value}</strong></div>)}
          </section>
          <details className={styles.rules}>
            <summary>How pay is calculated</summary>
            <p>Monthly: full base salary, regardless of leave. Daily: base rate × recorded workday units. A half day counts as 0.5.</p>
            <p>Commission: synced net sales for the selected shop and work date earn one configured amount per full sales bucket. A remainder at the round-up threshold earns the next bucket. Sales below the first full bucket earn no commission.</p>
          </details>
          <section className={styles.payrollPanel} aria-label="Employee payroll">
            <div className={styles.listHeader}>
              <div className={styles.listTitle}><h2>Employee payroll</h2><span aria-live="polite">{loading ? "Loading…" : `${filtered.length} of ${activePayroll.length} employees`}</span></div>
              <div className={styles.filters}>
                <Input aria-label="Find an employee" placeholder="Find an employee…" value={query} onChange={event => setQuery(event.target.value)} allowClear />
                <Select aria-label="Filter by pay type" value={payType} onChange={setPayType} options={[{value:"all",label:"All pay types"},{value:"daily",label:"Daily"},{value:"monthly",label:"Monthly"},{value:"none",label:"No rate"}]} />
              </div>
            </div>
            {loading ? <div className={styles.empty}><Spin /><p>Calculating payroll…</p></div> : !filtered.length ? <div className={styles.empty} role="status"><h3>{activePayroll.length ? "No matching employees" : "No attendance for this month"}</h3><p>{activePayroll.length ? "Try a different name, employee ID or pay type." : "Only employees with recorded work or leave appear. Choose another payroll month to see attendance."}</p>{activePayroll.length > 0 && <Button onClick={() => {setQuery("");setPayType("all");}}>Clear filters</Button>}</div> : <>
              <div className={styles.columnHeaders} aria-hidden="true"><span>Employee</span><span>Attendance</span><span>Base pay</span><span>Commission</span><span>Total pay</span><span>Actions</span></div>
              <ul className={styles.employeeList}>
                {filtered.map(record => {
                  const open = expanded.includes(record.employeeId);
                  const detailsId = `payroll-details-${encodeURIComponent(record.employeeId)}`;
                  return <li className={styles.employeeItem} key={record.employeeId}>
                    <div className={styles.employeeRow}>
                      <div className={styles.employeeIdentity}><div><strong>{record.employeeName}</strong></div><span className={styles.badge}>{record.compensationType === "daily" ? "Daily" : record.compensationType === "monthly" ? "Monthly" : "No rate"}</span></div>
                      <div className={styles.attendance}><span>{record.workedDays} worked</span><span>{record.leaveDays} leave</span></div>
                      <div className={styles.payValue}><span>Base pay</span>{formatMoney(record.basePay)}</div>
                      <div className={styles.payValue}><span>Commission</span>{formatMoney(record.commission)}</div>
                      <div className={`${styles.payValue} ${styles.totalPay}`}><span>Total pay</span><strong>{formatMoney(record.totalPay)}</strong></div>
                      <div className={styles.rowActions}>
                        <Button type="text" loading={exportingId === record.employeeId} disabled={Boolean(exportingId && exportingId !== record.employeeId)} aria-label={`Export PDF for ${record.employeeName}`} onClick={() => void exportPdf(record)}>Export PDF</Button>
                        <Button type="text" aria-expanded={open} aria-controls={detailsId} aria-label={`${open ? "Hide" : "View"} details for ${record.employeeName}`} onClick={() => toggleDetails(record.employeeId)}>{open ? "Hide details" : "View details"}</Button>
                      </div>
                    </div>
                    {open && <div id={detailsId} className={styles.dailyBreakdown}>
                      <div className={styles.detailHeading}><h3>Daily sales, commission &amp; leave</h3><span>{period}</span></div>
                      <p className={styles.employeeId}>Employee ID: {record.employeeId}</p>
                      <div className={styles.rateInfo}><span>{record.compensationType === "daily" ? "Daily rate" : "Base salary"}: {formatMoney(record.baseSalary)}{record.effectiveFrom ? ` · From ${formatDate(record.effectiveFrom)}` : ""}</span><span>Eligible sales: {record.commissionType === "sales_bucket" ? formatMoney(record.commissionSales) : "Not eligible"}</span><span>Commission rule: {record.commissionType === "sales_bucket" ? `${formatMoney(record.commissionBucketAmount)} per ${formatMoney(record.commissionBucketSales)} · Round at ${formatMoney(record.commissionRoundupThreshold)}` : "None"}</span></div>
                      <DailyDetails record={record} />
                    </div>}
                  </li>;
                })}
              </ul>
              <div className={styles.listTotal}><strong>Total · {filtered.length} employees</strong><div><span>Base pay</span><strong>{formatMoney(filtered.reduce((sum, r) => sum + r.basePay, 0))}</strong></div><div><span>Commission</span><strong>{formatMoney(filtered.reduce((sum, r) => sum + r.commission, 0))}</strong></div><div><span>Total pay</span><strong>{formatMoney(filtered.reduce((sum, r) => sum + r.totalPay, 0))}</strong></div></div>
            </>}
          </section>
          <p className={styles.pdfNote}>PDF includes daily sales, commission and leave.</p>
        </main>
      </div>
    </ConfigProvider>
  );
}

function DailyDetails({ record }: { record: PayrollRecord }) {
  const days: Array<{ date: string; day?: DailyCommissionRecord }> = [
    ...record.dailyCommissions.map(day => ({ date: day.date, day })),
    ...Array.from(new Set(record.leaveDates || [])).map(date => ({ date })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  if (!days.length) return <p className={styles.noDays}>No work or leave days recorded.</p>;
  return <div className={styles.dayList}>
    <div className={styles.dayHeaders} aria-hidden="true"><span>Date / shop</span><span>Attendance</span><span>Net sales</span><span>Buckets</span><span>Commission</span></div>
    {days.map(({ date, day }, index) => <div className={styles.dayRow} key={`${date}:${day?.shopId || "leave"}:${index}`}>
      <div><strong>{formatDate(date)}</strong><span className={styles.shop}>{day ? day.shopName || day.shopId : "—"}</span></div>
      <span className={day ? styles.workStatus : styles.leaveStatus}>{day ? day.attendanceUnits === 0.5 ? "Half day" : "Full day" : "Leave"}</span>
      <div className={styles.dayMoney}><span>Sales</span>{day ? formatMoney(day.netSales) : "—"}</div>
      <div className={styles.bucket}><span>Buckets</span>{day ? day.commissionType !== "sales_bucket" ? "Not eligible" : day.bucketCount === 0 ? "Below first bucket" : day.bucketCount : "—"}</div>
      <div className={styles.dayMoney}><span>Commission</span>{day ? formatMoney(day.commission) : "—"}</div>
    </div>)}
  </div>;
}

function getBangkokMonth(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  return `${year}-${month}`;
}

function getPayrollMonthOptions(): Array<{ label: string; value: string }> {
  const [currentYear, currentMonth] = getBangkokMonth().split("-").map(Number);
  return Array.from({ length: 120 }, (_, index) => {
    const date = new Date(Date.UTC(currentYear, currentMonth - 1 - index, 1));
    return {
      label: new Intl.DateTimeFormat("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(date),
      value: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
    };
  });
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-TH", {
    style: "currency",
    currency: "THB",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
