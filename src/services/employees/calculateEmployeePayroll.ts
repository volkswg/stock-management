import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { getGoogleSheetsSalesDashboard } from "@/services/sales";
import {
  listEmployeeCompensations,
  listEmployees,
  type EmployeeCompensation,
  type EmployeeCompensationType,
} from "./manageEmployees";
import {
  EmployeeTimesheetStatus,
  listEmployeeTimesheetsForMonth,
} from "./manageEmployeeTimesheets";

export type EmployeePayrollDailyCommission = {
  date: string;
  shopId: string;
  shopName: string;
  attendanceUnits: number;
  netSales: number;
  commissionType: "none" | "sales_bucket";
  bucketCount: number;
  commission: number;
};

export type EmployeePayroll = {
  employeeId: string;
  employeeName: string;
  compensationType: EmployeeCompensationType | null;
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
  basePay: number;
  totalPay: number;
  dailyCommissions: EmployeePayrollDailyCommission[];
};

export async function calculateEmployeePayroll({
  googleSheetsService,
  month,
}: {
  googleSheetsService: IGoogleSheetsService;
  month: string;
}): Promise<EmployeePayroll[]> {
  const employees = await listEmployees({ googleSheetsService });
  const [compensations, timesheets] = await Promise.all([
    listEmployeeCompensations({ googleSheetsService }),
    listEmployeeTimesheetsForMonth({ googleSheetsService, month }),
  ]);
  const monthStart = `${month}-01`;
  const monthEnd = getMonthEnd(month);
  const shopIds = Array.from(
    new Set(timesheets.map((timesheet) => timesheet.shopId)),
  );
  const salesDashboard = await getGoogleSheetsSalesDashboard({
    accountIds: shopIds,
    fromDate: monthStart,
    googleSheetsService,
    toDate: monthEnd,
  });
  const netSalesByShopDate = new Map(
    salesDashboard.shopSeries.flatMap((shop) =>
      shop.dailySales.map(
        (sales) =>
          [`${shop.accountId}:${sales.salesDate}`, sales.netSales] as const,
      ),
    ),
  );
  const shopNameById = new Map(
    salesDashboard.shopSeries.map((shop) => [shop.accountId, shop.shopName]),
  );

  return employees
    .filter(
      (employee) =>
        employee.hiredDate <= monthEnd &&
        (!employee.terminatedDate || employee.terminatedDate >= monthStart),
    )
    .map((employee) => {
      const employeeTimesheets = timesheets.filter(
        (timesheet) => timesheet.employeeId === employee.id,
      );
      const workedDates = new Map<string, number>();
      const workedShopDates = new Map<
        string,
        { date: string; shopId: string; units: number }
      >();
      for (const timesheet of employeeTimesheets) {
        if (timesheet.status !== EmployeeTimesheetStatus.Work) continue;
        const date = getBangkokDate(timesheet.createdAt);
        const units = timesheet.workdayType === "half" ? 0.5 : 1;
        workedDates.set(date, Math.max(workedDates.get(date) || 0, units));
        const key = `${timesheet.shopId}:${date}`;
        const existing = workedShopDates.get(key);
        workedShopDates.set(key, {
          date,
          shopId: timesheet.shopId,
          units: Math.max(existing?.units || 0, units),
        });
      }
      const workedDays = Array.from(workedDates.values()).reduce(
        (total, units) => total + units,
        0,
      );
      const leaveDates = new Set(
        employeeTimesheets
          .filter(
            (timesheet) =>
              timesheet.status === EmployeeTimesheetStatus.Leave,
          )
          .map((timesheet) => getBangkokDate(timesheet.createdAt)),
      );
      const compensation = findEffectiveCompensation(
        compensations,
        employee.id,
        monthEnd,
      );
      const baseSalary = compensation?.baseSalary || 0;
      let commission = 0;
      let commissionSales = 0;
      const dailyCommissions: EmployeePayrollDailyCommission[] = [];
      for (const attendance of workedShopDates.values()) {
        const dailyCompensation = findEffectiveCompensation(
          compensations,
          employee.id,
          attendance.date,
        );
        const netSales =
          netSalesByShopDate.get(`${attendance.shopId}:${attendance.date}`) || 0;
        const commissionType =
          dailyCompensation?.commissionType === "sales_bucket"
            ? "sales_bucket"
            : "none";
        let bucketCount = 0;
        let dailyCommission = 0;
        if (dailyCompensation?.commissionType === "sales_bucket") {
          bucketCount = calculateBucketCount({
            netSales,
            bucketSales: dailyCompensation.commissionBucketSales,
            roundupThreshold: dailyCompensation.commissionRoundupThreshold,
          });
          dailyCommission =
            bucketCount *
            dailyCompensation.commissionBucketAmount *
            attendance.units;
        }
        const roundedDailyCommission = roundMoney(dailyCommission);
        dailyCommissions.push({
          date: attendance.date,
          shopId: attendance.shopId,
          shopName: shopNameById.get(attendance.shopId) || attendance.shopId,
          attendanceUnits: attendance.units,
          netSales: roundMoney(netSales),
          commissionType,
          bucketCount,
          commission: roundedDailyCommission,
        });
        if (commissionType !== "sales_bucket") continue;
        commissionSales += netSales * attendance.units;
        commission += roundedDailyCommission;
      }
      dailyCommissions.sort(
        (left, right) =>
          left.date.localeCompare(right.date) ||
          left.shopName.localeCompare(right.shopName),
      );
      const basePay =
        compensation?.compensationType === "daily"
          ? baseSalary * workedDays
          : baseSalary;
      return {
        employeeId: employee.id,
        employeeName: employee.name,
        compensationType: compensation?.compensationType || null,
        effectiveFrom: compensation?.effectiveFrom || "",
        baseSalary,
        commission: roundMoney(commission),
        commissionType: compensation?.commissionType || "none",
        commissionBucketSales: compensation?.commissionBucketSales || 0,
        commissionBucketAmount: compensation?.commissionBucketAmount || 0,
        commissionRoundupThreshold:
          compensation?.commissionRoundupThreshold || 0,
        commissionSales: roundMoney(commissionSales),
        workedDays,
        leaveDays: leaveDates.size,
        basePay: roundMoney(basePay),
        totalPay: roundMoney(basePay + commission),
        dailyCommissions,
      };
    })
    .sort((left, right) => left.employeeName.localeCompare(right.employeeName));
}

function calculateBucketCount({
  netSales,
  bucketSales,
  roundupThreshold,
}: {
  netSales: number;
  bucketSales: number;
  roundupThreshold: number;
}): number {
  if (bucketSales <= 0 || netSales < bucketSales) {
    return 0;
  }
  const fullBuckets = Math.floor(netSales / bucketSales);
  const remainder = netSales % bucketSales;
  const roundedBuckets =
    fullBuckets +
    (roundupThreshold > 0 &&
    roundupThreshold < bucketSales &&
    remainder >= roundupThreshold
      ? 1
      : 0);
  return roundedBuckets;
}

function findEffectiveCompensation(
  compensations: EmployeeCompensation[],
  employeeId: string,
  date: string,
): EmployeeCompensation | undefined {
  return compensations
    .filter(
      (compensation) =>
        compensation.employeeId === employeeId &&
        compensation.effectiveFrom <= date,
    )
    .at(-1);
}

function getMonthEnd(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const day = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, "0")}`;
}

function getBangkokDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).format(date);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
