import type { TDocumentDefinitions } from "pdfmake/interfaces";

type DailyCommissionRecord = {
  date: string;
  shopId: string;
  shopName: string;
  attendanceUnits: number;
  netSales: number;
  commissionType: "none" | "sales_bucket";
  bucketCount: number;
  commission: number;
};

export type PayrollRecord = {
  employeeId: string;
  employeeName: string;
  compensationType: "daily" | "monthly" | null;
  effectiveFrom: string;
  baseSalary: number;
  commission: number;
  commissionType: "none" | "sales_bucket";
  commissionBucketSales: number;
  commissionBucketAmount: number;
  commissionRoundupThreshold: number;
  commissionSales: number;
  workedDays: number;
  leaveDays: number;
  leaveDates: string[];
  basePay: number;
  totalPay: number;
  dailyCommissions: DailyCommissionRecord[];
};

const money = (value: number) => new Intl.NumberFormat("en-TH", {
  style: "currency", currency: "THB", minimumFractionDigits: 2,
}).format(value);

export function buildPayrollDocument(record: PayrollRecord, month: string): TDocumentDefinitions {
  const period = new Intl.DateTimeFormat("en-GB", {
    month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
  const dailyRows = [
    ...record.dailyCommissions.map(day => ({
      date: day.date,
      cells: [
        day.date, day.shopName || day.shopId,
        day.attendanceUnits === 0.5 ? "Half day" : "Full day",
        { text: money(day.netSales), alignment: "right" as const },
        day.commissionType === "sales_bucket" ? String(day.bucketCount) : "—",
        { text: money(day.commission), alignment: "right" as const },
      ],
    })),
    ...Array.from(new Set(record.leaveDates || [])).map(date => ({
      date,
      cells: [date, "—", { text: "Leave", bold: true, color: "#966219" }, "—", "—", "—"],
    })),
  ].sort((left, right) => left.date.localeCompare(right.date));
  return {
    info: { title: `Daily sales and commission — ${record.employeeName} — ${month}`, author: "Stock Management" },
    pageSize: "A4",
    pageMargins: [36, 36, 36, 42],
    defaultStyle: { font: "Sarabun", fontSize: 10, color: "#24352c" },
    footer: (page, pages) => ({ text: `${period} • Page ${page} of ${pages}`, alignment: "center", fontSize: 8, color: "#68756c" }),
    content: [
      { text: "Daily sales and commission", fontSize: 21, bold: true, color: "#157347" },
      { text: `${record.employeeName} • ${period}`, fontSize: 12, margin: [0, 4, 0, 16] },
      dailyRows.length ? {
        table: { headerRows: 1, widths: [60, "*", 54, 68, 34, 68], body: [
          ["Date", "Shop", "Attendance", "Net sales", "Buckets", "Commission"].map(text => ({ text, bold: true, fillColor: "#e8f3ec" })),
          ...dailyRows.map(row => row.cells),
        ] }, layout: "lightHorizontalLines", fontSize: 9,
      } : { text: "No work or leave days recorded." },
    ],
  };
}

export async function downloadPayrollPdf(record: PayrollRecord, month: string): Promise<void> {
  // Load the PDF engine only when exporting. Fonts are served locally, not by a third party.
  const { default: pdfMake } = await import("pdfmake/build/pdfmake");
  const normal = `${window.location.origin}/fonts/sarabun/Sarabun-Regular.ttf`;
  const bold = `${window.location.origin}/fonts/sarabun/Sarabun-Bold.ttf`;
  pdfMake.fonts = { Sarabun: { normal, bold, italics: normal, bolditalics: bold } };
  const filenameId = record.employeeId.replace(/[^a-zA-Z0-9_-]/g, "_") || "employee";
  await pdfMake.createPdf(buildPayrollDocument(record, month)).download(`salary-${filenameId}-${month}.pdf`);
}
