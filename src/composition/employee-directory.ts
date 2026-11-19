import "server-only";
import type { BusinessDatabase as Storage } from "@/composition/postgres/service";
import type { EmployeeDirectory } from "@/modules/inventory/application/ports/employee-directory";
import { readEmployeeDirectory } from "@/modules/hr/server";

export function createEmployeeDirectory(storage: Storage, unavailableError: () => Error): EmployeeDirectory {
  return { listEmployees: () => readEmployeeDirectory({ storage, unavailableError }) };
}
