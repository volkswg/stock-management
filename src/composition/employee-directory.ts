import "server-only";
import type { IGoogleSheetsService } from "@/externals/google/sheet/types";
import type { EmployeeDirectory } from "@/modules/inventory/application/ports/employee-directory";
import { readEmployeeDirectory } from "@/modules/hr/server";

export function createEmployeeDirectory(googleSheetsService: IGoogleSheetsService, unavailableError: () => Error): EmployeeDirectory {
  return { listEmployees: () => readEmployeeDirectory({ googleSheetsService, unavailableError }) };
}
