import type { AdjustmentEmployee } from "../../contracts";

export interface EmployeeDirectory {
  listEmployees(): Promise<AdjustmentEmployee[]>;
}
