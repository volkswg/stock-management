export type EmployeeDirectoryEntry = { id: string; name: string; status: string; hiredDate: string; terminatedDate: string };

export type EmployeeStatus = "active" | "inactive";
export type EmployeeCompensationType = "daily" | "monthly";
export type EmployeeCommissionType = "none" | "sales_bucket";

export type Employee = {
  id: string;
  name: string;
  phone: string;
  status: EmployeeStatus;
  hiredDate: string;
  terminatedDate: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  compensation: EmployeeCompensation | null;
};

export type EmployeeCompensation = {
  employeeId: string;
  baseSalary: number;
  commission: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  effectiveFrom: string;
  compensationType: EmployeeCompensationType;
  commissionType: EmployeeCommissionType;
  commissionBucketSales: number;
  commissionBucketAmount: number;
  commissionRoundupThreshold: number;
};

export type EmployeeInput = {
  name: string;
  phone: string;
  status: EmployeeStatus;
  hiredDate: string;
  terminatedDate: string;
  baseSalary: number;
  commission: number;
  compensationEffectiveFrom: string;
  compensationType: EmployeeCompensationType;
  commissionType: EmployeeCommissionType;
  commissionBucketSales: number;
  commissionBucketAmount: number;
  commissionRoundupThreshold: number;
};


export enum EmployeeTimesheetStatus {
  Work = "work",
  Leave = "leave",
}

export type EmployeeWorkdayType = "full" | "half";

export type EmployeeTimesheet = {
  id: string;
  employeeId: string;
  shopId: string;
  status: EmployeeTimesheetStatus;
  isOpen: boolean;
  createdAt: string;
  updatedAt: string;
  workdayType: EmployeeWorkdayType | null;
};

export type SalaryAdvance = {
  id: string; employeeId: string; shopId: string; requestedDate: string; payrollMonth: string;
  requestedAmount: number; paidAmount: number; status: "requested" | "approved" | "paid" | "cancelled";
  paidDate: string; reference: string; note: string; createdAt: string; updatedAt: string;
};
export type AdvanceDeduction = { id: string; paidDate: string; reference: string; amount: number; deduction: number; balance: number };
export type PayrollSettlement = { id: string; employeeId: string; month: string; paidDate: string; reference: string; createdAt: string; snapshot: EmployeePayroll };

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
  leaveDates: string[];
  basePay: number;
  grossPay: number;
  advanceDeduction: number;
  advanceBalance: number;
  advances: AdvanceDeduction[];
  settlement: { id: string; paidDate: string; reference: string } | null;
  totalPay: number;
  dailyCommissions: EmployeePayrollDailyCommission[];
};


export type PayrollSalesDashboard = { shopSeries: { accountId: string; shopName: string; dailySales: { salesDate: string; netSales: number }[] }[] };
