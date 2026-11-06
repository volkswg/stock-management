import type { AdjustmentEmployee } from "../contracts";
import type { EmployeeDirectory } from "./ports/employee-directory";

export function listAdjustmentEmployees(directory: EmployeeDirectory): Promise<AdjustmentEmployee[]> {
  return directory.listEmployees();
}
