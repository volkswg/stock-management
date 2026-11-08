import "server-only";
import { PostgresRecords } from "@/infrastructure/persistence/postgres/records";
import { EMPLOYEE_HEADERS } from "@/modules/hr/infrastructure/google-sheets/employees/const";
import { EMPLOYEE_COMPENSATION_HEADERS } from "@/modules/hr/infrastructure/google-sheets/employee-compensations/const";
import { EMPLOYEE_TIMESHEET_HEADERS } from "@/modules/hr/infrastructure/google-sheets/employee-timesheets/const";
import { ADVANCE_HEADERS } from "@/modules/hr/infrastructure/google-sheets/employee-advances/const";
import { SETTLEMENT_HEADERS } from "@/modules/hr/infrastructure/google-sheets/employee-advances/const";

export function hrTables() {
  return {
    employees: new PostgresRecords({ table: "employees", headers: EMPLOYEE_HEADERS }),
    employeeCompensations: new PostgresRecords({ table: "employee_compensations", headers: EMPLOYEE_COMPENSATION_HEADERS, key: "migration_id" }),
    employeeTimesheets: new PostgresRecords({ table: "employee_timesheets", headers: EMPLOYEE_TIMESHEET_HEADERS }),
    employeeAdvances: new PostgresRecords({ table: "employee_advances", headers: ADVANCE_HEADERS }),
    payrollSettlements: new PostgresRecords({ table: "payroll_settlements", headers: SETTLEMENT_HEADERS }),
  };
}
