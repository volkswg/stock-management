import "server-only";
import { createHash } from "node:crypto";
import type { EmployeePayroll } from "../contracts";

// Includes attendance, compensation and advance allocation: stale confirmations fail closed.
export function payrollRevision(record: EmployeePayroll): string {
  return createHash("sha256").update(JSON.stringify(record)).digest("hex");
}
