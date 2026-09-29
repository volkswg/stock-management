import type { IGoogleSheetsService } from "@/externals/google/sheet";
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

export type EmployeePayroll = {
  employeeId: string;
  employeeName: string;
  compensationType: EmployeeCompensationType | null;
  effectiveFrom: string;
  baseSalary: number;
  commission: number;
  workedDays: number;
  leaveDays: number;
  basePay: number;
  totalPay: number;
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
      for (const timesheet of employeeTimesheets) {
        if (timesheet.status !== EmployeeTimesheetStatus.Work) continue;
        const date = getBangkokDate(timesheet.createdAt);
        const units = timesheet.workdayType === "half" ? 0.5 : 1;
        workedDates.set(date, Math.max(workedDates.get(date) || 0, units));
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
      const commission = compensation?.commission || 0;
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
        commission,
        workedDays,
        leaveDays: leaveDates.size,
        basePay: roundMoney(basePay),
        totalPay: roundMoney(basePay + commission),
      };
    })
    .sort((left, right) => left.employeeName.localeCompare(right.employeeName));
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
